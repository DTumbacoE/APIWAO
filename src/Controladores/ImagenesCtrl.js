
import { sql } from '../bd.js';

const errorInterno = (res, error) => {
    console.error('Error en imágenes:', error);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

const idValido = (valor) => {
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero > 0;
};

const validarUrl = (valor) => {
    if (typeof valor !== 'string' || valor.length > 500) {
        return false;
    }

    try {
        const url = new URL(valor);
        const cloudName =
            process.env.CLOUDINARY_GALLERY_CLOUD_NAME ||
            process.env.CLOUDINARY_CLOUD_NAME;

        if (!cloudName) return false;

        const partes = url.pathname.split('/');

        return (
            url.protocol === 'https:' &&
            url.hostname === 'res.cloudinary.com' &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            partes[1] === cloudName &&
            partes[2] === 'image' &&
            partes[3] === 'upload' &&
            partes.length >= 5
        );
    } catch {
        return false;
    }
};

// Verifica que el usuario sea propietario de un negocio activo.
const verificarPropiedad = async (idNegocio, usuario) => {
    if (Number(usuario.id_rol) !== 2) {
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

// Comprueba la suscripción y el límite de galería.
const obtenerPlanVigente = async (idNegocio) => {
    const [planes] = await sql.query(
        `SELECT
            p.max_imagenes,
            p.permite_galeria
         FROM Suscripciones s
         INNER JOIN Planes p ON p.id_plan = s.id_plan
         WHERE s.id_negocio = ?
           AND s.estado = 'ACTIVA'
           AND s.fecha_inicio <= CURRENT_DATE()
           AND s.fecha_fin >= CURRENT_DATE()
         ORDER BY s.fecha_fin DESC, s.id_suscripcion DESC
         LIMIT 1`,
        [idNegocio]
    );

    return planes[0] || null;
};

const imagenConNegocio = async (idImagen) => {
    const [imagenes] = await sql.query(
        `SELECT
            i.id_imagen,
            i.id_negocio,
            i.url,
            n.id_usuario,
            n.estado
         FROM ImagenesNegocios i
         INNER JOIN Negocios n
             ON n.id_negocio = i.id_negocio
         WHERE i.id_imagen = ?
         LIMIT 1`,
        [idImagen]
    );

    return imagenes[0] || null;
};

// =======================
// CREAR IMAGEN
// =======================
export const crearImagen = async (req, res) => {
    try {
        const { id_negocio, url } = req.body || {};

        if (!idValido(id_negocio) || !validarUrl(url)) {
            return res.status(400).json({
                success: false,
                message: 'Negocio o URL de imagen inválidos'
            });
        }

        const autorizado = await verificarPropiedad(
            id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para agregar imágenes'
            });
        }

        const plan = await obtenerPlanVigente(id_negocio);

        if (!plan || Number(plan.permite_galeria) !== 1) {
            return res.status(403).json({
                success: false,
                message: 'Tu suscripción no permite utilizar la galería'
            });
        }

        const [resultado] = await sql.query(
            `INSERT INTO ImagenesNegocios (id_negocio, url)
             SELECT ?, ?
             WHERE (
                 SELECT COUNT(*)
                 FROM ImagenesNegocios
                 WHERE id_negocio = ?
             ) < ?`,
            [
                id_negocio,
                url,
                id_negocio,
                Number(plan.max_imagenes)
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message: 'Has alcanzado el límite de imágenes de tu plan'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Imagen registrada correctamente',
            id_imagen: resultado.insertId
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// OBTENER TODAS LAS IMÁGENES
// =======================
export const obtenerImagenes = async (req, res) => {
    try {
        const [imagenes] = await sql.query(
            `SELECT i.*
             FROM ImagenesNegocios i
             INNER JOIN Negocios n
                 ON n.id_negocio = i.id_negocio
             WHERE n.estado = 1
             ORDER BY i.fecha_subida DESC`
        );

        return res.json(imagenes);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// OBTENER IMAGEN POR ID
// =======================
export const obtenerImagen = async (req, res) => {
    try {
        const { id_imagen } = req.params;

        if (!idValido(id_imagen)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador inválido'
            });
        }

        const [imagenes] = await sql.query(
            `SELECT i.*
             FROM ImagenesNegocios i
             INNER JOIN Negocios n
                 ON n.id_negocio = i.id_negocio
             WHERE i.id_imagen = ?
               AND n.estado = 1
             LIMIT 1`,
            [id_imagen]
        );

        if (imagenes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        return res.json(imagenes[0]);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// OBTENER IMÁGENES POR NEGOCIO
// =======================
export const obtenerImagenesPorNegocio = async (req, res) => {
    try {
        const { id_negocio } = req.params;

        if (!idValido(id_negocio)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador inválido'
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

        const [imagenes] = await sql.query(
            `SELECT *
             FROM ImagenesNegocios
             WHERE id_negocio = ?
             ORDER BY fecha_subida DESC`,
            [id_negocio]
        );

        return res.json(imagenes);

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// ACTUALIZAR IMAGEN
// =======================
export const actualizarImagen = async (req, res) => {
    try {
        const { id_imagen } = req.params;
        const { url, id_negocio } = req.body || {};

        if (!idValido(id_imagen) || !validarUrl(url)) {
            return res.status(400).json({
                success: false,
                message: 'Imagen o URL inválidas'
            });
        }

        const imagen = await imagenConNegocio(id_imagen);

        if (!imagen || Number(imagen.estado) !== 1) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        if (
            id_negocio !== undefined &&
            Number(id_negocio) !== Number(imagen.id_negocio)
        ) {
            return res.status(400).json({
                success: false,
                message: 'No se puede cambiar el negocio de una imagen'
            });
        }

        const autorizado = await verificarPropiedad(
            imagen.id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar esta imagen'
            });
        }

        const plan = await obtenerPlanVigente(imagen.id_negocio);

        if (!plan || Number(plan.permite_galeria) !== 1) {
            return res.status(403).json({
                success: false,
                message: 'Tu suscripción no permite modificar la galería'
            });
        }

        await sql.query(
            `UPDATE ImagenesNegocios
             SET url = ?
             WHERE id_imagen = ?
               AND id_negocio = ?`,
            [url, id_imagen, imagen.id_negocio]
        );

        return res.json({
            success: true,
            message: 'Imagen actualizada correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};

// =======================
// ELIMINAR IMAGEN
// =======================
export const eliminarImagen = async (req, res) => {
    try {
        const { id_imagen } = req.params;

        if (!idValido(id_imagen)) {
            return res.status(400).json({
                success: false,
                message: 'Identificador inválido'
            });
        }

        const imagen = await imagenConNegocio(id_imagen);

        if (!imagen || Number(imagen.estado) !== 1) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        const autorizado = await verificarPropiedad(
            imagen.id_negocio,
            req.usuario
        );

        if (!autorizado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar esta imagen'
            });
        }

        const [resultado] = await sql.query(
            `DELETE i
             FROM ImagenesNegocios i
             INNER JOIN Negocios n
                 ON n.id_negocio = i.id_negocio
             WHERE i.id_imagen = ?
               AND n.id_usuario = ?
               AND n.estado = 1`,
            [id_imagen, req.usuario.id_usuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });
        }

        return res.json({
            success: true,
            message: 'Imagen eliminada correctamente'
        });

    } catch (error) {
        return errorInterno(res, error);
    }
};
