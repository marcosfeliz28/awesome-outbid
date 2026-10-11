# Cómo recibir un aviso si Nexora deja de responder

Puedes crear un monitor gratuito en UptimeRobot. El plan gratuito consultado el **10-oct-2026** revisaba cada 5 minutos; el menú y las condiciones pueden cambiar. Un aviso gratuito no es instantáneo.

## Crea dos monitores

Usa como base el dominio público que normalmente abres para entrar a Nexora. No uses contraseñas ni incluyas tokens en las direcciones.

1. **API y base de datos:** crea un monitor de **palabra clave** para la dirección pública de Nexora seguida de **/api/health**. La respuesta correcta contiene exactamente **"status":"ok"**. Configura aviso cuando la palabra no aparezca o el servidor responda con error.
2. **Comprobación profunda:** crea un monitor **HTTP(s)** para la dirección pública de Nexora seguida de **/healthz/deep**. Debe responder con un código **2xx**.

> Importante: **/healthz/deep** responde **204 sin cuerpo**. No le configures la palabra **"status":"ok"** porque no tiene texto que buscar. La comprobación de palabra va en **/api/health**.

## En UptimeRobot

1. Crea una cuenta y verifica el correo. Añade un monitor para cada dirección anterior.
2. Para **/api/health**, selecciona **Keyword** y escribe **"status":"ok"** como palabra que debe estar presente. Para **/healthz/deep**, selecciona **HTTP(s)** y acepta respuestas 2xx.
3. Deja el intervalo gratuito de 5 minutos. Si aparece **Alert Contacts**, elige tu correo; conecta Telegram solo si la opción aparece en tu plan y ya tienes el grupo privado de administración.
4. Configura una demora de aviso de al menos un fallo adicional, si está disponible, para no alarmarte por una reiniciada breve.
5. Envía una notificación de prueba desde el servicio. Si quieres probar una caída, crea temporalmente un monitor a una ruta falsa de tu web, espera el aviso y luego borra ese monitor temporal.

El monitor solo detecta y avisa: no repara Nexora ni reemplaza los respaldos. Al recibir un aviso, prueba la página desde otro dispositivo y comunica la hora a soporte. Si solo falla **/api/health**, puede ser la API o la base; si fallan ambos, también puede ser la web o su conexión con la API.

**Límite técnico:** **/healthz/deep** valida web, API y base mediante una respuesta sin cuerpo; **/api/health** devuelve el estado legible **{"status":"ok"}** y falla si la base no está lista. No ingreses información de clientes en el monitor.

Fuente oficial consultada el 10-oct-2026: [UptimeRobot Free](https://uptimerobot.com/pricing/) (50 monitores y revisiones cada 5 minutos); [Render Health Checks](https://render.com/docs/health-checks). Rutas verificadas en el código y configuración de Nexora.
