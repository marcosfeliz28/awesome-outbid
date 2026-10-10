# Monitoreo externo de Nexora POS (pasos de la dueña)

Hoy nadie se entera de una caída hasta que llama la cajera (hallazgo A2 de la
auditoría de infraestructura). Un servicio externo revisa la web cada minuto y
avisa al celular. Se configura una sola vez, en unos 20 minutos, sin tocar el
código ni Render.

## Qué se vigila

| Monitor          | Dirección                                          | Está bien si                          | Detecta                                                                 |
| ---------------- | -------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| 1. Venta posible | `https://nexora-pos-web.onrender.com/api/health`   | Código 200 y el texto `"status":"ok"` | Web, red privada, API **y base de datos**. Si la base cae responde 503. |
| 2. Servidor vivo | `https://nexora-pos-web.onrender.com/healthz/deep` | Código 204 (o cualquier 2xx)          | Web, API y base, sin cuerpo (lo resuelve Nginx, no la PWA).             |

- Intervalo: **60 segundos**. Avisar después de **2 fallos seguidos** (o
  «después de 2 minutos caído») para no alarmar por un reinicio de segundos.
- Avisos: **Telegram** (gratis) y, si el plan lo permite, **SMS o llamada** a
  la dueña y al técnico. Avisar también cuando vuelve a estar bien.
- Hacer las dos peticiones cada minuto no afecta a la tienda: son lecturas
  cortas que no tocan ventas.

> **Límites de los planes gratuitos (no verificado, cambian a menudo):** a la
> fecha de redacción, UptimeRobot gratis revisaba cada 5 min y Better Stack
> gratis cada 3 min; el intervalo de 60 s y los SMS suelen ser de pago.
> Confirmar en la página de precios al registrarse. Si se usa el plan gratis,
> elegir el intervalo más corto que permita: cinco minutos sigue siendo mucho
> mejor que no tener monitor.

## Opción A: UptimeRobot (la más sencilla)

1. Crear la cuenta en `uptimerobot.com` con el correo de la tienda y activar la
   verificación en dos pasos.
2. **Avisos por Telegram:** _Integrations_ (o _Alert Contacts_) › _Add_ ›
   **Telegram**. Seguir el enlace, abrir el bot de UptimeRobot en Telegram y
   pulsar **Iniciar**; para un grupo, agregar el bot al grupo de la
   administración. Repetir para el técnico.
3. **SMS / llamada (si el plan lo incluye):** _Alert Contacts_ › _Add_ › SMS o
   Voice con el número de la dueña y del técnico.
4. **Monitor 1:** _Add New Monitor_ ›
   - Tipo: **Keyword** (si no aparece, **HTTP(s)**).
   - Nombre: `Nexora - venta posible`.
   - URL: `https://nexora-pos-web.onrender.com/api/health`.
   - Palabra clave: `"status":"ok"`, avisar si **no existe**.
   - Intervalo: el menor posible (ideal 1 min). Tiempo de espera: 30 s.
   - Marcar los contactos de Telegram (y SMS).
5. **Monitor 2:** igual, tipo **HTTP(s)**, nombre `Nexora - servidor vivo`,
   URL `https://nexora-pos-web.onrender.com/healthz/deep`.
6. Si la opción existe, poner «avisar tras 2 fallos» o «retraso de aviso: 1–2
   minutos».
7. **Probar el aviso:** en cada contacto, _Send test notification_. Después,
   crear un monitor temporal hacia
   `https://nexora-pos-web.onrender.com/healthz/no-existe` (da 404), esperar
   el aviso en Telegram y **borrarlo**.

## Opción B: Better Stack (Uptime)

1. Crear la cuenta en `betterstack.com` (producto _Uptime_).
2. _Integrations_ › **Telegram**: seguir el asistente y conectar el grupo de la
   administración. Añadir el teléfono de la dueña para SMS o llamada si el plan
   lo permite.
3. _Monitors_ › _Create monitor_:
   - «Alert us when» **URL becomes unavailable** o **URL doesn't contain
     keyword**, con `"status":"ok"`.
   - URL `https://nexora-pos-web.onrender.com/api/health`, frecuencia la menor
     posible, _Confirmation period_ 1–2 min.
4. Segundo monitor con `https://nexora-pos-web.onrender.com/healthz/deep`
   («URL becomes unavailable»).
5. Probar con _Send test alert_ y con un monitor temporal a una URL que dé 404.

## Además, en Render (5 minutos)

1. _Workspace Settings › Notifications_: avisos por correo de **fallo del
   servicio** y de **despliegue fallido** para `nexora-pos-web` y
   `nexora-pos-api` (hoy sólo avisa de despliegues fallidos).
2. En la base `nexora-pos-db`, activar el aviso de **uso de disco alto** si
   aparece. El disco es de 5 GB y no crece solo (`storageAutoscalingEnabled:
false`); revisar el uso en _Metrics_ una vez al mes.
3. Opcional: `SENTRY_DSN` en `nexora-pos-api` para recibir los errores de la
   API (ver [SENTRY-API.md](SENTRY-API.md)).

## Qué hacer cuando llega un aviso

1. Abrir `https://nexora-pos-web.onrender.com/api/health` desde el celular con
   datos móviles.
2. Seguir [CONTINGENCIA.md](CONTINGENCIA.md) (tabla «diagnosticar en 2
   minutos») y avisar al técnico.
3. Mirar `status.render.com`.

Si sólo falla el monitor 1 y el 2 sigue bien, la API vive pero la base no
responde. Si fallan los dos, la API está caída o reiniciándose.
