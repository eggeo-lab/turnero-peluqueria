# Turnero Peluquería — CLAUDE.md

MVP de un SaaS de turnos para peluquerías/barberías. Mobile-first, en español rioplatense.
Una sola peluquería (datos en `src/data/negocio.js`), no es multi-tenant. Seña manual por transferencia +
comprobante, bloqueo temporizado del slot y aprobación del peluquero con un link.

## Estructura (ojo: carpeta anidada)

La raíz de git **no** es el proyecto: todo vive en `turnero-peluqueria/`.

```
/                              ← raíz git (solo CLAUDE.md + turnero-peluqueria/)
└── turnero-peluqueria/        ← proyecto real; Root Directory en Vercel
    ├── package.json           frontend (React 19 + Vite 8 + react-router-dom 7)
    ├── .env.example           VITE_API_URL
    ├── index.html             carga Montserrat desde Google Fonts
    ├── vercel.json            rewrite SPA → /index.html
    ├── render.yaml            referencia de Render (el servicio real está configurado a mano)
    ├── src/
    │   ├── App.jsx            rutas: /, /admin, /admin/confirmar/:turnoId
    │   ├── index.css          tokens CSS (colores, tipografía, radios, --max-w)
    │   ├── pages/             ClientBookingPage (wizard cliente), AdminInboxPage (bandeja con ADMIN_KEY), AdminConfirmPage
    │   ├── components/
    │   │   ├── client/        pasos: Service → DateTime → ClientInfo → Payment → Waiting
    │   │   ├── admin/         AdminApproval (aprobar/rechazar)
    │   │   ├── layout/        AppShell (tarjeta ≥640px, panel de marca ≥960px)
    │   │   └── ui/            Badge, Button, CountdownRing, StepHeader, TicketCard
    │   ├── hooks/             useTurnos.js: useOcupados, useTurnosAdmin, useTurno (polling) + acciones; useCountdown
    │   ├── lib/               api.js (fetch + headers de auth + ApiError), slots.js (espejo de reglas.js)
    │   └── data/              negocio.js (nombre + CBU/Alias), services.js (nombre de ícono → Phosphor)
    └── backend/               ← Root Directory en Render: turnero-peluqueria/backend
        ├── package.json       Express 5, better-sqlite3, multer, nanoid, dotenv, express-rate-limit (ESM)
        ├── .env.example
        └── src/
            ├── server.js      CORS, trust proxy, /health, /api, job de expiración (15s)
            ├── env.js         carga backend/.env (ruta anclada, no depende del cwd)
            ├── routes/turnos.js   endpoints, middleware autorizar(rol), multer (whitelist de MIME, 8MB)
            ├── lib/reglas.js      fuente única de reglas de tiempo + TZ Argentina
            ├── lib/turnos.js      lógica de negocio, vistas por rol, máquina de estados
            ├── lib/auth.js        tokensIguales (timingSafeEqual), requireAdminKey, limiteAuth
            ├── lib/notifications.js  mensajes WhatsApp (Evolution API) / modo mock
            └── db/            schema.sql (tablas + índice anti doble booking), index.js (init + seed + chequeo de esquema)
```

## Comandos

Desde `turnero-peluqueria/` (dos terminales):

```bash
# Backend (http://localhost:3001). Cargar ADMIN_KEY en .env para usar /admin
cd backend && npm install && cp .env.example .env && npm run dev   # node --watch
# Windows sin Python: npm install --ignore-scripts (better-sqlite3 trae binarios precompilados)

# Frontend (http://localhost:5173)
npm install && npm run dev
npm run build      # build de producción (dist/)
npm run lint       # oxlint (avisa de `next` sin usar en el error handler de Express: es esperado)
```

Sin `VITE_API_URL` el frontend apunta a `http://localhost:3001/api`. La base `backend/data.sqlite`
se crea sola al arrancar y siembra los servicios. No hay tests automatizados.

## Reglas de negocio

- Reserva con máximo **24 hs** de anticipación, grilla **09:00–18:30 cada 30'**. Cancelación hasta **3 hs** antes.
- Seña manual: el cliente transfiere a CBU/Alias y sube el comprobante (imagen).
- Elegir horario bloquea el slot **15 min**.
- Fuente única: `backend/src/lib/reglas.js` (valida formato, fecha real, horario, grilla, ventana y plazo de cancelación).
  `src/lib/slots.js` es un espejo para la UI: mantenerlo en sync.
- Zona horaria: `reglas.js` fija `process.env.TZ = 'America/Argentina/Buenos_Aires'` al cargarse (Render corre en UTC).
  `server.js` lo importa primero.

### Máquina de estados (`backend/src/lib/turnos.js`)

```
POST /turnos ──► RESERVANDO_CON_TIMER ──(comprobante a tiempo)──► PENDIENTE_COMPROBANTE
                        │                                            │        │        │
                (vence 15', job c/15s)                       aprobar│ rechazar│ cancelar│ (≥3hs)
                        ▼                                            ▼        ▼        ▼
                    EXPIRADO                                  CONFIRMADO RECHAZADO CANCELADO
                                                                     └──cancelar (≥3hs)──► CANCELADO
```

- Activos (ocupan el slot): `ESTADOS_ACTIVOS` en `reglas.js` = `RESERVANDO_CON_TIMER`, `PENDIENTE_COMPROBANTE`, `CONFIRMADO`.
- `PENDIENTE_COMPROBANTE` no vence (`reservado_hasta = NULL`).
- Subir comprobante con timer vencido → `EXPIRADO` + 409 `timer_vencido`.

### API (`/api`) y autenticación

Cada turno tiene dos secretos (nanoid 24): `client_token` (del cliente) y `admin_token` (del peluquero).

| Método | Ruta | Auth |
|---|---|---|
| GET | `/servicios` | pública |
| GET | `/turnos/ocupados?fecha=YYYY-MM-DD` | pública; solo `[{fecha, hora}]` de estados activos |
| GET | `/turnos[?fecha=]` | header `x-admin-key` = `ADMIN_KEY`. **Sin `ADMIN_KEY` en el server → 503 `admin_deshabilitado`** |
| GET | `/turnos/:id` | `x-client-token` (sin `comprobanteUrl`) o `x-admin-token` (todo) |
| POST | `/turnos` | pública → 201 con `clientToken` (única vez que viaja) / 409 `slot_ocupado` / 400 `fuera_de_horario`, `fuera_de_ventana` |
| POST | `/turnos/:id/comprobante` | `x-client-token`; multipart `comprobante`; notifica al peluquero |
| GET | `/turnos/:id/comprobante?t=ADMIN_TOKEN` | admin (por query porque es un `<img src>`) |
| POST | `/turnos/:id/aprobar` · `/rechazar` | `x-admin-token` (`{motivo}` en body para rechazar) |
| POST | `/turnos/:id/cancelar` | `x-client-token`; valida estado y plazo de 3 hs |

- Endpoints con clave/token llevan `limiteAuth`: 30 respuestas con error / 15 min / IP → 429. Las exitosas no cuentan (el polling no consume cupo).
- Errores: `{ error: codigo, mensaje }`; mapeo a HTTP en `ERROR_HTTP` (routes/turnos.js).
- Frontend: el cliente guarda `{id, token}` en `sessionStorage` (`turnero:turno`) y lo borra en estado terminal o al
  "Reservar otro turno". La bandeja guarda la `ADMIN_KEY` en `localStorage` (`turnero:adminKey`); nunca va en el bundle.

## Decisiones técnicas (y por qué)

- **Anti doble booking en la base**: índice único parcial `idx_turnos_slot_activo` sobre `(fecha, hora)`
  `WHERE estado IN (activos)`. Dos requests simultáneas no pueden ganar el mismo slot; el INSERT que
  pierde tira `UNIQUE constraint failed` → 409. El timer del frontend es solo UX. Sintaxis compatible con Postgres.
  Por eso `validarHorario` rechaza fechas imposibles (`2026-10-32`): el índice compara texto.
- **Tokens por rol** en vez de sesiones/usuarios: no hay cuentas; cada link/reserva lleva su propio secreto.
  Comparación con `crypto.timingSafeEqual` sobre hashes SHA-256.
- **Bandeja `/admin` protegida, no eliminada**: con WhatsApp en mock es el único canal para que el peluquero vea pendientes.
- **Comprobantes fuera de estáticos**: se sirven con `nosniff` + CSP `default-src 'none'`; la extensión sale del MIME, no del nombre.
- **Polling, no WebSockets**: turno cada 2.5s, lista/ocupados cada 4s. Simple y suficiente para el volumen.
- **Expiración en el servidor** (`setInterval` 15s en server.js): funciona aunque nadie tenga la pestaña abierta.
- **Notificaciones** en `backend/src/lib/notifications.js`. Sin `EVOLUTION_API_URL` → modo mock (`console.info`). Fire-and-forget.
- **CORS_ORIGIN** acepta varios orígenes separados por coma; requests sin `Origin` (curl) se permiten.
- **Rutas ancladas con `import.meta.url`** (`.env`, `uploads/`, `data.sqlite`): el backend funciona desde cualquier cwd.

## Convenciones

- Todo en español: UI, nombres de dominio (`turno`, `servicio`, `senia`), códigos de error, comentarios.
- Tipografía única **Montserrat** (diferenciar por peso/tracking/escala, no por otra fuente).
- Íconos solo **@phosphor-icons/react**. El backend guarda el nombre del ícono como string; el mapeo está en `src/data/services.js`.
- Mobile-first; breakpoints de `AppShell.css`: 640px (tarjeta oscura) y 960px (panel de marca).
- Estilos: CSS plano por componente (`Componente.css` al lado del `.jsx`) usando las variables de `src/index.css`. Sin librerías de UI.
- DB en snake_case; la API devuelve camelCase (`rowToTurno`).

## Variables de entorno

Frontend (Vercel / `turnero-peluqueria/.env`, ver `.env.example`):
- `VITE_API_URL` — base de la API incluyendo `/api`. Default `http://localhost:3001/api`.

Backend (Render / `backend/.env`, ver `backend/.env.example`):
- `PORT` — default 3001.
- `CORS_ORIGIN` — orígenes permitidos, separados por coma.
- `PUBLIC_APP_URL` — URL del frontend; se usa para armar el link de aprobación.
- `ADMIN_KEY` — clave de la bandeja `/admin`. Vacía → `GET /api/turnos` responde 503.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` — WhatsApp vía Evolution API; vacías = mock.
- `ADMIN_WHATSAPP` — número del peluquero que recibe los avisos.
- `DB_PATH` — ruta del SQLite (default `backend/data.sqlite`).
- `TRUST_PROXY` — saltos de proxy para `req.ip` (rate limit). Default 1 si `RENDER` está seteada (Render lo hace), 0 si no.

## Deploy

- Repo: github.com/eggeo-lab/turnero-peluqueria. Cada push a `main` redeploya Render y Vercel.
- **Backend — Render (free)**: https://turnero-peluqueria.onrender.com · Root Directory `turnero-peluqueria/backend`,
  build `npm install`, start `npm start`, health `/health`. Variables: `CORS_ORIGIN`, `PUBLIC_APP_URL` (= URL de Vercel)
  y `ADMIN_KEY`. Faltan las de WhatsApp. `render.yaml` está en la carpeta anidada: como Blueprint hay que indicar su ruta.
- **Frontend — Vercel**: https://turnero-peluqueria-two.vercel.app · Root Directory `turnero-peluqueria`, preset Vite,
  `VITE_API_URL=https://turnero-peluqueria.onrender.com/api`. `vercel.json` hace el fallback de SPA.

## Limitaciones conocidas y pendientes

- **Disco efímero en Render free**: SQLite y comprobantes se pierden en cada redeploy. Producción real → disco persistente o Postgres.
- Render free duerme el backend: la primera request puede tardar ~50s.
- WhatsApp real sin conectar (modo mock). Hasta entonces el peluquero usa `/admin` con `ADMIN_KEY`.
- Verificado con build + curl; falta prueba manual completa en navegador.
- **Decisión de producto pendiente — duración de servicios**: cada turno ocupa un único slot de 30' aunque el servicio
  dure más (Color 90', Corte + Barba 45'). Definir si un servicio largo bloquea los slots siguientes y cómo se garantiza
  en la base (el índice actual es por `(fecha, hora)` exacta). No implementar sin decidirlo.
- Rate limit en memoria: se resetea al reiniciar y no se comparte entre instancias. Verificar en Render que `req.ip`
  sea la IP real del cliente (si `TRUST_PROXY=1` no alcanza, todos compartirían cupo).
- `POST /turnos` no tiene rate limit: alguien podría bloquear muchos slots por 15' cada uno.
- La grilla del frontend usa la hora local del navegador; un cliente fuera de Argentina vería horarios corridos (el backend igual valida).
- Constantes de tiempo duplicadas frontend/backend (`slots.js` ↔ `reglas.js`).
- Sin multi-tenant. Servicios sembrados en `backend/src/db/index.js`; datos del negocio en `src/data/negocio.js`.
- Posible mejora: aplanar la carpeta anidada (implica cambiar Root Directory en Render y Vercel).

## Reglas de trabajo para Claude

- No commitear `.env`, `backend/data.sqlite*` ni `backend/uploads/` (ya están en `.gitignore`). No hacer commit/push salvo pedido explícito.
- Nunca exponer `admin_token`, `client_token`, teléfono ni `comprobanteUrl` en endpoints públicos. `rowToTurno(row, rol)`
  arma la vista según el rol; los tokens no van nunca ahí (solo `listTurnos` agrega `adminToken`, detrás de `ADMIN_KEY`).
- Endpoints nuevos con clave/token: usar `autorizar(rol)` / `requireAdminKey` y `limiteAuth`.
- El anti doble booking vive en la base (índice único parcial). Cualquier cambio de estados o de cómo se ocupa un slot
  debe actualizar ese índice, no solo la UI.
- Cambios de esquema: `schema.sql` usa `CREATE ... IF NOT EXISTS` y no hay migraciones. En Render la base se recrea
  en cada deploy; en local hay que borrar `data.sqlite` (`db/index.js` corta el arranque si detecta una base vieja:
  actualizar ese chequeo al agregar columnas).
- Si se agrega un estado, actualizar: CHECK de `schema.sql`, índice parcial, `ESTADOS_ACTIVOS` (reglas.js), badges
  (`Badge.jsx`, `AdminInboxPage`), `WaitingStep` y `AdminApproval`.
- Cambios de reglas de tiempo: primero `reglas.js`, después el espejo `slots.js`.
- Respetar las convenciones de UI (Montserrat, Phosphor, variables CSS, mobile-first, español rioplatense).
