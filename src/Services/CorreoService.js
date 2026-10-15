const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export async function enviarVerificacionCorreo({ correo, nombre, enlace }) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Falta configurar Brevo');
  }
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const respuesta = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json','api-key':process.env.BREVO_API_KEY},
    body: JSON.stringify({
      sender: {name: process.env.BREVO_SENDER_NAME || 'WAO', email: process.env.BREVO_SENDER_EMAIL},
      to: [{email: correo, name: nombre}],
      subject: 'Confirma tu correo electrónico - WAO',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px"><h2 style="color:#102C54">Bienvenido a WAO</h2><p>Hola, ${escapeHtml(nombre)}.</p><p>Confirma tu dirección de correo para activar tu cuenta.</p><p><a href="${escapeHtml(enlace)}" style="display:inline-block;padding:13px 20px;background:#F5A623;color:#102C54;text-decoration:none;border-radius:8px;font-weight:bold">Verificar mi correo</a></p><p>Este enlace caduca en 24 horas. Si no creaste esta cuenta, ignora el mensaje.</p></div>`
    })
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error('Brevo rechazó el envío:', respuesta.status, detalle.slice(0,500));
    throw new Error(`Brevo respondió ${respuesta.status}`);
  }
  return respuesta.json();
}
