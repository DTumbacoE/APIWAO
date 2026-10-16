
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

// Consultar negocios activos
router.get('/', verificarToken, obtenerNegocios);

// Negocios del propietario autenticado
router.get('/mis-negocios', verificarToken, misNegocios);

// Consultar la suscripción de un negocio
router.get('/plan/:id_negocio', verificarToken, obtenerPlanNegocio);

// Consultar un negocio
router.get('/:id_negocio', verificarToken, obtenerNegocio);

// Crear negocio
router.post('/', verificarToken, crearNegocio);

// Actualizar negocio
router.put('/:id_negocio', verificarToken, actualizarNegocio);

// Desactivar negocio
router.delete('/:id_negocio', verificarToken, eliminarNegocio);

export default router;
