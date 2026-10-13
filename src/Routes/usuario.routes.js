import { Router } from 'express';

import {
    crearUsuario,
    loginUsuario,
    perfilUsuario,
    actualizarContrasena
} from '../Controladores/UsuariosCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

router.post('/registro', crearUsuario);

router.post('/login', loginUsuario);

router.get(
    '/perfil',
    verificarToken,
    perfilUsuario
);

router.put(
    '/contrasena/:id_usuario',
    verificarToken,
    actualizarContrasena
);

export default router;  