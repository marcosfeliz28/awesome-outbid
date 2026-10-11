# Conectar el respaldo de Nexora a Google Drive

Esta guía sirve para **administración o soporte técnico**. No envíes contraseñas, secretos OAuth ni la frase de cifrado por chat, correo o captura. No hagas estos pasos desde una computadora compartida.

## Antes de empezar

- Necesitas acceso a la cuenta de Google de la tienda y autorización de quien administra el servicio. Si no tienes esa autorización, detente y pide ayuda; esta guía no requiere que compartas credenciales con nadie.
- Nexora necesita tres variables en el servicio API: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `BACKUP_ENCRYPTION_KEY`. Los valores son secretos: nunca los copies a esta guía ni al repositorio.
- `BACKUP_ENCRYPTION_KEY` requiere **32 caracteres como mínimo** y suficiente variedad. Una clave corta o simple deja la tarjeta como **No configurado**. Una frase nueva no recupera respaldos cifrados con otra frase.

## 1. Crear proyecto y permiso de Google Drive

1. Entra a Google Cloud Console con la cuenta donde se guardarán las copias y crea un proyecto para Nexora.
2. En **APIs y servicios** → **Biblioteca**, habilita **Google Drive API**.
3. Configura la pantalla de consentimiento de OAuth. Solicita únicamente el permiso `drive.file`; no añadas permisos para leer el resto del Drive.
4. Crea credenciales OAuth tipo **Aplicación web**. En **URI de redireccionamiento autorizados**, coloca la dirección pública exacta de la web, seguida por `/api/backups/google/callback`. La dirección base es el `WEB_ORIGIN` de la API, que el despliegue obtiene de `RENDER_EXTERNAL_URL` de la web. No agregues una barra final antes de la ruta. La tarjeta de Nexora muestra **Dirección de regreso para Google**; úsala como referencia exacta.

## 2. Crear y resguardar la frase de cifrado en Windows

Abre PowerShell **en tu computadora**, sin compartir pantalla ni iniciar una grabación. Ejecuta esto; genera una frase aleatoria y la muestra solo en esa ventana:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$clave = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$clave
```

La frase resultante tiene 43 caracteres. Guárdala de inmediato en un gestor de contraseñas y en otro lugar físico seguro. **No la envíes a este chat ni la dejes en un archivo compartido.** Evita cambiarla: si la cambias, las copias antiguas solo se abren con la frase anterior, y habrá que volver a conectar Google.

## 3. Configuración del servidor — solo la persona autorizada

La persona autorizada agrega los tres valores secretos a las variables de entorno del servicio API y sigue el procedimiento aprobado de despliegue. Esta guía no autoriza a modificar el servidor ni a compartir secretos. Si no tienes esa función, entrega solamente los **nombres** de las variables que hacen falta y solicita ayuda; no mandes los valores.

## 4. Conectar y probar desde Nexora

1. Entra con una cuenta administradora y ve a **Configuración** → **Negocio y reglas** → **Respaldo diario a Google Drive**.
2. Si la tarjeta indica **No configurado**, pide a soporte verificar las tres variables y la frase (sin enviárselas). No continúes hasta que la tarjeta indique que está configurado.
3. Pulsa **Conectar con Google**, elige la cuenta de la tienda y autoriza el permiso de Drive solicitado.
4. Confirma que la tarjeta diga **Conectado**. Pulsa **Respaldar ahora** para la prueba inicial y espera a que aparezca **Último respaldo bueno** con fecha y tamaño.
5. En Drive, verifica que exista la carpeta **Nexora POS respaldos**. El nombre del archivo contiene la fecha. No renombres ni muevas los respaldos.

Después, el servicio intenta una copia automática cada madrugada. En la tarjeta revisa **Próximo respaldo automático** y **Último respaldo bueno**. Si el intento falla, avisa a soporte; las ventas no deben detenerse por ese fallo.

## Si algo no coincide

- **No configurado:** revisar los nombres de variables, el mínimo de 32 caracteres y la variedad de la frase; no revelar valores.
- **Google rechaza la dirección:** compara carácter por carácter con **Dirección de regreso para Google** y añade la misma URI a las credenciales OAuth.
- **Hay que reconectar:** pulsa **Conectar con Google** de nuevo. Si cambió la frase, solo se conserva acceso a copias antiguas si guardaste la frase anterior.
- **Restauración:** no intentes restaurar sobre la base activa. La recuperación debe hacerla soporte en una base nueva y aislada siguiendo [Respaldo y recuperación de Render](RESTAURACION_RENDER.md).

Más detalle técnico y retención: [docs/RESPALDO_DRIVE.md](RESPALDO_DRIVE.md). Esta guía no indica que el respaldo esté actualmente conectado: confirma el estado real en la tarjeta de Nexora.
