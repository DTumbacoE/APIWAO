import { sql } from '../bd.js';


export const obtenerPlanNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;

        const [datos] = await sql.query(
            `
            SELECT
                p.id_plan,
                p.nombre,
                p.costo,
                p.max_imagenes,
                p.max_promociones,
                p.permite_horarios,
                p.permite_galeria,
                p.destacado,
                s.id_suscripcion,
                s.fecha_inicio,
                s.fecha_fin,
                s.estado
            FROM Suscripciones s
            INNER JOIN Planes p
                ON p.id_plan = s.id_plan
            WHERE s.id_negocio = ?
            AND s.estado = 'ACTIVA'
            LIMIT 1
            `,
            [id_negocio]
        );

        if (datos.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'El negocio no tiene un plan activo'
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