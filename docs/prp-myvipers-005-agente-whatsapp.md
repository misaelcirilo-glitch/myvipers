# PRP-myvipers-005 — Agente de ventas por WhatsApp (autoservicio, ticket bajo)

**Estado:** DESPLEGADO INERTE (2026-09-28): `014` aplicada en Neon prod (backup `backup-pre-014`), desplegado a mvipers y el-machay; el webhook responde 503 "Webhook no configurado" hasta poner las env `MV_WA_*`. Falta el alta en Meta (pasos de Misael, §6).
**Owner:** Misael · **Depende de:** PRP-myvipers-004 (Stripe en Live) ✅

## 1. Objetivo

Un restaurante o tienda que escribe por WhatsApp recibe respuesta automática, entiende qué es MyVipers y termina con el enlace de alta gratis, sin intervención de Misael. Si pregunta precios, recibe los reales de Stripe para su país. Las respuestas a contactos en frío se reconocen y abren con otro guion.

## 2. Decisiones (cambios frente a la propuesta original)

| Tema | Propuesta original | Decidido | Por qué |
|---|---|---|---|
| Dónde vive | Repo nuevo + Supabase nuevo + `agent.myvipers.es` | **Dentro de la app MyVipers**: webhook `https://myvipers.es/api/whatsapp/webhook`, tablas `mv_*` en la Neon de MyVipers | Sin infra ni coste nuevo; precios leídos con la misma lógica del checkout; el cruce lead↔alta será un JOIN por teléfono (el problema del §5 original desaparece). Sigue totalmente separado de Verioska: otra app de Meta, otro número, otra BD. |
| Enlace para tiendas | `/crear-restaurante` para todos | Restaurante → `/crear-restaurante` (alta inmediata). **Tienda → `/registrar-negocio`** (solicitud que Misael aprueba; el agente avisa de la revisión) | `/crear-restaurante` solo crea restaurantes (mesas, carta…). |
| Precios | 4 importes fijos en el prompt | **Leídos de Stripe** por `lookup_key` para eur/latam/pen (caché 10 min) | Los importes del PRP no coincidían con Live (Perú: 49 PEN/mes, 490 PEN/año). Así sobrevive a cambios de precio y a la futura cuenta Stripe propia. |
| Tablas | `mv_leads`, `mv_conversations`, `mv_messages`, `mv_outreach_contacts` | Sin `mv_conversations`: **un lead = una conversación** (un número) | KISS; los mensajes cuelgan del lead. |
| RLS | Equivalente a Verioska | **No aplica**: la BD de MyVipers es Neon sin roles de cliente; solo accede el servidor (igual que el resto de tablas) | — |
| Modelo | Sonnet | `claude-sonnet-5` (constante `AGENT_MODEL` en `llm.ts`) | Último Sonnet. |
| Petición de humano | — | Si el lead pide una persona, el agente lo dice y se envía un **email a Misael** (`MV_AGENT_NOTIFY_EMAIL`) con enlace wa.me | Para no prometer algo que nadie ve. |

## 3. Qué se construyó

- `migrations/014-whatsapp-agent.sql`: `mv_outreach_contacts`, `mv_leads`, `mv_messages` (aditiva, idempotente).
- `src/features/whatsapp-agent/`
  - `meta.ts` — firma HMAC, parser tolerante del webhook (texto, botones de plantilla, media no soportada), envío por Graph API. El `phone_number_id` sale SIEMPRE de la env.
  - `prompt.ts` — prompt con **solo funciones reales** (puntos VIP, premios/canjes, promos, CRM, finanzas, boletas, multi-idioma/moneda; carta+reservas solo restaurante; catálogo solo tienda), enlaces por tipo, precios por región, bloque de apertura para contacto en frío. Voz: asistente automático del equipo; nunca dice ser persona.
  - `llm.ts` — llamada a Anthropic, salida JSON validada con Zod (solo `reply` obligatorio; un campo mal formado se descarta, nunca se envía JSON crudo). **Fallback sin IA** (sin `ANTHROPIC_API_KEY` o si Anthropic falla): mensaje con el/los enlaces de alta.
  - `repo.ts` — acceso a BD; dedupe de reintentos de Meta por `wa_message_id`.
  - `process-inbound.ts` — pipeline: lead (país por prefijo del número) → contacto en frío (apertura / "Ahora no, gracias" sin IA) → IA → envío → estado del lead (nunca retrocede de "enlace enviado").
  - `utils.ts` — país por teléfono, botones de plantilla, transición de estado.
- `src/app/api/whatsapp/webhook/route.ts` — GET (verificación de Meta) y POST. Sin las env `MV_WA_*` responde 503 (el-machay comparte código y queda inerte).
- `src/shared/lib/pricing.ts` — precios de Stripe por región; `api/admin/billing` ahora lo usa (sin cambio de comportamiento).
- `sendAgentHandoffEmail` en `src/shared/lib/email.ts`.
- Tests: `agent.test.ts` (35). Total con billing: 65 ✅. `tsc` y `eslint` limpios.

## 4. Variables de entorno (Vercel `mvipers`, Production)

| Variable | Qué es |
|---|---|
| `MV_WA_VERIFY_TOKEN` | Texto que eliges tú; el mismo que pones en Meta al configurar el webhook |
| `MV_WA_APP_SECRET` | App de Meta → Configuración → Básica → Clave secreta de la app |
| `MV_WA_PHONE_NUMBER_ID` | WhatsApp → Configuración de la API → Identificador del número |
| `MV_WA_ACCESS_TOKEN` | Token **permanente** de un usuario del sistema con `whatsapp_business_messaging` |
| `ANTHROPIC_API_KEY` | Sin ella el agente responde con el mensaje de reserva (enlaces de alta) |
| `MV_AGENT_NOTIFY_EMAIL` | (Opcional) email que recibe los "quiere hablar con una persona" |

## 5. Registrar contactos en frío (hasta que haya panel)

```sql
-- 1) Antes de enviar la plantilla desde Business Suite:
INSERT INTO mv_outreach_contacts (wa_phone_e164, business_name, business_type, city, country, source)
VALUES ('+51999123456', 'Tienda Rosa', 'retail', 'Lima', 'PE', 'google maps');
-- 2) Tras enviarla:
UPDATE mv_outreach_contacts SET status = 'sent', sent_at = now(), template_name = '<plantilla>'
WHERE wa_phone_e164 = '+51999123456';
```
La plantilla debería tener dos respuestas rápidas tipo **"Sí, cuéntame"** / **"Ahora no, gracias"** (se reconocen también "Me interesa", "No me interesa", "No, gracias").

Ver leads: `SELECT wa_phone_e164, profile_name, business_type, country, source, status, last_message_at FROM mv_leads ORDER BY last_message_at DESC;`

## 6. Go-live (en orden)

1. **Meta for Developers** (mismo Business Manager): crear app **"MyVipers Sales Agent"** (tipo Business) → añadir producto WhatsApp → WABA nueva de MyVipers → dar de alta y verificar el **número nuevo** (no el de Verioska).
2. Usuario del sistema con token permanente (`whatsapp_business_messaging`, `whatsapp_business_management`) asignado a la app y la WABA.
3. Vercel `mvipers`: las env de §4 → **redesplegar** (la 014 ya está en prod desde 2026-09-28).
4. Meta → WhatsApp → Configuración → Webhook: URL `https://myvipers.es/api/whatsapp/webhook`, token = `MV_WA_VERIFY_TOKEN` → Verificar → suscribir el campo **`messages`**.
5. Plantilla de contacto en frío (categoría Marketing) con los dos botones → esperar aprobación.
6. Pruebas (§7).

## 7. Criterios de aceptación

- [ ] App y WABA nuevos en Meta, número propio verificado.
- [ ] Webhook desplegado y verificado por Meta.
- [ ] Inbound orgánico: cualifica tipo (+ país) y termina con el enlace correcto (restaurante → `/crear-restaurante`, tienda → `/registrar-negocio` con aviso de revisión).
- [ ] Contacto en frío: primer mensaje con apertura distinta; "Ahora no, gracias" → despedida sin IA y `not_interested`.
- [ ] Precio según país (PE → PEN; España → EUR; resto → LATAM).
- [x] Tablas creadas y validadas en rama (`staging-wa-agent-014`): upsert, dedupe, historial, estados.
- [ ] Nada compartido con `agent.verioska.com` (app, número y BD distintos) — por diseño.

## 8. Fuera de alcance / siguientes

Alta desde el chat · cruce lead↔alta real (ahora trivial: `restaurants.phone` ↔ `mv_leads.wa_phone_e164`) · panel de leads · envío automático de la plantilla · seguimientos · transcripción de audios (hoy: "solo leo texto").

**Aparte:** la FAQ de la landing dice "planes desde 29€/mes", que no cuadra con los precios de Stripe. Revisar.
