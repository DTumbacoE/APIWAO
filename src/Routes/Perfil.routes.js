
import { Router } from 'express';
import multer from 'multer';

import { verificarToken } from '../middlewares/auth.js';

import {
    editarPerfil,
    cambiarContrasenaSegura,
    subirFoto,
    borrarFoto
} from '../Controladores/PerfilCtrl.js';

const router = Router();

const TIPOS_PERMITIDOS = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1
    },
    fileFilter: (_req, file, cb) => {
        if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
            return cb(new Error('FORMATO_INVALIDO'));
        }

        cb(null, true);
    }
});

const procesarFoto = (req, res, next) => {
    upload.single('foto')(req, res, (error) => {
        if (!error) return next();

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                message: 'La imagen supera los 5 MB'
            });
        }

        if (error.message === 'FORMATO_INVALIDO') {
            return res.status(400).json({
                success: false,
                message: 'Solo se permiten imágenes JPG, PNG o WebP'
            });
        }

        return res.status(400).json({
            success: false,
            message: 'No se pudo procesar la imagen'
        });
    });
};

// Todas las operaciones requieren autenticación.
router.use(verificarToken);

// Editar información personal.
router.put('/', editarPerfil);

// Cambiar contraseña.
router.put('/cambiar-contrasena', cambiarContrasenaSegura);

// Subir o reemplazar fotografía.
router.post('/foto-perfil', procesarFoto, subirFoto);

// Eliminar fotografía.
router.delete('/foto-perfil', borrarFoto);

export default router;
