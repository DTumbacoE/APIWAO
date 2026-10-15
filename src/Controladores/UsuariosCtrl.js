import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { sql } from '../bd.js';
import { enviarVerificacionCorreo } from '../Services/CorreoService.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const correoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && correo.length <= 150;
const normalizarCorreo = (correo) => typeof correo === 'string' ? correo.trim().toLowerCase() : '';
const baseUrl = () => process.env.PUBLIC_API_URL?.replace(/\/$/, '') || '';

async function generarEnlace(idUsuario) {
  if (!baseUrl()) throw new Error('Falta PUBLIC_API_URL');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await sql.query('DELETE FROM VerificacionCorreo WHERE id_usuario = ? AND fecha_uso IS NULL', [idUsuario]);
  await sql.query(`INSERT INTO VerificacionCorreo (id_usuario, token_hash, fecha_expiracion)
                   VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))`, [idUsuario, tokenHash]);
  return `${baseUrl()}/api/usuarios/verificar-correo?token=${encodeURIComponent(token)}`;
}

export const crearUsuario = async (req, res) => {
  try {
    const { nombre, apellido, telefono, direccion, password } = req.body || {};
    const correo = normalizarCorreo(req.body?.correo);
    const idRol = Number(req.body?.id_rol ?? 3);
    if (![nombre, apellido, telefono, direccion].every(v => typeof v === 'string' && v.trim()) ||
        !correoValido(correo) || typeof password !== 'string' || password.length < 8 || ![2, 3].includes(idRol)) {
      return res.status(400).json({success:false,message:'Datos de registro inválidos. La contraseña debe tener al menos 8 caracteres.'});
    }
    const [existe] = await sql.query('SELECT id_usuario FROM Usuarios WHERE correo = ? LIMIT 1', [correo]);
    if (existe.length) return res.status(409).json({success:false,message:'Correo ya registrado'});
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await sql.query(`INSERT INTO Usuarios
      (nombre, apellido, correo, telefono, direccion, password_hash, id_rol, estado_cuenta, correo_verificado)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', 0)`,
      [nombre.trim(), apellido.trim(), correo, telefono.trim(), direccion.trim(), passwordHash, idRol]);
    let correoEnviado = false;
    try {
      const enlace = await generarEnlace(result.insertId);
      await enviarVerificacionCorreo({correo, nombre: nombre.trim(), enlace});
      correoEnviado = true;
    } catch (error) {
      console.error('Registro creado, pero falló envío de verificación:', error);
    }
    return res.status(201).json({success:true,id_usuario:result.insertId,correo_verificado:false,correo_enviado:correoEnviado,
      message:correoEnviado?'Cuenta creada. Revisa tu correo para verificarla.':'Cuenta creada, pero no pudimos enviar el correo. Solicita un nuevo enlace.'});
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({success:false,message:'Correo ya registrado'});
    console.error('Error en registro:',error);
    return res.status(500).json({success:false,message:'Error interno del servidor'});
  }
};

export const verificarCorreo = async (req, res) => {
  try {
    const token = req.query.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).send('Enlace inválido.');
    const conexion = await sql.getConnection();
    try {
      await conexion.beginTransaction();
      const [filas] = await conexion.query(`SELECT v.id_verificacion, v.id_usuario, u.correo_verificado, u.estado_cuenta
        FROM VerificacionCorreo v JOIN Usuarios u ON u.id_usuario = v.id_usuario
        WHERE v.token_hash = ? AND v.fecha_uso IS NULL AND v.fecha_expiracion > UTC_TIMESTAMP()
        FOR UPDATE`, [hashToken(token)]);
      if (!filas.length || filas[0].estado_cuenta !== 'activo') {
        await conexion.rollback();
        return res.status(400).send('El enlace es inválido, expiró o la cuenta no está activa.');
      }
      await conexion.query('UPDATE Usuarios SET correo_verificado = 1, fecha_verificacion_correo = UTC_TIMESTAMP() WHERE id_usuario = ?', [filas[0].id_usuario]);
      await conexion.query('UPDATE VerificacionCorreo SET fecha_uso = UTC_TIMESTAMP() WHERE id_verificacion = ?', [filas[0].id_verificacion]);
      await conexion.commit();
      res.set('Cache-Control','no-store');
      return res.status(200).type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>WAO</title><body style="font-family:Arial;text-align:center;padding:60px"><h1>Correo verificado</h1><p>Tu cuenta WAO ya está activa. Puedes volver a la aplicación e iniciar sesión.</p></body></html>');
    } catch (error) { await conexion.rollback(); throw error; }
    finally { conexion.release(); }
  } catch (error) {
    console.error('Error verificando correo:',error);
    return res.status(500).send('Error al verificar el correo.');
  }
};

export const reenviarVerificacion = async (req, res) => {
  const mensaje = 'Si la cuenta existe y está pendiente de verificación, recibirás un nuevo enlace.';
  try {
    const correo = normalizarCorreo(req.body?.correo);
    if (!correoValido(correo)) return res.status(400).json({success:false,message:'Correo inválido'});
    const [filas] = await sql.query(`SELECT id_usuario, nombre FROM Usuarios
      WHERE correo = ? AND correo_verificado = 0 AND estado_cuenta = 'activo' LIMIT 1`, [correo]);
    if (filas.length) {
      const usuario = filas[0];
      const [recientes] = await sql.query(`SELECT id_verificacion FROM VerificacionCorreo
        WHERE id_usuario = ? AND fecha_creacion > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE) LIMIT 1`,[usuario.id_usuario]);
      if (!recientes.length) {
        const enlace = await generarEnlace(usuario.id_usuario);
        try { await enviarVerificacionCorreo({correo,nombre:usuario.nombre,enlace}); }
        catch (error) { console.error('No se pudo reenviar verificación:',error); }
      }
    }
    return res.json({success:true,message:mensaje});
  } catch (error) {
    console.error('Error reenviando verificación:',error);
    return res.status(500).json({success:false,message:'Error interno del servidor'});
  }
};

export const loginUsuario = async (req, res) => {
  try {
    const correo = normalizarCorreo(req.body?.correo);
    const password = req.body?.password;
    if (!correoValido(correo) || typeof password !== 'string') return res.status(400).json({success:false,message:'Credenciales inválidas'});
    const [usuarios] = await sql.query('SELECT * FROM Usuarios WHERE correo = ? LIMIT 1',[correo]);
    if (!usuarios.length || !(await bcrypt.compare(password, usuarios[0].password_hash))) {
      return res.status(401).json({success:false,message:'Correo o contraseña incorrectos'});
    }
    const usuario = usuarios[0];
    if (usuario.estado_cuenta !== 'activo') return res.status(403).json({success:false,message:'Esta cuenta no está activa'});
    if (!usuario.correo_verificado) return res.status(403).json({success:false,codigo:'CORREO_NO_VERIFICADO',message:'Debes verificar tu correo antes de iniciar sesión'});
    const token = jwt.sign({id_usuario:usuario.id_usuario,correo:usuario.correo,id_rol:usuario.id_rol},process.env.JWT_SECRET,{expiresIn:'30d'});
    delete usuario.password_hash;
    return res.json({success:true,token,usuario});
  } catch (error) {
    console.error('Error en login:',error);
    return res.status(500).json({success:false,message:'Error interno del servidor'});
  }
};

export const perfilUsuario = async (req, res) => {
  try {
    const [usuarios] = await sql.query(`SELECT id_usuario, nombre, apellido, correo, telefono, direccion,
      fecha_registro, id_rol, estado_cuenta, correo_verificado, fecha_verificacion_correo
      FROM Usuarios WHERE id_usuario = ? AND estado_cuenta = 'activo' AND correo_verificado = 1 LIMIT 1`,[req.usuario.id_usuario]);
    if (!usuarios.length) return res.status(403).json({success:false,message:'Cuenta no disponible'});
    return res.json(usuarios[0]);
  } catch (error) {
    console.error('Error en perfil:',error);
    return res.status(500).json({success:false,message:'Error interno del servidor'});
  }
};

export const actualizarContrasena = async (req, res) => {
  try {
    const idSolicitado = Number(req.params.id_usuario);
    const idAutenticado = Number(req.usuario?.id_usuario);
    const { password } = req.body || {};
    if (!Number.isSafeInteger(idSolicitado) || idSolicitado <= 0) return res.status(400).json({success:false,message:'ID de usuario inválido'});
    if (idSolicitado !== idAutenticado) return res.status(403).json({success:false,message:'No tienes permiso para modificar esta cuenta'});
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({success:false,message:'La contraseña debe tener al menos 8 caracteres'});
    const passwordHash = await bcrypt.hash(password,12);
    const [result] = await sql.query(`UPDATE Usuarios SET password_hash = ?
      WHERE id_usuario = ? AND estado_cuenta = 'activo' AND correo_verificado = 1`,[passwordHash,idAutenticado]);
    if (!result.affectedRows) return res.status(403).json({success:false,message:'Cuenta no disponible'});
    return res.json({success:true,message:'Contraseña actualizada'});
  } catch (error) {
    console.error('Error al actualizar contraseña:',error);
    return res.status(500).json({success:false,message:'Error interno del servidor'});
  }
};
