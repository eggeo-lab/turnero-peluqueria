import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { tokensIguales } from './auth.js';
import {
  RESERVA_TIMER_MIN,
  CANCELACION_MIN_HORAS,
  ESTADOS_ACTIVOS,
  validarHorario,
  validarVentanaDeTiempo,
  puedeCancelar,
} from './reglas.js';

// Vista del turno según quién lo pide:
//   'cliente' → todo menos el comprobante (lo subió él, no necesita verlo).
//   'admin'   → todo, incluido el link al comprobante.
// Los tokens NUNCA van acá — son lo que protege cada vista.
function rowToTurno(row, rol) {
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
    // Ruta relativa al origen de la API; exige el admin_token (?t=).
    comprobanteUrl: rol === 'admin' && row.comprobante_path ? `/api/turnos/${row.id}/comprobante` : null,
    motivoRechazo: row.motivo_rechazo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_JOIN = `
  SELECT t.*, s.nombre AS s_nombre, s.duracion_min AS s_duracion_min,
         s.precio AS s_precio, s.senia AS s_senia, s.icon AS s_icon
  FROM turnos t JOIN servicios s ON s.id = t.servicio_id
`;

function getRow(id) {
  return db.prepare(`${SELECT_JOIN} WHERE t.id = ?`).get(id);
}

// Uso interno (notificaciones, respuestas a quien ya se autenticó).
export function getTurno(id, rol = 'admin') {
  return rowToTurno(getRow(id), rol);
}

export function getComprobantePath(id) {
  return db.prepare('SELECT comprobante_path FROM turnos WHERE id = ?').get(id)?.comprobante_path || null;
}

// Devuelve el rol que habilitan los tokens recibidos para este turno,
// o un error. El admin_token tiene prioridad si vinieran ambos.
export function autorizarTurno(id, { adminToken, clientToken }) {
  if (!adminToken && !clientToken) return { error: 'no_autorizado' };
  const row = db.prepare('SELECT admin_token, client_token FROM turnos WHERE id = ?').get(id);
  if (!row) return { error: 'no_encontrado' };
  if (tokensIguales(adminToken, row.admin_token)) return { rol: 'admin' };
  if (tokensIguales(clientToken, row.client_token)) return { rol: 'cliente' };
  return { error: 'no_autorizado' };
}

// Lista completa para la bandeja /admin (protegida con ADMIN_KEY). Es el
// único lugar que devuelve el admin_token, para armar el link de
// aprobación mientras WhatsApp no esté conectado.
export function listTurnos({ fecha } = {}) {
  const rows = fecha
    ? db.prepare(`${SELECT_JOIN} WHERE t.fecha = ? ORDER BY t.created_at DESC`).all(fecha)
    : db.prepare(`${SELECT_JOIN} ORDER BY t.created_at DESC LIMIT 200`).all();
  return rows.map((row) => ({ ...rowToTurno(row, 'admin'), adminToken: row.admin_token }));
}

// Endpoint público: solo qué horarios están tomados, sin datos de nadie.
export function listOcupados(fecha) {
  const placeholders = ESTADOS_ACTIVOS.map(() => '?').join(', ');
  return db
    .prepare(`SELECT fecha, hora FROM turnos WHERE fecha = ? AND estado IN (${placeholders}) ORDER BY hora`)
    .all(fecha, ...ESTADOS_ACTIVOS);
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

// Intenta bloquear el slot de forma atómica. La garantía anti doble
// booking la da el índice único parcial de la base — si otra request
// ganó la carrera, este INSERT tira SQLITE_CONSTRAINT y devolvemos 409.
export function crearReserva({ servicioId, fecha, hora, cliente }) {
  const servicio = db.prepare('SELECT * FROM servicios WHERE id = ? AND activo = 1').get(servicioId);
  if (!servicio) {
    return { error: 'servicio_invalido' };
  }

  const errorHorario = validarHorario(fecha, hora);
  if (errorHorario) {
    return { error: 'fuera_de_horario', mensaje: errorHorario };
  }

  const errorVentana = validarVentanaDeTiempo(fecha, hora);
  if (errorVentana) {
    return { error: 'fuera_de_ventana', mensaje: errorVentana };
  }

  const id = nanoid(12);
  const adminToken = nanoid(24);
  const clientToken = nanoid(24);
  const now = Date.now();
  const reservadoHasta = now + RESERVA_TIMER_MIN * 60 * 1000;

  try {
    db.prepare(
      `INSERT INTO turnos
        (id, servicio_id, fecha, hora, cliente_nombre, cliente_telefono, estado, reservado_hasta, admin_token, client_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'RESERVANDO_CON_TIMER', ?, ?, ?, ?, ?)`
    ).run(id, servicioId, fecha, hora, cliente.nombre, cliente.telefono, reservadoHasta, adminToken, clientToken, now, now);
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      return { error: 'slot_ocupado' };
    }
    throw err;
  }

  // clientToken viaja solo en esta respuesta: el frontend lo guarda y lo
  // manda en x-client-token para leer, subir comprobante y cancelar.
  return { turno: getTurno(id, 'cliente'), clientToken };
}

// Las funciones de abajo asumen que la ruta ya validó el token
// correspondiente (ver middleware autorizar en routes/turnos.js).

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

  return { turno: getTurno(id, 'cliente'), adminToken: turno.admin_token };
}

export function aprobarTurno(id) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (turno.estado !== 'PENDIENTE_COMPROBANTE') return { error: 'estado_invalido' };
  db.prepare(`UPDATE turnos SET estado = 'CONFIRMADO', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  return { turno: getTurno(id, 'admin') };
}

export function rechazarTurno(id, motivo) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (turno.estado !== 'PENDIENTE_COMPROBANTE') return { error: 'estado_invalido' };
  db.prepare(
    `UPDATE turnos SET estado = 'RECHAZADO', motivo_rechazo = ?, updated_at = ? WHERE id = ?`
  ).run(motivo || null, Date.now(), id);
  return { turno: getTurno(id, 'admin') };
}

export function cancelarTurno(id) {
  const turno = db.prepare('SELECT * FROM turnos WHERE id = ?').get(id);
  if (!turno) return { error: 'no_encontrado' };
  if (!['PENDIENTE_COMPROBANTE', 'CONFIRMADO'].includes(turno.estado)) {
    return { error: 'estado_invalido' };
  }

  if (!puedeCancelar(turno.fecha, turno.hora)) {
    return { error: 'fuera_de_plazo', mensaje: `Solo se puede cancelar con ${CANCELACION_MIN_HORAS}hs de anticipación.` };
  }

  db.prepare(`UPDATE turnos SET estado = 'CANCELADO', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  return { turno: getTurno(id, 'cliente') };
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
