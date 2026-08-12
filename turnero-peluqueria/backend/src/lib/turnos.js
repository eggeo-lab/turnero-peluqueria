import { nanoid } from 'nanoid';
import { db } from '../db/index.js';

export const RESERVA_TIMER_MIN = 15;
export const ANTICIPACION_MAX_HORAS = 24;
export const CANCELACION_MIN_HORAS = 3;

function rowToTurno(row) {
  if (!row) return null;
  return {
    id: row.id,
    servicio: {
      id: row.servicio_id,
      nombre: row.s_nombre,
      duracionMin: row.s_duracion_min,
      precio: row.s_precio,
      senia: row.s_senia,
      icon: row.s_icon,
    },
    fecha: row.fecha,
    hora: row.hora,
    cliente: { nombre: row.cliente_nombre, telefono: row.cliente_telefono },
    estado: row.estado,
    reservadoHasta: row.reservado_hasta,
    comprobanteUrl: row.comprobante_path ? `/uploads/${row.comprobante_path}` : null,
    motivoRechazo: row.motivo_rechazo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // admin_token NUNCA va acá — es lo que protege el link de aprobación.
  };
}

// Variante solo para la bandeja demo (/admin), que en producción no
// existiría. Ahí sí incluimos el token para poder armar el link de
// aprobación sin depender de WhatsApp durante las pruebas locales.
function rowToTurnoConToken(row) {
  const turno = rowToTurno(row);
  return turno && { ...turno, adminToken: row.admin_token };
}

const SELECT_JOIN = `
  SELECT t.*, s.nombre AS s_nombre, s.duracion_min AS s_duracion_min,
         s.precio AS s_precio, s.senia AS s_senia, s.icon AS s_icon
  FROM turnos t JOIN servicios s ON s.id = t.servicio_id
`;

export function getTurno(id) {
  const row = db.prepare(`${SELECT_JOIN} WHERE t.id = ?`).get(id);
  return rowToTurno(row);
}

export function listTurnos({ fecha } = {}) {
  const rows = fecha
    ? db.prepare(`${SELECT_JOIN} WHERE t.fecha = ? ORDER BY t.created_at DESC`).all(fecha)
    : db.prepare(`${SELECT_JOIN} ORDER BY t.created_at DESC LIMIT 200`).all();
  // rowToTurnoConToken: ver comentario arriba — es la excepción a
  // propósito para la bandeja demo, no para el flujo real.
  return rows.map(rowToTurnoConToken);
}

export function listServicios() {
  return db.prepare('SELECT * FROM servicios WHERE activo = 1').all().map((s) => ({
    id: s.id,
    nombre: s.nombre,
    duracionMin: s.duracion_min,
    precio: s.precio,
    senia: s.senia,
    icon: s.icon,
  }));
}

// Ventana de horarios permitidos según la anticipación máxima (24hs).
export function validarVentanaDeTiempo(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const inicio = new Date(y, m - 1, d, h, min, 0, 0);
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + ANTICIPACION_MAX_HORAS * 60 * 60 * 1000);
  if (inicio <= ahora) return 'El horario elegido ya pasó.';
  if (inicio > limite) return `Solo se puede reservar con hasta ${ANTICIPACION_MAX_HORAS}hs de anticipación.`;
  return null;
}

// Intenta bloquear el slot de forma atómica. La garantía anti doble
// booking la da el índice único parcial de la base — si otra request
// ganó la carrera, este INSERT tira SQLITE_CONSTRAINT y devolvemos 409.
export function crearReserva({ servicioId, fecha, hora, cliente }) {
  const servicio = db.prepare('SELECT * FROM servicios WHERE id = ? AND activo = 1').get(servicioId);
  if (!servicio) {
    return { error: 'servicio_invalido' };
  }

  const errorVentana = validarVentanaDeTiempo(fecha, hora);
  if (errorVentana) {
    return { error: 'fuera_de_ventana', mensaje: errorVentana };
  }

  const id = nanoid(12);
  const adminToken = nanoid(24);
  const now = Date.now();
  const reservadoHasta = now + RESERVA_TIMER_MIN * 60 * 1000;

  try {
    db.prepare(
      `INSERT INTO turnos
        (id, servicio_id, fecha, hora, cliente_nombre, cliente_telefono, estado, reservado_hasta, admin_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'RESERVANDO_CON_TIMER', ?, ?, ?, ?)`
    ).run(id, servicioId, fecha, hora, cliente.nombre, cliente.telefono, reservadoHasta, adminToken, now, now);
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return { error: 'slot_ocupado' };
    }
    throw err;
  }

  return { turno: getTurno(id) };
}

export function adjuntarComprobante(id, comprobantePath) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (turno.estado === 'EXPIRADO') return { error: 'timer_vencido' };
  if (turno.estado !== 'RESERVANDO_CON_TIMER') return { error: 'estado_invalido' };
  if (turno.reservado_hasta && turno.reservado_hasta < Date.now()) {
    db.prepare(`UPDATE turnos SET estado = 'EXPIRADO', updated_at = ? WHERE id = ?`).run(Date.now(), id);
    return { error: 'timer_vencido' };
  }

  db.prepare(
    `UPDATE turnos
     SET estado = 'PENDIENTE_COMPROBANTE', comprobante_path = ?, reservado_hasta = NULL, updated_at = ?
     WHERE id = ?`
  ).run(comprobantePath, Date.now(), id);

  return { turno: getTurno(id), adminToken: turno.admin_token };
}

// Verifica el token del link de aprobación antes de dejar aprobar/rechazar.
function verificarToken(id, token) {
  const row = db.prepare('SELECT admin_token FROM turnos WHERE id = ?').get(id);
  if (!row) return false;
  return typeof token === 'string' && token.length > 0 && token === row.admin_token;
}

export function aprobarTurno(id, token) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (!verificarToken(id, token)) return { error: 'no_autorizado' };
  if (turno.estado !== 'PENDIENTE_COMPROBANTE') return { error: 'estado_invalido' };
  db.prepare(`UPDATE turnos SET estado = 'CONFIRMADO', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  return { turno: getTurno(id) };
}

export function rechazarTurno(id, token, motivo) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (!verificarToken(id, token)) return { error: 'no_autorizado' };
  if (turno.estado !== 'PENDIENTE_COMPROBANTE') return { error: 'estado_invalido' };
  db.prepare(
    `UPDATE turnos SET estado = 'RECHAZADO', motivo_rechazo = ?, updated_at = ? WHERE id = ?`
  ).run(motivo || null, Date.now(), id);
  return { turno: getTurno(id) };
}

export function cancelarTurno(id) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (!['PENDIENTE_COMPROBANTE', 'CONFIRMADO'].includes(turno.estado)) {
    return { error: 'estado_invalido' };
  }

  const [h, min] = turno.hora.split(':').map(Number);
  const [y, m, d] = turno.fecha.split('-').map(Number);
  const inicio = new Date(y, m - 1, d, h, min, 0, 0);
  const horasRestantes = (inicio.getTime() - Date.now()) / (1000 * 60 * 60);
  if (horasRestantes < CANCELACION_MIN_HORAS) {
    return { error: 'fuera_de_plazo', mensaje: `Solo se puede cancelar con ${CANCELACION_MIN_HORAS}hs de anticipación.` };
  }

  db.prepare(`UPDATE turnos SET estado = 'CANCELADO', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  return { turno: getTurno(id) };
}

// Libera (expira) las reservas con timer vencido. Se corre periódicamente
// desde server.js — es el equivalente real del liberarVencidos() que
// antes vivía en el frontend contra localStorage.
export function expirarVencidos() {
  const info = db
    .prepare(
      `UPDATE turnos SET estado = 'EXPIRADO', updated_at = ?
       WHERE estado = 'RESERVANDO_CON_TIMER' AND reservado_hasta < ?`
    )
    .run(Date.now(), Date.now());
  return info.changes;
}
