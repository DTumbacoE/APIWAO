import { Router } from 'express';
import { crearUsuario, loginUsuario, perfilUsuario, actualizarContrasena, verificarCorreo, reenviarVerificacion } from '../Controladores/UsuariosCtrl.js';
import { verificarToken } from '../middlewares/auth.js';

const router = Router();
router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);
router.get('/verificar-correo', verificarCorreo);
router.post('/reenviar-verificacion', reenviarVerificacion);
router.get('/perfil', verificarToken, perfilUsuario);
router.put('/contrasena/:id_usuario', verificarToken, actualizarContrasena);
router.get('/validar-token', verificarToken, async (req,res) => {
  try {
    const [filas] = await (await import('../bd.js')).sql.query(`SELECT id_usuario FROM Usuarios WHERE id_usuario = ? AND estado_cuenta = 'activo' AND correo_verificado = 1 LIMIT 1`,[req.usuario.id_usuario]);
    return filas.length ? res.json({success:true}) : res.status(403).json({success:false});
  } catch (error) { console.error(error); return res.status(500).json({success:false}); }
});
export default router;
