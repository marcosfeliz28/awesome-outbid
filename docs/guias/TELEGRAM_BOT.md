# Preparar los avisos de Nexora en Telegram

Esta configuración permite que administración reciba avisos de la tienda. Hazla solo si la dueña lo autoriza. **El token del bot es una contraseña:** no lo pegues en ChatGPT, Claude, correo, WhatsApp, una captura ni este repositorio.

## 1. Crear el bot y un grupo privado

1. En Telegram, busca la cuenta oficial **@BotFather**, envía **/newbot** y sigue las instrucciones. Guarda el token en el gestor de contraseñas de la tienda.
2. Crea un grupo **privado** para la administración y agrega el bot. Envía dentro del grupo un mensaje nuevo como **/start@NombreDelBot**.
3. Pide a la persona técnica autorizada que obtenga el identificador del grupo desde una computadora segura. No pongas el token en la barra de direcciones de un navegador: la dirección podría quedar en el historial.
4. Para encontrar el identificador, la persona técnica autorizada puede consultar las actualizaciones del bot desde PowerShell local, sin imprimir el token ni compartir la respuesta completa. Abre una ventana privada de PowerShell y ejecuta el bloque de abajo. Escribe el token cuando lo solicite; la entrada no se muestra.

    ```powershell
    $secure = Read-Host "Token de BotFather (no lo compartas)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      $updates = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getUpdates"
      $updates.result | ForEach-Object { $_.message.chat } |
        Select-Object id, type, title -Unique | Format-Table
    } finally {
      if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      }
      $token = $null
      $secure = $null
    }
    ```

    Comparte con soporte únicamente el identificador del grupo, no el token ni el contenido de mensajes.

Si no aparece el grupo, confirma que el bot está agregado y que alguien envió un mensaje nuevo; vuelve a ejecutar el bloque. Si PowerShell está grabando la sesión, detén la grabación primero. Nunca pegues el token en un navegador ni en un chat.

## 2. Activar los avisos en el servidor

La persona autorizada agrega directamente en el servicio API de Render las variables con estos nombres:

- **TELEGRAM_BOT_TOKEN** — token privado de BotFather.
- **TELEGRAM_CHAT_ID** — identificador del grupo privado.

No me envíes sus valores. Si no tienes acceso autorizado, pide a soporte que las configure; el despliegue lo coordina la responsable de Nexora. No cambies otras variables.

## 3. Probar desde Nexora

Entra como administración a **Configuración** → **Negocio y reglas** → **Avisos de facturas por Telegram**. Activa los avisos si la pantalla los ofrece y usa **Enviar mensaje de prueba**. Confirma que llegue al grupo correcto. Si dice **Desactivados**, pide a soporte revisar que las dos variables existan y que la responsable haya reiniciado/desplegado el servicio.

Si el token se comparte por accidente, revócalo en **@BotFather** y pide a soporte sustituirlo. No uses grupos abiertos para información de ventas.
