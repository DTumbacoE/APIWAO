
import bcrypt from 'bcrypt';
import { sql } from '../bd.js';

import {
    subirFotoPerfil,
    eliminarFotoPerfil
} from '../Services/Cloudinary.js';

import { fileTypeFromBuffer } from 'file-type';

// ============================================================
// UTILIDADES
// ============================================================

const idDe = (req) => req.usuario.id_usuario;

const limpiar = (valor, maximo, requerido = false) => {
    if (typeof valor !== 'string') return null;

    const texto = valor.trim();

    if ((requerido && !texto) || texto.length > maximo) {
        return null;
    }

    return texto;
};

const errorServidor = (res, contexto, error) => {
    console.error(contexto, error);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

const eliminarEnSegundoPlano = (publicId) => {
    if (!publicId) return;

    eliminarFotoPerfil(publicId).catch((error) => {
        console.error('No se pudo eliminar imagen antigua:', error);
    });
};

// ============================================================
// EDITAR PERFIL
// ============================================================

export const editarPerfil = async (req, res) => {
    const body = req.body ?? {};

    const permitidos = [
        'nombre',
        'apellido',
        'telefono',
        'direccion'
    ];

    if (
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some(
            (campo) => !permitidos.includes(campo)
        )
    ) {
        return res.status(400).json({
            success: false,
            message: 'Se enviaron campos no permitidos'
        });
    }

    if (
        !permitidos.some(
            (campo) => Object.hasOwn(body, campo)
        )
    ) {
        return res.status(400).json({
            success: false,
            message: 'No se enviaron cambios'
        });
    }

    const campos = [];
    const valores = [];

    const definiciones = [
        ['nombre', 100, true],
        ['apellido', 100, true],
        ['telefono', 20, false],
        ['direccion', 255, false]
    ];

    for (const [campo, maximo, requerido] of definiciones) {
        if (!Object.hasOwn(body, campo)) continue;

        const valor = limpiar(body[campo], maximo, requerido);

        if (valor === null) {
            return res.status(400).json({
                success: false,
                message: `Campo ${campo} inválido`
            });
        }

        campos.push(`${campo} = ?`);
        valores.push(valor || null);
    }

    try {
        const [resultado] = await sql.query(
            `UPDATE Usuarios
             SET ${campos.join(', ')}
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1`,
            [...valores, idDe(req)]
        );

        if (resultado.affectedRows === 0) {
            return res.status(403).json({
                success: false,
                message: 'Cuenta no disponible'
            });
        }

        const [usuarios] = await sql.query(
            `SELECT
                id_usuario,
                nombre,
                apellido,
                correo,
                telefono,
                direccion,
                foto_perfil_url,
                id_rol
             FROM Usuarios
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
             LIMIT 1`,
            [idDe(req)]
        );

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            usuario: usuarios[0]
        });

    } catch (error) {
        return errorServidor(res, 'Editar perfil:', error);
    }
};

// ============================================================
// CAMBIAR CONTRASEÑA
// ============================================================

export const cambiarContrasenaSegura = async (req, res) => {
    const {
        contrasenaActual,
        contrasenaNueva
    } = req.body ?? {};

    if (
        typeof contrasenaActual !== 'string' ||
        typeof contrasenaNueva !== 'string' ||
        contrasenaNueva.length < 12 ||
        contrasenaNueva.length > 128 ||
        contrasenaNueva === contrasenaActual
    ) {
        return res.status(400).json({
            success: false,
            message:
                'La nueva contraseña debe tener entre 12 y ' +
                '128 caracteres y ser diferente de la actual'
        });
    }

    let conn;

    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();

        const [usuarios] = await conn.query(
            `SELECT password_hash
             FROM Usuarios
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
             LIMIT 1
             FOR UPDATE`,
            [idDe(req)]
        );

        if (
            !usuarios.length ||
            !(await bcrypt.compare(
                contrasenaActual,
                usuarios[0].password_hash
            ))
        ) {
            await conn.rollback();

            return res.status(401).json({
                success: false,
                message: 'Contraseña actual incorrecta'
            });
        }

        const nuevoHash = await bcrypt.hash(
            contrasenaNueva,
            12
        );

        await conn.query(
            `UPDATE Usuarios
             SET password_hash = ?
             WHERE id_usuario = ?`,
            [nuevoHash, idDe(req)]
        );

        await conn.query(
            `UPDATE SesionesWeb
             SET fecha_revocacion = UTC_TIMESTAMP()
             WHERE id_usuario = ?
               AND fecha_revocacion IS NULL`,
            [idDe(req)]
        );

        await conn.commit();

        res.clearCookie('wao_session', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            path: '/'
        });

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            message:
                'Contraseña actualizada. Inicia sesión nuevamente.'
        });

    } catch (error) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (e) {
                console.error('Error rollback:', e);
            }
        }

        return errorServidor(res, 'Cambiar contraseña:', error);

    } finally {
        if (conn) conn.release();
    }
};

// ============================================================
// SUBIR O REEMPLAZAR FOTO DE PERFIL
// ============================================================

export const subirFoto = async (req, res) => {
    if (
        !req.file ||
        !Buffer.isBuffer(req.file.buffer) ||
        req.file.buffer.length === 0 ||
        req.file.buffer.length > 5 * 1024 * 1024
    ) {
        return res.status(400).json({
            success: false,
            message:
                'Selecciona una imagen JPG, PNG o WebP de hasta 5 MB'
        });
    }

    let nueva = null;
    let guardada = false;

    try {
        const tipoReal = await fileTypeFromBuffer(
            req.file.buffer
        );

        const permitidos = new Set([
            'image/jpeg',
            'image/png',
            'image/webp'
        ]);

        if (!tipoReal || !permitidos.has(tipoReal.mime)) {
            return res.status(400).json({
                success: false,
                message: 'El archivo no es una imagen válida'
            });
        }

        if (req.file.mimetype !== tipoReal.mime) {
            return res.status(400).json({
                success: false,
                message: 'El formato declarado no coincide con la imagen'
            });
        }

        const [usuarios] = await sql.query(
            `SELECT foto_perfil_public_id
             FROM Usuarios
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
             LIMIT 1`,
            [idDe(req)]
        );

        if (!usuarios.length) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const anterior = usuarios[0].foto_perfil_public_id;

        nueva = await subirFotoPerfil(
            req.file.buffer,
            idDe(req)
        );

        // Actualización condicional:
        // solo cambia la foto si nadie la modificó antes.
        const [resultado] = await sql.query(
            `UPDATE Usuarios
             SET foto_perfil_url = ?,
                 foto_perfil_public_id = ?
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
               AND foto_perfil_public_id <=> ?`,
            [
                nueva.url,
                nueva.publicId,
                idDe(req),
                anterior
            ]
        );

        if (resultado.affectedRows !== 1) {
            await eliminarFotoPerfil(nueva.publicId)
                .catch((error) => {
                    console.error(
                        'No se pudo limpiar la foto nueva:',
                        error
                    );
                });

            nueva = null;

            return res.status(409).json({
                success: false,
                message:
                    'La fotografía cambió durante la operación. ' +
                    'Inténtalo nuevamente.'
            });
        }

        guardada = true;

        // Eliminar el recurso anterior solo después de
        // confirmar que MySQL guardó la nueva fotografía.
        eliminarEnSegundoPlano(anterior);

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            foto_perfil_url: nueva.url
        });

    } catch (error) {
        if (nueva && !guardada) {
            await eliminarFotoPerfil(nueva.publicId)
                .catch((e) => {
                    console.error(
                        'No se pudo limpiar foto fallida:',
                        e
                    );
                });
        }

        return errorServidor(res, 'Subir foto:', error);
    }
};

// ============================================================
// ELIMINAR FOTO DE PERFIL
// ============================================================

export const borrarFoto = async (req, res) => {
    try {
        const [usuarios] = await sql.query(
            `SELECT foto_perfil_public_id
             FROM Usuarios
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
             LIMIT 1`,
            [idDe(req)]
        );

        if (!usuarios.length) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const anterior = usuarios[0].foto_perfil_public_id;

        if (!anterior) {
            return res.json({
                success: true,
                foto_perfil_url: null
            });
        }

        const [resultado] = await sql.query(
            `UPDATE Usuarios
             SET foto_perfil_url = NULL,
                 foto_perfil_public_id = NULL
             WHERE id_usuario = ?
               AND estado_cuenta = 'activo'
               AND correo_verificado = 1
               AND foto_perfil_public_id = ?`,
            [idDe(req), anterior]
        );

        if (resultado.affectedRows !== 1) {
            return res.status(409).json({
                success: false,
                message:
                    'La fotografía cambió durante la operación. ' +
                    'Inténtalo nuevamente.'
            });
        }

        eliminarEnSegundoPlano(anterior);

        res.setHeader('Cache-Control', 'no-store');

        return res.json({
            success: true,
            foto_perfil_url: null
        });

    } catch (error) {
        return errorServidor(res, 'Eliminar foto:', error);
    }
};
