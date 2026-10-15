import {
  solicitarCodigo,
  verificarCodigo,
  restablecerContrasena,
} from '../Controladores/RecuperacionCtrl.js';

router.post('/recuperar-contrasena', solicitarCodigo);
router.post('/verificar-codigo', verificarCodigo);
router.post('/restablecer-contrasena', restablecerContrasena);