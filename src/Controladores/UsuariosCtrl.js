import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sql } from '../bd.js';

export const crearUsuario = async (req, res) => {

    try {

        const {
            nombre,
            apellido,
            correo,
            telefono,
            direccion,
            password,
            id_rol
        } = req.body;

        const [existe] = await sql.query(
            'SELECT id_usuario FROM Usuarios WHERE correo=?',
            [correo]
        );

        if (existe.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Correo ya registrado'
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await sql.query(
            `INSERT INTO Usuarios
            (
                nombre,
                apellido,
                correo,
                telefono,
                direccion,
                password_hash,
                id_rol
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                apellido,
                correo,
                telefono,
                direccion,
                password_hash,
                id_rol || 3
            ]
        );

        res.status(201).json({
            success: true,
            id_usuario: result.insertId
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const loginUsuario = async (req, res) => {

    try {

        const { correo, password } = req.body;

        const [usuarios] = await sql.query(
            'SELECT * FROM Usuarios WHERE correo=? LIMIT 1',
            [correo]
        );

        if (usuarios.length === 0) {

            return res.status(401).json({
                success: false,
                message: 'Correo incorrecto'
            });

        }

        const usuario = usuarios[0];

        const coincide = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!coincide) {

            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });

        }

        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                correo: usuario.correo,
                id_rol: usuario.id_rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '30d'
            }
        );

        delete usuario.password_hash;

        res.json({
            success: true,
            token,
            usuario
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const perfilUsuario = async (req, res) => {

    try {

        const [usuario] = await sql.query(
            `SELECT
                id_usuario,
                nombre,
                apellido,
                correo,
                telefono,
                direccion,
                fecha_registro,
                id_rol
            FROM Usuarios
            WHERE id_usuario=?`,
            [req.usuario.id_usuario]
        );

        res.json(usuario[0]);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }
};
    
export const actualizarContrasena = async (req, res) => {
    try {
        const idSolicitado = Number(req.params.id_usuario);
        const idAutenticado = Number(req.usuario?.id_usuario);
        const { password } = req.body;

        if (!Number.isSafeInteger(idSolicitado) || idSolicitado <= 0) {
            return res.status(400).json({
                success: false,
                message: 'ID de usuario inválido'
            });
        }

        if (idSolicitado !== idAutenticado) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar esta cuenta'
            });
        }

        if (typeof password !== 'string' || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [result] = await sql.query(
            `UPDATE Usuarios
             SET password_hash = ?
             WHERE id_usuario = ?`,
            [password_hash, idAutenticado]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Contraseña actualizada'
        });

    } catch (error) {
        console.error('Error al actualizar contraseña:', error);

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};