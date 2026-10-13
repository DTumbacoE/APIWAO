import { sql } from '../bd.js';

// =======================
// CREAR IMAGEN
// =======================
export const crearImagen = async (req, res) => {

    try {

        const {
            id_negocio,
            url
        } = req.body;

        if (!id_negocio || !url) {
            return res.status(400).json({
                success: false,
                message: 'id_negocio y url son obligatorios'
            });
        }

        const [result] = await sql.query(
            `INSERT INTO ImagenesNegocios (
                id_negocio,
                url
            )
            VALUES (?, ?)`,
            [
                id_negocio,
                url
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Imagen registrada correctamente',
            id_imagen: result.insertId
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// OBTENER TODAS LAS IMÁGENES
// =======================
export const obtenerImagenes = async (req, res) => {

    try {

        const [imagenes] = await sql.query(
            `SELECT *
             FROM ImagenesNegocios
             ORDER BY fecha_subida DESC`
        );

        res.json(imagenes);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// OBTENER IMAGEN POR ID
// =======================
export const obtenerImagen = async (req, res) => {

    try {

        const { id_imagen } = req.params;

        const [imagen] = await sql.query(
            `SELECT *
             FROM ImagenesNegocios
             WHERE id_imagen = ?`,
            [id_imagen]
        );

        if (imagen.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });

        }

        res.json(imagen[0]);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// OBTENER IMÁGENES POR NEGOCIO
// =======================
export const obtenerImagenesPorNegocio = async (req, res) => {

    try {

        const { id_negocio } = req.params;

        const [imagenes] = await sql.query(
            `SELECT *
             FROM ImagenesNegocios
             WHERE id_negocio = ?
             ORDER BY fecha_subida DESC`,
            [id_negocio]
        );

        res.json(imagenes);

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// ACTUALIZAR IMAGEN
// =======================
export const actualizarImagen = async (req, res) => {

    try {

        const { id_imagen } = req.params;

        const {
            id_negocio,
            url
        } = req.body;

        const [existe] = await sql.query(
            `SELECT id_imagen
             FROM ImagenesNegocios
             WHERE id_imagen = ?`,
            [id_imagen]
        );

        if (existe.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });

        }

        await sql.query(
            `UPDATE Imagenes
             SET
                id_negocio = ?,
                url = ?
             WHERE id_imagen = ?`,
            [
                id_negocio,
                url,
                id_imagen
            ]
        );

        res.json({
            success: true,
            message: 'Imagen actualizada correctamente'
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

// =======================
// ELIMINAR IMAGEN
// =======================
export const eliminarImagen = async (req, res) => {

    try {

        const { id_imagen } = req.params;

        const [existe] = await sql.query(
            `SELECT id_imagen
             FROM ImagenesNegocios
             WHERE id_imagen = ?`,
            [id_imagen]
        );

        if (existe.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Imagen no encontrada'
            });

        }

        await sql.query(
            `DELETE FROM ImagenesNegocios
             WHERE id_imagen = ?`,
            [id_imagen]
        );

        res.json({
            success: true,
            message: 'Imagen eliminada correctamente'
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

};