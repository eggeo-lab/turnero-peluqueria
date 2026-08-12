import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

const POLL_LISTA_MS = 4000;
const POLL_TURNO_MS = 2500;

// Lista de turnos (para la bandeja del admin y para calcular qué
// horarios ya están ocupados en el selector de fecha/hora). Hace
// polling simple; en un siguiente paso se puede cambiar por WebSocket
// sin tocar los componentes que consumen este hook.
export function useTurnos({ fecha, poll = true } = {}) {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const data = await api.getTurnos(fecha);
      setTurnos(data);
    } catch {
      // silencioso: el próximo poll reintenta
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
    if (!poll) return;
    const id = setInterval(cargar, POLL_LISTA_MS);
    return () => clearInterval(id);
  }, [cargar, poll]);

  const reservarSlot = useCallback(async (servicio, fechaSel, hora, cliente) => {
    try {
      const turno = await api.crearReserva({ servicioId: servicio.id, fecha: fechaSel, hora, cliente });
      cargar();
      return { turno };
    } catch (err) {
      if (err instanceof ApiError) return { error: err.code, mensaje: err.mensaje };
      return { error: 'red', mensaje: 'No pudimos conectar con el servidor.' };
    }
  }, [cargar]);

  const subirComprobante = useCallback(async (turnoId, file) => {
    try {
      const turno = await api.subirComprobante(turnoId, file);
      return { turno };
    } catch (err) {
      if (err instanceof ApiError) return { error: err.code, mensaje: err.mensaje };
      return { error: 'red', mensaje: 'No pudimos conectar con el servidor.' };
    }
  }, []);

  const aprobarTurno = useCallback(async (turnoId, token) => {
    try {
      return { turno: await api.aprobarTurno(turnoId, token) };
    } catch (err) {
      return { error: err instanceof ApiError ? err.code : 'red' };
    }
  }, []);

  const rechazarTurno = useCallback(async (turnoId, token, motivo) => {
    try {
      return { turno: await api.rechazarTurno(turnoId, token, motivo) };
    } catch (err) {
      return { error: err instanceof ApiError ? err.code : 'red' };
    }
  }, []);

  const cancelarTurno = useCallback(async (turnoId) => {
    try {
      return { turno: await api.cancelarTurno(turnoId) };
    } catch (err) {
      return { error: err instanceof ApiError ? err.code : 'red', mensaje: err instanceof ApiError ? err.mensaje : null };
    }
  }, []);

  return {
    turnos,
    loading,
    refrescar: cargar,
    reservarSlot,
    subirComprobante,
    aprobarTurno,
    rechazarTurno,
    cancelarTurno,
  };
}

// Observa un único turno por id via polling — reemplaza la suscripción
// a localStorage. Se usa en la pantalla de pago/espera del cliente y en
// la vista de aprobación del peluquero, así ambas reflejan el estado
// real del servidor casi en vivo.
export function useTurno(turnoId) {
  const [turno, setTurno] = useState(null);
  const [loading, setLoading] = useState(!!turnoId);
  const [notFound, setNotFound] = useState(false);
  const timerRef = useRef(null);
  const cargarRef = useRef(async () => {});

  useEffect(() => {
    if (!turnoId) return undefined;
    let activo = true;

    const cargar = async () => {
      try {
        const data = await api.getTurno(turnoId);
        if (activo) {
          setTurno(data);
          setNotFound(false);
        }
      } catch (err) {
        if (activo && err instanceof ApiError && err.status === 404) setNotFound(true);
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
  }, [turnoId]);

  const refrescar = useCallback(() => cargarRef.current(), []);

  return { turno, loading, notFound, refrescar };
}
