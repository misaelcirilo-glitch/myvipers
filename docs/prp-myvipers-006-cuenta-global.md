# PRP-myvipers-006 — Cuenta global de cliente

**Estado:** PROPUESTA — todas las decisiones cerradas (2026-11-21); pendiente de la aprobación final de Misael. Nada implementado.
**Owner:** Misael · **Depende de:** PR #3 (paso 0), PR #4 (cambio obligatorio de contraseña), PR #5 (canje atómico), PR #6 (pruebas de aislamiento).

## 1. Objetivo

Un cliente tiene **una cuenta global** identificada por su teléfono, verificado por WhatsApp. Bajo esa cuenta puede pertenecer a **varios negocios**, con puntos e historial **separados por negocio**, y cambiar de uno a otro desde «Mis negocios». Cada negocio sigue viendo solo a sus clientes.

**Fuera de este PRP:** descubrir negocios (paso 7) y retirar contraseñas (paso 8).

## 2. Decisiones ya tomadas (Misael, 2026-11-20)

1. El número que envía los códigos sale de una variable de entorno (`WHATSAPP_OTP_PHONE_NUMBER_ID`), nunca del código. Al inicio puede ser el del agente de ventas; el objetivo es un segundo número de la misma WABA solo para códigos (plantilla de autenticación). Cambiar de número = cambiar la variable.
2. El personal (admin) **no** entra por la cuenta global.
3. Las contraseñas se mantienen. El código por WhatsApp sirve para **verificar el número** y para **recuperar el acceso**.
4. Consentimiento con casilla clara al unirse a un negocio: «Este negocio verá tu nombre y teléfono».
5. Dominio principal `myvipers.es`. `el-machay.vercel.app` sigue sirviendo la app, sin redirigir nunca.
6. Los puntos son por negocio; no se comparten.

**Regla clave:** las filas de `users` solo se unen bajo una cuenta global **después** de verificar el teléfono por WhatsApp. Nunca antes.

## 3. Punto de partida (auditoría 2026-11-20)

- Un cliente = una fila de `users` por negocio (`restaurant_id`), con su contraseña, sus puntos (`total_points`, `available_points`), nivel y código de referido. Índice único `users_restaurant_phone9_uniq` (negocio + 9 últimas cifras).
- 130 usuarios (122 clientes). **0 teléfonos repetidos entre negocios.** Todos los teléfonos están guardados con **9 cifras, sin prefijo de país**.
- Sin RLS (Neon): el aislamiento está en la API. 24 pruebas de aislamiento en verde en staging.
- WhatsApp solo lo usa el agente de ventas (`src/features/whatsapp-agent/`, variables `MV_WA_*`).
- Sesión: JWT de 30 días con `userId`, `role`, `restaurantId`, `restaurantSlug`.

## 4. Diseño

### 4.1 La fila de `users` pasa a ser «el cliente en un negocio»
No se mueve ningún dato. Encima se añade la cuenta:

```
customer_accounts (cuenta global)            users (cliente en un negocio — ya existe)
  id                                           id, restaurant_id, puntos, nivel, referido…
  phone_e164  ÚNICO (con prefijo de país)      account_id → customer_accounts(id)   ← NUEVO, vacío al principio
  verified_at NOT NULL
```

Una cuenta **solo existe si el teléfono está verificado** (`verified_at` obligatorio): no hay cuentas «pendientes».

### 4.2 El teléfono: con prefijo de país
Hoy todos los números son de 9 cifras sin prefijo, y Perú y España usan ambos 9 cifras: comparar solo las 9 últimas podría unir a dos personas distintas de dos países. Por eso:
- La cuenta se identifica por el número **completo con prefijo** (formato E.164, p. ej. `+51934879292`).
- Una fila de `users` se une a una cuenta solo si **el prefijo del país de su negocio + sus 9 cifras** coincide con el número verificado. Si el negocio no tiene país, esa fila no se une sola (se une cuando el cliente entra en ese negocio y lo confirma).
- **Selector de prefijo** en el alta y al pedir un código: por defecto el del país del negocio; el cliente de otro país puede cambiarlo. Las altas nuevas guardan el número completo con prefijo. (Decidido por Misael, 2026-11-20.)

### 4.3 Verificación por WhatsApp
- Código de 6 cifras, **caduca a los 5 minutos**, máximo **5 intentos**, de un solo uso.
- En la base de datos nunca se guarda el código ni el teléfono en claro: solo huellas (HMAC con una clave secreta `OTP_PEPPER`).
- **Límites**: 3 códigos cada 15 minutos y 8 al día por móvil; 20 por hora por conexión; tope diario global de **300** (`OTP_DAILY_CAP`, configurable) con **alerta** por correo al llegar al 80 % y al alcanzarlo.
- La respuesta al pedir un código es **la misma y tarda lo mismo** se envíe o no (no revela si un número es cliente).
- Envío por plantilla de **autenticación** de Meta, desde el número de `WHATSAPP_OTP_PHONE_NUMBER_ID`.
- Limpieza automática de los registros de códigos con más de 30 días.
- Dos usos:
  - **Verificar** (cliente con sesión): confirma que el número de su fila es suyo → se crea la cuenta y se le unen sus filas.
  - **Recuperar el acceso** (sin sesión): con el código entra en su cuenta y elige negocio. No hace falta recordar la contraseña.

### 4.4 Qué pasa al verificar (la unión)
1. Se crea (o se localiza) la cuenta de ese número.
2. Se le unen las filas de `users` de **clientes** cuyo número completo coincide. Las de personal (`admin`) nunca.
3. **Filas que el cliente no estaba usando en ese momento** (otro negocio, mismo número): como alguien pudo registrarlas con un número ajeno, su contraseña deja de valer (quedan marcadas con `must_change_password`, del PR #4) y se cierran sus sesiones abiertas. El dueño del número entra a ellas por su cuenta.
4. **Garantía: no se pierde nada.** Las filas unidas no se borran ni se fusionan: los puntos, los canjes, las reservas y el historial de cada fila siguen en esa fila y en su negocio, y pasan a ser accesibles para el dueño verificado desde su cuenta. La unión solo escribe `account_id` (y, en las filas ajenas, la marca de contraseña y el cierre de sesiones). (Decidido por Misael, 2026-11-20.)
5. Todo en una sola operación de base de datos; queda apuntado en un registro (`account_events`) sin datos personales.

### 4.5 Sesión y cambio de negocio
- El JWT añade `accountId` (opcional). **Los JWT antiguos siguen valiendo**: sin `accountId` la sesión se comporta exactamente como hoy (un solo negocio). No se cierra la sesión a nadie.
- `POST /api/account/switch { restaurantId }`: comprueba en la base de datos que la cuenta tiene una fila en ese negocio y emite un JWT nuevo para esa fila. Rechaza cualquier sesión que no sea de cliente.
- Cierre de sesiones (punto 4.4.3): columna `users.sessions_valid_after`; una sesión emitida antes de esa fecha deja de valer.

### 4.6 «Mis negocios» y unirse a un negocio
- Pantalla `/mis-negocios` (enlace desde Perfil): lista los negocios de la cuenta con logo, puntos y nivel; al tocar uno, cambia de negocio.
- Cliente sin verificar: ve un aviso «Verifica tu número para ver todos tus negocios».
- **Unirse**: un cliente con cuenta que abre `/r/[slug]` de un negocio donde no tiene fila ve «Unirme», con la casilla obligatoria «Este negocio verá tu nombre y teléfono». Al aceptar se crea su fila en ese negocio (con los puntos de bienvenida de ese negocio, **una sola vez por cuenta y negocio**; la cantidad la configura cada negocio y puede ser 0) y se guarda la fecha del consentimiento.

### 4.7 El Machay y su PWA
- No cambia el dominio, ni la dirección de inicio de la PWA, ni su manifiesto. No hay ninguna redirección.
- Los clientes de El Machay siguen entrando como hoy. Verificar el número es **opcional** y no bloquea nada.
- **Decidido:** en `el-machay.vercel.app` la app sigue siendo de un solo negocio. «Mis negocios» se muestra solo en `myvipers.es` (en El Machay, un enlace normal «Ver mis otros negocios en myvipers.es»). Así la PWA de El Machay no cambia de aspecto.

## 5. Fases

Cada fase va en su rama y su PR, se prueba en staging (rehecho como copia de producción) y no llega a producción sin OK. Todas las migraciones son **aditivas**, idempotentes y con reversa escrita. Todo el recorrido nuevo va detrás de un interruptor (`ACCOUNT_GLOBAL_ENABLED`), apagado por defecto: se puede desplegar sin que nada cambie.

| Fase | Contenido | Esfuerzo |
|---|---|---|
| **F1** (paso 2) | Migración 019: `customer_accounts`, `users.account_id`, `users.sessions_valid_after`, `users.data_consent_at`, `phone_otp`, `account_events` | Bajo |
| **F2** (paso 3) | Códigos por WhatsApp: pedir, enviar, comprobar, límites, limpieza; unión de filas al verificar | Medio |
| **F3** (paso 4) | JWT con `accountId`, cambio de negocio, cierre de sesiones | Medio |
| **F4** (paso 5) | Pantalla «Mis negocios», aviso de verificación, recuperar acceso con código | Bajo-medio |
| **F5** (paso 6) | Unirse a un negocio con consentimiento | Bajo |

### F1 — Esquema
- **Migración 019** (reversa: borrar las columnas y tablas nuevas; no toca datos existentes).
  - `customer_accounts(id, phone_e164 UNIQUE, verified_at NOT NULL, created_at, last_login_at)`
  - `users.account_id` (vacía) + índice único `(account_id, restaurant_id)` + regla: solo filas de cliente pueden tener cuenta.
  - `users.sessions_valid_after`, `users.data_consent_at` (vacías).
  - `phone_otp(id, phone_hash, ip_hash, code_hash, purpose, status, attempts, created_at, sent_at, expires_at)`
  - `account_events(id, account_id, event, detail, created_at)`
- **Pruebas:** la migración se aplica dos veces sin error; la reversa deja el esquema como antes; las 24 pruebas de aislamiento siguen en verde.
- **Aceptación:** producción funciona igual con la 019 aplicada (nadie lee aún las columnas nuevas).

### F2 — Códigos y unión
- Rutas `POST /api/account/otp/request` y `POST /api/account/otp/verify`. Envío en `src/features/account/` reutilizando el cliente de Meta, con número, token y plantilla por variable de entorno.
- **Pruebas (staging, con el envío simulado; ningún mensaje a números reales):**
  - código correcto / incorrecto / caducado / usado dos veces / 6.º intento;
  - cada límite (por móvil, por conexión, diario);
  - misma respuesta y misma duración se envíe o se bloquee;
  - unión: une solo las filas de cliente del mismo número completo; **no** une personal; **no** une un número igual de otro país; invalida la contraseña y las sesiones de las filas que no eran la de la sesión;
  - **garantía de conservación**: antes y después de unir, cada fila conserva exactamente sus puntos (`total_points`, `available_points`), sus movimientos, canjes y reservas, y su `restaurant_id`; el dueño verificado los ve al entrar en ese negocio; la persona que registró la fila ya no puede entrar;
  - sin verificar, ninguna fila tiene `account_id` (regla clave).
- **Aceptación:** prueba real con el móvil de Misael en staging y en un negocio de prueba; el código llega por WhatsApp desde el número de la variable; cambiar la variable cambia el número sin tocar código.

### F3 — Sesión
- **Pruebas:** un JWT antiguo (sin `accountId`) entra y funciona igual; el cambio de negocio solo funciona hacia negocios de la propia cuenta; una sesión de admin no puede cambiar de negocio; una sesión anterior a `sessions_valid_after` deja de valer; las 24 pruebas de aislamiento + nuevas con sesión de cuenta.
- **Aceptación:** un cliente de El Machay con sesión abierta antes del despliegue sigue dentro sin volver a entrar.

### F4 — «Mis negocios»
- **Pruebas:** cliente con 2 negocios ve los 2 con sus puntos separados; cambiar de negocio cambia carta, puntos y promociones; cliente sin verificar ve el aviso y nada más; recuperar acceso con código entra sin contraseña.
- **Aceptación:** recorrido en navegador real (móvil) en myvipers.es; en el-machay.vercel.app la PWA instalada abre igual que hoy.

### F5 — Unirse
- **Pruebas:** sin marcar la casilla no se crea nada; al unirse se crea una sola fila (dos toques seguidos no duplican ni dan doble bienvenida); el negocio nuevo ve al cliente y el anterior no ve nada del nuevo.
- **Aceptación:** Misael se une con su cuenta al negocio de demostración y ve los dos en «Mis negocios».

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Número registrado por otra persona | Regla clave: sin verificación no hay unión. Al unir, las filas ajenas a la sesión pierden contraseña y sesiones (4.4.3) |
| Mismo número de 9 cifras en dos países | Cuenta por número completo con prefijo (4.2) |
| Coste y abuso de los códigos | Límites por móvil, conexión y día; tope global con aviso; respuesta uniforme |
| Meta: falta la plantilla de autenticación | El número del agente de ventas ya está conectado y respondiendo (comprobado 2026-11-20). Misael solicita la plantilla (anexo A). F1 no depende de esto |
| Romper la PWA de El Machay | Sin cambios de dominio, inicio ni manifiesto; interruptor apagado por defecto; prueba en la PWA instalada antes de activar |
| Sesiones de 30 días ya emitidas | El JWT antiguo sigue valiendo (4.5) |

## 7. Orden de despliegue de cada fase
1. Rama → pruebas en staging → PR.
2. Copia de seguridad de producción (rama de Neon `backup-pre-0XX`).
3. Migración en producción (aditiva) → comprobación.
4. Despliegue de los dos proyectos de Vercel con el interruptor apagado → prueba de humo.
5. Encender el interruptor → prueba real → vigilar registros.
6. Vuelta atrás: apagar el interruptor (inmediato); la reversa de la migración solo si hiciera falta.

## 8. Decisiones de Misael (todas cerradas)
1. ~~Meta~~ — **Resuelto**: el agente de ventas está conectado y respondiendo (comprobado 2026-11-20). Queda pedir la plantilla de autenticación (anexo A); F1 avanza sin ella.
2. ~~País del número~~ — **Decidido**: número completo E.164, con selector de prefijo (por defecto, el país del negocio).
3. ~~Filas ajenas al verificar~~ — **Decidido**: pierden contraseña y sesiones; sus puntos, canjes e historial se conservan y pasan al dueño verificado (4.4.4), con prueba en staging.
4. ~~El Machay~~ — **Decidido**: «Mis negocios» solo en `myvipers.es`; en El Machay, un enlace (4.7).
5. ~~Puntos de bienvenida~~ — **Decidido**: se dan una vez por cuenta y negocio, y la cantidad es configurable por negocio (4.6).
6. ~~Tope de códigos~~ — **Decidido**: límite por número más tope diario de 300, con alerta (4.3).
7. ~~Entrar con código~~ — **Decidido**: con el número verificado se puede entrar con un código por WhatsApp, que caduca a los 5 minutos (4.3).

No queda ninguna decisión abierta.

## Anexo A — Plantilla de autenticación que hay que pedir a Meta

- **Categoría:** Autenticación (`AUTHENTICATION`).
- **Nombre:** `codigo_verificacion` (irá en la variable `WHATSAPP_OTP_TEMPLATE`).
- **Idioma:** Español (`es`). Basta con este para empezar; se pueden añadir `en` y `pt` más adelante con el mismo nombre.
- **Texto:** en esta categoría lo fija Meta, no se redacta. Queda: «*{{1}}* es tu código de verificación.»
- **Opciones a marcar:**
  - Recomendación de seguridad: sí («Por tu seguridad, no lo compartas.»).
  - Caducidad del código: sí, **5 minutos** («Este código caduca en 5 minutos.»).
  - Botón: **Copiar código** (`COPY_CODE`), texto «Copiar código».
- La plantilla se aprueba para la WABA, así que sirve para cualquier número de esa WABA: cambiar al número dedicado no exige otra plantilla.
