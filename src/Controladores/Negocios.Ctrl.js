
import { sql } from '../bd.js';

// ============================================================
// UTILIDADES
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

const esPropietario = (usuario) => {
    return (
        usuario &&
        idValido(usuario.id_usuario) &&
        Number(usuario.id_rol) === 2
    );
};

const errorInterno = (res, error) => {
    console.error('Error en negocios:', error);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

const validarTexto = (valor, maximo, obligatorio = false) => {
    if (valor === null || valor === undefined) {
        return !obligatorio;
    }

    if (typeof valor !== 'string') {
        return false;
    }

    const texto = valor.trim();

    if (obligatorio && texto.length === 0) {
        return false;
    }

    return texto.length <= maximo;
};

const validarNumero = (valor, minimo, maximo) => {
    if (
        valor === null ||
        valor === undefined ||
        valor === ''
    ) {
        return true;
    }

    const numero = Number(valor);

    return (
        Number.isFinite(numero) &&
        numero >= minimo &&
        numero <= maximo
    );
};

const validarSitioWeb = (valor) => {
    if (valor === null || valor === undefined || valor === '') {
        return true;
    }

    if (typeof valor !== 'string' || valor.length > 500) {
        return false;
    }

    try {
        const url = new URL(valor);

        return (
            ['https:', 'http:'].includes(url.protocol) &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
};

const validarNegocio = (datos) => {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        return false;
    }

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
    } = datos;

    return (
        idValido(id_tipo_negocio) &&
        validarTexto(nombre, 150, true) &&
        validarTexto(descripcion, 2000) &&
        validarTexto(ubicacion, 500, true) &&
        validarNumero(tarifa, 0, 999999999) &&
        validarNumero(latitud, -90, 90) &&
        validarNumero(longitud, -180, 180) &&
        validarTexto(telefono, 30) &&
        validarSitioWeb(sitio_web)
    );
};

const verificarPropiedad = async (idNegocio, usuario) => {
    if (!idValido(idNegocio) || !esPropietario(usuario)) {
        return false;
    }

    const [negocios] = await sql.query(
        `SELECT id_negocio
         FROM Negocios
         WHERE id_negocio = ?
           AND id_usuario = ?
           AND estado = 1
         LIMIT 1`,
        [idNegocio, usuario.id_usuario]
    );

    return negocios.length > 0;
};

const valoresNegocio = (datos) => [
    Number(datos.id_tipo_negocio),
    datos.nombre.trim(),
    datos.descripcion?.trim() || null,
    datos.ubicacion.trim(),
    datos.tarifa === '' || datos.tarifa == null
        ? null
        : Number(datos.tarifa),
    datos.latitud === '' || datos.latitud == null
        ? null
        : Number(datos.latitud),
    datos.longitud === '' || datos.longitud == null
        ? null
        : Number(datos.longitud),
    datos.telefono?.trim() || null,
    datos.sitio_web?.trim() || null
];

// ============================================================
// CREAR NEGOCIO
// ============================================================

export const crearNegocio = async (req, res) => {
    try {
        if (!esPropietario(req.usuario)) {
            return res.status(403).json({
                success: false,
                message: 'Solo los propietarios pueden registrar negocios'
            });
        }

        if (!validarNegocio(req.body)) {
            return res.status(400).json({
                success: false,
                message: 'Los datos del negocio son inválidos'
            });
        }

        const { id_plan, horarios } = req.body;

        // El plan se puede seleccionar en Flutter,
        // pero no se activa desde este endpoint.
        if (
            id_plan !== undefined &&
            id_plan !== null &&
            !idValido(id_plan)
        ) {
            return res.status(400).json({
                success: false,
                message: 'El plan seleccionado no es válido'
            });
        }

        // Los horarios requieren una suscripción confirmada.
        if (
            horarios !== undefined &&
            !Array.isArray(horarios)
        ) {
            return res.status(400).json({
                success: false,
                message: 'El formato de horarios es inválido'
            });
        }

        if (Array.isArray(horarios) && horarios.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    'Primero registra el negocio y activa un plan ' +
                    'que permita gestionar horarios'
            });
        }

        const [resultado] = await sql.query(
            `INSERT INTO Negocios (
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
                req.usuario.id_usuario,
                ...valoresNegocio(req.body)
            ]
        );

        return res.status(201).json({
            success: true,
            id_negocio: resultado.insertId,
            suscripcion_activa: false,
            message:
                'Negocio registrado correctamente. ' +
                'La suscripción se activará después de confirmar el pago.'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// OBTENER TODOS LOS NEGOCIOS ACTIVOS
// ============================================================

export const obtenerNegocios = async (req, res) => {
    try {
        const [negocios] = await sql.query(
            `SELECT *
             FROM Negocios
             WHERE estado = 1
             ORDER BY fecha_registro DESC`
        );

        return res.json(negocios);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// OBTENER NEGOCIO POR ID
// ============================================================

export const obtenerNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        const [negocios] = await sql.query(
            `SELECT *
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

        return res.json(negocios[0]);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// MIS NEGOCIOS
// ============================================================

export const misNegocios = async (req, res) => {
    try {
        if (!esPropietario(req.usuario)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso permitido solo a propietarios'
            });
        }

        const [negocios] = await sql.query(
            `SELECT
                n.*,
                tn.descripcion AS tipo_nombre,
                p.nombre AS plan_nombre,
                s.fecha_inicio,
                s.fecha_fin
             FROM Negocios n
             LEFT JOIN TiposNegocios tn
                ON tn.id_tipo_negocio = n.id_tipo_negocio
             LEFT JOIN Suscripciones s
                ON s.id_suscripcion = (
                    SELECT s2.id_suscripcion
                    FROM Suscripciones s2
                    WHERE s2.id_negocio = n.id_negocio
                      AND s2.estado = 'ACTIVA'
                      AND s2.fecha_inicio <= CURRENT_DATE()
                      AND s2.fecha_fin >= CURRENT_DATE()
                    ORDER BY
                        s2.fecha_fin DESC,
                        s2.id_suscripcion DESC
                    LIMIT 1
                )
             LEFT JOIN Planes p
                ON p.id_plan = s.id_plan
             WHERE n.id_usuario = ?
               AND n.estado = 1
             ORDER BY n.fecha_registro DESC`,
            [req.usuario.id_usuario]
        );

        return res.json(negocios);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// ACTUALIZAR NEGOCIO
// ============================================================

export const actualizarNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        if (!esPropietario(req.usuario)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso permitido solo a propietarios'
            });
        }

        if (!validarNegocio(req.body)) {
            return res.status(400).json({
                success: false,
                message: 'Los datos del negocio son inválidos'
            });
        }

        if (
            !(await verificarPropiedad(id_negocio, req.usuario))
        ) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar este negocio'
            });
        }

        const [resultado] = await sql.query(
            `UPDATE Negocios
             SET
                id_tipo_negocio = ?,
                nombre = ?,
                descripcion = ?,
                ubicacion = ?,
                tarifa = ?,
                latitud = ?,
                longitud = ?,
                telefono = ?,
                sitio_web = ?
             WHERE id_negocio = ?
               AND id_usuario = ?
               AND estado = 1`,
            [
                ...valoresNegocio(req.body),
                id_negocio,
                req.usuario.id_usuario
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Negocio no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Negocio actualizado correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// ELIMINAR NEGOCIO (DESACTIVACIÓN LÓGICA)
// ============================================================

export const eliminarNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        if (!esPropietario(req.usuario)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso permitido solo a propietarios'
            });
        }

        const [resultado] = await sql.query(
            `UPDATE Negocios
             SET estado = 0
             WHERE id_negocio = ?
               AND id_usuario = ?
               AND estado = 1`,
            [id_negocio, req.usuario.id_usuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Negocio no encontrado o sin permisos'
            });
        }

        return res.json({
            success: true,
            message: 'Negocio desactivado correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// ============================================================
// OBTENER PLAN DEL NEGOCIO
// ============================================================

export const obtenerPlanNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de negocio inválido'
            });
        }

        if (
            !(await verificarPropiedad(id_negocio, req.usuario))
        ) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para consultar este plan'
            });
        }

        const [datos] = await sql.query(
            `SELECT
                p.*,
                s.id_suscripcion,
                s.fecha_inicio,
                s.fecha_fin,
                s.estado
             FROM Suscripciones s
             INNER JOIN Planes p
                ON p.id_plan = s.id_plan
             INNER JOIN Negocios n
                ON n.id_negocio = s.id_negocio
             WHERE s.id_negocio = ?
               AND n.id_usuario = ?
               AND n.estado = 1
               AND s.estado = 'ACTIVA'
               AND s.fecha_inicio <= CURRENT_DATE()
               AND s.fecha_fin >= CURRENT_DATE()
             ORDER BY
                s.fecha_fin DESC,
                s.id_suscripcion DESC
             LIMIT 1`,
            [
                id_negocio,
                req.usuario.id_usuario
            ]
        );

        if (datos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'El negocio no tiene una suscripción activa'
            });
        }

        return res.json(datos[0]);

    } catch (error) {
        return errorInterno(res, error);
    }
};
