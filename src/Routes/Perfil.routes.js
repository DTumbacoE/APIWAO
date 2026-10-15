
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
    console.log('Archivo recibido por Multer:', {
      campo: file.fieldname,
      nombre: file.originalname,
      tipoMIME: file.mimetype,
    });

    const formatosPermitidos = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!formatosPermitidos.includes(file.mimetype)) {
      return cb(
        new Error(`Formato no permitido: ${file.mimetype}`)
      );
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
    upload.single('foto')(req, res, (err) => {
      if (err) {
        console.error('Error Multer:', {
          mensaje: err.message,
          codigo: err.code,
        });

        return res.status(400).json({
          success: false,
          message:
            err.code === 'LIMIT_FILE_SIZE'
              ? 'La imagen supera los 5 MB'
              : err.message,
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
