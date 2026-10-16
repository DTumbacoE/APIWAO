
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

router.post('/registro', crearUsuario);

// Login tradicional para clientes que usan Bearer
router.post('/login', loginUsuario);

// Login exclusivo de Flutter Web con cookie HttpOnly
router.post('/login-web', loginUsuarioWeb);

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

router.get('/verificar-correo', verificarCorreo);
router.post('/reenviar-verificacion', reenviarVerificacion);

router.get('/validar-token', verificarToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Sesión válida',
    usuario: req.usuario
  });
});

router.get('/perfil', verificarToken, perfilUsuario);

export default router;
