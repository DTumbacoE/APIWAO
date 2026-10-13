import jwt from 'jsonwebtoken';

export const verificarToken = (req, res, next) => {

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Token requerido'
        });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {

        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token inválido'
            });
        }

        req.usuario = usuario;

        next();
    });
};