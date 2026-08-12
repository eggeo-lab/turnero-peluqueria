// Igual que en el frontend, pero acá sí tiene sentido dispararlo de
// verdad: el backend es quien conoce el estado real y no depende de
// que el navegador del cliente/peluquero siga abierto.

const WHATSAPP_ENDPOINT = process.env.EVOLUTION_API_URL || null;
const WHATSAPP_API_KEY = process.env.EVOLUTION_API_KEY || null;
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP || null;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

function linkAprobacion(turno) {
  return `${PUBLIC_APP_URL}/admin/confirmar/${turno.id}?t=${turno.adminToken}`;
}

export async function notifyPeluquero(turno) {
  const mensaje =
    `💈 Nuevo turno pendiente de aprobación\n` +
    `${turno.cliente.nombre} — ${turno.servicio.nombre}\n` +
    `${turno.fecha} ${turno.hora}\n` +
    `Aprobar/Rechazar: ${linkAprobacion(turno)}`;
  return sendWhatsApp(ADMIN_PHONE, mensaje);
}

export async function notifyClienteConfirmacion(turno) {
  const mensaje =
    `✅ ¡Turno confirmado!\n` +
    `${turno.servicio.nombre} el ${turno.fecha} a las ${turno.hora}.\n` +
    `Te esperamos. Cualquier cambio, avisanos con anticipación.`;
  return sendWhatsApp(turno.cliente.telefono, mensaje);
}

export async function notifyClienteRechazo(turno) {
  const mensaje =
    `⚠️ Tu turno del ${turno.fecha} ${turno.hora} fue rechazado.\n` +
    `Motivo: ${turno.motivoRechazo || 'comprobante no válido'}.\n` +
    `Podés volver a reservar cuando quieras.`;
  return sendWhatsApp(turno.cliente.telefono, mensaje);
}

async function sendWhatsApp(numero, mensaje) {
  if (!WHATSAPP_ENDPOINT || !numero) {
    console.info('[notificaciones:mock]', { numero, mensaje });
    return { ok: true, mock: true };
  }
  try {
    const res = await fetch(WHATSAPP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WHATSAPP_API_KEY ? { apikey: WHATSAPP_API_KEY } : {}),
      },
      body: JSON.stringify({ number: numero, text: mensaje }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error('[notificaciones] error enviando WhatsApp', err);
    return { ok: false, error: err.message };
  }
}
