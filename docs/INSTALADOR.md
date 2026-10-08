# Instalador de FitStore POS para Windows 11

Esta guía está pensada para la dueña de la tienda. El instalador deja una laptop
Windows 11 funcionando como servidor de FitStore POS sin escribir comandos. Las
cajas y los celulares entran por la red privada de la tienda.

## Antes de empezar

Necesitas:

1. La laptop Windows 11 conectada al router de la tienda.
2. Una cuenta de Windows con permiso de administrador.
3. El archivo `FitStore-POS-Setup-<versión>.exe`.
4. Un correo, una contraseña nueva de al menos 12 caracteres y un PIN de 4 a 6
   dígitos para la persona dueña. El paquete no trae contraseña de demostración.
5. De preferencia, una carpeta de OneDrive o una memoria USB con espacio para
   los respaldos. La memoria debe estar conectada a la hora programada.
6. La red de la tienda marcada como **Privada** en **Configuración de Windows ›
   Red e Internet › Wi-Fi › Propiedades**. No marques como privada una red
   pública de hotel, aeropuerto o cafetería.

No desconectes ni apagues la laptop durante la instalación o una actualización.

## Instalación, paso a paso

1. Haz clic derecho en el instalador y elige **Ejecutar como administrador**.
2. Acepta el aviso de Windows sólo si el nombre y el SHA-256 coinciden con los
   entregados junto al instalador.
3. Escribe el nombre y el correo del usuario dueño.
4. Crea una contraseña de al menos 12 caracteres, repítela y elige un PIN de 4
   a 6 dígitos. Guárdalos en un lugar seguro.
5. Elige la carpeta de respaldo. Conviene usar OneDrive o una memoria USB. Si
   no tienes una, elige una carpeta local y cámbiala después con asistencia.
6. Pulsa **Instalar** y espera el mensaje de finalización. El primer arranque
   puede tardar varios minutos.
7. Abre el acceso directo **FitStore POS** del escritorio.
8. Inicia sesión con el correo y la contraseña que acabas de elegir.
9. En Configuración, completa los datos reales del negocio antes de vender.

El instalador hace internamente lo siguiente:

- instala copias privadas de Node.js y PostgreSQL, sin cambiar otras
  instalaciones de la computadora;
- instala o repara el runtime oficial de Microsoft Visual C++ que necesita
  PostgreSQL;
- crea la base, un rol con contraseña aleatoria y secretos únicos;
- aplica todas las migraciones de Prisma;
- crea únicamente el usuario dueño indicado en el asistente;
- registra PostgreSQL, la API y la web HTTPS como servicios automáticos;
- permite el puerto 4173 sólo desde la red local y bloquea el acceso directo al
  puerto 3001;
- crea el certificado local, las tareas de respaldo y el acceso directo.

## Encendido y uso diario

Enciende la laptop y espera uno o dos minutos. No hace falta abrir una consola.
Los tres servicios arrancan solos. En la laptop usa:

```text
https://localhost:4173
```

En el escritorio se crea **FitStore - acceso en celulares.txt** con la dirección
de la red, por ejemplo:

```text
https://192.168.1.25:4173
```

La dirección puede cambiar si el router entrega otra IP. FitStore renueva el
certificado al arrancar, pero los accesos guardados en los celulares tendrían
que cambiar. Pide a quien administra el router que reserve una IP para la
laptop por DHCP; no hace falta configurar una IP manual en Windows.

## Confirmar el certificado en Android

Haz esto una sola vez en cada celular Android:

1. Copia al celular el archivo del escritorio **Certificado FitStore para
   celulares.cer**. Sólo comparte ese `.cer`; nunca compartas archivos `.pfx`,
   `.env` ni `secrets.json`.
2. Abre **Ajustes**. La ruta cambia según la marca; busca “instalar certificado”.
3. En Android estándar entra a **Seguridad y privacidad › Más ajustes de
   seguridad › Cifrado y credenciales › Instalar un certificado › Certificado
   de CA**.
4. Confirma el aviso de Android y selecciona el archivo `.cer`.
5. Ponle el nombre **FitStore POS CA** si lo solicita.
6. Cierra y vuelve a abrir Chrome.
7. Escribe la dirección que aparece en el archivo `FitStore - acceso en
   celulares.txt`. Debe mostrarse con HTTPS sin advertencias.
8. Acepta el permiso de cámara cuando FitStore lo solicite.
9. Desde el menú de Chrome, elige **Instalar aplicación** o **Agregar a pantalla
   principal**.

Si Android muestra una advertencia de certificado después de instalarlo,
comprueba que el teléfono usa la misma Wi-Fi, que la fecha y hora son correctas
y que abriste exactamente la IP indicada. Algunas políticas empresariales
impiden instalar CA de usuario; en ese caso debe autorizarlo quien administra
el teléfono.

## Confirmar el certificado en iPhone o iPad

Haz esto una sola vez en cada dispositivo:

1. Pasa **Certificado FitStore para celulares.cer** al iPhone mediante AirDrop,
   iCloud Drive o una conexión directa segura.
2. Abre el archivo y acepta descargar el perfil.
3. Ve a **Ajustes › General › VPN y gestión de dispositivos** o toca **Perfil
   descargado** en la parte superior de Ajustes.
4. Abre **FitStore POS CA**, toca **Instalar** y confirma con el código del
   iPhone.
5. Ve a **Ajustes › General › Información › Ajustes de confianza de
   certificados**.
6. Activa la confianza completa para **FitStore POS CA** y confirma.
7. Cierra y vuelve a abrir Safari.
8. Abre la dirección HTTPS indicada en el escritorio de la laptop.
9. Acepta la cámara y usa **Compartir › Añadir a pantalla de inicio**.

La clave privada de la autoridad certificadora nunca sale de la laptop. El
archivo `.cer` que se instala en los teléfonos sólo contiene la parte pública.

## Respaldos automáticos

- La tarea **FitStore POS - Respaldo diario** se ejecuta todos los días a las
  2:00 a. m. y también al encender si se perdió la hora.
- Cada copia se crea con `pg_dump` en formato custom, se abre con `pg_restore
  --list` para comprobarla y recibe un archivo SHA-256.
- Se conservan los últimos 30 días.
- Si OneDrive o la memoria USB no están disponibles, ese día se usa
  `%ProgramData%\FitStore POS\Backups` y queda una advertencia en el registro.
- Una actualización y una restauración crean otra copia antes de cambiar nada.

Revisa al menos una vez por semana que aparezcan archivos recientes
`FitStore_*.dump`, `.sha256` y `.json` en la carpeta elegida. Un respaldo dentro
de la misma laptop no protege frente a daño, robo o pérdida de esa laptop.

## Restaurar un respaldo

La restauración reemplaza la base activa; debe hacerse sin ventas en curso.

1. Cierra FitStore en todas las cajas y celulares.
2. En la laptop abre **Inicio › FitStore POS › Restaurar un respaldo**.
3. Selecciona el archivo `FitStore_*.dump`.
4. La herramienta cierra la entrada web y la API, comprueba el SHA-256, abre el
   archivo con `pg_restore` y crea un respaldo de seguridad de la base actual.
5. Escribe `RESTAURAR` cuando se solicite.
6. Espera la confirmación. La herramienta restaura primero en una base temporal,
   aplica allí las migraciones y valida las tablas esenciales. Sólo entonces
   reemplaza el contenido activo mediante `pg_restore --single-transaction`,
   inicia los servicios y comprueba la API y HTTPS.
7. Inicia sesión y verifica una venta conocida, el inventario y el último cierre.

Si la copia falla durante la validación aislada, la base activa no cambia y la
aplicación vuelve a abrir. Si falla después del reemplazo, la herramienta usa el
respaldo previo para recuperar y verificar automáticamente la base anterior. Sólo
deja los servicios detenidos cuando también falla esa recuperación; en ese caso,
no borres el respaldo indicado y entrega el registro a soporte.

## Instalar una actualización

1. Espera a que terminen las ventas y sincroniza las cajas que trabajaron sin
   internet.
2. Conecta el destino habitual de respaldos.
3. Ejecuta el nuevo `FitStore-POS-Setup-<versión>.exe` como administrador.
4. El asistente detecta FitStore. No vuelve a pedir el usuario dueño ni cambia
   sus credenciales.
5. Antes de reemplazar archivos, cierra la web y la API para impedir ventas
   nuevas, comprueba la versión mayor de PostgreSQL, crea y verifica un respaldo,
   deshabilita temporalmente el autoarranque, detiene PostgreSQL y aparta íntegra
   la versión anterior con un manifiesto de hashes. Así un reinicio inesperado no
   abre una versión todavía no verificada.
6. Después instala la nueva aplicación, valida que la versión mayor de
   PostgreSQL sea compatible, aplica `prisma migrate deploy` y comprueba salud
   de API y web.
7. Si la configuración, migración o verificación falla, el instalador restaura
   automáticamente los archivos, configuración y base anteriores, vuelve a
   iniciar los servicios y comprueba API y HTTPS. Conserva además el instalador
   anterior y el respaldo previo hasta completar la prueba de aceptación.

Sólo puede ejecutarse una instalación, actualización o desinstalación a la vez.
Un segundo asistente se detiene antes de tocar archivos o activar un rollback.

Una actualización mayor de PostgreSQL se detiene expresamente: requiere una
migración asistida. Nunca copies una carpeta de datos de una versión mayor sobre
otra versión.

## Desinstalar

Usa **Configuración de Windows › Aplicaciones › Aplicaciones instaladas ›
FitStore POS › Desinstalar**.

La opción recomendada conserva en `%ProgramData%\FitStore POS` la base, los
secretos, certificados y respaldos para una reinstalación. Retira los servicios,
tareas, firewall, accesos y archivos del programa.

El borrado de datos sólo aparece mediante dos confirmaciones explícitas. Aun
así, el desinstalador nunca borra respaldos ubicados en OneDrive, USB u otra
carpeta externa. No elijas el borrado permanente mientras exista información
que deba conservarse.

## Si no abre

1. Confirma que la laptop está conectada a la red y tiene fecha/hora correctas.
2. Confirma que la conexión de la tienda está marcada como red **Privada** en
   Windows.
3. Reiníciala y espera dos minutos.
4. Prueba `https://localhost:4173` en la propia laptop.
5. Abre PowerShell como administrador y ejecuta la herramienta técnica:

   ```powershell
   & "$env:ProgramFiles\FitStore POS\scripts\Verify-FitStore.ps1"
   ```

La ausencia temporal de una red Privada/Dominio se informa como advertencia: no
convierte en fallida una instalación cuya API y HTTPS local están sanas. Mientras
se corrige el perfil, `https://localhost:4173` sigue funcionando en la laptop,
pero el firewall no permite la entrada de las otras cajas.

6. Conserva estos archivos para soporte:

   ```text
   %ProgramData%\FitStore POS\logs\instalador.log
   %ProgramData%\FitStore POS\logs\FitStoreAPI.*
   %ProgramData%\FitStore POS\logs\FitStoreWeb.*
   ```

No publiques `.env`, `secrets.json`, archivos `.pfx`, respaldos ni registros con
datos de clientes.

---

## Sección técnica

### Elección del instalador

Se usa **NSIS** para generar un `.exe`. Es software de código abierto con
licencia zlib/libpng y permite ejecutar de forma elevada las tareas del servidor.
Tauri no se usa en esta fase: una ventana Tauri no resuelve el ciclo de vida de
PostgreSQL, servicios de Windows, tareas programadas, firewall, PKI y
desinstalación conservadora. La PWA instalada por el navegador sigue siendo el
cliente de escritorio y móvil.

### Diseño instalado

| Componente | Ubicación/puerto | Exposición |
| --- | --- | --- |
| PostgreSQL privado | `127.0.0.1:5434` | Sólo loopback |
| API NestJS | `0.0.0.0:3001` | Bloqueada por firewall; sólo la usa el proxy local |
| PWA + proxy HTTPS | `0.0.0.0:4173` | Sólo perfiles Privado/Dominio y `LocalSubnet` |
| Programa y runtimes | `%ProgramFiles%\FitStore POS` | Administradores/SYSTEM |
| Base, secretos, PKI y registros | `%ProgramData%\FitStore POS` | Administradores/SYSTEM |

Servicios automáticos con inicio retrasado:

1. `FitStorePostgreSQL`.
2. `FitStoreAPI`, dependiente de PostgreSQL.
3. `FitStoreWeb`, dependiente de la API.

WinSW supervisa API y web y reinicia cada una ante un fallo. La web usa el
servidor Node de `instalador/runtime/web-server.mjs`: entrega archivos estáticos,
mantiene SSE sin buffering y sustituye `X-Forwarded-For` antes de enviar `/api`
a `127.0.0.1:3001`.

### Secretos y base

En una instalación nueva se generan con CSPRNG:

- contraseña del superusuario PostgreSQL;
- contraseña del rol `fitstore`;
- `JWT_SECRET` de 64 bytes;
- contraseña del PFX local.

Los secretos no pasan como argumentos de procesos ni se escriben en registros.
`.env`, `secrets.json`, `server.json`, PFX y archivos temporales reciben ACL sólo
para `SYSTEM` y Administradores. `create-admin.ts` recibe las credenciales por
variables de entorno, que se eliminan al terminar. No se ejecuta el seed de
demostración.

### HTTPS y cambios de IP

El instalador crea una CA RSA-4096 por equipo, válida por diez años, y un
certificado servidor RSA-2048 de dos años con SAN para `localhost`, nombre del
equipo y todas las IPv4 privadas activas. La tarea de inicio **FitStore POS -
Actualizar HTTPS** vuelve a emitir sólo el certificado servidor si cambian las
IP; conserva la misma CA, de modo que los teléfonos no deben reinstalarla.

Para evitar cambios de URL, configura una reserva DHCP. El firewall se recrea
con una regla Allow TCP 4173 limitada a `LocalSubnet` y perfiles Domain/Private,
y una regla Block TCP 3001 para todos los perfiles.

### Construcción reproducible

Requisitos del equipo de construcción: Windows 11 x64, Node 24+, Corepack/pnpm,
Git y conexión a internet la primera vez.

Desde la raíz:

```powershell
corepack enable
pnpm instalador:compilar
```

El comando:

1. ejecuta `pnpm install --frozen-lockfile`, Prisma generate y ambos builds;
2. crea una distribución de API con sus dependencias y copia la PWA compilada;
3. descarga Node 24, WinSW y los binarios oficiales completos de PostgreSQL
   18.6 para Windows con URL y SHA-256 bloqueados;
4. verifica por SHA-256 y firma Authenticode el runtime de Microsoft Visual C++;
5. conserva de PostgreSQL las carpetas `bin`, `lib` y `share`, incluidos
   `pg_dump`, `pg_restore`, `psql`, `initdb` y el servidor;
6. genera `MANIFEST.sha256` para todo el payload;
7. instala NSIS con `winget` si falta y crea:

   ```text
   instalador\dist\FitStore-POS-Setup-<versión>.exe
   instalador\dist\FitStore-POS-Setup-<versión>.exe.sha256
   ```

Las versiones externas están en `instalador/dependencias.lock.json`. Para
preparar el payload sin NSIS usa `pnpm instalador:preparar`.

### Prueba técnica en Windows

Después de instalar en una Windows 11 de prueba, abre PowerShell como
administrador y ejecuta:

```powershell
& "$env:ProgramFiles\FitStore POS\tests\Windows-Smoke.ps1"
```

La prueba crea un respaldo real, lo restaura en una base aislada con nombre
temporal, compara usuarios, ventas y migraciones, elimina esa base de prueba y
comprueba servicios, endpoints HTTPS, tareas, firewall y CA. No reemplaza la
base activa.

### Pruebas realizadas en el entorno de desarrollo

- `pnpm build`: API NestJS y PWA Vite compiladas correctamente.
- `pnpm lint`: sin errores.
- `pnpm instalador:validar`: 4/4 pruebas del servidor estático/proxy y todos los
  controles de estructura, rutas permitidas y ausencia de secretos fijos.
- Distribución de API preparada con `pnpm deploy`; se comprobó que no conserva
  enlaces al repositorio y que `@fitstore/shared` carga de forma autónoma.
- Los scripts PowerShell del instalador pasan el analizador sintáctico y las funciones de
  secretos, URL de base y escape XML pasan pruebas directas.
- El guion NSIS compila sin advertencias con un payload de prueba.
- Se descargaron Node, PostgreSQL, WinSW y Visual C++ Runtime y sus cuatro
  SHA-256 coinciden con `dependencias.lock.json`; el ZIP de PostgreSQL contiene
  las nueve herramientas requeridas.
- La suite general llegó a 126 pruebas correctas y una omitida. Dos pruebas de
  portabilidad que capturan la salida de un Node hijo fallan por una restricción
  de este entorno Linux; se reprodujo exactamente el mismo resultado en la
  copia original sin cambios. Los dos comandos probados directamente terminan
  correctamente.

### Pruebas pendientes en una Windows 11 real

1. Construir el `.exe` con el comando único y comprobar su SHA-256.
2. Instalar en una máquina limpia y reiniciar dos veces.
3. Probar lector, impresora, cuatro cajas y al menos un Android y un iPhone.
4. Desconectar internet sin desconectar la Wi-Fi local y completar una venta.
5. Ejecutar `Windows-Smoke.ps1` y luego una restauración completa en una copia
   de la máquina.
6. Actualizar desde la versión anterior, confirmar migraciones y ejecutar la
   prueba de aceptación de caja.
7. Desinstalar conservando datos, reinstalar y confirmar que reaparecen.
8. Probar aparte el borrado explícito en una máquina sin datos importantes.
9. Firmar el instalador con un certificado Authenticode de la empresa antes de
   distribuirlo; sin firma, SmartScreen puede mostrar una advertencia.

### Pedidos a Claude

No hay ningún cambio obligatorio en el código de aplicación para construir esta
primera fase. Como endurecimiento posterior, conviene que Claude agregue:

1. una variable `HOST=127.0.0.1` para que la API pueda enlazarse directamente a
   loopback además de la protección actual del firewall;
2. un comando de producción compilado para crear el primer dueño, evitando que
   futuras versiones del instalador tengan que conservar `tsx` y ese archivo
   TypeScript en la distribución.
