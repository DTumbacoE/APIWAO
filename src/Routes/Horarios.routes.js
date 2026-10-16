
import { Router } from 'express';

import {
    obtenerHorariosPorNegocio,
    obtenerHorario,
    crearHorario,
    actualizarHorario,
    eliminarHorario
} from '../Controladores/HorariosCtrl.js';

import { verificarToken } from '../middlewares/auth.js';

const router = Router();

// Consultas públicas
router.get('/negocio/:id_negocio', obtenerHorariosPorNegocio);
router.get('/:id_horario', obtenerHorario);

// Operaciones protegidas
router.post('/', verificarToken, crearHorario);
router.put('/:id_horario', verificarToken, actualizarHorario);
router.delete('/:id_horario', verificarToken, eliminarHorario);

export default router;
