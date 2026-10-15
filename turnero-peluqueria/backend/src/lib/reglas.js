// =========================================================
// Reglas de negocio de tiempo — fuente única del backend.
// Espejo en el frontend: src/lib/slots.js (mantener en sync).
// =========================================================

// Las reglas se calculan con `new Date(y, m, d, h, min)`, que usa la
// zona del proceso. Render corre en UTC y la peluquería y sus clientes
// en Argentina: sin esto, "las 11:00" se interpretaba 3hs corrido.
// Se fija al cargar este módulo, antes de cualquier cálculo de fechas.
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
process.env.TZ = ZONA_HORARIA;

export const HORARIO_APERTURA = 9; // primer turno 09:00
export const HORARIO_CIERRE = 19; // último turno arranca antes de las 19:00 (18:30)
export const PASO_MIN = 30; // grilla de turnos cada 30'
export const RESERVA_TIMER_MIN = 15;
export const ANTICIPACION_MAX_HORAS = 24;
export const CANCELACION_MIN_HORAS = 3;

// Estados que ocupan el slot. Tiene que coincidir con el WHERE del
// índice único parcial idx_turnos_slot_activo en schema.sql.
export const ESTADOS_ACTIVOS = ['RESERVANDO_CON_TIMER', 'PENDIENTE_COMPROBANTE', 'CONFIRMADO'];

const HORA_MS = 60 * 60 * 1000;

// 'YYYY-MM-DD' + 'HH:MM' → Date en la zona de la peluquería.
export function inicioDelTurno(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Formato válido + dentro del horario de atención + alineado a la grilla.
// Devuelve un mensaje de error o null.
export function validarHorario(fecha, hora) {
  if (typeof fecha !== 'string' || typeof hora !== 'string' || !FECHA_RE.test(fecha) || !HORA_RE.test(hora)) {
    return 'Fecha u hora con formato inválido.';
  }
  // Date "corrige" fechas imposibles (2026-10-32 → 1/11). Hay que
  // rechazarlas: el índice anti doble booking compara el texto de fecha,
  // así que "2026-10-32" y "2026-11-01" serían slots distintos.
  const inicio = inicioDelTurno(fecha, hora);
  const [y, m, d] = fecha.split('-').map(Number);
  if (inicio.getFullYear() !== y || inicio.getMonth() !== m - 1 || inicio.getDate() !== d) {
    return 'Fecha inválida.';
  }
  const [h, min] = hora.split(':').map(Number);
  const minutos = h * 60 + min;
  if (minutos < HORARIO_APERTURA * 60 || minutos >= HORARIO_CIERRE * 60) {
    return `Los turnos son de ${HORARIO_APERTURA}:00 a ${HORARIO_CIERRE}:00.`;
  }
  if (min % PASO_MIN !== 0) return `Los turnos arrancan cada ${PASO_MIN} minutos.`;
  return null;
}

// Ventana de reserva: en el futuro y con hasta 24hs de anticipación.
// Devuelve un mensaje de error o null.
export function validarVentanaDeTiempo(fecha, hora, ahora = new Date()) {
  const inicio = inicioDelTurno(fecha, hora);
  const limite = new Date(ahora.getTime() + ANTICIPACION_MAX_HORAS * HORA_MS);
  if (inicio <= ahora) return 'El horario elegido ya pasó.';
  if (inicio > limite) return `Solo se puede reservar con hasta ${ANTICIPACION_MAX_HORAS}hs de anticipación.`;
  return null;
}

export function puedeCancelar(fecha, hora, ahora = new Date()) {
  const horasRestantes = (inicioDelTurno(fecha, hora).getTime() - ahora.getTime()) / HORA_MS;
  return horasRestantes >= CANCELACION_MIN_HORAS;
}
