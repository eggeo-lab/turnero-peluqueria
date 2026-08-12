import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import turnosRouter from './routes/turnos.js';
import { expirarVencidos } from './lib/turnos.js';
import './db/index.js'; // inicializa/migra la base al arrancar

const app = express();
const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
  console.log(`[server] escuchando en http://localhost:${PORT} (CORS: ${ORIGIN})`);
});
