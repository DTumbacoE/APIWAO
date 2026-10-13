import { sql } from '../bd.js';


export const crearNegocio = async (req, res) => {

    const connection = await sql.getConnection();

    try {

        await connection.beginTransaction();

        const id_usuario = req.usuario.id_usuario;

        const {
            id_tipo_negocio,
            nombre,
            descripcion,
            ubicacion,
            tarifa,
            latitud,
            longitud,
            telefono,
            sitio_web,
            id_plan,
            horarios
        } = req.body;

        // Crear negocio
        const [result] = await connection.query(
            `INSERT INTO Negocios(
                id_usuario,
                id_tipo_negocio,
                nombre,
                descripcion,
                ubicacion,
                tarifa,
                latitud,
                longitud,
                telefono,
                sitio_web
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario,
                id_tipo_negocio,
                nombre,
                descripcion,
                ubicacion,
                tarifa,
                latitud,
                longitud,
                telefono,
                sitio_web
            ]
        );

        const id_negocio = result.insertId;

        // Fechas de la suscripción
        const fechaInicio = new Date();

        const fechaFin = new Date();

        switch (id_plan) {
            case 1: // Básico
                fechaFin.setMonth(fechaFin.getMonth() + 1);
                break;

            case 2: // Semestral
                fechaFin.setMonth(fechaFin.getMonth() + 6);
                break;

            case 3: // Premium
                fechaFin.setMonth(fechaFin.getMonth() + 12);
                break;

            default:
                throw new Error('Plan no válido');
        }

        // Crear suscripción
        await connection.query(
            `INSERT INTO Suscripciones(
                id_negocio,
                id_plan,
                fecha_inicio,
                fecha_fin,
                estado
            )
            VALUES (?, ?, ?, ?, 'ACTIVA')`,
            [
                id_negocio,
                id_plan,
                fechaInicio.toISOString().split('T')[0],
                fechaFin.toISOString().split('T')[0]
            ]
        );
        // Crear horarios
        if (horarios && horarios.length > 0) {

            for (const horario of horarios) {

                await connection.query(
                    `INSERT INTO Horarios(
                id_negocio,
                dia_semana,
                hora_apertura,
                hora_cierre
            )
            VALUES (?, ?, ?, ?)`,
                    [
                        id_negocio,
                        horario.dia_semana,
                        horario.hora_apertura,
                        horario.hora_cierre
                    ]
                );

            }

        }

        await connection.commit();

        res.status(201).json({
            success: true,
            id_negocio
        });

    } catch (error) {

        await connection.rollback();

        res.status(500).json({
            success: false,
            error: error.message
        });

    } finally {

        connection.release();

    }

};

// =======================
// TODOS LOS NEGOCIOS
// =======================
export const obtenerNegocios = async (req, res) => {

    try {

        const [negocios] = await sql.query(
            `SELECT *
             FROM Negocios
             WHERE estado = 1
             ORDER BY fecha_registro DESC`
        );

        res.json(negocios);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// NEGOCIO POR ID
// =======================
export const obtenerNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;

        const [negocio] = await sql.query(
            `SELECT *
             FROM Negocios
             WHERE id_negocio = ?`,
            [id_negocio]
        );

        if (negocio.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Negocio no encontrado'
            });

        }

        res.json(negocio[0]);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// MIS NEGOCIOS
// =======================
export const misNegocios = async (req, res) => {

    try {

        const id_usuario = req.usuario.id_usuario;

        const [negocios] = await sql.query(
            `SELECT
                n.*,
                tn.descripcion AS tipo_nombre,
                p.nombre AS plan_nombre,
                s.fecha_inicio,
                s.fecha_fin
            FROM Negocios n
            LEFT JOIN TiposNegocios tn
                ON n.id_tipo_negocio = tn.id_tipo_negocio
            LEFT JOIN Suscripciones s
                ON n.id_negocio = s.id_negocio
                AND s.estado = 'ACTIVA'
            LEFT JOIN Planes p
                ON s.id_plan = p.id_plan
            WHERE n.id_usuario = ?`,
            [id_usuario]
        );

        res.json(negocios);

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};
// =======================
// ACTUALIZAR NEGOCIO
// =======================
export const actualizarNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;
        const id_usuario = req.usuario.id_usuario;

        const {
            id_tipo_negocio,
            nombre,
            descripcion,
            ubicacion,
            tarifa,
            latitud,
            longitud,
            telefono,
            sitio_web
        } = req.body;

        const [existe] = await sql.query(
            `SELECT id_negocio
             FROM Negocios
             WHERE id_negocio = ?
             AND id_usuario = ?`,
            [
                id_negocio,
                id_usuario
            ]
        );

        if (existe.length === 0) {

            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar este negocio'
            });

        }

        await sql.query(
            `UPDATE Negocios
             SET
                id_tipo_negocio=?,
                nombre=?,
                descripcion=?,
                ubicacion=?,
                tarifa=?,
                latitud=?,
                longitud=?,
                telefono=?,
                sitio_web=?
             WHERE id_negocio=?`,
            [
                id_tipo_negocio,
                nombre,
                descripcion,
                ubicacion,
                tarifa,
                latitud,
                longitud,
                telefono,
                sitio_web,
                id_negocio
            ]
        );

        res.json({
            success: true,
            message: 'Negocio actualizado'
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// ELIMINAR NEGOCIO
// =======================
export const eliminarNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;
        const id_usuario = req.usuario.id_usuario;

        const [existe] = await sql.query(
            `SELECT id_negocio
             FROM Negocios
             WHERE id_negocio = ?
             AND id_usuario = ?`,
            [
                id_negocio,
                id_usuario
            ]
        );

        if (existe.length === 0) {

            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar este negocio'
            });

        }

        await sql.query(
            `UPDATE Negocios
             SET estado = 0
             WHERE id_negocio = ?`,
            [id_negocio]
        );

        res.json({
            success: true,
            message: 'Negocio eliminado'
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};
export const obtenerPlanNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;

        const [datos] = await sql.query(`
            SELECT
                p.*,
                s.id_suscripcion,
                s.fecha_inicio,
                s.fecha_fin,
                s.estado
            FROM Suscripciones s
            INNER JOIN Planes p
                ON p.id_plan = s.id_plan
            WHERE s.id_negocio = ?
            LIMIT 1
        `, [id_negocio]);

        if (datos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'El negocio no tiene suscripción'
            });
        }

        res.json(datos[0]);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};