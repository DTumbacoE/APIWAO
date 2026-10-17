import multer from 'multer';

import { Router } from 'express';

import {
    crearImagen,
    subirImagenSegura,
    obtenerImagenes,
    obtenerImagen,
    obtenerImagenesPorNegocio,
    actualizarImagen,
    eliminarImagen
} from '../Controladores/ImagenesCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

const cargaGaleria = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 }
});
router.post('/subir', verificarToken, (req, res, next) => {
    cargaGaleria.single('imagen')(req, res, (error) => {
        if (error) return res.status(400).json({ success: false, message: 'Archivo inválido o superior a 5 MB' });
        next();
    });
}, subirImagenSegura);
router.post('/', verificarToken, crearImagen);

router.get('/', verificarToken, obtenerImagenes);

router.get(
    '/negocio/:id_negocio',
    verificarToken,
    obtenerImagenesPorNegocio
);

router.get('/:id_imagen', verificarToken, obtenerImagen);

router.put('/:id_imagen', verificarToken, actualizarImagen);

router.delete('/:id_imagen', verificarToken, eliminarImagen);

export default router;
