# PRP-myvipers-004 — Suscripción de pago (activación automática vía Stripe)

**Estado:** DESPLEGADO (2026-09-27): 012 aplicada en prod (backup `backup-pre-012`), `stripe-billing` pusheada y desplegada `--prod` a mvipers (myvipers.es) y el-machay. **Probado en modo Test (2026-09-27)** con Tienda Demo: suscribir → `active` (customer, subscription, lookup_key y periodo guardados) y cancelar inmediato → `canceled`. **EN LIVE (2026-09-27)**: clave restringida propia `MyVipers Production` (plantilla "Facturación y suscripciones recurrentes") + webhook Live en Vercel `mvipers`; redesplegado; el panel lee precios Live (PEN 49/mes, 490/año). Tienda Demo limpiada de datos Test. La clave estándar de la cuenta VERIOSKA no la usa nadie desde 2026-09-11 (Dental Cloud usa su restringida "Verioska Backend Production").
**Owner:** Misael

## 1. Punto de partida real (verificado 2026-09-27)

El PRP asumía que no había nada construido. No era así:

| Pieza | Estado encontrado |
|---|---|
| Migración `012-stripe-billing.sql` (columnas Stripe en `restaurants`) | Escrita, **no aplicada en prod** |
| `POST /api/stripe/checkout` | Existía; la **región venía del cliente** (TODO de seguridad) |
| `POST /api/stripe/webhook` | Existía; **sin lista blanca**, solo eventos `customer.subscription.*` |
| Billing Portal | No existía |
| Pantalla de facturación en el panel | No existía (nada llamaba al checkout) |
| Variables en Vercel `mvipers` (myvipers.es) | **Ninguna** de Stripe |

Producción (myvipers.es) ya corre el código de `stripe-billing` (desplegado por CLI; `main` va por detrás). El webhook responde 503 "Webhook no configurado".

## 2. Qué se hizo

- **`src/shared/lib/billing.ts`** (lógica pura, testeada): región por país, lista blanca de `lookup_key`, mapeo de estados, extracción de ids de eventos (formas de API antigua y nueva de Stripe).
- **Checkout**: la región se decide en **servidor** desde `restaurants.country` (PE → `pen`, Europa → `eur`, resto → `latam`, sin país → `eur`). Si la región PEN no tiene precio en Stripe, cobra la tarifa LATAM. Si ya hay suscripción viva → 409 (se gestiona en el portal; evita dos suscripciones). Metadata `restaurant_id` + `plan_lookup_key` + `product=myvipers`.
- **Webhook**: escucha `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. Resuelve la suscripción, la **re-lee de Stripe** (fuente de verdad, idempotente ante eventos desordenados) e **ignora cualquier precio fuera de la lista blanca** antes de tocar la BD (cuenta Stripe compartida con Dental Cloud). Secret: `STRIPE_WEBHOOK_SECRET_MYVIPERS` (acepta `STRIPE_WEBHOOK_SECRET` por compatibilidad).
- **Portal**: `POST /api/stripe/portal` (cambiar tarjeta, facturas, cancelar).
- **Estado**: `GET /api/admin/billing` con los **precios reales de Stripe** para la región del negocio (no se hardcodean importes).
- **UI**: `BillingCard` en la pestaña **Config** del panel del dueño (solo rol `admin`). Al volver de Stripe (`?checkout=ok|cancel`) o del portal (`?tab=config`) abre esa pestaña y refresca el estado.

## 3. Decisiones

- **Se mantiene el esquema de la 012** en vez de las columnas del PRP: `subscription_status` (estado nativo de Stripe; `NULL` = gratis) cubre `billing_status`, y `plan_lookup_key` identifica el plan mejor que un `price_id`. No se duplican columnas. La columna previa `restaurants.plan` ('free') no la usa ningún código y no se toca.
- **Cancelación** → queda `canceled` (sin acceso diferenciado: el enforcement por plan está fuera de alcance, así que hoy equivale a gratis). El panel ofrece volver a suscribirse.
- `incomplete` (checkout sin terminar) se muestra como gratis.

## 4. Go-live (pasos, en orden)

1. **Stripe (modo Test primero)**: comprobar que los precios tienen los `lookup_key` `myvipers_{mensual|anual}_{eur|latam|pen}` (los PEN son opcionales: sin ellos Perú paga LATAM). Limpiar precios duplicados.
2. **Stripe → Webhooks → Add endpoint**: `https://myvipers.es/api/stripe/webhook`, solo los 6 eventos de arriba. No tocar el endpoint de Verioska.
3. **Stripe → Billing Portal**: activar y guardar la configuración (sin ella `billingPortal.sessions.create` falla).
4. **Vercel `mvipers` → env (Production)**: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET_MYVIPERS` (los pega Misael en el panel).
5. ~~**Neon prod**: aplicar `012`~~ ✅ hecho 2026-09-27.
6. ~~**Deploy**~~ ✅ hecho 2026-09-27 (mvipers + el-machay). Tras poner las env de Stripe en Vercel hay que **redesplegar mvipers** para que las tome.
7. **Prueba en Test**: suscribir con `4242 4242 4242 4242` → `active`; cancelar en el portal → `canceled`; comprobar que un evento de Dental Cloud se ignora (`ignored: 'precio ajeno a MyVipers'`).
8. Repetir 1–4 en **Live**.

## 5. Criterios de aceptación

- [x] Verificado si existía pantalla de facturación → no existía; creada.
- [x] Migración validada en staging (`staging-billing-012`) · [x] aplicada en prod (2026-09-27).
- [x] Checkout con metadata correcta y región decidida en servidor.
- [x] Segundo webhook registrado en Stripe (modo Test).
- [x] Probado en modo Test (suscribir → `active`, cancelar → `canceled`) — 2026-09-27.
- [x] Configuración en Live (precios con lookup_key, webhook, portal, env) — 2026-09-27.
- [x] Webhook ignora precios fuera de la lista blanca (tests).
- [x] El panel muestra el estado de facturación.

## 6. Fuera de alcance

Enforcement de límites por plan · IVA/fiscalidad · agente de ventas de MyVipers.
Nota: el portal cancela **al final del periodo**; el panel no avisa de la cancelación programada (`cancel_at_period_end`) hasta que Stripe envía `deleted`.
Aparte (no tocado): `POST /api/onboarding/apply` devuelve **500** con cuerpo vacío en prod (debería ser 400).
