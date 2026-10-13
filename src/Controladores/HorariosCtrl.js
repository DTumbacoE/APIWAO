import { sql } from '../bd.js';

export const obtenerHorariosPorNegocio = async (req, res) => {
    try {

        const { id_negocio } = req.params;

        const [horarios] = await sql.query(
            `SELECT *
             FROM Horarios
             WHERE id_negocio = ?
             ORDER BY FIELD(
                 dia_semana,
                 'Lunes',
                 'Martes',
                 'Miércoles',
                 'Jueves',
                 'Viernes',
                 'Sábado',
                 'Domingo'
             )`,
            [id_negocio]
        );

        res.json(horarios);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const obtenerHorario = async (req, res) => {
    try {

        const { id_horario } = req.params;

        const [horarios] = await sql.query(
            `SELECT *
             FROM Horarios
             WHERE id_horario = ?`,
            [id_horario]
        );

        if (horarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        res.json(horarios[0]);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const crearHorario = async (req, res) => {
    try {

        const {
            id_negocio,
            dia_semana,
            hora_apertura,
            hora_cierre
        } = req.body;

        const [resultado] = await sql.query(
            `INSERT INTO Horarios (
                id_negocio,
                dia_semana,
                hora_apertura,
                hora_cierre
            )
            VALUES (?, ?, ?, ?)`,
            [
                id_negocio,
                dia_semana,
                hora_apertura,
                hora_cierre
            ]
        );

        res.json({
            success: true,
            id_horario: resultado.insertId
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const actualizarHorario = async (req, res) => {
    try {

        const { id_horario } = req.params;

        const {
            dia_semana,
            hora_apertura,
            hora_cierre
        } = req.body;

        await sql.query(
            `UPDATE Horarios
             SET dia_semana = ?,
                 hora_apertura = ?,
                 hora_cierre = ?
             WHERE id_horario = ?`,
            [
                dia_semana,
                hora_apertura,
                hora_cierre,
                id_horario
            ]
        );

        res.json({
            success: true,
            message: 'Horario actualizado correctamente'
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const eliminarHorario = async (req, res) => {
    try {

        const { id_horario } = req.params;

        await sql.query(
            `DELETE FROM Horarios
             WHERE id_horario = ?`,
            [id_horario]
        );

        res.json({
            success: true,
            message: 'Horario eliminado correctamente'
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};