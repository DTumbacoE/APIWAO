
import { Router } from 'express';
import multer from 'multer';

import { verificarToken } from '../middlewares/auth.js';

import {
  editarPerfil,
  cambiarContrasenaSegura,
  subirFoto,
  borrarFoto,
} from '../Controladores/PerfilCtrl.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const formatosPermitidos = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!formatosPermitidos.includes(file.mimetype)) {
      return cb(new Error('Formato de imagen no permitido'));
    }

    cb(null, true);
  },
});

// Todas las operaciones requieren autenticación.
router.use(verificarToken);

// Editar información personal.
router.put('/', editarPerfil);

// Cambiar contraseña.
router.put('/cambiar-contrasena', cambiarContrasenaSegura);

// Subir o reemplazar foto de perfil.
router.post(
  '/foto-perfil',
  (req, res, next) => {
    upload.single('foto')(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message:
            error.code === 'LIMIT_FILE_SIZE'
              ? 'La imagen no puede superar los 5 MB'
              : 'Imagen inválida o formato no permitido',
        });
      }

      next();
    });
  },
  subirFoto
);

// Eliminar foto de perfil.
router.delete('/foto-perfil', borrarFoto);

export default router;
