// Reglas de negocio de tiempo del MVP.
export const HORARIO_APERTURA = 9; // 09:00
export const HORARIO_CIERRE = 19; // 19:00
export const PASO_MIN = 30; // grilla de turnos cada 30'
export const ANTICIPACION_MAX_HORAS = 24;
export const CANCELACION_MIN_HORAS = 3;
export const RESERVA_TIMER_MIN = 15;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function fechaISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fechaLabel(date, hoy) {
  const mismodia = fechaISO(date) === fechaISO(hoy);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  if (mismodia) return 'Hoy';
  if (fechaISO(date) === fechaISO(manana)) return 'Mañana';
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Devuelve los días (hoy / mañana, según corresponda) con sus horarios
// disponibles dentro de la ventana de anticipación máxima permitida.
export function generarDiasDisponibles(now = new Date()) {
  const limite = new Date(now.getTime() + ANTICIPACION_MAX_HORAS * 60 * 60 * 1000);
  const dias = [];

  for (let d = 0; d < 2; d++) {
    const dia = new Date(now);
    dia.setDate(dia.getDate() + d);
    dia.setHours(0, 0, 0, 0);

    const horas = [];
    for (let h = HORARIO_APERTURA; h < HORARIO_CIERRE; h++) {
      for (let m = 0; m < 60; m += PASO_MIN) {
        const slot = new Date(dia);
        slot.setHours(h, m, 0, 0);
        if (slot <= now) continue; // ya pasó
        if (slot > limite) continue; // fuera de la ventana de 24hs
        horas.push(`${pad(h)}:${pad(m)}`);
      }
    }
    if (horas.length) {
      dias.push({ fecha: fechaISO(dia), label: fechaLabel(dia, now), horas });
    }
  }
  return dias;
}

export function puedeCancelar(fecha, hora, now = new Date()) {
  const [h, m] = hora.split(':').map(Number);
  const [y, mo, d] = fecha.split('-').map(Number);
  const inicio = new Date(y, mo - 1, d, h, m, 0, 0);
  const horasRestantes = (inicio.getTime() - now.getTime()) / (1000 * 60 * 60);
  return horasRestantes >= CANCELACION_MIN_HORAS;
}
