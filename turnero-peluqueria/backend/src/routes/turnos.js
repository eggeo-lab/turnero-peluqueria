import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import {
  crearReserva,
  adjuntarComprobante,
  aprobarTurno,
  rechazarTurno,
  cancelarTurno,
  autorizarTurno,
  getTurno,
  getComprobantePath,
  listTurnos,
  listOcupados,
  listServicios,
} from '../lib/turnos.js';
import { requireAdminKey, limiteAuth } from '../lib/auth.js';
import { notifyPeluquero, notifyClienteConfirmacion, notifyClienteRechazo } from '../lib/notifications.js';

const router = Router();

// backend/uploads, sin importar desde qué carpeta se arranque el proceso.
const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// La extensión sale de esta lista y no del nombre original: si no, un
// "x.html" declarado como image/png se guardaría (y serviría) como HTML.
const EXT_POR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      cb(null, `${nanoid(16)}${EXT_POR_MIME[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!EXT_POR_MIME[file.mimetype]) {
      return cb(new Error('Solo se aceptan imágenes'));
    }
    cb(null, true);
  },
});

const ERROR_HTTP = {
  slot_ocupado: 409,
  servicio_invalido: 400,
  fuera_de_ventana: 400,
  fuera_de_horario: 400,
  fuera_de_plazo: 400,
  fecha_invalida: 400,
  no_encontrado: 404,
  estado_invalido: 409,
  timer_vencido: 409,
  no_autorizado: 401,
};

function respondError(res, error, mensaje) {
  const status = ERROR_HTTP[error] || 400;
  res.status(status).json({ error, mensaje: mensaje || null });
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Exige el token del rol indicado para el turno de req.params.id:
//   'admin'   → header x-admin-token (el ?t= del link de WhatsApp)
//   'cliente' → header x-client-token (devuelto por POST /turnos)
//   'any'     → cualquiera de los dos; deja el rol resultante en req.rol
// tokenEnQuery: acepta el admin token también como ?t= (para <img src>,
// que no puede mandar headers).
function autorizar(rolRequerido, { tokenEnQuery = false } = {}) {
  return (req, res, next) => {
    const adminHeader = req.get('x-admin-token') || (tokenEnQuery ? req.query.t : undefined);
    const tokens = {
      adminToken: rolRequerido !== 'cliente' ? adminHeader : undefined,
      clientToken: rolRequerido !== 'admin' ? req.get('x-client-token') : undefined,
    };
    const result = autorizarTurno(req.params.id, tokens);
    if (result.error) return respondError(res, result.error);
    req.rol = result.rol;
    next();
  };
}

router.get('/servicios', (req, res) => {
  res.json(listServicios());
});

// Público: solo { fecha, hora } de los slots tomados, para pintar el
// selector de horarios. Sin nombres, teléfonos ni tokens.
router.get('/turnos/ocupados', (req, res) => {
  const { fecha } = req.query;
  if (typeof fecha !== 'string' || !FECHA_RE.test(fecha)) return respondError(res, 'fecha_invalida');
  res.json(listOcupados(fecha));
});

// Lista completa con datos de clientes y admin_token: solo bandeja /admin.
router.get('/turnos', limiteAuth, requireAdminKey, (req, res) => {
  const { fecha } = req.query;
  res.json(listTurnos({ fecha }));
});

router.get('/turnos/:id', limiteAuth, autorizar('any'), (req, res) => {
  res.json(getTurno(req.params.id, req.rol));
});

// Paso 1: bloquea el slot por 15' (o 409 si alguien se adelantó).
router.post('/turnos', (req, res) => {
  const { servicioId, fecha, hora, cliente } = req.body || {};
  if (!servicioId || !fecha || !hora || !cliente?.nombre || !cliente?.telefono) {
    return res.status(400).json({ error: 'datos_incompletos' });
  }
  const result = crearReserva({ servicioId, fecha, hora, cliente });
  if (result.error) return respondError(res, result.error, result.mensaje);
  res.status(201).json({ ...result.turno, clientToken: result.clientToken });
});

// Paso 2: sube el comprobante -> PENDIENTE_COMPROBANTE + avisa al peluquero.
// El token se valida antes de multer para no escribir archivos ajenos.
// Errores de multer (no es imagen, supera 8MB) son del cliente: 400, no 500.
function subirComprobante(req, res, next) {
  upload.single('comprobante')(req, res, (err) => {
    if (!err) return next();
    const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 8MB.' : 'Solo se aceptan imágenes.';
    res.status(400).json({ error: 'archivo_invalido', mensaje });
  });
}

router.post('/turnos/:id/comprobante', limiteAuth, autorizar('cliente'), subirComprobante, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'archivo_requerido' });

  const result = adjuntarComprobante(req.params.id, req.file.filename);
  if (result.error) {
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return respondError(res, result.error);
  }
  // El admin_token viaja únicamente por acá (al peluquero, vía WhatsApp).
  notifyPeluquero({ ...getTurno(req.params.id, 'admin'), adminToken: result.adminToken }).catch(() => {});
  res.json(result.turno);
});

// Imagen del comprobante: solo para el peluquero (admin_token). Ya no
// se sirve /uploads como estático público.
router.get('/turnos/:id/comprobante', limiteAuth, autorizar('admin', { tokenEnQuery: true }), (req, res) => {
  const archivo = getComprobantePath(req.params.id);
  if (!archivo) return respondError(res, 'no_encontrado');
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.sendFile(path.join(UPLOAD_DIR, archivo), (err) => {
    if (err && !res.headersSent) respondError(res, 'no_encontrado');
  });
});

// Paso 3: el peluquero aprueba o rechaza desde su link único.
router.post('/turnos/:id/aprobar', limiteAuth, autorizar('admin'), async (req, res) => {
  const result = aprobarTurno(req.params.id);
  if (result.error) return respondError(res, result.error);
  notifyClienteConfirmacion(result.turno).catch(() => {});
  res.json(result.turno);
});

router.post('/turnos/:id/rechazar', limiteAuth, autorizar('admin'), async (req, res) => {
  const result = rechazarTurno(req.params.id, req.body?.motivo);
  if (result.error) return respondError(res, result.error);
  notifyClienteRechazo(result.turno).catch(() => {});
  res.json(result.turno);
});

router.post('/turnos/:id/cancelar', limiteAuth, autorizar('cliente'), (req, res) => {
  const result = cancelarTurno(req.params.id);
  if (result.error) return respondError(res, result.error, result.mensaje);
  res.json(result.turno);
});

export default router;
