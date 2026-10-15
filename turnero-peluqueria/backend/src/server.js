import './lib/reglas.js'; // primero: fija TZ=America/Argentina/Buenos_Aires
import './env.js'; // carga backend/.env antes que el resto
import express from 'express';
import cors from 'cors';
import turnosRouter from './routes/turnos.js';
import { expirarVencidos } from './lib/turnos.js';
import './db/index.js'; // inicializa/migra la base al arrancar

const app = express();
const PORT = process.env.PORT || 3001;

// Detrás del proxy de Render, req.ip (que usa el rate limit) tiene que
// salir de X-Forwarded-For; si no, todos los clientes comparten la IP
// del proxy y un atacante bloquearía a todos. Render setea RENDER=true.
const TRUST_PROXY = Number(process.env.TRUST_PROXY || (process.env.RENDER ? 1 : 0));
if (TRUST_PROXY) app.set('trust proxy', TRUST_PROXY);

// CORS_ORIGIN admite uno o varios orígenes separados por coma, para
// poder tener local + producción funcionando al mismo tiempo, ej:
// CORS_ORIGIN=http://localhost:5173,https://turnero-peluqueria.vercel.app
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Sin "origin" = requests server-to-server o curl; se permiten.
      // Origen no reconocido: se deniega en silencio (sin CORS headers,
      // el navegador lo bloquea solo) en vez de tirar un 500 con detalles.
      callback(null, !origin || ORIGINS.includes(origin));
    },
  })
);
app.use(express.json());
// Los comprobantes NO se sirven como estáticos: van por
// GET /api/turnos/:id/comprobante, que exige el admin_token.

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', turnosRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'error_interno', mensaje: err.message });
});

// Job de expiración: reemplaza al setInterval que antes corría en el
// navegador contra localStorage. Acá corre siempre, exista o no un
// cliente con la pestaña abierta.
const JOB_INTERVAL_MS = 15_000;
setInterval(() => {
  const liberados = expirarVencidos();
  if (liberados > 0) console.log(`[expirar] ${liberados} turno(s) liberado(s) por timer vencido`);
}, JOB_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`[server] escuchando en puerto ${PORT} (CORS: ${ORIGINS.join(', ')})`);
  console.log(`[server] zona horaria ${process.env.TZ} → hora local ${new Date().toString()}`);
});
