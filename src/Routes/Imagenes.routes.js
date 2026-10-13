import { Router } from 'express';

import {
    crearImagen,
    obtenerImagenes,
    obtenerImagen,
    obtenerImagenesPorNegocio,
    actualizarImagen,
    eliminarImagen
} from '../Controladores/ImagenesCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Crear imagen
router.post(
    '/',
    verificarToken,
    crearImagen
);

// Obtener todas las imágenes
router.get(
    '/',
    verificarToken,
    obtenerImagenes
);

// Obtener imágenes de un negocio
router.get(
    '/negocio/:id_negocio',
    verificarToken,
    obtenerImagenesPorNegocio
);

// Obtener imagen por id
router.get(
    '/:id_imagen',
    verificarToken,
    obtenerImagen
);

// Actualizar imagen
router.put(
    '/:id_imagen',
    verificarToken,
    actualizarImagen
);

// Eliminar imagen
router.delete(
    '/:id_imagen',
    verificarToken,
    eliminarImagen
);

export default router;