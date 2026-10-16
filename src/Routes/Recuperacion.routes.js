
import { Router } from 'express';

import {
    solicitarCodigo,
    verificarCodigo,
    restablecerContrasena
} from '../Controladores/RecuperacionCtrl.js';

const router = Router();

// Solicitar código de recuperación por correo.
router.post(
    '/recuperar-contrasena',
    solicitarCodigo
);

// Verificar código de seis dígitos.
router.post(
    '/verificar-codigo',
    verificarCodigo
);

// Establecer nueva contraseña con token temporal.
router.post(
    '/restablecer-contrasena',
    restablecerContrasena
);

export default router;
