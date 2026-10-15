import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// No hay migraciones: schema.sql solo crea lo que falta. Si la base es
// anterior a un cambio de columnas (ej. client_token), se avisa en vez
// de fallar más adelante con un error de SQL confuso.
const columnas = db.prepare('PRAGMA table_info(turnos)').all().map((c) => c.name);
if (!columnas.includes('client_token')) {
  console.error(`[db] ${DB_PATH} tiene un esquema viejo (falta turnos.client_token). Borrala y reiniciá.`);
  process.exit(1);
}

// Seed del catálogo de servicios si la tabla está vacía. En producción
// esto lo administraría el peluquero desde un panel, no un seed fijo.
const yaTieneServicios = db.prepare('SELECT COUNT(*) AS n FROM servicios').get().n > 0;
if (!yaTieneServicios) {
  const insert = db.prepare(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, senia, icon) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const seed = db.transaction((servicios) => {
    for (const s of servicios) insert.run(s.id, s.nombre, s.duracionMin, s.precio, s.senia, s.icon);
  });
  seed([
    { id: 'corte-clasico', nombre: 'Corte clásico', duracionMin: 30, precio: 6500, senia: 2000, icon: 'Scissors' },
    { id: 'corte-barba', nombre: 'Corte + Barba', duracionMin: 45, precio: 9800, senia: 3000, icon: 'Razor' },
    { id: 'barba', nombre: 'Perfilado de barba', duracionMin: 20, precio: 4200, senia: 1500, icon: 'Faders' },
    { id: 'color', nombre: 'Color / Platinado', duracionMin: 90, precio: 21000, senia: 6000, icon: 'PaintBrush' },
  ]);
  console.log('[db] catálogo de servicios sembrado');
}

console.log(`[db] SQLite listo en ${DB_PATH}`);
