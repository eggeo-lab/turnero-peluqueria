import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import {
  crearReserva,
  adjuntarComprobante,
  aprobarTurno,
  rechazarTurno,
  cancelarTurno,
  getTurno,
  listTurnos,
  listServicios,
} from '../lib/turnos.js';
import { notifyPeluquero, notifyClienteConfirmacion, notifyClienteRechazo } from '../lib/notifications.js';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${nanoid(16)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se aceptan imágenes'));
    }
    cb(null, true);
  },
});

const ERROR_HTTP = {
  slot_ocupado: 409,
  servicio_invalido: 400,
  fuera_de_ventana: 400,
  fuera_de_plazo: 400,
  no_encontrado: 404,
  estado_invalido: 409,
  timer_vencido: 409,
  no_autorizado: 401,
};

function respondError(res, error, mensaje) {
  const status = ERROR_HTTP[error] || 400;
  res.status(status).json({ error, mensaje: mensaje || null });
}

router.get('/servicios', (req, res) => {
  res.json(listServicios());
});

// Lista turnos (usado por la bandeja demo y para pintar los slots
// ocupados del selector de horarios).
router.get('/turnos', (req, res) => {
  const { fecha } = req.query;
  res.json(listTurnos({ fecha }));
});

router.get('/turnos/:id', (req, res) => {
  const turno = getTurno(req.params.id);
  if (!turno) return res.status(404).json({ error: 'no_encontrado' });
  res.json(turno);
});

// Paso 1: bloquea el slot por 15' (o 409 si alguien se adelantó).
router.post('/turnos', (req, res) => {
  const { servicioId, fecha, hora, cliente } = req.body || {};
  if (!servicioId || !fecha || !hora || !cliente?.nombre || !cliente?.telefono) {
    return res.status(400).json({ error: 'datos_incompletos' });
  }
  const result = crearReserva({ servicioId, fecha, hora, cliente });
  if (result.error) return respondError(res, result.error, result.mensaje);
  res.status(201).json(result.turno);
});

// Paso 2: sube el comprobante -> PENDIENTE_COMPROBANTE + avisa al peluquero.
router.post('/turnos/:id/comprobante', upload.single('comprobante'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'archivo_requerido' });

  const result = adjuntarComprobante(req.params.id, req.file.filename);
  if (result.error) {
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    return respondError(res, result.error);
  }
  // El token de aprobación viaja únicamente por acá (al peluquero, vía
  // WhatsApp) — nunca se lo devolvemos al cliente en la respuesta HTTP.
  notifyPeluquero({ ...result.turno, adminToken: result.adminToken }).catch(() => {});
  res.json(result.turno);
});

// Paso 3: el peluquero aprueba o rechaza desde su link único. El token
// viaja en el body (o query, por si se prueba pegando el link directo)
// y tiene que matchear el que se generó al crear el turno.
router.post('/turnos/:id/aprobar', async (req, res) => {
  const token = req.body?.token || req.query?.token;
  const result = aprobarTurno(req.params.id, token);
  if (result.error) return respondError(res, result.error);
  notifyClienteConfirmacion(result.turno).catch(() => {});
  res.json(result.turno);
});

router.post('/turnos/:id/rechazar', async (req, res) => {
  const token = req.body?.token || req.query?.token;
  const motivo = req.body?.motivo;
  const result = rechazarTurno(req.params.id, token, motivo);
  if (result.error) return respondError(res, result.error);
  notifyClienteRechazo(result.turno).catch(() => {});
  res.json(result.turno);
});

router.post('/turnos/:id/cancelar', (req, res) => {
  const result = cancelarTurno(req.params.id);
  if (result.error) return respondError(res, result.error, result.mensaje);
  res.json(result.turno);
});

export default router;
