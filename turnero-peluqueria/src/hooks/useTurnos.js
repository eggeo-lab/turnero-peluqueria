import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

const POLL_LISTA_MS = 4000;
const POLL_TURNO_MS = 2500;

// Polling simple; en un siguiente paso se puede cambiar por WebSocket
// sin tocar los componentes que consumen estos hooks.

// Horarios tomados de un día (endpoint público, sin datos de clientes).
// Devuelve un Set de 'HH:MM' para pintar el selector.
export function useOcupados(fecha) {
  const [ocupados, setOcupados] = useState(() => new Set());

  useEffect(() => {
    if (!fecha) return undefined;
    let activo = true;
    const cargar = async () => {
      try {
        const data = await api.getOcupados(fecha);
        if (activo) setOcupados(new Set(data.map((t) => t.hora)));
      } catch {
        // silencioso: el próximo poll reintenta
      }
    };
    cargar();
    const id = setInterval(cargar, POLL_LISTA_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [fecha]);

  return ocupados;
}

// Lista completa para la bandeja /admin. Corta el polling ante un error
// de autenticación (401) o si el servidor no tiene ADMIN_KEY (503).
export function useTurnosAdmin(adminKey) {
  const [turnos, setTurnos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset al cambiar de clave: así dos claves malas seguidas vuelven a
    // disparar el error, y cerrar sesión no deja la lista anterior a la vista.
    setTurnos([]);
    setError(null);
    if (!adminKey) return undefined;
    let activo = true;
    let id = null;
    const cargar = async () => {
      try {
        const data = await api.getTurnosAdmin(adminKey);
        if (activo) {
          setTurnos(data);
          setError(null);
        }
      } catch (err) {
        if (!activo) return;
        const code = err instanceof ApiError ? err.code : 'red';
        setError(code);
        if (code !== 'red') clearInterval(id);
      }
    };
    cargar();
    id = setInterval(cargar, POLL_LISTA_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [adminKey]);

  return { turnos, error };
}

// Observa un único turno por id via polling, autenticado con el token
// del cliente o del peluquero. `error` queda en 'no_autorizado' (token
// inválido/ausente) o 'no_encontrado'.
export function useTurno(turnoId, { clientToken, adminToken } = {}) {
  const [turno, setTurno] = useState(null);
  const [loading, setLoading] = useState(!!turnoId);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const cargarRef = useRef(async () => {});

  useEffect(() => {
    setTurno(null);
    setError(null);
    if (!turnoId) return undefined;
    let activo = true;
    setLoading(true);

    const cargar = async () => {
      try {
        const data = await api.getTurno(turnoId, { clientToken, adminToken });
        if (activo) {
          setTurno(data);
          setError(null);
        }
      } catch (err) {
        if (activo && err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          setError(err.code);
          clearInterval(timerRef.current);
        }
      } finally {
        if (activo) setLoading(false);
      }
    };

    cargarRef.current = cargar;
    cargar();
    timerRef.current = setInterval(cargar, POLL_TURNO_MS);
    return () => {
      activo = false;
      clearInterval(timerRef.current);
    };
  }, [turnoId, clientToken, adminToken]);

  const refrescar = useCallback(() => cargarRef.current(), []);

  return { turno, loading, error, refrescar };
}

// Acciones: envuelven la API y devuelven { turno } o { error, mensaje }
// en vez de tirar excepciones.
async function ejecutar(fn) {
  try {
    return { turno: await fn() };
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code, mensaje: err.mensaje };
    return { error: 'red', mensaje: 'No pudimos conectar con el servidor.' };
  }
}

export const acciones = {
  // { turno } incluye clientToken (solo en esta respuesta).
  reservar: (servicio, fecha, hora, cliente) =>
    ejecutar(() => api.crearReserva({ servicioId: servicio.id, fecha, hora, cliente })),
  subirComprobante: (turnoId, clientToken, file) =>
    ejecutar(() => api.subirComprobante(turnoId, clientToken, file)),
  aprobar: (turnoId, adminToken) => ejecutar(() => api.aprobarTurno(turnoId, adminToken)),
  rechazar: (turnoId, adminToken, motivo) => ejecutar(() => api.rechazarTurno(turnoId, adminToken, motivo)),
  cancelar: (turnoId, clientToken) => ejecutar(() => api.cancelarTurno(turnoId, clientToken)),
};
