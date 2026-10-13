import { Router } from 'express';

import {
    obtenerHorariosPorNegocio,
    obtenerHorario,
    crearHorario,
    actualizarHorario,
    eliminarHorario
} from '../Controladores/HorariosCtrl.js';

const router = Router();

router.get('/negocio/:id_negocio', obtenerHorariosPorNegocio);

router.get('/:id_horario', obtenerHorario);

router.post('/', crearHorario);

router.put('/:id_horario', actualizarHorario);

router.delete('/:id_horario', eliminarHorario);

export default router;