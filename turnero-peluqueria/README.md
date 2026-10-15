# Turnero Peluquería — MVP

SaaS de turnos para peluquerías/barberías con seña manual (CBU/Alias),
bloqueo temporizado de 15' y aprobación de un clic para el peluquero.

## Estructura

El proyecto vive en una carpeta anidada dentro del repo:

```
<raíz del repo>/
├── CLAUDE.md
└── turnero-peluqueria/      # ← este README; Root Directory en Vercel
    ├── src/                 # Frontend — React + Vite
    ├── backend/             # Backend — Express + SQLite; Root Directory en Render
    ├── render.yaml
    └── vercel.json
```

## Cómo correrlo (dos terminales)

**Terminal 1 — Backend**
```bash
cd backend
npm install
cp .env.example .env   # cargar ADMIN_KEY para usar la bandeja /admin
npm run dev
```
Queda escuchando en `http://localhost:3001`. Al arrancar por primera vez
crea `backend/data.sqlite` y siembra el catálogo de servicios.

> En Windows sin Python, `npm install` puede fallar al compilar
> `better-sqlite3`. El paquete trae binarios precompilados, así que
> `npm install --ignore-scripts` funciona.

**Terminal 2 — Frontend**
```bash
npm install
cp .env.example .env   # opcional: sin .env usa http://localhost:3001/api
npm run dev
```
Queda en `http://localhost:5173`.

## Rutas

- `/` — flujo del cliente (servicio → fecha/hora → datos → seña → espera)
- `/admin` — bandeja de turnos protegida con `ADMIN_KEY`. Mientras
  WhatsApp no esté conectado es la forma de ver los turnos pendientes.
- `/admin/confirmar/:turnoId?t=TOKEN` — mini-webview de aprobación del peluquero

## Probar el flujo completo

Con las dos terminales corriendo y `ADMIN_KEY` cargada en `backend/.env`:
1. En una pestaña, hacé una reserva completa como cliente hasta subir el
   comprobante (podés adjuntar cualquier imagen).
2. En otra, entrá a `/admin`, ingresá la `ADMIN_KEY`, tocá el turno
   pendiente y aprobalo (o rechazalo).
3. Volvé a la primera pestaña: en unos segundos (polling cada ~2.5s) la
   pantalla de espera del cliente refleja el nuevo estado.

## Qué garantiza el anti doble-booking

`backend/src/db/schema.sql` define un índice único parcial sobre
`(fecha, hora)` para los turnos en estado activo. Es una constraint de
la base de datos, no una validación de aplicación — así que ni una
condición de carrera entre dos requests simultáneos puede reservar el
mismo horario dos veces. El timer de 15' en el frontend es UX; esta
constraint es la garantía real.

## Seguridad y autenticación

Cada turno tiene dos secretos, generados al reservar:

| Token | Quién lo tiene | Cómo viaja | Para qué |
|---|---|---|---|
| `client_token` | el cliente (solo en la respuesta de `POST /api/turnos`) | header `x-client-token` | ver su turno, subir comprobante, cancelar |
| `admin_token` | el peluquero (link de WhatsApp `?t=`) | header `x-admin-token` (o `?t=` para la imagen) | ver turno y comprobante, aprobar, rechazar |

- `GET /api/turnos/:id` sin token válido → `401`. El comprobante solo lo ve el peluquero.
- `GET /api/turnos/ocupados?fecha=YYYY-MM-DD` es público y devuelve solo `{ fecha, hora }`.
- `GET /api/turnos` (lista completa, para `/admin`) exige el header
  `x-admin-key` con el valor de `ADMIN_KEY`. **Si `ADMIN_KEY` no está
  configurada en el servidor responde `503 admin_deshabilitado`**: la
  bandeja queda deshabilitada, nunca abierta.
- Los comprobantes ya no se sirven en `/uploads`: van por
  `GET /api/turnos/:id/comprobante?t=ADMIN_TOKEN`.
- Rate limit (`express-rate-limit`): 30 respuestas con error cada 15
  minutos por IP en los endpoints con clave o token → `429`.
- El cliente guarda `{ id, token }` en `sessionStorage` para sobrevivir
  a una recarga; se borra al llegar a un estado terminal o al reservar otro turno.

## Notificaciones

`backend/src/lib/notifications.js` ya arma los mensajes de WhatsApp
(nuevo turno pendiente → peluquero; confirmación/rechazo → cliente).
Sin `EVOLUTION_API_URL` configurado en `backend/.env`, solo los
loguea en consola (modo mock) — así se puede probar todo el flujo sin
tener WhatsApp Business conectado todavía.

## Reglas de tiempo

- Reserva con hasta 24hs de anticipación, grilla de 30' entre las 9 y las 19.
- Cancelación del cliente hasta 3hs antes.
- Todo se valida en el backend (`backend/src/lib/reglas.js`), que usa
  siempre la zona `America/Argentina/Buenos_Aires` aunque el servidor
  corra en UTC.

## Pendiente para producción

- Reemplazar el polling por WebSockets si el volumen lo justifica.
- Multi-tenant: hoy el catálogo de servicios y la cuenta bancaria son
  de una sola peluquería.
- WhatsApp real: falta cargar `EVOLUTION_API_URL` / `EVOLUTION_API_KEY`
  / `ADMIN_WHATSAPP` en las variables de entorno del backend (hoy
  corre en modo mock).

## Deploy (Render + Vercel)

`render.yaml` y `vercel.json` están en esta carpeta (`turnero-peluqueria/`),
no en la raíz del repo:

- **Render** (backend): Root Directory `turnero-peluqueria/backend`. El
  servicio está configurado a mano en el dashboard; `render.yaml` queda
  como referencia (para usarlo como Blueprint hay que indicarle la ruta
  `turnero-peluqueria/render.yaml`). Variables: `CORS_ORIGIN`,
  `PUBLIC_APP_URL`, `ADMIN_KEY` y, cuando se conecte WhatsApp, las de Evolution API.
- **Vercel** (frontend): Root Directory `turnero-peluqueria`, preset Vite,
  variable `VITE_API_URL`. `vercel.json` hace el fallback de SPA.

Detalle importante: el plan free de Render usa disco efímero, así que
**el archivo SQLite (y los comprobantes subidos) se resetean en cada
redeploy**. Para un MVP en pruebas no es grave; si en algún momento hay
clientes reales dependiendo de esto, hay que sumar un disco persistente
en Render (Settings → Disks, tiene un costo chico) o migrar a Postgres.
