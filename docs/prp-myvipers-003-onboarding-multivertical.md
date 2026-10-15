# PRP-myvipers-003 — Onboarding multi-vertical (con aprobación)

> Estado: **PROPUESTO** (pendiente de aprobación de Misael para ejecutar en bucle-agéntico).
> Fecha: 2026-09-07 · Autor: Claude Code.

## 1. Objetivo

Una **única puerta de alta** para que cualquier negocio (restaurante, retail y los verticales futuros) solicite su cuenta en MyVipers. El alta es **con aprobación**: el negocio rellena una solicitud pública; un **admin de plataforma** la revisa y, al aprobar, se crea el tenant + su admin con los **módulos correctos según su tipo de negocio**. Debe ser **genérico y extensible**: añadir un vertical nuevo = añadir un preset, sin tocar el flujo.

**NO** es un alta pública instantánea (evitamos spam/abuso y creación de tenants reales sin control). **NO** es solo para retail.

## 2. Contexto real (lo que ya existe — no reinventar)

- **Tenant = tabla `restaurants`** (no se renombra). Ya tiene `business_type TEXT` (CHECK actual: `'restaurant'|'retail'`) y `enabled_modules jsonb` (default `["restaurant"]`) — migración `007`.
- Módulos: `hasModule(enabledModules, module)` en `src/shared/lib/modules.ts` (client-safe, sin `db`). `getTenantConfig` en `tenant.ts` (server, toca BD).
- Usuarios: tabla `users` con `role` (`admin|waiter|customer`), `restaurant_id`, `password_hash` (bcrypt), `phone` normalizado. Login por tenant en `/r/[slug]/login`; registro de **clientes** en `/r/[slug]/registro` y `POST /api/auth/register` (crea CLIENTE, no tenant).
- Stack: Next 16.2 + Neon (`@neondatabase/serverless`, plantillas `db\`\``) + JWT (`jose`) cookie `token` + Zod v4 (`error.issues`) + bcryptjs. Dos proyectos Vercel sobre la MISMA BD (`mvipers`→myvipers.es, `el-machay`). **Migraciones se validan en STAGING** (`ep-nameless-snow-amidpyes`) antes de prod (`ep-falling-smoke-am68e6gk`).

## 3. Diseño

### 3.1 Config de verticales (fuente de verdad de "tipos de negocio")
Nuevo `src/shared/lib/verticals.ts` (**client-safe**, sin imports de servidor — misma regla que `modules.ts`):

```ts
export interface VerticalPreset {
  type: string;            // p.ej. 'restaurant' | 'retail' | 'cosmetica' | 'cafeteria'
  label: string;           // "Restaurante", "Tienda de ropa / retail"
  modules: string[];       // enabled_modules por defecto para este tipo
  enabled: boolean;        // si se ofrece en el onboarding
}
export const VERTICALS: VerticalPreset[] = [
  { type: 'restaurant', label: 'Restaurante', modules: ['restaurant'], enabled: true },
  { type: 'retail',     label: 'Tienda / Retail (moda, calzado, accesorios)', modules: ['retail'], enabled: true },
  // futuros: cosmética, cafetería, etc. → solo añadir aquí + su(s) módulo(s).
];
export const getVertical = (type: string) => VERTICALS.find(v => v.type === type);
```

Añadir un vertical nuevo = **una línea aquí** (+ construir su módulo). El onboarding y la aprobación lo toman de esta lista. **Sin hardcodear retail.**

> Migración: **relajar el CHECK** `restaurants_business_type_chk` (que hoy solo permite restaurant|retail) → quitarlo y **validar en app** contra `VERTICALS` (extensible sin tocar schema). Alternativa conservadora: dejar el CHECK y ampliarlo por migración cada vertical (menos flexible). Decisión propuesta: **quitar el CHECK, validar en app**.

### 3.2 Modelo de datos — migración `013-tenant-onboarding.sql` (aditiva, idempotente)
- **`tenant_applications`** (solicitudes de alta, NO crean tenant hasta aprobar):
  - `id uuid pk`, `business_name text`, `slug text` (deseado, se valida único+formato), `business_type text` (∈ VERTICALS.enabled),
  - `admin_name text`, `admin_phone text`, `admin_email text null`, `admin_password_hash text` (bcrypt, ya hasheado en el POST),
  - `country text null` (para futuros ajustes por país), `notes text null` (mensaje del solicitante),
  - `status text not null default 'pending'` (`pending|approved|rejected`), `review_notes text null`, `reviewed_by uuid null`, `reviewed_at timestamptz null`,
  - `created_tenant_id uuid null` (el tenant creado al aprobar), `created_at timestamptz default now()`.
  - Índices: `status`, `slug`.
- **Admin de plataforma**: `ALTER TABLE users ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;` + seed manual del/los admin(s) de plataforma (Misael). (Rol super-admin transversal, independiente del tenant.)
- **Quitar** `restaurants_business_type_chk` (validación pasa a la app).

### 3.3 API
- **Pública** `POST /api/onboarding/apply` (sin sesión):
  - Zod: business_name, slug (regex `^[a-z0-9-]{3,40}$`), business_type (∈ VERTICALS.enabled), admin_name, admin_phone, admin_email?, password (min 6), notes?.
  - Valida **slug libre** (no colisiona con `restaurants.slug` ni con otra solicitud pending), hashea password, inserta `tenant_applications` (status pending).
  - **Rate-limit** por IP/teléfono (evitar spam) + honeypot. Nunca crea tenant/usuario aquí.
  - Responde 201 "solicitud recibida" (sin sesión).
- **Plataforma** (gated `is_platform_admin`):
  - `GET /api/platform/applications?status=pending` → lista solicitudes.
  - `POST /api/platform/applications/:id/approve` → transacción: crea `restaurants` (business_type + `enabled_modules` = preset del vertical, slug), crea `users` admin (con `admin_password_hash`, role `admin`, restaurant_id), marca application `approved` + `created_tenant_id`. Idempotente (si ya aprobada, no duplica).
  - `POST /api/platform/applications/:id/reject` → status `rejected` + `review_notes`.
- **Middleware de plataforma**: helper `requirePlatformAdmin(session)` (server) → 403 si no.

### 3.4 UI
- **Pública** `/(auth)/registrar-negocio` (o `/onboarding`): formulario con **selector de tipo de negocio** poblado desde `VERTICALS.filter(enabled)`, datos del negocio + admin, mensaje de éxito "Solicitud enviada, te avisaremos". Enlazable desde la landing de myvipers.es.
- **Plataforma** `/(platform)/plataforma/solicitudes` (solo `is_platform_admin`): tabla de pendientes → **Aprobar / Rechazar** (con nota). Al aprobar, muestra la **URL de acceso** del nuevo tenant (`/r/<slug>/login`) para pasársela al negocio.

### 3.5 Notificación (Fase 4, opcional)
Al aprobar, avisar al solicitante (email vía Resend o SMS) con su **URL de login** + recordatorio de credenciales. Si no hay proveedor aún, la plataforma muestra la URL para envío manual.

## 4. Seguridad (auto-blindaje aplicado)
- **Nada se crea vivo hasta aprobar** (la solicitud es inerte; no hay tenant/usuario hasta el approve).
- **Gate server-side real** para plataforma (`is_platform_admin`), no solo UI — lección de `/api/demo-login` (un banner no es control de acceso).
- **Aislamiento multi-tenant** intacto: el approve crea el tenant con su `restaurant_id`; todo el resto ya filtra por tenant.
- **Slug** validado (formato + unicidad) para no chocar con `/r/[slug]` existentes ni con la landing.
- **Rate-limit + honeypot** en el endpoint público.
- Password del solicitante **hasheado (bcrypt) en el apply**, nunca en claro; el approve solo lo mueve al `users`.

## 5. Criterio de éxito
1. El formulario público crea una **solicitud pending** y **NO** crea tenant/usuario.
2. Un `is_platform_admin` ve pendientes, **aprueba** → se crea `restaurants` (business_type correcto + `enabled_modules` del preset) + admin `users`; el negocio entra en `/r/<slug>/login` y ve **solo sus módulos**.
3. **Rechazar** funciona (status rejected, no crea nada).
4. **Extensibilidad probada**: añadir un preset nuevo en `VERTICALS` (p. ej. `cosmetica`) → aparece en el selector y su approve activa sus módulos, **sin tocar migración ni el flujo**.
5. Tenants existentes (El Machay, demos) **intactos**; aislamiento entre tenants garantizado.
6. Tests verdes en STAGING (ver §7).

## 6. Fases (bucle-agéntico)
- **F0** — `verticals.ts` + relajar CHECK business_type + validación en app.
- **F1** — migración `013` (tenant_applications + is_platform_admin) **validada en STAGING**; seed platform admin.
- **F2** — API pública `apply` (+ Zod, slug, rate-limit) y helper `requirePlatformAdmin`.
- **F3** — API plataforma approve/reject (transaccional, idempotente) + UI panel de solicitudes.
- **F4** — UI pública `/registrar-negocio` + enlace desde landing.
- **F5** — (opcional) notificación al aprobar.
- **F6** — tests + doc validación staging + plan de cutover (013 a prod, merge, deploy mvipers+el-machay).

## 7. Tests (vitest, contra STAGING `ep-nameless-snow-amidpyes`)
- `apply` crea solicitud pending, no tenant/usuario.
- `approve` crea tenant con `enabled_modules` = preset del business_type + admin con role admin + login válido.
- `approve` idempotente (no duplica si se repite).
- slug duplicado → rechazado en apply.
- Un no-platform-admin → 403 en endpoints de plataforma.
- Aislamiento: el nuevo tenant no ve datos de El Machay/demos y viceversa.

## 8. Decisiones (confirmadas por Misael 2026-09-07)
- **business_type**: se **quita el CHECK**; validación en app contra `VERTICALS` (extensible sin tocar schema). ✅
- **Platform admin**: cuenta con teléfono **`678080701`**, `is_platform_admin=true` (seed en F1). Contraseña la fija Misael (o se genera y la cambia al entrar).
- **Verticales al lanzar**: restaurant + retail. Otros se añaden como preset cuando existan sus módulos.
- **Notificación (F5)**: Resend existe (usado por Verioska Agent) pero **sin remitente verificado para `myvipers.es`** → F5 **diferida a envío manual** (la plataforma muestra la URL de acceso). Se enchufa Resend cuando haya sender verificado para MyVipers.

### Detalle de login de plataforma
El login actual es **por tenant** (`/r/[slug]/login` → token con `restaurantId`). El platform admin es **transversal**, así que se añade un **login dedicado** `/(platform)/plataforma/login` que autentica por teléfono+password **sin exigir tenant**, y emite un token marcado como plataforma (o se valida `is_platform_admin` sobre el user). `requirePlatformAdmin` comprueba el flag server-side en cada endpoint `/api/platform/*`. (Detalle a cerrar en F2: el user de plataforma necesita `restaurant_id`; opciones: hacerlo nullable para platform admins, o adjuntarlo a un tenant "plataforma" técnico. Se decide en F2 con el mínimo cambio.)

## 9. Fuera de alcance
- Alta 100% auto-servicio sin aprobación (descartado por Misael).
- Construir módulos de verticales nuevos (cosmética, cafetería…) — esto solo prepara el onboarding para ellos.
- Cobro/suscripción en el alta (se integra con el PRP de Stripe billing por separado).
