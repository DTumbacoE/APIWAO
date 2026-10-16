
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
