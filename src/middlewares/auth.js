
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { sql } from '../bd.js';

const FRONTEND_URL =
  process.env.FRONTEND_URL;

const hashToken = (valor) =>
  crypto.createHash('sha256').update(valor).digest('hex');

export const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    let token = null;
    let autenticacionPorCookie = false;

    // 1. Autenticación Bearer para clientes compatibles
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2. Autenticación web mediante cookie HttpOnly
    if (!token && req.cookies?.wao_session) {
      token = req.cookies.wao_session;
      autenticacionPorCookie = true;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión nuevamente'
      });
    }

    // 3. Comprobar origen en solicitudes que modifican datos
    if (
      autenticacionPorCookie &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    ) {
      const origen = req.get('Origin');

      if (origen !== FRONTEND_URL) {
        return res.status(403).json({
          success: false,
          message: 'Origen no autorizado'
        });
      }
    }

    // 4. Verificar firma y expiración del JWT
    let datosToken;

    try {
      datosToken = jwt.verify(
        token,
        process.env.JWT_SECRET,
        { algorithms: ['HS256'] }
      );
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    const idUsuario = Number(datosToken.id_usuario);

    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // 5. Validar que las cookies contengan sesiones web
    if (autenticacionPorCookie) {
      if (
        datosToken.tipo_sesion !== 'web' ||
        typeof datosToken.jti !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(datosToken.jti)
      ) {
        return res.status(401).json({
          success: false,
          message: 'Sesión web inválida'
        });
      }

      const jtiHash = hashToken(datosToken.jti);

      // 6. Consultar la sesión registrada en MySQL
      const [sesiones] = await sql.query(
        `SELECT id_sesion
         FROM SesionesWeb
         WHERE id_usuario = ?
           AND jti_hash = ?
           AND fecha_revocacion IS NULL
           AND fecha_expiracion > UTC_TIMESTAMP()
         LIMIT 1`,
        [idUsuario, jtiHash]
      );

      if (sesiones.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'La sesión ha expirado o fue cerrada'
        });
      }

      req.sesionWeb = {
        id_sesion: sesiones[0].id_sesion,
        jtiHash
      };
    } else {
      // Impedir que un JWT exclusivo de cookies web
      // sea reutilizado como Bearer.
      if (datosToken.tipo_sesion === 'web') {
        return res.status(401).json({
          success: false,
          message: 'Tipo de autenticación no permitido'
        });
      }
    }

    // 7. Verificar el estado actual del usuario
    const [usuarios] = await sql.query(
      `SELECT
         id_usuario,
         correo,
         id_rol,
         estado_cuenta,
         correo_verificado
       FROM Usuarios
       WHERE id_usuario = ?
       LIMIT 1`,
      [idUsuario]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];

    if (usuario.estado_cuenta !== 'activo') {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta se encuentra suspendida o desactivada'
      });
    }

    if (Number(usuario.correo_verificado) !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Debes verificar tu correo electrónico'
      });
    }

    // 8. Utilizar información actualizada de MySQL
    req.usuario = {
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      id_rol: usuario.id_rol
    };

    next();

  } catch (error) {
    console.error('Error verificando autenticación:', error);

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
