// -----------------------------------------------------------------------
// Capa de notificaciones — a integrar con Evolution API (WhatsApp) o un
// proveedor de email transaccional (Resend, SendGrid, etc.) desde el
// backend. En el MVP frontend solo logueamos el payload que se enviaría.
//
// Sugerencia de arquitectura real:
//   1. Backend expone POST /api/turnos -> crea el turno en estado
//      RESERVANDO_CON_TIMER y agenda un job que lo expira a los 15'.
//   2. POST /api/turnos/:id/comprobante -> pasa a PENDIENTE_COMPROBANTE
//      y dispara notifyPeluquero().
//   3. POST /api/turnos/:id/aprobar | /rechazar (protegido por token del
//      link único) -> dispara notifyCliente().
// -----------------------------------------------------------------------

const WHATSAPP_ENDPOINT = import.meta.env.VITE_EVOLUTION_API_URL || null;
const ADMIN_PHONE = import.meta.env.VITE_ADMIN_WHATSAPP || null;

function linkAprobacion(turnoId) {
  return `${window.location.origin}/admin/confirmar/${turnoId}`;
}

// Se dispara cuando el cliente sube el comprobante y el turno pasa a
// PENDIENTE_COMPROBANTE. Avisa al peluquero con el link de un clic.
export async function notifyPeluquero(turno) {
  const mensaje =
    `💈 Nuevo turno pendiente de aprobación\n` +
    `${turno.cliente?.nombre} — ${turno.servicio?.nombre}\n` +
    `${turno.fecha} ${turno.hora}\n` +
    `Aprobar/Rechazar: ${linkAprobacion(turno.id)}`;

  return sendWhatsApp(ADMIN_PHONE, mensaje);
}

// Se dispara cuando el peluquero aprueba el turno.
export async function notifyClienteConfirmacion(turno) {
  const mensaje =
    `✅ ¡Turno confirmado!\n` +
    `${turno.servicio?.nombre} el ${turno.fecha} a las ${turno.hora}.\n` +
    `Te esperamos. Cualquier cambio, avisanos con anticipación.`;

  return sendWhatsApp(turno.cliente?.telefono, mensaje);
}

// Se dispara cuando el peluquero rechaza el turno (ej: comprobante inválido).
export async function notifyClienteRechazo(turno) {
  const mensaje =
    `⚠️ Tu turno del ${turno.fecha} ${turno.hora} fue rechazado.\n` +
    `Motivo: ${turno.motivoRechazo || 'comprobante no válido'}.\n` +
    `Podés volver a reservar cuando quieras.`;

  return sendWhatsApp(turno.cliente?.telefono, mensaje);
}

async function sendWhatsApp(numero, mensaje) {
  if (!WHATSAPP_ENDPOINT || !numero) {
    // Modo demo: no hay backend/credenciales configuradas todavía.
    console.info('[notificaciones:mock]', { numero, mensaje });
    return { ok: true, mock: true };
  }
  try {
    const res = await fetch(WHATSAPP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: numero, text: mensaje }),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error('Error enviando WhatsApp', err);
    return { ok: false, error: err.message };
  }
}
