import jwt from 'jsonwebtoken';
import { sql } from '../bd.js';

export const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token requerido',
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token requerido',
      });
    }

    let datosToken;

    try {
      datosToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado',
      });
    }

    const idUsuario = Number(datosToken.id_usuario);

    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }

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
        message: 'Usuario no encontrado',
      });
    }

    const usuario = usuarios[0];

    if (usuario.estado_cuenta !== 'activo') {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta se encuentra suspendida o desactivada',
      });
    }

    if (Number(usuario.correo_verificado) !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Debes verificar tu correo electrónico',
      });
    }

    // Utilizamos los datos actuales de MySQL,
    // no los roles antiguos almacenados en el JWT.
    req.usuario = {
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      id_rol: usuario.id_rol,
    };

    next();
  } catch (error) {
    console.error('Error verificando autenticación:', error);

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};