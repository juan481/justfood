# JustFood

SaaS marca blanca de gestión gastronómica — Next.js (App Router, TS) + Prisma + PostgreSQL + Socket.IO, un solo proceso Node (`server.ts`) pensado para correr con PM2 detrás de Nginx en el VPS de Hetzner (HestiaCP).

El plan completo (arquitectura, modelo de datos, agente de WhatsApp con Gemini, roadmap por fases) vive en `C:\Users\Juanc\.claude\plans\act-a-como-un-arquitecto-twinkly-wigderson.md`. La referencia de diseño (los 12 screens exportados de Stitch + los dos DESIGN.md, ya descartados) está en [`design-reference/`](./design-reference/).

## Estado actual: Fases 0, 1, 2a, 3, 5 completas y probadas en local. Fase 2d y 4 construidas, sin credenciales reales para probarlas de punta a punta.

Todo esto está construido y probado **contra la base de datos local** (Docker). Nada tocó el sitio en vivo de pizzazeka.com.ar ni el VPS — eso es el paso de "subir" que sigue pendiente (ver Pendiente).

### Hecho y probado de punta a punta

**Fundación (Fase 0):** Next.js + TypeScript + Tailwind con el tema oscuro "Command Bar" (único sistema visual de toda la app). `server.ts` (Next.js + Socket.IO en un proceso). Auth con NextAuth + bcrypt + sesión JWT con `tenantId`/`branchId`/`role`. Postgres local vía Docker (puerto `5434`).

**Catálogo y pedidos, canales Web + Mostrador + WhatsApp manual (Fase 1 + 2a):**
- Schema Prisma completo: catálogo, pedidos, reservas, leads, settings, config de pagos/POS (secretos encriptados con `src/lib/crypto.ts`), zonas de delivery.
- **ETL** (`npm run etl:pizzazeka`) migró los datos reales de `PizzaZeka/data.sqlite` (56 productos, 7 pedidos, mesas, reservas, leads) desde una copia local — nunca tocó el original. Re-corrible. Encontró y corrigió un bug real: precios truncados en 2 pedidos del dato fuente (`items_json` no es JSON real) que ahora se preservan en notas en vez de migrarse como $0.
- API pública con auth por API key + `Idempotency-Key`, recálculo de precio siempre en el server (fix del bug de confianza del prototipo).
- API admin: CRUD de productos, KDS, cambio de estado con concurrencia optimista (`version` + grafo de transiciones válidas), pedido de mostrador/WhatsApp manual (mismo modal, badge de canal).
- UI `/menu` y `/kds` (4 columnas, tiempo real, banner+sonido, drawer, modal de nuevo pedido).

**Comanda + hardening de KDS (Fase 3):**
- Impresión de comanda vía navegador (`/kds/print/[id]`, formato 80mm, dispara `window.print()` solo) — sin agente local de impresión todavía (necesita una impresora física real para probar contra ESC/POS; queda documentado como próximo paso, no construido a ciegas).
- Polling de respaldo cada 20s en el KDS además del push por Socket.IO, para que un evento perdido nunca desincronice el tablero para siempre.

**Alta de un segundo tenant + aislamiento (Fase 5):**
- `npm run onboard:tenant` — crea Tenant + sucursal default + categorías base + usuario admin, sin tocar código.
- **Probado con un tenant de prueba real** (`demo-resto-2`): confirmé aislamiento en las 3 capas — un producto/pedido de un tenant no aparece en el menú/KDS público del otro, un admin de un tenant recibe 404 al intentar editar/borrar un producto ajeno por ID, y un cliente de Socket.IO conectado a la room de un tenant **no** recibe los eventos `order:new` del otro (verificado con un cliente real, no en teoría).

**Cola "Pagos por Revisar" (Fase 2d, schema y flujo completos — sin OCR real todavía):**
- `PaymentReceipt` + validación automática (monto, alias/CVU, número de operación duplicado) en `src/lib/payment-receipt-validation.ts`.
- Pantalla `/pagos`: pedidos esperando comprobante → carga manual de los datos (stand-in de lo que hará Gemini Vision) → cola de revisión con flags → aprobar/rechazar.
- **Probado de punta a punta**: pedido por transferencia queda invisible en el KDS hasta aprobar el comprobante; aprobar lo pasa a `NUEVO` y lo mete al KDS por el mismo camino en tiempo real que cualquier pedido nuevo; probé los 3 flags (coincide, monto no coincide, operación duplicada) con casos reales.
- Lo único que falta acá es la extracción automática por Gemini Vision (Fase 2d "real") — hoy el monto/alias/n° de operación se cargan a mano, pero el endpoint (`POST /api/v1/admin/payment-receipts`) es el mismo que va a usar la extracción automática el día que haya `GEMINI_API_KEY`.

**Mercado Pago Checkout Pro + Fudo POS (Fase 4 — código construido, NO probado contra las APIs reales):**
- `src/lib/mercadopago.ts`: creación de preferencia + consulta de pago, porteado de los mismos endpoints que ya usaba el prototipo.
- `POST /api/v1/public/[tenantSlug]/payment/mp-webhook`: el webhook de confirmación que el prototipo **nunca tuvo** — cierra el loop (createPreference → cliente paga en MP → MP notifica → se confirma el pago consultando la API de MP → recién ahí el pedido pasa a cocina). Los pedidos por Mercado Pago ahora también quedan en `EN_ESPERA_PAGO` hasta la confirmación real (antes de esta fase entraban directo, sin verificar nada).
- `src/lib/fudo.ts`: port directo de `sendOrderToFudo()` del prototipo, se dispara solo (fire-and-forget, nunca bloquea el pedido) cuando un pedido entra a cocina — pero sigue *deshabilitado* para pizzazeka (`fudo_enabled=0`, igual que en el dato migrado).
- `npm run set:payment-config -- <tenant> --mp-token=... --fudo-token=...` para cargar credenciales reales desde la terminal (no hay pantalla de settings todavía, es backlog del plan).
- **Verifiqué que el código ejecuta correctamente** hasta la llamada real (probé con un token de Mercado Pago inventado: el pedido queda bloqueado como corresponde, la preferencia se intenta crear, MP la rechaza por token inválido, y el error se maneja prolijamente sin romper nada) — pero **nadie probó esto contra una cuenta real o sandbox de Mercado Pago/Fudo**. Antes de confiarle plata real, hay que probarlo con credenciales de verdad.

### Sin arrancar — bloqueado por credenciales externas que no tengo

Esto es lo único que falta del roadmap y necesita cuentas/API keys que solo Juan puede conseguir — no es código que yo pueda simplemente escribir a ciegas y confiar:

- **Fase 2b (agente conversacional Gemini) + 2c (geovalidación)**: necesita `GEMINI_API_KEY`, acceso a WhatsApp Business Platform (Meta Cloud API — mismo patrón que NISSI pero cuenta/número separado) y una `GOOGLE_GEOCODING_API_KEY` con billing habilitado. El schema para esto (`WaConversation`/`WaMessage`) todavía no existe — se agrega recién cuando arranque esta fase, para no construir contra una API que no puedo probar.
- **Mercado Pago y Fudo reales**: necesita un access token real (o de sandbox) de MP y un token real de Fudo para validar que el código que ya está escrito funciona de verdad.

## Cómo levantarlo en local

```bash
docker compose up -d          # Postgres local en :5434
cp .env.example .env          # completar si hace falta
npm install
npm run db:push               # o npm run db:migrate — crea las tablas
npm run db:seed               # siembra pizzazeka + admin (password: changeme123)
npm run etl:pizzazeka          # migra los datos reales de PizzaZeka (requiere ../PizzaZeka/data.sqlite)
npm run generate:api-key -- pizzazeka "sitio web"   # para probar /api/v1/public/.../orders
npm run dev                   # http://localhost:3010
```

Login de prueba: restaurante `pizzazeka`, usuario `admin`, contraseña `changeme123`.

Otros scripts útiles: `npm run onboard:tenant -- <slug> "<nombre>"` (alta de un restaurante nuevo), `npm run set:payment-config -- <slug> --mp-token=... --fudo-token=...` (credenciales de pago/POS).

## Pendiente — necesita acceso al VPS/infraestructura, no es código

- **Postgres en el VPS**: HestiaCP es MySQL-first — instalar a mano (`apt install postgresql`).
- **Nginx**: location block para `food.justcreate.com` (o el subdominio de staging) apuntando al puerto `3010`, con headers de upgrade de WebSocket para `/socket.io/`.
- **PM2**: `pm2 start ecosystem.config.js` una vez que Postgres y el `.env` de producción estén listos.
- **`NEXTAUTH_SECRET` y `ENCRYPTION_KEY` reales**: generar con `openssl rand -base64 32` para cualquier ambiente que no sea tu máquina local.
- **El corte real de pizzazeka.com.ar**: repuntar el `index.html` actual de PizzaZeka a esta API (con la API key real, no la de test), correr el ETL una última vez contra un snapshot fresco de la base en vivo, y cambiar el bloque de Nginx del sitio — ver el plan aprobado, Fase 1, para el procedimiento completo con rollback.

## Próximo paso

Con Web + Mostrador + WhatsApp manual + Pagos por Revisar + MP/Fudo (código) funcionando en local, lo que queda depende de vos: (1) conseguir las credenciales de Gemini/Meta WhatsApp/Google Geocoding para arrancar la Fase 2b-2c, (2) conseguir un token real o de sandbox de Mercado Pago/Fudo para validar la Fase 4, o (3) decidir que ya es momento de "subir" — corte real al VPS. Avisame cuál preferís y sigo.
