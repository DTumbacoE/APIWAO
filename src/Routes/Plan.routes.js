import { Router } from 'express';

import {
    obtenerPlanNegocio} from '../Controladores/PlanCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();


router.get(
    '/negocio/:id_negocio',
    verificarToken,
    obtenerPlanNegocio
);



export default router;