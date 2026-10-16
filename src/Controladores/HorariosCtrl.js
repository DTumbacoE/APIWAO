
import { sql } from '../bd.js';

const DIAS = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
];

const idValido = (valor) => {
    const numero = Number(valor);
    return (
        valor !== null &&
        valor !== undefined &&
        String(valor).trim() !== '' &&
        Number.isSafeInteger(numero) &&
        numero > 0
    );
};

const horaValida = (valor) =>
    typeof valor === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(valor);

const normalizarHora = (hora) =>
    hora.length === 5 ? `${hora}:00` : hora;

const validarDatos = (datos) => {
    const { dia_semana, hora_apertura, hora_cierre } = datos;

    if (
        !DIAS.includes(dia_semana) ||
        !horaValida(hora_apertura) ||
        !horaValida(hora_cierre)
    ) {
        return false;
    }

    return normalizarHora(hora_apertura) <
        normalizarHora(hora_cierre);
};

const errorInterno = (res, error) => {
    console.error('Error en horarios:', error);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

// Comprueba que el usuario sea propietario de un negocio activo.
const verificarPropiedad = async (idNegocio, usuario) => {
    if (
        !usuario ||
        !idValido(usuario.id_usuario) ||
        Number(usuario.id_rol) !== 2
    ) {
        return false;
    }

    const [negocios] = await sql.query(
        `SELECT n.id_negocio
         FROM Negocios n
         INNER JOIN Usuarios u
             ON u.id_usuario = n.id_usuario
         WHERE n.id_negocio = ?
           AND n.id_usuario = ?
           AND n.estado = 1
           AND u.id_rol = 2
           AND u.estado_cuenta = 'activo'
         LIMIT 1`,
        [idNegocio, usuario.id_usuario]
    );

    return negocios.length > 0;
};

// Comprueba si la suscripción permite horarios.
const permiteHorarios = async (idNegocio) => {
    const [planes] = await sql.query(
        `SELECT p.permite_horarios
         FROM Suscripciones s
         INNER JOIN Planes p
             ON p.id_plan = s.id_plan
         WHERE s.id_negocio = ?
           AND s.estado = 'ACTIVA'
           AND s.fecha_inicio <= CURRENT_DATE()
           AND s.fecha_fin >= CURRENT_DATE()
         ORDER BY s.fecha_fin DESC, s.id_suscripcion DESC
         LIMIT 1`,
        [idNegocio]
    );

    return (
        planes.length > 0 &&
        Number(planes[0].permite_horarios) === 1
    );
};

// Busca un horario y su negocio.
const buscarHorario = async (idHorario) => {
    const [horarios] = await sql.query(
        `SELECT h.*, n.estado AS estado_negocio
         FROM Horarios h
         INNER JOIN Negocios n
             ON n.id_negocio = h.id_negocio
         WHERE h.id_horario = ?
         LIMIT 1`,
        [idHorario]
    );

    return horarios[0] || null;
};

// Comprueba si existe un horario superpuesto.
const horarioSuperpuesto = async (
    idNegocio,
    dia,
    apertura,
    cierre,
    idExcluir = null
) => {
    const [horarios] = await sql.query(
        `SELECT id_horario
         FROM Horarios
         WHERE id_negocio = ?
           AND dia_semana = ?
           AND hora_apertura < ?
           AND hora_cierre > ?
           AND (? IS NULL OR id_horario <> ?)
         LIMIT 1`,
        [
            idNegocio,
            dia,
            cierre,
            apertura,
            idExcluir,
            idExcluir
        ]
    );

    return horarios.length > 0;
};

// =======================
// OBTENER HORARIOS POR NEGOCIO
// =======================
export const obtenerHorariosPorNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        const [negocios] = await sql.query(
            `SELECT id_negocio
             FROM Negocios
             WHERE id_negocio = ?
               AND estado = 1
             LIMIT 1`,
            [id_negocio]
        );

        if (negocios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Negocio no encontrado'
            });
        }

        const [horarios] = await sql.query(
            `SELECT h.*
             FROM Horarios h
             WHERE h.id_negocio = ?
             ORDER BY FIELD(
                 h.dia_semana,
                 'Lunes',
                 'Martes',
                 'Miércoles',
                 'Jueves',
                 'Viernes',
                 'Sábado',
                 'Domingo'
             ), h.hora_apertura`,
            [id_negocio]
        );

        return res.json(horarios);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// OBTENER HORARIO
// =======================
export const obtenerHorario = async (req, res) => {
    try {
        const { id_horario } = req.params;

        if (!idValido(id_horario)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de horario inválido'
            });
        }

        const [horarios] = await sql.query(
            `SELECT h.*
             FROM Horarios h
             INNER JOIN Negocios n
                 ON n.id_negocio = h.id_negocio
             WHERE h.id_horario = ?
               AND n.estado = 1
             LIMIT 1`,
            [id_horario]
        );

        if (horarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        return res.json(horarios[0]);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// CREAR HORARIO
// =======================
export const crearHorario = async (req, res) => {
    try {
        const {
            id_negocio,
            dia_semana,
            hora_apertura,
            hora_cierre
        } = req.body || {};

        if (
            !idValido(id_negocio) ||
            !validarDatos({
                dia_semana,
                hora_apertura,
                hora_cierre
            })
        ) {
            return res.status(400).json({
                success: false,
                message: 'Datos del horario inválidos'
            });
        }

        const autorizado = await verificarPropiedad(
            id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para crear horarios'
            });
        }

        if (!(await permiteHorarios(id_negocio))) {
            return res.status(403).json({
                success: false,
                message: 'Tu suscripción no permite gestionar horarios'
            });
        }

        const apertura = normalizarHora(hora_apertura);
        const cierre = normalizarHora(hora_cierre);

        if (
            await horarioSuperpuesto(
                id_negocio,
                dia_semana,
                apertura,
                cierre
            )
        ) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un horario superpuesto ese día'
            });
        }

        const [resultado] = await sql.query(
            `INSERT INTO Horarios (
                id_negocio,
                dia_semana,
                hora_apertura,
                hora_cierre
            )
            SELECT n.id_negocio, ?, ?, ?
            FROM Negocios n
            INNER JOIN Usuarios u
                ON u.id_usuario = n.id_usuario
            WHERE n.id_negocio = ?
              AND n.id_usuario = ?
              AND n.estado = 1
              AND u.id_rol = 2
              AND u.estado_cuenta = 'activo'`,
            [
                dia_semana,
                apertura,
                cierre,
                id_negocio,
                req.usuario.id_usuario
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para crear horarios'
            });
        }

        return res.status(201).json({
            success: true,
            id_horario: resultado.insertId
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// ACTUALIZAR HORARIO
// =======================
export const actualizarHorario = async (req, res) => {
    try {
        const { id_horario } = req.params;
        const {
            dia_semana,
            hora_apertura,
            hora_cierre
        } = req.body || {};

        if (
            !idValido(id_horario) ||
            !validarDatos({
                dia_semana,
                hora_apertura,
                hora_cierre
            })
        ) {
            return res.status(400).json({
                success: false,
                message: 'Datos del horario inválidos'
            });
        }

        const horario = await buscarHorario(id_horario);

        if (!horario || Number(horario.estado_negocio) !== 1) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        const autorizado = await verificarPropiedad(
            horario.id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar este horario'
            });
        }

        if (!(await permiteHorarios(horario.id_negocio))) {
            return res.status(403).json({
                success: false,
                message: 'Tu suscripción no permite gestionar horarios'
            });
        }

        const apertura = normalizarHora(hora_apertura);
        const cierre = normalizarHora(hora_cierre);

        if (
            await horarioSuperpuesto(
                horario.id_negocio,
                dia_semana,
                apertura,
                cierre,
                id_horario
            )
        ) {
            return res.status(409).json({
                success: false,
                message: 'El horario se superpone con otro existente'
            });
        }

        const [resultado] = await sql.query(
            `UPDATE Horarios h
             INNER JOIN Negocios n
                 ON n.id_negocio = h.id_negocio
             SET h.dia_semana = ?,
                 h.hora_apertura = ?,
                 h.hora_cierre = ?
             WHERE h.id_horario = ?
               AND n.id_usuario = ?
               AND n.estado = 1`,
            [
                dia_semana,
                apertura,
                cierre,
                id_horario,
                req.usuario.id_usuario
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado o sin cambios'
            });
        }

        return res.json({
            success: true,
            message: 'Horario actualizado correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// ELIMINAR HORARIO
// =======================
export const eliminarHorario = async (req, res) => {
    try {
        const { id_horario } = req.params;

        if (!idValido(id_horario)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de horario inválido'
            });
        }

        const horario = await buscarHorario(id_horario);

        if (!horario || Number(horario.estado_negocio) !== 1) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        const autorizado = await verificarPropiedad(
            horario.id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar este horario'
            });
        }

        const [resultado] = await sql.query(
            `DELETE h
             FROM Horarios h
             INNER JOIN Negocios n
                 ON n.id_negocio = h.id_negocio
             WHERE h.id_horario = ?
               AND n.id_usuario = ?
               AND n.estado = 1`,
            [id_horario, req.usuario.id_usuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Horario eliminado correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};
