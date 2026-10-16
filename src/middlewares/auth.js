
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { sql } from '../bd.js';

// ============================================================
// UTILIDADES
// ============================================================

const hashToken = (valor) =>
    crypto.createHash('sha256')
        .update(valor)
        .digest('hex');

const origenFrontend = () => {
    try {
        const url = new URL(process.env.FRONTEND_URL);

        if (url.protocol !== 'https:') {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
};

const respuestaNoAutorizada = (res, mensaje) =>
    res.status(401).json({
        success: false,
        message: mensaje
    });

const compararSeguro = (a, b) => {
    if (
        typeof a !== 'string' ||
        typeof b !== 'string'
    ) {
        return false;
    }

    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    return (
        bufferA.length === bufferB.length &&
        crypto.timingSafeEqual(bufferA, bufferB)
    );
};

// La huella cambia cuando cambia password_hash.
// No exponemos el hash bcrypt en el JWT.
export const generarHuellaMovil = (
    idUsuario,
    passwordHash
) => {
    const secreto = process.env.JWT_SECRET;

    if (
        typeof secreto !== 'string' ||
        !secreto
    ) {
        throw new Error('JWT_SECRET no configurado');
    }

    return crypto.createHmac('sha256', secreto)
        .update(
            `wao-movil:${idUsuario}:${passwordHash}`
        )
        .digest('hex');
};

// ============================================================
// VERIFICAR TOKEN
// ============================================================

export const verificarToken = async (req, res, next) => {
    try {
        const autorizacion = req.get('Authorization');

        let token = null;
        let autenticacionPorCookie = false;

        // Bearer exclusivamente para clientes móviles.
        if (autorizacion) {
            const coincidencia =
                /^Bearer\s+(\S+)$/i.exec(autorizacion.trim());

            if (!coincidencia) {
                return respuestaNoAutorizada(
                    res,
                    'Encabezado de autorización inválido'
                );
            }

            token = coincidencia[1];
        } else if (req.cookies?.wao_session) {
            // Cookie HttpOnly para Flutter Web.
            token = req.cookies.wao_session;
            autenticacionPorCookie = true;
        }

        if (!token) {
            return respuestaNoAutorizada(
                res,
                'Debes iniciar sesión nuevamente'
            );
        }

        // ====================================================
        // PROTECCIÓN DE SOLICITUDES WEB
        // ====================================================

        if (
            autenticacionPorCookie &&
            !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
        ) {
            const permitido = origenFrontend();
            const origen = req.get('Origin');

            if (
                !permitido ||
                !origen ||
                origen !== permitido
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'Origen no autorizado'
                });
            }
        }

        // ====================================================
        // VERIFICAR JWT
        // ====================================================

        let datosToken;

        try {
            datosToken = jwt.verify(
                token,
                process.env.JWT_SECRET,
                {
                    algorithms: ['HS256']
                }
            );
        } catch {
            return respuestaNoAutorizada(
                res,
                'Token inválido o expirado'
            );
        }

        if (
            !datosToken ||
            typeof datosToken !== 'object'
        ) {
            return respuestaNoAutorizada(
                res,
                'Token inválido'
            );
        }

        const idUsuario = Number(
            datosToken.id_usuario
        );

        if (
            !Number.isSafeInteger(idUsuario) ||
            idUsuario <= 0
        ) {
            return respuestaNoAutorizada(
                res,
                'Token inválido'
            );
        }

        // ====================================================
        // VALIDAR TIPO DE SESIÓN
        // ====================================================

        if (autenticacionPorCookie) {
            if (
                datosToken.tipo_sesion !== 'web' ||
                typeof datosToken.jti !== 'string' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    datosToken.jti
                )
            ) {
                return respuestaNoAutorizada(
                    res,
                    'Sesión web inválida'
                );
            }

            const jtiHash = hashToken(
                datosToken.jti
            );

            const [sesiones] = await sql.query(
                `SELECT id_sesion
                 FROM SesionesWeb
                 WHERE id_usuario = ?
                   AND jti_hash = ?
                   AND fecha_revocacion IS NULL
                   AND fecha_expiracion > UTC_TIMESTAMP()
                 LIMIT 1`,
                [
                    idUsuario,
                    jtiHash
                ]
            );

            if (!sesiones.length) {
                return respuestaNoAutorizada(
                    res,
                    'La sesión ha expirado o fue cerrada'
                );
            }

            req.sesionWeb = {
                id_sesion: sesiones[0].id_sesion,
                jtiHash
            };

        } else if (
            datosToken.tipo_sesion !== 'movil'
        ) {
            return respuestaNoAutorizada(
                res,
                'Tipo de autenticación no permitido'
            );
        }

        // ====================================================
        // CONSULTAR ESTADO ACTUAL DEL USUARIO
        // ====================================================

        const [usuarios] = await sql.query(
            `SELECT
                id_usuario,
                correo,
                id_rol,
                estado_cuenta,
                correo_verificado,
                password_hash
             FROM Usuarios
             WHERE id_usuario = ?
             LIMIT 1`,
            [idUsuario]
        );

        if (!usuarios.length) {
            return respuestaNoAutorizada(
                res,
                'Usuario no encontrado'
            );
        }

        const usuario = usuarios[0];

        if (usuario.estado_cuenta !== 'activo') {
            return res.status(403).json({
                success: false,
                message:
                    'Tu cuenta se encuentra suspendida o desactivada'
            });
        }

        if (Number(usuario.correo_verificado) !== 1) {
            return res.status(403).json({
                success: false,
                message:
                    'Debes verificar tu correo electrónico'
            });
        }

        // ====================================================
        // REVOCACIÓN DE JWT MÓVILES
        // ====================================================

        if (!autenticacionPorCookie) {
            const huellaActual = generarHuellaMovil(
                usuario.id_usuario,
                usuario.password_hash
            );

            if (
                !compararSeguro(
                    datosToken.huella_sesion,
                    huellaActual
                )
            ) {
                return respuestaNoAutorizada(
                    res,
                    'Tu sesión ya no es válida. Inicia sesión nuevamente'
                );
            }
        }

        // No enviar password_hash a los controladores.
        req.usuario = {
            id_usuario: usuario.id_usuario,
            correo: usuario.correo,
            id_rol: usuario.id_rol
        };

        return next();

    } catch (error) {
        console.error(
            'Error verificando autenticación:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
