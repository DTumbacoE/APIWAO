
import { Router } from 'express';

import {
    obtenerPlanNegocio
} from '../Controladores/PlanCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Consultar el plan activo del negocio propio.
router.get(
    '/negocio/:id_negocio',
    verificarToken,
    obtenerPlanNegocio
);

export default router;
