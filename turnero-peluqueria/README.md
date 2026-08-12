# Turnero Peluquería — MVP

SaaS de turnos para peluquerías/barberías con seña manual (CBU/Alias),
bloqueo temporizado de 15' y aprobación de un clic para el peluquero.

## Estructura

```
turnero-peluqueria/
├── src/            # Frontend — React + Vite
└── backend/        # Backend — Express + SQLite
```

## Cómo correrlo (dos terminales)

**Terminal 1 — Backend**
```bash
cd backend
npm install
cp .env.example .env   # opcional: revisar valores por defecto
npm run dev
```
Queda escuchando en `http://localhost:3001`. Al arrancar por primera vez
crea `backend/data.sqlite` y siembra el catálogo de servicios.

**Terminal 2 — Frontend**
```bash
npm install
npm run dev
```
Queda en `http://localhost:5173`. Ya tiene un `.env` apuntando a
`http://localhost:3001/api`.

## Rutas

- `/` — flujo del cliente (servicio → fecha/hora → datos → seña → espera)
- `/admin` — bandeja de turnos, solo para probar el flujo sin copiar el
  link a mano (en producción no existiría: el peluquero recibe el link
  directo por WhatsApp)
- `/admin/confirmar/:turnoId` — mini-webview de aprobación del peluquero

## Probar el flujo completo

Con las dos terminales corriendo, abrí dos pestañas del navegador:
1. En una, hacé una reserva completa como cliente hasta subir el
   comprobante (podés adjuntar cualquier imagen).
2. En la otra, entrá a `/admin`, tocá el turno pendiente y aprobalo (o
   rechazalo).
3. Volvé a la primera pestaña: en unos segundos (hace polling cada
   ~2.5s) la pantalla de espera del cliente refleja el nuevo estado.

## Qué garantiza el anti doble-booking

`backend/src/db/schema.sql` define un índice único parcial sobre
`(fecha, hora)` para los turnos en estado activo. Es una constraint de
la base de datos, no una validación de aplicación — así que ni una
condición de carrera entre dos requests simultáneos puede reservar el
mismo horario dos veces. El timer de 15' en el frontend es UX; esta
constraint es la garantía real.

## Notificaciones

`backend/src/lib/notifications.js` ya arma los mensajes de WhatsApp
(nuevo turno pendiente → peluquero; confirmación/rechazo → cliente).
Sin `EVOLUTION_API_URL` configurado en `backend/.env`, solo los
loguea en consola (modo mock) — así se puede probar todo el flujo sin
tener WhatsApp Business conectado todavía.

## Seguridad del link del peluquero

El link que recibe el peluquero por WhatsApp incluye un token
(`?t=...`) generado por turno y guardado en la base (`admin_token`).
Los endpoints `/aprobar` y `/rechazar` lo exigen y devuelven `401` si
falta o no coincide — probado con curl: sin token, con token
inventado, y con el token real. La bandeja demo (`/admin`) también
incluye el token en cada link porque, a diferencia de la app real, es
un atajo de desarrollo que no debería existir en producción.

## Cancelación del cliente

Desde la pantalla de espera (`/`, una vez que el turno está
`PENDIENTE_COMPROBANTE` o `CONFIRMADO`) el cliente puede cancelar,
siempre que falten 3hs o más para el turno — la regla se valida en el
backend (`cancelarTurno`), no solo en la UI.

## Importante: no lo pude probar en un navegador real

Todo lo de arriba lo verifiqué con `curl` contra el backend (que
prueba la lógica real) y con `npm run build` / `vite preview` (que
prueba que el bundle compila y las rutas de React Router resuelven
bien). Lo que **no** pude hacer es abrir la app en un navegador de
verdad y clickear — el sandbox donde corro no tiene forma de
descargar un Chromium headless. Antes de mostrárselo a un cliente,
probalo vos mismo end-to-end en el navegador.

## Pendiente para producción

- Reemplazar el polling por WebSockets si el volumen lo justifica.
- Multi-tenant: hoy el catálogo de servicios y la cuenta bancaria son
  de una sola peluquería.
- Si se despliega en un hosting estático (Netlify, Vercel, etc.), hay
  que configurar el fallback de SPA (todas las rutas → `index.html`)
  para que `/admin/confirmar/:id` no dé 404 al entrar directo por el
  link de WhatsApp.
- WhatsApp real: falta cargar `EVOLUTION_API_URL` / `EVOLUTION_API_KEY`
  / `ADMIN_WHATSAPP` en `backend/.env` (hoy corre en modo mock).
