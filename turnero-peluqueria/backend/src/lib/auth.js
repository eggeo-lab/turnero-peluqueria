import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';

// Comparación en tiempo constante. Se hashean ambos lados para que
// timingSafeEqual reciba buffers del mismo largo y no filtre el largo
// del secreto.
export function tokensIguales(recibido, esperado) {
  if (typeof recibido !== 'string' || typeof esperado !== 'string' || !recibido || !esperado) {
    return false;
  }
  const a = crypto.createHash('sha256').update(recibido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

// Protege la lista completa de turnos (bandeja /admin). Sin ADMIN_KEY
// configurada el endpoint queda deshabilitado (503), nunca abierto.
export function requireAdminKey(req, res, next) {
  const clave = process.env.ADMIN_KEY;
  if (!clave) {
    return res.status(503).json({
      error: 'admin_deshabilitado',
      mensaje: 'ADMIN_KEY no está configurada en el servidor.',
    });
  }
  if (!tokensIguales(req.get('x-admin-key'), clave)) {
    return res.status(401).json({ error: 'no_autorizado', mensaje: null });
  }
  next();
}

// Freno a fuerza bruta sobre endpoints con clave o token. Solo cuentan
// las respuestas con error (>= 400), así el polling legítimo (turno cada
// 2.5s, lista cada 4s) no consume cupo. Store en memoria: se resetea al
// reiniciar el proceso, suficiente para una sola instancia.
export const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'demasiados_intentos', mensaje: 'Demasiados intentos fallidos. Probá en unos minutos.' },
});
