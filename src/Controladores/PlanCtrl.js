
import { sql } from '../bd.js';

// ============================================================
// VALIDACIONES
// ============================================================

const idValido = (valor) => {
    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ''
    ) {
        return false;
    }

    const numero = Number(valor);

    return Number.isSafeInteger(numero) && numero > 0;
};

// ============================================================
// OBTENER PLAN ACTIVO DE UN NEGOCIO
// ============================================================

export const obtenerPlanNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        // 1. Validar identificador.
        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        // 2. Comprobar rol propietario.
        if (Number(req.usuario?.id_rol) !== 2) {
            return res.status(403).json({
                success: false,
                message: 'Acceso permitido solo a propietarios'
            });
        }

        // 3. Consultar únicamente negocios propios y activos.
        const [negocios] = await sql.query(
            `SELECT id_negocio
             FROM Negocios
             WHERE id_negocio = ?
               AND id_usuario = ?
               AND estado = 1
             LIMIT 1`,
            [
                id_negocio,
                req.usuario.id_usuario
            ]
        );

        if (negocios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Negocio no encontrado o sin permisos'
            });
        }

        // 4. Obtener una suscripción activa y vigente.
        const [datos] = await sql.query(
            `SELECT
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
               AND s.fecha_inicio <= CURRENT_DATE()
               AND s.fecha_fin >= CURRENT_DATE()
             ORDER BY
                s.fecha_fin DESC,
                s.id_suscripcion DESC
             LIMIT 1`,
            [id_negocio]
        );

        if (datos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'El negocio no tiene un plan activo y vigente'
            });
        }

        return res.status(200).json(datos[0]);

    } catch (error) {
        console.error('Error obteniendo plan del negocio:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
