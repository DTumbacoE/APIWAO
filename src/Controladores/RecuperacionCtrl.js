
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { sql } from '../bd.js';
import { enviarCodigoRecuperacion } from '../Services/CorreoService.js';

const hash = (valor) =>
  crypto.createHash('sha256').update(valor).digest('hex');

const hashCodigo = (id, codigo) =>
  crypto.createHmac('sha256', process.env.RESET_CODE_SECRET)
    .update(`${id}:${codigo}`)
    .digest('hex');

const mensajeGenerico =
  'Si el correo corresponde a una cuenta activa, recibirás un código de recuperación.';

const correoNormalizado = (valor) =>
  typeof valor === 'string' ? valor.trim().toLowerCase() : '';

export async function solicitarCodigo(req, res) {
  try {
    const correo = correoNormalizado(req.body.correo);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        success: false,
        message: 'Correo inválido',
      });
    }

    const [usuarios] = await sql.query(
      `SELECT id_usuario, nombre
       FROM Usuarios
       WHERE correo = ?
         AND estado_cuenta = 'activo'
         AND correo_verificado = 1
       LIMIT 1`,
      [correo]
    );

    // Misma respuesta para correos existentes y desconocidos.
    if (!usuarios.length) {
      return res.json({ success: true, message: mensajeGenerico });
    }

    const usuario = usuarios[0];

    const [anteriores] = await sql.query(
      `SELECT id_recuperacion
       FROM RecuperacionContrasena
       WHERE id_usuario = ?
         AND fecha_creacion > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)
       ORDER BY id_recuperacion DESC LIMIT 1`,
      [usuario.id_usuario]
    );

    // Esperar 2 minutos antes de solicitar otro código.
    if (anteriores.length) {
      return res.json({ success: true, message: mensajeGenerico });
    }

    const codigo = crypto.randomInt(0, 1000000)
      .toString()
      .padStart(6, '0');

    await sql.query(
      `INSERT INTO RecuperacionContrasena
       (id_usuario, codigo_hash, fecha_creacion, fecha_expiracion)
       VALUES (?, ?, UTC_TIMESTAMP(),
               DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      [usuario.id_usuario, hashCodigo(usuario.id_usuario, codigo)]
    );

    await enviarCodigoRecuperacion({
      correo,
      nombre: usuario.nombre,
      codigo,
    });

    return res.json({
      success: true,
      message: mensajeGenerico,
    });
  } catch (error) {
    console.error('Error al solicitar recuperación:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo procesar la solicitud',
    });
  }
}

export async function verificarCodigo(req, res) {
  const correo = correoNormalizado(req.body.correo);
  const codigo = req.body.codigo;

  if (!/^\d{6}$/.test(codigo ?? '')) {
    return res.status(400).json({
      success: false,
      message: 'Código inválido',
    });
  }

  const conn = await sql.getConnection();

  try {
    await conn.beginTransaction();

    const [usuarios] = await conn.query(
      `SELECT id_usuario FROM Usuarios
       WHERE correo = ? AND estado_cuenta = 'activo'
         AND correo_verificado = 1 LIMIT 1`,
      [correo]
    );

    if (!usuarios.length) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Código inválido o vencido',
      });
    }

    const id = usuarios[0].id_usuario;

    const [filas] = await conn.query(
      `SELECT id_recuperacion, codigo_hash, intentos
       FROM RecuperacionContrasena
       WHERE id_usuario = ?
         AND fecha_uso IS NULL
         AND fecha_expiracion > UTC_TIMESTAMP()
       ORDER BY id_recuperacion DESC
       LIMIT 1 FOR UPDATE`,
      [id]
    );

    const registro = filas[0];

    if (!registro || registro.intentos >= 5) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Código inválido o vencido',
      });
    }

    const coincide = crypto.timingSafeEqual(
      Buffer.from(registro.codigo_hash, 'hex'),
      Buffer.from(hashCodigo(id, codigo), 'hex')
    );

    if (!coincide) {
      await conn.query(
        `UPDATE RecuperacionContrasena
         SET intentos = intentos + 1
         WHERE id_recuperacion = ?`,
        [registro.id_recuperacion]
      );
      await conn.commit();

      return res.status(400).json({
        success: false,
        message: 'Código inválido o vencido',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await conn.query(
      `UPDATE RecuperacionContrasena
       SET fecha_uso = UTC_TIMESTAMP(),
           token_reset_hash = ?,
           fecha_expiracion_token =
             DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
       WHERE id_recuperacion = ?`,
      [hash(token), registro.id_recuperacion]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: 'Código verificado',
      resetToken: token,
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error verificando código:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  } finally {
    conn.release();
  }
}

export async function restablecerContrasena(req, res) {
  const { resetToken, nuevaContrasena } = req.body;

  if (
    typeof resetToken !== 'string' ||
    !/^[a-f0-9]{64}$/.test(resetToken) ||
    typeof nuevaContrasena !== 'string' ||
    nuevaContrasena.length < 8 ||
    nuevaContrasena.length > 128
  ) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos o contraseña demasiado corta',
    });
  }

  const conn = await sql.getConnection();

  try {
    await conn.beginTransaction();

    const [filas] = await conn.query(
      `SELECT r.id_recuperacion, r.id_usuario
       FROM RecuperacionContrasena r
       INNER JOIN Usuarios u ON u.id_usuario = r.id_usuario
       WHERE r.token_reset_hash = ?
         AND r.fecha_expiracion_token > UTC_TIMESTAMP()
         AND u.estado_cuenta = 'activo'
         AND u.correo_verificado = 1
       LIMIT 1 FOR UPDATE`,
      [hash(resetToken)]
    );

    if (!filas.length) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Autorización inválida o vencida',
      });
    }

    const registro = filas[0];
    const passwordHash = await bcrypt.hash(nuevaContrasena, 12);

    await conn.query(
      'UPDATE Usuarios SET password_hash = ? WHERE id_usuario = ?',
      [passwordHash, registro.id_usuario]
    );

    // Invalidar todas las recuperaciones pendientes de esa cuenta.
    await conn.query(
      `UPDATE RecuperacionContrasena
       SET fecha_uso = COALESCE(fecha_uso, UTC_TIMESTAMP()),
           token_reset_hash = NULL,
           fecha_expiracion_token = NULL,
           fecha_expiracion = UTC_TIMESTAMP()
       WHERE id_usuario = ?`,
      [registro.id_usuario]
    );

    await conn.commit();

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error restableciendo contraseña:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo actualizar la contraseña',
    });
  } finally {
    conn.release();
  }
}
