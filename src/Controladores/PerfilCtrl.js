import bcrypt from 'bcrypt';
import { sql } from '../bd.js';
import { subirFotoPerfil, eliminarFotoPerfil } from '../Services/Cloudinary.js';
import { fileTypeFromBuffer } from 'file-type';

const idDe = (req) => req.usuario.id_usuario;
const limpiar = (v, max, requerido = false) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if ((requerido && !s) || s.length > max) return null;
  return s;
};

export const editarPerfil = async (req, res) => {
  const body = req.body ?? {};
  const permitidos = ['nombre', 'apellido', 'telefono', 'direccion'];
  if (Object.keys(body).some(k => !permitidos.includes(k))) {
    return res.status(400).json({ success: false, message: 'Solo puedes modificar nombre, apellido, teléfono y dirección' });
  }
  if (!permitidos.some(k => Object.hasOwn(body, k))) {
    return res.status(400).json({ success: false, message: 'No se enviaron cambios' });
  }
  const campos = [];
  const valores = [];
  for (const [key, max, requerido] of [['nombre', 100, true], ['apellido', 100, true], ['telefono', 20, false], ['direccion', 255, false]]) {
    if (!Object.hasOwn(body, key)) continue;
    const valor = limpiar(body[key], max, requerido);
    if (valor === null) return res.status(400).json({ success: false, message: `Campo ${key} inválido` });
    campos.push(`${key} = ?`);
    valores.push(valor || null);
  }
  try {
    await sql.query(`UPDATE Usuarios SET ${campos.join(', ')} WHERE id_usuario = ?`, [...valores, idDe(req)]);
    const [rows] = await sql.query('SELECT id_usuario, nombre, apellido, correo, telefono, direccion, foto_perfil_url, id_rol FROM Usuarios WHERE id_usuario = ?', [idDe(req)]);
    return res.json({ success: true, usuario: rows[0] });
  } catch (e) {
    console.error('Editar perfil:', e);
    return res.status(500).json({ success: false, message: 'No se pudo actualizar el perfil' });
  }
};

export const cambiarContrasenaSegura = async (req, res) => {
  const { contrasenaActual, contrasenaNueva } = req.body ?? {};
  if (typeof contrasenaActual !== 'string' || typeof contrasenaNueva !== 'string' ||
    contrasenaNueva.length < 12 || contrasenaNueva.length > 128 || contrasenaNueva === contrasenaActual) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener entre 12 y 128 caracteres y ser diferente de la actual' });
  }
  try {
    const [rows] = await sql.query('SELECT password_hash FROM Usuarios WHERE id_usuario = ?', [idDe(req)]);
    if (!rows.length || !await bcrypt.compare(contrasenaActual, rows[0].password_hash)) {
      return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
    }
    const hash = await bcrypt.hash(contrasenaNueva, 12);
    await sql.query('UPDATE Usuarios SET password_hash = ? WHERE id_usuario = ?', [hash, idDe(req)]);
    return res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (e) {
    console.error('Cambiar contraseña:', e);
    return res.status(500).json({ success: false, message: 'No se pudo cambiar la contraseña' });
  }
};

export const subirFoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Selecciona una imagen JPG, PNG o WebP de hasta 5 MB' });
  const tipoReal = await fileTypeFromBuffer(req.file.buffer);

  const formatosPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!tipoReal || !formatosPermitidos.includes(tipoReal.mime)) {
    return res.status(400).json({
      success: false,
      message: 'El archivo no es una imagen JPG, PNG o WebP válida',
    });
  }
  let nueva;
  try {
    const [rows] = await sql.query('SELECT foto_perfil_public_id FROM Usuarios WHERE id_usuario = ?', [idDe(req)]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const anterior = rows[0].foto_perfil_public_id;
    nueva = await subirFotoPerfil(req.file.buffer, idDe(req));
    await sql.query('UPDATE Usuarios SET foto_perfil_url = ?, foto_perfil_public_id = ? WHERE id_usuario = ?', [nueva.url, nueva.publicId, idDe(req)]);
    if (anterior) eliminarFotoPerfil(anterior).catch(e => console.error('No se eliminó foto anterior:', e));
    return res.json({ success: true, foto_perfil_url: nueva.url });
  } catch (e) {
    if (nueva) await eliminarFotoPerfil(nueva.publicId).catch(() => { });
    console.error('Subir foto:', e);
    return res.status(500).json({ success: false, message: 'No se pudo guardar la foto' });
  }
};

export const borrarFoto = async (req, res) => {
  try {
    const [rows] = await sql.query('SELECT foto_perfil_public_id FROM Usuarios WHERE id_usuario = ?', [idDe(req)]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const anterior = rows[0].foto_perfil_public_id;
    await sql.query('UPDATE Usuarios SET foto_perfil_url = NULL, foto_perfil_public_id = NULL WHERE id_usuario = ?', [idDe(req)]);
    if (anterior) eliminarFotoPerfil(anterior).catch(e => console.error('No se eliminó foto:', e));
    return res.json({ success: true, foto_perfil_url: null });
  } catch (e) {
    console.error('Eliminar foto:', e);
    return res.status(500).json({ success: false, message: 'No se pudo eliminar la foto' });
  }
};
