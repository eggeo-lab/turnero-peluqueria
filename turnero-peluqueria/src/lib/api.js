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

export const api = {
  getServicios: () => request('/servicios'),

  getTurnos: (fecha) => request(`/turnos${fecha ? `?fecha=${fecha}` : ''}`),

  getTurno: (id) => request(`/turnos/${id}`),

  crearReserva: (payload) =>
    request('/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  subirComprobante: (turnoId, file) => {
    const form = new FormData();
    form.append('comprobante', file);
    return request(`/turnos/${turnoId}/comprobante`, { method: 'POST', body: form });
  },

  aprobarTurno: (turnoId, token) =>
    request(`/turnos/${turnoId}/aprobar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  rechazarTurno: (turnoId, token, motivo) =>
    request(`/turnos/${turnoId}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, motivo }),
    }),

  cancelarTurno: (turnoId) => request(`/turnos/${turnoId}/cancelar`, { method: 'POST' }),
};

export { ApiError };
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');
