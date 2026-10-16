
import { Router } from 'express';

import {
  crearUsuario,
  loginUsuario,
  loginUsuarioWeb,
  logoutUsuarioWeb,
  perfilUsuario,
  verificarCorreo,
  reenviarVerificacion
} from '../Controladores/UsuariosCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Registro de usuarios
router.post('/registro', crearUsuario);

// Login móvil mediante JWT Bearer
router.post('/login', loginUsuario);

// Login web mediante cookie HttpOnly
router.post('/login-web', loginUsuarioWeb);

// Cierre de sesión web
router.post(
  '/logout-web',
  verificarToken,
  (req, res, next) => {
    if (!req.sesionWeb) {
      return res.status(401).json({
        success: false,
        message: 'Se requiere una sesión web'
      });
    }

    next();
  },
  logoutUsuarioWeb
);

// Verificación de correo
router.get('/verificar-correo', verificarCorreo);

// Reenvío de verificación
router.post('/reenviar-verificacion', reenviarVerificacion);

// Validación de sesión
router.get('/validar-token', verificarToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Sesión válida',
    usuario: req.usuario
  });
});

// Perfil del usuario autenticado
router.get('/perfil', verificarToken, perfilUsuario);

export default router;
