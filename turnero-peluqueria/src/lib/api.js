const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(status, body) {
    super(body?.mensaje || body?.error || `Error HTTP ${status}`);
    this.status = status;
    this.code = body?.error || null;
    this.mensaje = body?.mensaje || null;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

// Headers de autenticación por rol. Cada turno tiene dos secretos:
//   clientToken → lo recibe el cliente en POST /turnos
//   adminToken  → lo recibe el peluquero en el link de WhatsApp (?t=)
function authHeaders({ clientToken, adminToken } = {}) {
  return {
    ...(clientToken ? { 'x-client-token': clientToken } : {}),
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
  };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const api = {
  getServicios: () => request('/servicios'),

  // Público: solo { fecha, hora } de los horarios tomados.
  getOcupados: (fecha) => request(`/turnos/ocupados?fecha=${encodeURIComponent(fecha)}`),

  // Lista completa para la bandeja /admin (requiere ADMIN_KEY).
  getTurnosAdmin: (adminKey) => request('/turnos', { headers: { 'x-admin-key': adminKey } }),

  getTurno: (id, auth) => request(`/turnos/${id}`, { headers: authHeaders(auth) }),

  // Devuelve el turno + clientToken (única vez que viaja).
  crearReserva: (payload) =>
    request('/turnos', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload) }),

  subirComprobante: (turnoId, clientToken, file) => {
    const form = new FormData();
    form.append('comprobante', file);
    return request(`/turnos/${turnoId}/comprobante`, {
      method: 'POST',
      headers: authHeaders({ clientToken }),
      body: form,
    });
  },

  aprobarTurno: (turnoId, adminToken) =>
    request(`/turnos/${turnoId}/aprobar`, { method: 'POST', headers: authHeaders({ adminToken }) }),

  rechazarTurno: (turnoId, adminToken, motivo) =>
    request(`/turnos/${turnoId}/rechazar`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders({ adminToken }) },
      body: JSON.stringify({ motivo }),
    }),

  cancelarTurno: (turnoId, clientToken) =>
    request(`/turnos/${turnoId}/cancelar`, { method: 'POST', headers: authHeaders({ clientToken }) }),
};

export { ApiError };
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');
