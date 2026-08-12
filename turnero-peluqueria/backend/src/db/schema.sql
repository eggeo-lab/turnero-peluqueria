-- =========================================================
-- Esquema — Turnero Peluquería
--
-- La pieza clave contra el doble booking es el índice único
-- parcial de más abajo: SQLite (y Postgres, que soporta la
-- misma sintaxis) rechaza a nivel de motor cualquier INSERT
-- que intente ocupar un (fecha, hora) que ya tiene un turno
-- en un estado "activo". Esto es lo que de verdad previene
-- condiciones de carrera con dos clientes reservando el mismo
-- slot al mismo tiempo — el timer de 15' en el frontend es
-- solo UX, esta constraint es la garantía real.
-- =========================================================

CREATE TABLE IF NOT EXISTS servicios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  duracion_min INTEGER NOT NULL,
  precio INTEGER NOT NULL,
  senia INTEGER NOT NULL,
  icon TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS turnos (
  id TEXT PRIMARY KEY,
  servicio_id TEXT NOT NULL REFERENCES servicios(id),
  fecha TEXT NOT NULL,               -- 'YYYY-MM-DD'
  hora TEXT NOT NULL,                -- 'HH:MM'
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'RESERVANDO_CON_TIMER'
    CHECK (estado IN (
      'RESERVANDO_CON_TIMER',
      'PENDIENTE_COMPROBANTE',
      'CONFIRMADO',
      'RECHAZADO',
      'EXPIRADO',
      'CANCELADO'
    )),
  reservado_hasta INTEGER,           -- epoch ms; NULL = ya no depende del timer
  comprobante_path TEXT,
  motivo_rechazo TEXT,
  admin_token TEXT NOT NULL,         -- secreto para aprobar/rechazar; va en el link de WhatsApp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Un solo slot activo por (fecha, hora), sin importar cuántos
-- turnos vencidos/rechazados haya en el historial para ese horario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_slot_activo
  ON turnos(fecha, hora)
  WHERE estado IN ('RESERVANDO_CON_TIMER', 'PENDIENTE_COMPROBANTE', 'CONFIRMADO');

CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
