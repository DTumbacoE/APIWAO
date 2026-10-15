import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const verificarConfiguracion = () => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Faltan las credenciales de Cloudinary");
  }
};

// Subir una foto de perfil
export const subirFotoPerfil = async (buffer, idUsuario) => {
  verificarConfiguracion();

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("La imagen no es válida");
  }

  const usuarioId = Number(idUsuario);

  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    throw new Error("ID de usuario inválido");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "wao/perfiles",
        public_id: `usuario_${usuarioId}_${Date.now()}`,
        resource_type: "image",
        overwrite: false,
        transformation: [
          {
            width: 500,
            height: 500,
            crop: "fill",
            gravity: "auto",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, resultado) => {
        if (error) return reject(error);

        if (!resultado?.secure_url || !resultado?.public_id) {
          return reject(new Error("Cloudinary no devolvió una imagen válida"));
        }

        resolve({
          url: resultado.secure_url,
          publicId: resultado.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

// Eliminar una foto de perfil
export const eliminarFotoPerfil = async (publicId) => {
  verificarConfiguracion();

  if (
    typeof publicId !== "string" ||
    !/^wao\/perfiles\/[a-zA-Z0-9_-]+$/.test(publicId)
  ) {
    throw new Error("Identificador de imagen inválido");
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
};