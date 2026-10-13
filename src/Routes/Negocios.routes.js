import { Router } from 'express';

import {
    crearNegocio,
    obtenerNegocios,
    obtenerNegocio,
    misNegocios,
    actualizarNegocio,
    eliminarNegocio,
    obtenerPlanNegocio
} from '../Controladores/Negocios.Ctrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Crear negocio
router.post(
    '/',
    verificarToken,
    crearNegocio
);

// Listar todos los negocios
router.get(
    '/',
    verificarToken,
    obtenerNegocios
);

// Mis negocios
router.get(
    '/mis-negocios',
    verificarToken,
    misNegocios
);

// Obtener negocio por id
router.get(
    '/:id_negocio',
    verificarToken,
    obtenerNegocio
);



// Actualizar negocio
router.put(
    '/:id_negocio',
    verificarToken,
    actualizarNegocio
);

// Eliminar negocio
router.delete(
    '/:id_negocio',
    verificarToken,
    eliminarNegocio
);
router.get(
    '/plan/:id_negocio',
    verificarToken,
    obtenerPlanNegocio
);

export default router;