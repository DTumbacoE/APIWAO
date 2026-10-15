import { Router } from 'express';

import {
  crearUsuario,
  loginUsuario,
  perfilUsuario,
  verificarCorreo,
  reenviarVerificacion
} from '../Controladores/UsuariosCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);

router.get('/verificar-correo', verificarCorreo);
router.post('/reenviar-verificacion', reenviarVerificacion);

router.get('/validar-token', verificarToken, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Token válido',
    usuario: req.usuario
  });
});

router.get('/perfil', verificarToken, perfilUsuario);

export default router;