
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const verificarConfiguracion = () => {
    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        throw new Error('Faltan credenciales de Cloudinary');
    }
};

const validarIdUsuario = (id) => {
    const numero = Number(id);

    return (
        Number.isSafeInteger(numero) &&
        numero > 0
    );
};

const validarPublicId = (publicId) => {
    return (
        typeof publicId === 'string' &&
        /^wao\/perfiles\/[a-zA-Z0-9_-]+$/.test(publicId)
    );
};

// ============================================================
// SUBIR FOTO DE PERFIL
// ============================================================

export const subirFotoPerfil = async (buffer, idUsuario) => {
    verificarConfiguracion();

    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0 ||
        buffer.length > 5 * 1024 * 1024
    ) {
        throw new Error('Imagen inválida o demasiado grande');
    }

    if (!validarIdUsuario(idUsuario)) {
        throw new Error('ID de usuario inválido');
    }

    const publicId =
        `usuario_${Number(idUsuario)}_${crypto.randomUUID()}`;

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'wao/perfiles',
                public_id: publicId,
                resource_type: 'image',
                overwrite: false,
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                transformation: [
                    {
                        width: 500,
                        height: 500,
                        crop: 'fill',
                        gravity: 'auto',
                        quality: 'auto',
                        fetch_format: 'auto'
                    }
                ]
            },
            (error, resultado) => {
                if (error) {
                    return reject(error);
                }

                if (
                    !resultado?.secure_url ||
                    !resultado?.public_id ||
                    !validarPublicId(resultado.public_id)
                ) {
                    return reject(
                        new Error('Respuesta inválida de Cloudinary')
                    );
                }

                resolve({
                    url: resultado.secure_url,
                    publicId: resultado.public_id
                });
            }
        );

        // Enviar el Buffer como un único fragmento.
        Readable.from([buffer])
            .on('error', reject)
            .pipe(stream);
    });
};


export const eliminarFotoPerfil = async (publicId) => {
    verificarConfiguracion();

    if (!validarPublicId(publicId)) {
        throw new Error('Identificador de imagen inválido');
    }

    return cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true
    });
};
