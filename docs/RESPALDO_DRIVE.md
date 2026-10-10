# Respaldo diario a Google Drive

Guía para la dueña. No hace falta saber programar; sólo seguir los pasos con
calma. Tarda unos 30 minutos la primera vez.

## Qué hace

- Cada madrugada, a las **3:30 (hora de Santo Domingo)**, Nexora guarda una
  copia **completa** de la base de datos (ventas, clientes, inventario, caja…)
  en **tu** Google Drive, dentro de la carpeta **«Nexora POS respaldos»**.
- La copia se **cifra antes de salir** del servidor con una frase que sólo tú
  conoces (`BACKUP_ENCRYPTION_KEY`). Google guarda un archivo que no puede
  leer: sin la frase nadie puede abrirlo, tampoco Google ni Nexora.
- Se conservan las copias de los **últimos 30 días** y **una de cada mes** de
  los últimos 12 meses. Las más viejas pasan a la Papelera de Drive (Google
  las borra del todo a los 30 días).
- Nexora sólo puede ver y tocar **los archivos que ella misma creó** en tu
  Drive (permiso «drive.file»). No ve tus fotos, documentos ni nada más.
- Si un respaldo falla, lo vuelve a intentar a los 15 minutos y a la hora. Si
  falla 3 veces seguidas, o pasan más de 36 horas sin un respaldo bueno, te
  llega un aviso al grupo de Telegram (si los avisos de Telegram están
  activados). El estado siempre se ve en **Configuración › Negocio y reglas ›
  «Respaldo diario a Google Drive»**.
- Un fallo del respaldo **nunca** detiene la caja ni las ventas.

## Antes de empezar

- Una cuenta de Google (puede ser tu Gmail) con espacio libre en Drive. Cada
  copia ocupa pocos megas; 42 copias caben de sobra en los 15 GB gratuitos.
- Entrar a Render (render.com) con permiso para cambiar el servicio
  `nexora-pos-api`.
- La dirección de tu sistema, por ejemplo `https://nexora-pos-web.onrender.com`
  (la que abres en el navegador para entrar a Nexora). La tarjeta del respaldo
  en Configuración te muestra la «Dirección de regreso para Google» exacta
  mientras no esté configurado.

> **Nunca pegues claves, secretos ni la frase en un chat, correo o WhatsApp**
> (tampoco con un asistente de IA ni con soporte). Sólo van en Render y en tu
> lugar seguro.

## Paso 1. Crea el proyecto en Google Cloud

1. Entra a <https://console.cloud.google.com> con la cuenta de Google donde
   quieres guardar los respaldos.
2. Arriba, en el selector de proyectos, pulsa **«Nuevo proyecto»**. Nombre:
   `Nexora respaldos`. Pulsa **Crear** y, cuando termine, selecciónalo.

## Paso 2. Activa Google Drive API

1. Menú (☰) › **APIs y servicios › Biblioteca**.
2. Busca **Google Drive API**, ábrela y pulsa **Habilitar**.

## Paso 3. Pantalla de consentimiento

En el menú: **APIs y servicios › Pantalla de consentimiento de OAuth** (en la
consola nueva se llama **Google Auth Platform**).

1. Pulsa **Comenzar** (o «Configurar»).
2. **Información de la app**: nombre `Nexora POS respaldos`; correo de
   asistencia: tu correo.
3. **Público** (tipo de usuario): **Externo** si usas Gmail normal. Si tu
   cuenta es de Google Workspace de la empresa, puedes elegir **Interno** y
   saltarte el punto 6.
4. **Información de contacto**: tu correo. Acepta la política y pulsa
   **Crear**.
5. En **Acceso a los datos** (o «Permisos»), pulsa **Agregar o quitar
   permisos**, busca `drive.file` y marca
   `https://www.googleapis.com/auth/drive.file` («Ver, editar, crear y
   eliminar solo los archivos de Google Drive específicos que uses con esta
   app»). Guarda. No agregues ningún otro permiso.
6. **MUY IMPORTANTE — Publícala.** En **Público**, el «Estado de publicación»
   empieza en **Pruebas**. Pulsa **Publicar app** y confirma: debe quedar
   **«En producción»**.
   - Si se queda en «Pruebas», Google **corta el permiso a los 7 días** y los
     respaldos dejan de hacerse.
   - Con sólo el permiso `drive.file` Google **no pide verificación**: se
     publica al instante. Si muestra un aviso de verificación, revisa que no
     hayas agregado otros permisos ni un logotipo.
   - Mientras esté en «Pruebas», agrega tu correo en **Usuarios de prueba**
     para poder conectarte.

## Paso 4. Crea las credenciales («Aplicación web»)

1. **APIs y servicios › Credenciales** (o **Google Auth Platform › Clientes**)
   › **Crear credenciales › ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Nexora POS`.
3. En **URI de redireccionamiento autorizados** pulsa **Agregar URI** y escribe
   exactamente (con tu dirección, sin barra al final del dominio):

   ```text
   https://TU-DIRECCION/api/backups/google/callback
   ```

   Por ejemplo `https://nexora-pos-web.onrender.com/api/backups/google/callback`.
   «Orígenes de JavaScript autorizados» no hace falta.

4. Pulsa **Crear**. Google muestra el **ID de cliente** y el **Secreto del
   cliente**. Déjalos en esa pantalla (o descarga el JSON a tu computadora)
   para el paso 6. El secreto es como una contraseña.

## Paso 5. Inventa y guarda la frase de cifrado

Es la llave de tus respaldos. **Sin ella no se pueden abrir: ni nosotros ni
Google pueden recuperarla.**

- Mínimo 24 caracteres. Lo más fácil: 6 o 7 palabras al azar separadas por
  guiones, por ejemplo con este estilo (¡no uses este ejemplo!):
  `mango-tambora-azul-puerto-nube-siete-cafe`.
- Guárdala en dos lugares seguros: un gestor de contraseñas (por ejemplo, el
  de Google o 1Password) **y** escrita en papel en un sobre cerrado, en la caja
  fuerte o con una persona de confianza.
- No la cambies sin necesidad: los respaldos viejos sólo se abren con la frase
  con la que se hicieron. Si un día la cambias, guarda también la anterior y
  pulsa «Conectar con Google» otra vez.

## Paso 6. Ponlo en Render

1. Entra a <https://dashboard.render.com>, abre el servicio
   **`nexora-pos-api`** y ve a **Environment**.
2. Pulsa **Add Environment Variable** y agrega estas tres (copiar y pegar, sin
   espacios antes ni después):

   | Nombre (Key)                 | Valor (Value)                     |
   | ---------------------------- | --------------------------------- |
   | `GOOGLE_OAUTH_CLIENT_ID`     | el ID de cliente del paso 4       |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | el secreto del cliente del paso 4 |
   | `BACKUP_ENCRYPTION_KEY`      | tu frase del paso 5               |

3. Pulsa **Save, rebuild, and deploy** (o «Save changes» y luego
   **Manual Deploy › Deploy latest commit**). Espera a que diga **Live**.

Si falta alguna de las tres, o la frase tiene menos de 24 caracteres, la
tarjeta dice «No configurado» y no se hace nada más.

## Paso 7. Conecta Google Drive

1. En Nexora, entra con tu usuario de administración y ve a **Configuración ›
   Negocio y reglas › «Respaldo diario a Google Drive»**.
2. Pulsa **Conectar con Google**, elige tu cuenta y, en la pantalla de Google,
   **marca la casilla** del permiso de Drive y pulsa **Continuar**.
   - Si aparece «Google no verificó esta app», es tu propia app: pulsa
     **Avanzado › Ir a Nexora POS respaldos**.
3. Vuelves a Nexora y verás **«Google Drive quedó conectado»** y la etiqueta
   **Conectado**.

## Paso 8. Prueba «Respaldar ahora»

1. Pulsa **Respaldar ahora**. Tarda unos minutos; puedes seguir trabajando.
2. Cuando termine, la tarjeta muestra **«Último respaldo bueno»** con la fecha
   y el tamaño.
3. En tu Google Drive aparece la carpeta **«Nexora POS respaldos»** con un
   archivo como `nexora-2026-10-10-0330.dump.enc`. No lo cambies de nombre ni
   lo muevas: Nexora sólo administra los que siguen ese patrón dentro de esa
   carpeta.

Desde ese día se respalda solo cada madrugada.

## Cómo restaurar (con ayuda técnica)

Restaurar no borra nada de lo actual: siempre se hace en una base **nueva y
vacía**, se revisa y sólo después se decide si se usa. Pídeselo a la persona
técnica y entrégale la frase en persona (no por chat).

1. En Google Drive, descarga el archivo `.dump.enc` del día que quieres.
2. En una computadora con Node.js 24 y el cliente de PostgreSQL 17, dentro de
   la carpeta del proyecto:

   ```text
   node scripts/decrypt-backup.mjs nexora-2026-10-10-0330.dump.enc
   ```

   Pide la frase sin mostrarla. Si la frase es incorrecta o el archivo fue
   alterado o está incompleto, se detiene y no deja nada a medias. Si va bien,
   deja `nexora-2026-10-10-0330.dump` con su `.sha256` y su `.json`.

3. Crea una base de datos nueva y vacía (por ejemplo, desde Render › New ›
   PostgreSQL, versión 17) y restaura:

   ```text
   RESTORE_DATABASE_URL=<URL de la base NUEVA> node scripts/restore.mjs nexora-2026-10-10-0330.dump
   ```

   `restore.mjs` comprueba la suma SHA-256 antes de empezar y restaura todo o
   nada.

4. Revisa la base nueva y, sólo si está bien, sigue
   «Respaldo y recuperación de Render» en `docs/DEPLOY-RENDER.md` para
   apuntar la API a ella.

## Si Google retira el permiso

La tarjeta dice **«Hay que reconectar»** y, si Telegram está activado, llega
un aviso. Puede pasar si:

- quitaste el acceso en <https://myaccount.google.com/permissions>;
- la app quedó en «Pruebas» (paso 3, punto 6) y pasaron 7 días;
- el permiso pasó 6 meses sin usarse (por ejemplo, con el respaldo apagado);
- se cambió `BACKUP_ENCRYPTION_KEY` en Render.

Qué hacer: revisa que la app esté **«En producción»** y pulsa **Conectar con
Google** otra vez. Los respaldos ya guardados no se pierden.

## Otras preguntas

- **¿Puedo apagarlo?** Pulsa **Desconectar**: Nexora devuelve el permiso a
  Google y deja de respaldar. Las copias que ya están en Drive se quedan.
- **¿Y si el secreto de Google se filtra?** En Google Cloud › Credenciales,
  abre el cliente, crea un secreto nuevo y borra el viejo; cambia
  `GOOGLE_OAUTH_CLIENT_SECRET` en Render y vuelve a desplegar.
- **¿Y si alguien ve el archivo en mi Drive?** Está cifrado: sin la frase es
  ruido. Aun así, no compartas la carpeta.
- **¿Qué sale de la tienda?** Sólo el archivo cifrado y su nombre (con la
  fecha). Google no recibe la contraseña de la base ni la frase.

---

## Para la persona técnica

- Código: `apps/api/src/drive-backup.ts` (rutas, temporizador, Google) y
  `apps/api/src/drive-backup-core.ts` (cifrado, nombres, retención,
  calendario). Tarjeta: `apps/web/src/DriveBackup.tsx`. Pruebas:
  `tests/drive-backup-core.test.ts`, `tests/drive-backup.test.ts` (Google y
  Telegram falsos, pg_dump real y restauración) y
  `tests/e2e/respaldo-drive.spec.ts`.
- Rutas (sólo permiso `*`): `GET /api/backups/status`, `POST /api/backups/run`,
  `GET /api/backups/google/connect`, `POST /api/backups/google/disconnect`.
  Pública: `GET /api/backups/google/callback` (valida `state`).
- **OAuth**: código de autorización con PKCE (S256), scope sólo `drive.file`,
  `access_type=offline`, `prompt=consent`. El `state` es un HMAC-SHA256 (clave
  HKDF de `JWT_SECRET`) con usuario, sesión, caducidad de 10 minutos y el
  SHA-256 de un nonce que va en una cookie `HttpOnly; SameSite=Lax;
Path=/api/backups/google` del mismo navegador; el verificador PKCE se deriva
  de ese nonce. La vuelta exige firma válida, no caducada, la cookie, la sesión
  viva y que la persona siga siendo administradora. Si Google no concede
  `drive.file`, se revoca lo concedido.
- **Token en reposo**: tabla `DriveBackup` (fila `main`, migración
  `202610200101_drive_backup`, sólo `CREATE TABLE IF NOT EXISTS`), columna
  `refreshTokenEnc` = `v1.` + base64url(sal 16 ‖ iv 12 ‖ etiqueta 16 ‖
  cifrado); AES-256-GCM con clave HKDF-SHA256(scrypt(frase, sal, N=2^15, r=8,
  p=1), «nexora drive refresh token v1»). Nunca se devuelve ni se registra; el
  estado muestra la cuenta enmascarada (`d•••@gmail.com`).
- **Formato `.dump.enc` (NXBK v1)**: cabecera de 36 bytes («NXBK», versión 1,
  KDF 1 = scrypt, log2N, r, p, tamaño de bloque uint32 BE, sal 16, prefijo de
  nonce 7); clave = scrypt(frase NFC, sal, 32, N=2^15, r=8, p=1); bloques de
  1 MiB cifrados con AES-256-GCM, nonce = prefijo ‖ nº de bloque (uint32 BE) ‖
  marca de último (1/0), datos asociados = cabecera, cada bloque seguido de su
  etiqueta de 16 bytes; el último bloque (0 a 1 MiB) siempre existe. Detecta
  frase errónea, cambios, bloques reordenados y archivos cortados.
  `scripts/decrypt-backup.mjs` lo reimplementa sin dependencias.
- **Respaldo**: `pg_dump --format=custom --no-password --lock-wait-timeout=60s`
  con la conexión por variables `PG*` (la contraseña va en `PGPASSWORD`, nunca
  en argv ni en registros), prioridad baja (nice 10), comprobación de la firma
  `PGDMP`, tamaño máximo `DRIVE_BACKUP_MAX_BYTES` (2 GiB por defecto). Sólo el
  contenido cifrado toca el disco (directorio temporal 0700, archivo 0600,
  borrado al terminar; restos de más de 2 h se limpian al arrancar). Memoria
  acotada: un bloque de cifrado (1 MiB) y una parte de subida (8 MiB).
- **Subida**: reanudable de Drive v3 en partes de 8 MiB; tras un corte
  pregunta cuánto llegó y sigue (hasta 6 reintentos con espera creciente).
  Metadatos: carpeta, `appProperties` `nexoraBackup=1`, `format=NXBK1` y
  `sha256` del cifrado. **Verificación**: tamaño igual y `sha256Checksum` o
  `md5Checksum` iguales a los locales; si no, la copia dudosa va a la papelera
  y no se borra nada más.
- **Retención** (sólo tras verificar): de los archivos de la carpeta con
  `nexoraBackup=1` y nombre `nexora-AAAA-MM-DD-HHmm.dump.enc`, conserva el más
  reciente de cada uno de los 30 días más recientes y el primero de cada uno de
  los 12 meses más recientes; el resto va a la papelera. Si el listado no trae
  la copia recién subida, no borra nada.
- **Un solo respaldo a la vez**: arriendo en la fila `main`
  (`lockId`/`lockedUntil`, 60 min, el mismo patrón que `NotificationOutbox`)
  más un indicador en memoria; tiempo máximo de 45 min por respaldo. No se usa
  un candado consultivo de sesión porque Prisma reparte las consultas entre
  conexiones del grupo y retenerlo ocuparía una conexión durante todo el
  respaldo.
- **Calendario**: el temporizador arranca 2 min después de iniciar la API y
  mira cada minuto. Ejecuta desde las 03:30 si hoy (desde las 03:30) no hubo
  éxito, tampoco en las últimas 20 h, quedan intentos (3 por día) y pasó la
  espera del reintento (15 min, 60 min).
- **Aviso**: evento `backup_alert` en la cola de Telegram (`NotificationOutbox`,
  uno por día como máximo) si hay 3 fallos seguidos, más de 36 h sin éxito o
  el permiso fue revocado. Sin datos personales.
- **Auditoría**: `backup_run`, `backup_failed` (usuario `system` en los
  programados), `drive_connected`, `drive_disconnected`; sin secretos.
- **Imagen**: `deploy/render/Dockerfile.api` instala `libpq5` y extrae
  `pg_dump`/`pg_restore` 17 del repositorio PGDG; `PG_DUMP_BIN` apunta a
  `/usr/lib/postgresql/17/bin/pg_dump`.
- **Variables sólo para pruebas** (ignoradas con `NODE_ENV=production`):
  `DRIVE_BACKUP_START_DELAY_MS`, `DRIVE_BACKUP_TICK_MS`,
  `DRIVE_BACKUP_RETRY_MS`, `DRIVE_BACKUP_TEST_IGNORE_HOUR`,
  `DRIVE_BACKUP_UPLOAD_CHUNK`, `DRIVE_BACKUP_UPLOAD_RETRY_MS`. Las bases
  `GOOGLE_OAUTH_BASE` y `GOOGLE_DRIVE_BASE` permiten un Google falso; no se
  declaran en Render. `GOOGLE_OAUTH_REDIRECT_URI` sustituye la dirección de
  regreso si hiciera falta.
