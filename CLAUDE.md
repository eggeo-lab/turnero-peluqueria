# Turnero Peluquería — CLAUDE.md

MVP de un SaaS de turnos para peluquerías/barberías. Mobile-first, en español rioplatense.
Una sola peluquería ("Estudio Navaja"), no es multi-tenant. Seña manual por transferencia +
comprobante, bloqueo temporizado del slot y aprobación del peluquero con un link.

## Estructura (ojo: carpeta anidada)

La raíz de git **no** es el proyecto: todo vive en `turnero-peluqueria/`.

```
/                              ← raíz git (solo CLAUDE.md + turnero-peluqueria/)
└── turnero-peluqueria/        ← proyecto real; Root Directory en Vercel
    ├── package.json           frontend (React 19 + Vite 8 + react-router-dom 7)
    ├── index.html             carga Montserrat desde Google Fonts
    ├── vercel.json            rewrite SPA → /index.html
    ├── render.yaml            blueprint de Render (ver "Deploy": su rootDir no coincide)
    ├── src/
    │   ├── App.jsx            rutas: /, /admin, /admin/confirmar/:turnoId
    │   ├── index.css          tokens CSS (colores, tipografía, radios, --max-w)
    │   ├── pages/             ClientBookingPage (wizard cliente), AdminInboxPage (demo), AdminConfirmPage
    │   ├── components/
    │   │   ├── client/        pasos: Service → DateTime → ClientInfo → Payment → Waiting
    │   │   ├── admin/         AdminApproval (aprobar/rechazar)
    │   │   ├── layout/        AppShell (tarjeta ≥640px, panel de marca ≥960px)
    │   │   └── ui/            Badge, Button, CountdownRing, StepHeader, TicketCard
    │   ├── hooks/             useTurnos/useTurno (polling), useCountdown
    │   ├── lib/               api.js (fetch + ApiError), slots.js (grilla y reglas de tiempo)
    │   │                      notifications.js = código muerto (no se importa; lo real está en backend)
    │   └── data/services.js   CBU/Alias hardcodeados + mapa nombre→ícono Phosphor
    └── backend/               ← Root Directory en Render: turnero-peluqueria/backend
        ├── package.json       Express 5, better-sqlite3, multer, nanoid, dotenv (ESM)
        ├── .env.example
        └── src/
            ├── server.js      CORS, /health, /uploads estático, /api, job de expiración (15s)
            ├── routes/turnos.js   endpoints + multer (solo image/*, máx 8MB)
            ├── lib/turnos.js      lógica de negocio y máquina de estados
            ├── lib/notifications.js  mensajes WhatsApp (Evolution API) / modo mock
            └── db/            schema.sql (tablas + índice anti doble booking), index.js (init + seed servicios)
```

## Comandos

Desde `turnero-peluqueria/` (dos terminales):

```bash
# Backend (http://localhost:3001) — correrlo SIEMPRE desde backend/ (uploads usa process.cwd())
cd backend && npm install && cp .env.example .env && npm run dev   # node --watch

# Frontend (http://localhost:5173)
npm install && npm run dev
npm run build      # build de producción (dist/)
npm run lint       # oxlint
```

Sin `VITE_API_URL` el frontend apunta a `http://localhost:3001/api`. La base `backend/data.sqlite`
se crea sola al arrancar y siembra los servicios. No hay tests automatizados.

## Reglas de negocio

- Reserva con máximo **24 hs** de anticipación. Grilla 09:00–19:00 cada 30' (solo en `src/lib/slots.js`).
- Seña manual: el cliente transfiere a CBU/Alias y sube el comprobante (imagen).
- Elegir horario bloquea el slot **15 min**. Cancelación del cliente hasta **3 hs** antes.
- Las constantes están duplicadas en `src/lib/slots.js` y `backend/src/lib/turnos.js`: mantenerlas en sync.
  La validación que manda es la del backend.

### Máquina de estados (`backend/src/lib/turnos.js`)

```
POST /turnos ──► RESERVANDO_CON_TIMER ──(comprobante a tiempo)──► PENDIENTE_COMPROBANTE
                        │                                            │        │        │
                (vence 15', job c/15s)                       aprobar│ rechazar│ cancelar│ (≥3hs)
                        ▼                                            ▼        ▼        ▼
                    EXPIRADO                                  CONFIRMADO RECHAZADO CANCELADO
                                                                     └──cancelar (≥3hs)──► CANCELADO
```

- Activos (ocupan el slot): `RESERVANDO_CON_TIMER`, `PENDIENTE_COMPROBANTE`, `CONFIRMADO`.
- `PENDIENTE_COMPROBANTE` no vence (`reservado_hasta = NULL`).
- Subir comprobante con timer vencido → `EXPIRADO` + 409 `timer_vencido`.

### API (`/api`)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/servicios` | catálogo activo |
| GET | `/turnos[?fecha=]` | **incluye `adminToken`** (ver Limitaciones) |
| GET | `/turnos/:id` | sin token |
| POST | `/turnos` | `{servicioId, fecha, hora, cliente:{nombre,telefono}}` → 201 / 409 `slot_ocupado` |
| POST | `/turnos/:id/comprobante` | multipart `comprobante`; notifica al peluquero |
| POST | `/turnos/:id/aprobar` · `/rechazar` | `{token[, motivo]}` (o `?token=`); 401 sin token válido |
| POST | `/turnos/:id/cancelar` | sin auth; valida estado y plazo de 3 hs |

Errores: `{ error: codigo, mensaje }`; mapeo de códigos a HTTP en `ERROR_HTTP` (routes/turnos.js).

## Decisiones técnicas (y por qué)

- **Anti doble booking en la base**: índice único parcial `idx_turnos_slot_activo` sobre `(fecha, hora)`
  `WHERE estado IN (activos)`. Dos requests simultáneas no pueden ganar el mismo slot; el INSERT que
  pierde tira `UNIQUE constraint failed` → 409. El timer del frontend es solo UX. Sintaxis compatible con Postgres.
- **`admin_token` por turno** (nanoid 24): protege aprobar/rechazar. Nunca sale en `GET /turnos/:id` ni en
  la respuesta del comprobante; viaja solo en el link de WhatsApp `/admin/confirmar/:id?t=TOKEN`.
- **Polling, no WebSockets**: turno cada 2.5s, lista cada 4s (`src/hooks/useTurnos.js`). Simple y suficiente
  para el volumen; el hook aísla a los componentes si se cambia a WS.
- **Expiración en el servidor** (`setInterval` 15s en server.js), no en el navegador: funciona aunque nadie tenga la pestaña abierta.
- **Notificaciones** en `backend/src/lib/notifications.js` (peluquero al subir comprobante; cliente al
  aprobar/rechazar). Sin `EVOLUTION_API_URL` → modo mock (`console.info`). Son fire-and-forget.
- **CORS_ORIGIN** acepta varios orígenes separados por coma; requests sin `Origin` (curl) se permiten.

## Convenciones

- Todo en español: UI, nombres de dominio (`turno`, `servicio`, `senia`), códigos de error, comentarios.
- Tipografía única **Montserrat** (diferenciar por peso/tracking/escala, no por otra fuente).
- Íconos solo **@phosphor-icons/react**. El backend guarda el nombre del ícono como string; el mapeo está en `src/data/services.js`.
- Mobile-first; breakpoints de `AppShell.css`: 640px (tarjeta oscura) y 960px (panel de marca).
- Estilos: CSS plano por componente (`Componente.css` al lado del `.jsx`) usando las variables de `src/index.css`. Sin librerías de UI.
- DB en snake_case; la API devuelve camelCase (`rowToTurno`).

## Variables de entorno

Frontend (Vercel / `turnero-peluqueria/.env`):
- `VITE_API_URL` — base de la API incluyendo `/api`. Default `http://localhost:3001/api`.

Backend (Render / `backend/.env`):
- `PORT` — default 3001.
- `CORS_ORIGIN` — orígenes permitidos, separados por coma.
- `PUBLIC_APP_URL` — URL del frontend; se usa para armar el link de aprobación.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` — WhatsApp vía Evolution API; vacías = mock.
- `ADMIN_WHATSAPP` — número del peluquero que recibe los avisos.
- `DB_PATH` — ruta del SQLite (default `backend/data.sqlite`).

## Deploy

- Repo: github.com/eggeo-lab/turnero-peluqueria. Cada push a `main` redeploya Render y Vercel.
- **Backend — Render (free)**: https://turnero-peluqueria.onrender.com · Root Directory `turnero-peluqueria/backend`,
  build `npm install`, start `npm start`, health `/health`. Variables cargadas: `CORS_ORIGIN` y `PUBLIC_APP_URL`
  (= URL de Vercel). Faltan las de WhatsApp.
  ⚠️ `render.yaml` dice `rootDir: backend` (relativo a la carpeta anidada): el servicio se configuró a mano en el
  dashboard; si alguna vez se usa como Blueprint hay que corregirlo a `turnero-peluqueria/backend`.
- **Frontend — Vercel**: https://turnero-peluqueria-two.vercel.app · Root Directory `turnero-peluqueria`, preset Vite,
  `VITE_API_URL=https://turnero-peluqueria.onrender.com/api`. `vercel.json` hace el fallback de SPA.

## Limitaciones conocidas y pendientes

- **Disco efímero en Render free**: SQLite y comprobantes se pierden en cada redeploy. Producción real → disco persistente o Postgres.
- Render free duerme el backend: la primera request puede tardar ~50s.
- WhatsApp real sin conectar (modo mock).
- Verificado solo con `npm run build` (frontend) y curl (backend). Falta prueba manual completa en navegador.
- **`GET /api/turnos` expone el `adminToken` de todos los turnos** y no es solo de la bandeja: `ClientBookingPage`
  también lo consume (para pintar slots ocupados). Cualquiera puede aprobar/rechazar. Antes de producción: sacar
  el token de la lista y crear un endpoint público de slots ocupados (solo `fecha`/`hora`). La bandeja `/admin` no debe existir.
- `/cancelar` no tiene auth: basta con el id del turno (que la lista expone).
- **Zona horaria**: el backend interpreta `fecha`/`hora` con la hora local del servidor; Render corre en UTC y el
  cliente en ART (−3). Las validaciones de 24 hs / "ya pasó" / 3 hs quedan corridas 3 hs. Solución probable: `TZ=America/Argentina/Buenos_Aires` en Render.
- El backend no valida horario de atención ni grilla de 30', y no considera la duración del servicio (un color de 90' ocupa un solo slot).
- Comprobantes servidos públicamente en `/uploads/<nombre-aleatorio>`.
- Sin multi-tenant. Servicios sembrados en `backend/src/db/index.js`; CBU/Alias en `src/data/services.js`; marca en `AppShell.jsx`.
- `AdminInboxPage` no tiene badge para `CANCELADO`.
- Posible mejora: aplanar la carpeta anidada (implica cambiar Root Directory en Render y Vercel).

## Reglas de trabajo para Claude

- No commitear `.env`, `backend/data.sqlite*` ni `backend/uploads/` (ya están en `.gitignore`). No hacer commit/push salvo pedido explícito.
- Nunca exponer `admin_token` en endpoints públicos nuevos; `rowToTurno` no lo incluye a propósito.
- El anti doble booking vive en la base (índice único parcial). Cualquier cambio de estados o de cómo se ocupa un slot
  debe actualizar ese índice, no solo la UI.
- Cambios de esquema: `schema.sql` usa `CREATE ... IF NOT EXISTS` y no hay migraciones. En Render la base se recrea
  en cada deploy; en local, un `ALTER` no se aplica solo a una base existente (borrar `data.sqlite` o migrar a mano).
- Si se agrega un estado, actualizar: CHECK de `schema.sql`, índice parcial, `ESTADOS_ACTIVOS` (DateTimeStep), badges y `WaitingStep`.
- Mantener en sync las constantes de tiempo frontend/backend; la validación real es la del backend.
- Respetar las convenciones de UI (Montserrat, Phosphor, variables CSS, mobile-first, español rioplatense).
