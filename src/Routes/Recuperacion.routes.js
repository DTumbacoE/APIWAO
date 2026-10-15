import { Router } from 'express';
const router = Router();
import {
  solicitarCodigo,
  verificarCodigo,
  restablecerContrasena,
} from '../Controladores/RecuperacionCtrl.js';

router.post('/recuperar-contrasena', solicitarCodigo);
router.post('/verificar-codigo', verificarCodigo);
router.post('/restablecer-contrasena', restablecerContrasena);

export default router;