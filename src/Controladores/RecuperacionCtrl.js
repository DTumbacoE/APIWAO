
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { sql } from '../bd.js';
import { enviarCodigoRecuperacion } from '../Services/CorreoService.js';

// ============================================================
// CONFIGURACIÓN
// ============================================================

const mensajeGenerico =
    'Si el correo corresponde a una cuenta activa, recibirás un código de recuperación.';

const correoNormalizado = (valor) =>
    typeof valor === 'string'
        ? valor.trim().toLowerCase()
        : '';

const correoValido = (correo) =>
    correo.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

const hash = (valor) =>
    crypto.createHash('sha256')
        .update(valor)
        .digest('hex');

const hashCodigo = (id, codigo) => {
    const secreto = process.env.RESET_CODE_SECRET;

    if (!secreto || secreto.length < 32) {
        throw new Error('RESET_CODE_SECRET no configurado');
    }

    return crypto.createHmac('sha256', secreto)
        .update(`${id}:${codigo}`)
        .digest('hex');
};

const respuestaCodigoInvalido = (res) =>
    res.status(400).json({
        success: false,
        message: 'Código inválido o vencido'
    });

const registrarError = (contexto, error) => {
    console.error(contexto, error);
};

// ============================================================
// 1. SOLICITAR CÓDIGO DE RECUPERACIÓN
// ============================================================

export async function solicitarCodigo(req, res) {
    const correo = correoNormalizado(req.body?.correo);

    if (!correoValido(correo)) {
        return res.status(400).json({
            success: false,
            message: 'Correo inválido'
        });
    }

    let conn;

    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();

        // Bloqueo por usuario para evitar solicitudes simultáneas
        // que generen varios códigos.
        const [usuarios] = await conn.query(
            `SELECT id_usuario, nombre
             FROM Usuarios
             WHERE correo = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
             LIMIT 1
             FOR UPDATE`,
            [correo]
        );

        if (!usuarios.length) {
            await conn.commit();

            return res.json({
                success: true,
                message: mensajeGenerico
            });
        }

        const usuario = usuarios[0];

        // Enfriamiento de dos minutos.
        const [anteriores] = await conn.query(
            `SELECT id_recuperacion
             FROM RecuperacionContrasena
             WHERE id_usuario = ?
               AND fecha_creacion >
                   DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)
             LIMIT 1`,
            [usuario.id_usuario]
        );

        if (anteriores.length) {
            await conn.commit();

            return res.json({
                success: true,
                message: mensajeGenerico
            });
        }

        // Invalidar códigos y tokens anteriores.
        await conn.query(
            `UPDATE RecuperacionContrasena
             SET fecha_uso = COALESCE(
                     fecha_uso,
                     UTC_TIMESTAMP()
                 ),
                 fecha_expiracion = UTC_TIMESTAMP(),
                 token_reset_hash = NULL,
                 fecha_expiracion_token = NULL
             WHERE id_usuario = ?
               AND (
                   fecha_uso IS NULL
                   OR token_reset_hash IS NOT NULL
               )`,
            [usuario.id_usuario]
        );

        const codigo = crypto.randomInt(0, 1000000)
            .toString()
            .padStart(6, '0');

        await conn.query(
            `INSERT INTO RecuperacionContrasena (
                id_usuario,
                codigo_hash,
                fecha_creacion,
                fecha_expiracion
             )
             VALUES (
                ?, ?,
                UTC_TIMESTAMP(),
                DATE_ADD(
                    UTC_TIMESTAMP(),
                    INTERVAL 10 MINUTE
                )
             )`,
            [
                usuario.id_usuario,
                hashCodigo(usuario.id_usuario, codigo)
            ]
        );

        await conn.commit();

        // Enviar después de confirmar la transacción.
        try {
            await enviarCodigoRecuperacion({
                correo,
                nombre: usuario.nombre,
                codigo
            });
        } catch (errorCorreo) {
            registrarError(
                'Error enviando código de recuperación:',
                errorCorreo
            );
        }

        return res.json({
            success: true,
            message: mensajeGenerico
        });

    } catch (error) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                registrarError('Error en rollback:', rollbackError);
            }
        }

        registrarError('Error solicitando recuperación:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo procesar la solicitud'
        });

    } finally {
        if (conn) conn.release();
    }
}

// ============================================================
// 2. VERIFICAR CÓDIGO DE RECUPERACIÓN
// ============================================================

export async function verificarCodigo(req, res) {
    const correo = correoNormalizado(req.body?.correo);
    const codigo = req.body?.codigo;

    if (
        !correoValido(correo) ||
        typeof codigo !== 'string' ||
        !/^\d{6}$/.test(codigo)
    ) {
        return respuestaCodigoInvalido(res);
    }

    let conn;

    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();

        const [usuarios] = await conn.query(
            `SELECT id_usuario
             FROM Usuarios
             WHERE correo = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
             LIMIT 1`,
            [correo]
        );

        if (!usuarios.length) {
            await conn.rollback();
            return respuestaCodigoInvalido(res);
        }

        const idUsuario = usuarios[0].id_usuario;

        const [filas] = await conn.query(
            `SELECT
                id_recuperacion,
                codigo_hash,
                intentos
             FROM RecuperacionContrasena
             WHERE id_usuario = ?
               AND fecha_uso IS NULL
               AND fecha_expiracion > UTC_TIMESTAMP()
             ORDER BY id_recuperacion DESC
             LIMIT 1
             FOR UPDATE`,
            [idUsuario]
        );

        const registro = filas[0];

        if (
            !registro ||
            Number(registro.intentos) >= 5
        ) {
            await conn.rollback();
            return respuestaCodigoInvalido(res);
        }

        const hashRecibido = hashCodigo(idUsuario, codigo);

        // Comparar buffers de longitud fija.
        const hashGuardado = Buffer.from(
            registro.codigo_hash,
            'hex'
        );

        const hashEsperado = Buffer.from(
            hashRecibido,
            'hex'
        );

        const coincide =
            hashGuardado.length === 32 &&
            hashEsperado.length === 32 &&
            crypto.timingSafeEqual(
                hashGuardado,
                hashEsperado
            );

        if (!coincide) {
            await conn.query(
                `UPDATE RecuperacionContrasena
                 SET intentos = intentos + 1
                 WHERE id_recuperacion = ?`,
                [registro.id_recuperacion]
            );

            await conn.commit();
            return respuestaCodigoInvalido(res);
        }

        // Token aleatorio de 256 bits.
        const resetToken = crypto.randomBytes(32)
            .toString('hex');

        await conn.query(
            `UPDATE RecuperacionContrasena
             SET fecha_uso = UTC_TIMESTAMP(),
                 token_reset_hash = ?,
                 fecha_expiracion_token =
                     DATE_ADD(
                         UTC_TIMESTAMP(),
                         INTERVAL 5 MINUTE
                     )
             WHERE id_recuperacion = ?`,
            [
                hash(resetToken),
                registro.id_recuperacion
            ]
        );

        await conn.commit();

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            message: 'Código verificado',
            resetToken
        });

    } catch (error) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                registrarError('Error en rollback:', rollbackError);
            }
        }

        registrarError('Error verificando código:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });

    } finally {
        if (conn) conn.release();
    }
}

// ============================================================
// 3. RESTABLECER CONTRASEÑA
// ============================================================

export async function restablecerContrasena(req, res) {
    const {
        resetToken,
        nuevaContrasena
    } = req.body || {};

    if (
        typeof resetToken !== 'string' ||
        !/^[a-f0-9]{64}$/.test(resetToken) ||
        typeof nuevaContrasena !== 'string' ||
        nuevaContrasena.length < 8 ||
        nuevaContrasena.length > 128 ||
        !nuevaContrasena.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: 'Datos de restablecimiento inválidos'
        });
    }

    let conn;

    try {
        // Calcular el hash antes de bloquear registros.
        const passwordHash = await bcrypt.hash(
            nuevaContrasena,
            12
        );

        conn = await sql.getConnection();
        await conn.beginTransaction();

        const [filas] = await conn.query(
            `SELECT
                r.id_recuperacion,
                r.id_usuario
             FROM RecuperacionContrasena r
             INNER JOIN Usuarios u
                ON u.id_usuario = r.id_usuario
             WHERE r.token_reset_hash = ?
               AND r.fecha_expiracion_token > UTC_TIMESTAMP()
               AND u.estado_cuenta = 'activo'
               AND u.correo_verificado = 1
             LIMIT 1
             FOR UPDATE`,
            [hash(resetToken)]
        );

        if (!filas.length) {
            await conn.rollback();

            return res.status(400).json({
                success: false,
                message: 'Autorización inválida o vencida'
            });
        }

        const registro = filas[0];

        // Actualizar contraseña.
        await conn.query(
            `UPDATE Usuarios
             SET password_hash = ?
             WHERE id_usuario = ?`,
            [
                passwordHash,
                registro.id_usuario
            ]
        );

        // Invalidar todos los códigos y tokens pendientes.
        await conn.query(
            `UPDATE RecuperacionContrasena
             SET fecha_uso = COALESCE(
                     fecha_uso,
                     UTC_TIMESTAMP()
                 ),
                 token_reset_hash = NULL,
                 fecha_expiracion_token = NULL,
                 fecha_expiracion = UTC_TIMESTAMP()
             WHERE id_usuario = ?`,
            [registro.id_usuario]
        );

        // Revocar todas las sesiones web de este usuario.
        await conn.query(
            `UPDATE SesionesWeb
             SET fecha_revocacion = UTC_TIMESTAMP()
             WHERE id_usuario = ?
               AND fecha_revocacion IS NULL`,
            [registro.id_usuario]
        );

        await conn.commit();

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            message: 'Contraseña actualizada correctamente'
        });

    } catch (error) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                registrarError('Error en rollback:', rollbackError);
            }
        }

        registrarError(
            'Error restableciendo contraseña:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar la contraseña'
        });

    } finally {
        if (conn) conn.release();
    }
}
