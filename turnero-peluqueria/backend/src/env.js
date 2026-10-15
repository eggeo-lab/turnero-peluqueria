import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Carga backend/.env sin importar desde qué carpeta se arranque el
// proceso (dotenv/config lo busca en process.cwd()). Tiene que
// importarse antes que los módulos que leen process.env al cargarse,
// como lib/notifications.js.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
