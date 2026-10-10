# Instalador de Nexora POS para Windows 11

Esta guía es para instalar un servidor local independiente en una laptop Windows
11. **No instales este servidor en cada laptop de cajero:** cada instalación
crearía una base local separada, distinta de la base compartida en Render. Para
que todos usen los mismos datos cloud, abre `https://nexora-pos-web.onrender.com/`
en cada equipo e instala la PWA desde Edge, Chrome o Safari. El cliente nativo
de escritorio conectado a la cloud no está empaquetado en este instalador.

## Antes de empezar

Necesitas:

1. La laptop Windows 11 conectada al router de la tienda.
2. Una cuenta de Windows con permiso de administrador.
3. El archivo `Nexora-POS-Setup-<versión>.exe`.
4. Un correo, una contraseña nueva de al menos 12 caracteres y un PIN de 4 a 6
   dígitos para la persona dueña. El paquete no trae contraseña de demostración.
5. Espacio libre para las copias en `%ProgramData%\FitStore POS\Backups`.
   Para conservar una copia fuera de la laptop, prepara aparte OneDrive o una USB.
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
5. Los respaldos se guardan en `%ProgramData%\FitStore POS\Backups`, incluso
   si el asistente heredado muestra otra carpeta. No elige un destino externo.
6. Pulsa **Instalar** y espera el mensaje de finalización. El primer arranque
   puede tardar varios minutos.
7. Abre el acceso directo **Nexora POS** del escritorio.
   La ruta interna del programa y sus datos todavía conserva el nombre heredado
   `FitStore POS` para que instalaciones previas puedan actualizarse sin mover
   ni perder la base existente.
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
- El destino siempre es `%ProgramData%\FitStore POS\Backups`. Una actualización
  corrige `state.backupPath` antiguo e intenta retirar permisos públicos de los
  archivos `FitStore_*` del destino anterior. Si la USB/red está inaccesible o
  no admite ACL, registra un aviso: el original puede seguir con permisos públicos.
  Preflight usa una copia local privada si no puede proteger el respaldo previo;
  no elimina el original. Soporte debe revisar esa ubicación antigua.
- Una actualización y una restauración crean otra copia antes de cambiar nada.

La retención de 30 días no excluye los respaldos referenciados por un marcador
de actualización pendiente, incluida la copia privada de Preflight. No pospongas
una recuperación hasta que venza ese plazo: solicita soporte y conserva aparte
una copia protegida verificada, sin alterar el marcador ni los datos vivos.

Revisa al menos una vez por semana que aparezcan archivos recientes
`FitStore_*.dump`, `.sha256` y `.json` en `%ProgramData%\FitStore POS\Backups`. Un respaldo dentro
de la misma laptop no protege frente a daño, robo o pérdida de esa laptop.

Los archivos y la carpeta tienen una ACL privada: SYSTEM y los administradores
pueden escribir. La cuenta de Windows que ejecutó el instalador tiene solamente
lectura (y acceso a la carpeta) cuando existe un SID real válido registrado en
`state.json` como `backupReaderSid`. No se concede acceso a Users ni Everyone.
Quien pueda usar esa cuenta de Windows también puede leer los datos de los
respaldos. Ejecutar como otra cuenta administrativa registra esa otra cuenta.
En instalaciones históricas sin `backupReaderSid` válido no se inventa un lector:
las copias quedan para SYSTEM/Administradores. Las cuentas Azure AD
(`S-1-12-1-…`) todavía no reciben lectura automática y generan un aviso;
requieren configuración asistida sin dar acceso a Users ni Everyone.

OneDrive corre como el usuario normal. Ese permiso de lectura permite copiar
los archivos desde dicha cuenta, pero **el instalador no configura ni verifica
la sincronización de OneDrive**, ni copia automáticamente a USB. Configura y
comprueba aparte la copia externa. El registro «Archivo de respaldo local
validado por PostgreSQL» confirma la validación local, no que haya una copia
fuera del equipo. Comprueba el archivo y su SHA-256 también en el destino externo.

Preflight exige que el dump coincida con el hash previo registrado en su
`.sha256` antes de copiarlo a la carpeta privada, y vuelve a comprobar la copia.
El sidecar de la copia usa el nombre de la copia privada, no el del dump original.
Esto detecta cambios del dump respecto de ese registro, pero no acredita autenticidad:
quien pueda modificar a la vez el dump y su `.sha256` puede sustituir ambos.
Una copia privada no vuelve confiable un respaldo externo ya manipulado;
conserva hashes y copias de referencia en una ubicación protegida independiente.

## Restaurar un respaldo

La restauración reemplaza la base activa; debe hacerse sin ventas en curso.

1. Cierra FitStore en todas las cajas y celulares.
2. En la laptop abre **Inicio › Nexora POS › Restaurar un respaldo**.
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
2. Comprueba espacio libre en `%ProgramData%\FitStore POS\Backups` y conserva
   aparte una copia externa de los archivos recientes antes de actualizar.
3. Ejecuta el nuevo `Nexora-POS-Setup-<versión>.exe` como administrador.
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
   iniciar los servicios y comprueba API y HTTPS. La copia temporal de la versión
   anterior se elimina automáticamente al completar `verified`, o al terminar
   correctamente el rollback; no existe una aceptación diferida que la conserve.
   El respaldo previo sigue sujeto a la retención de 30 días indicada arriba.

Sólo puede ejecutarse una instalación, actualización o desinstalación a la vez.
### Recuperar después de un corte de luz

#### Diario de permisos de PostgreSQL

Antes de conceder acceso temporal a PGDATA, la recuperación guarda las DACL
originales en `recovery-pgdata-acl.json`, dentro de la carpeta de la transacción
indicada por `actualizacion-preparada.json`. El archivo es privado y contiene
rutas y descriptores de permisos; no lo publique ni lo adjunte a un repositorio.
Se restaura al entrar en la recuperación y antes de eliminar marcador y
transacción. Los archivos volátiles ya inexistentes se omiten; eso no autoriza
a omitir errores de acceso ni entradas fuera de PGDATA.

Si aparece **«Diario de permisos corrupto o incompleto»**, no borre ni edite el
diario, el marcador, la transacción ni el cluster. La validación comprueba JSON,
campos y todos los descriptores antes de aplicar permisos, y conserva el archivo
para soporte. No siga abriendo la aplicación ni conceda permisos a Users/Everyone.

**Salida manual, solo por soporte:** identifique la transacción y PGDATA desde
el marcador, conserve copias privadas del diario y del registro, y recupere los
permisos originales desde una copia íntegra y confiable del diario o desde una
referencia de ACL comprobada de esa instalación. Compare SID, derechos, orden,
herencia y protección de cada entrada con `Get-Acl`/`icacls`; no reconstruya ACL
por adivinación ni sustituya el diario por `{}`. Si no existe referencia confiable,
requiere recuperación asistida. Restituir `LOGIN` no corrige permisos de archivos:
el comando de soporte indicado más abajo solo se usa tras verificar integridad
y resolver el acceso a PGDATA. No se ofrece un comando universal que sobrescriba
las ACL de instalaciones distintas.

No vuelva a ejecutar el instalador ni borre `actualizacion-preparada.json`.
Obtenga el paquete de scripts de **la versión nueva** entregado por soporte
(directorio `instalador/scripts` de la entrega auditada). El snapshot anterior
puede no contener `Recover-FitStoreUpdate.ps1`: no copie ese script antiguo ni
un archivo suelto. Extraiga el directorio completo, con `FitStore.Common.ps1`,
`Rollback-FitStoreUpdate.ps1` y sus demás archivos, a una carpeta externa, por
ejemplo `%TEMP%\Nexora-Recovery\scripts`. No sobrescriba la instalación.
Abra PowerShell como administrador y cambie primero a esa carpeta:

```powershell
Set-Location -LiteralPath "$env:TEMP\Nexora-Recovery\scripts"
powershell -NoProfile -ExecutionPolicy Bypass -File .\Recover-FitStoreUpdate.ps1 -InstallDir "C:\Program Files\FitStore POS"
```

La recuperación explícita verifica el SHA-256 del respaldo y exige que API y
Web sigan **deshabilitados y detenidos**, como los dejó Preflight. Consulta la
base para rechazar actividad posterior (ventas, auditoría del servidor, pagos,
devoluciones, movimientos y apertura/cierre de caja e inventario) desde el
instante anterior al respaldo, incluidas ventas offline capturadas antes. Si la ruta
instalada fue apartada, usa PostgreSQL de la copia anterior temporalmente para
esa consulta; no crea ni restaura una base durante la comprobación. Después
restaura archivos y base mediante el rollback verificado, incluidas sus fases
`rollback-files-moving` y `rollback-files-restored` interrumpidas.

Si hay ventas posteriores, servicios habilitados, respaldo alterado, consulta
fallida o marcador antiguo sin estos controles, **no restaura datos**: conserve
el respaldo, marcador y carpetas y solicite recuperación asistida. Una fase
`verified` nunca restaura la base anterior; requiere limpieza manual del
marcador preservando la versión activa. No cambie servicios para forzar este
procedimiento. La prueba Windows-Smoke en una máquina limpia sigue pendiente.

La consulta también comprueba `Sale.updatedAt`, cotizaciones (`Quote`), compras,
clientes, productos, configuración e incentivos. Obtiene de `information_schema`
las tablas y columnas de fecha de la base real, no exige el catálogo completo
de la versión nueva. Comprueba `createdAt`, `updatedAt`, `openedAt`, `closedAt`,
`lastActivityAt`, `approvedAt`, `revokedAt` y `sentAt` cuando existan.
El núcleo obligatorio es Sale, AuditLog, Payment, SaleReturn, CashMovement,
CashSession e InventoryMovement con sus columnas esenciales: si falta alguna,
rechaza la recuperación, no cuenta como cero. También exige que cada tabla
enumerada por `pg_restore --list` del respaldo siga existiendo en la base real.
Una tabla nueva ausente antes de migrar solo es aceptable si no pertenece al
núcleo ni aparece en ese respaldo. Una migración
que inserte en `AuditLog` después del corte también hace que la recuperación se
rechace: es un cierre seguro deliberado y requiere revisión asistida. Cambios de
configuración o cotizaciones sin auditoría pero con fecha posterior igualmente
bloquean. No es un historial genérico de commits de PostgreSQL: eliminaciones
manuales sin auditoría o escrituras que no actualicen ninguna marca no quedan
demostradas por esta consulta; si hubo intervención directa, no use recuperación
automática y solicite revisión de soporte.

La cobertura no demuestra todos los UPDATE o DELETE: `Brand`, `KitComponent`,
`SaleItem`, `PurchaseItem`, `ExpenseCategory`, `Counter`, `AuthAttempt`,
`AuthSession`, `SupplierImportProfile` y `SupplierCode` carecen de marcas
genéricas `createdAt`/`updatedAt` en el esquema. Las marcas específicas de
actividad de algunos modelos no equivalen a un historial completo de cambios;
sin auditoría ni una marca comprobada, una escritura puede pasar inadvertida.
En particular, `AuthSession.lastActivityAt` sí se consulta: AuthSession no está
totalmente excluida. También se comprueban las fechas de actividad, aprobación y
revocación de Terminal y `NotificationOutbox.sentAt` si existen en la base real.
Un UPDATE de migración sobre `Variant` que dispare el trigger de
`RealtimeEvent` después del corte también bloquea la recuperación: falla
cerrada y requiere soporte, no significa que deba ignorarse ese evento.

### Limpieza asistida del marcador en services/verifying

Las fases `services` y `verifying` no acreditan una actualización terminada:
la primera precede al registro de servicios; en la segunda estos pueden haber
arrancado, aunque aún no consten las dos comprobaciones HTTP. Por tanto, un
marcador en esas fases **no autoriza un rollback ni una limpieza automática**.
Preflight bloquea otra actualización mientras exista el marcador.

1. Soporte debe conservar una copia protegida del marcador, los logs, el
   respaldo previo y sus hashes, y las carpetas de la transacción. Registrar
   fase, versión y rutas reales, sin publicar secretos. No borrar la copia
   anterior ni ejecutar `Complete-FitStoreUpdate` para saltarse el bloqueo.
2. Consultar el estado y la cuenta real de los servicios en Windows, y las
   respuestas de `http://127.0.0.1:3001/api/health` y
   `https://localhost:4173/__fitstore/health`. Contrastar versión instalada,
   configuración y logs. Una respuesta HTTP por sí sola no demuestra que la
   actualización y sus migraciones hayan concluido correctamente.
3. Revisar si hubo actividad posterior al respaldo, incluidas ventas offline,
   pagos, inventario y caja. Si los servicios están habilitados o la revisión
   es incompleta, **no restaurar la base anterior**. No detener o deshabilitar
   servicios para simular que nunca hubo actividad. Preservar los datos vivos
   y obtener un respaldo actual verificado antes de cualquier intervención.
4. Si soporte confirma que la versión activa es correcta y debe conservarse,
   documentar la evidencia y retirar **solo el marcador exacto** mediante
   intervención asistida. No ejecutar rollback, no reemplazar la base, no
   sobrescribir archivos activos y no borrar automáticamente la transacción
   ni los respaldos. Comprobar después que servicios y datos siguen intactos.
5. Si no puede confirmarse la versión activa, mantener el bloqueo y escalar
   a recuperación asistida. `Recover-FitStoreUpdate.ps1` solo procede cuando
   satisface todos sus controles originales; no cambiar la fase del JSON ni
   la sesión del instalador para forzarlo. `verified` tampoco admite restaurar
   la base anterior: su limpieza asistida debe preservar la versión activa.

Este procedimiento requiere revisión de soporte; no es una reparación
automática ni una certificación de la prueba Windows-Smoke pendiente.

Si el directorio actual está dentro de la instalación, el script **rechaza antes
de restaurar**: salga de esa carpeta y repita desde el paquete externo. Así se
evita bloquear el reemplazo de la carpeta instalada con `Move-Item`.
También rechaza el directorio actual o el del script dentro de la transacción
de actualización, incluida la copia anterior, resolviendo rutas reales (enlaces
y nombres cortos). El paquete externo no debe extraerse en esos directorios.

La recuperación guarda la lista de roles con LOGIN tanto en el marcador como en
`recovery-login-state.json` antes de bloquear conexiones. En una recuperación
correcta restituye `fitstore` y los roles registrados antes de habilitar API/Web.
Si falla sin haber intentado modificar la base, intenta arrancar PostgreSQL y
restituir LOGIN en el camino de error. Si ya se entró en la fase de restauración
y todavía no se liberó el aislamiento, conserva NOLOGIN como política
conservadora de revisión: esto no demuestra que la base esté parcial.
`pg_restore --single-transaction --exit-on-error` revierte su propia transacción
si falla; el procedimiento completo incluye también archivos, configuración y
servicios, que no comparten esa transacción. Si hubo LOGIN ya restituido y falla
la comprobación HTTP o la limpieza posterior, registra ese estado y detiene
la aplicación; no afirma que las cuentas sigan en NOLOGIN.
La comprobación previa de actividad, si rechaza antes de restaurar, intenta
restituir LOGIN; no es el mismo camino que un fallo durante el rollback.
Soporte debe revisar qué fase falló antes de permitir clientes. Si el arranque o la
restitución también fallan, conserva el plan y registra ese bloqueo sin ocultar
el error original. Si otra interrupción deja el acceso
bloqueado, soporte debe conectarse como `postgres` y ejecutar
`ALTER ROLE fitstore LOGIN;` **solo después de revisar la integridad de la base**.
Esta salida también se indica en el log; conserve
ambos archivos y no restaure ni elimine el marcador sin revisión asistida.

**@dueña: probar en Windows limpio** PostgreSQL temporal con un cluster creado
por otra cuenta: la recuperación concede una ACL temporal a la cuenta actual
en PGDATA para el token reducido de `pg_ctl`, y restaura las ACL originales en
`finally`. Falta verificar ese diseño con un cluster creado por otra cuenta;
las pruebas aisladas actuales no acreditan ese caso de Windows limpio.
No se declara el instalador certificado ni se entrega a la tienda sin esta prueba.

Las regresiones deben respetar la firma real de `Wait-FitStorePostgres`
(`Paths`, `TimeoutSeconds`): no acepta `Secrets`; un stub con parámetros extra
puede ocultar un fallo de recuperación.

**CI histórico de 3j:** Claude confirmó `75b091d` con CI completo en verde
en `docs/coordinacion/INSTRUCCIONES_ACTUALES.md`, sección 3l. Ese resultado
corresponde a ese commit, no acredita los cambios posteriores A1/A2/M1/M2/M3
ni el HEAD de esta documentación. Antes de entregar otro lote se debe consultar
el run de su SHA exacto y comprobar todos los jobs, incluido `windows-installer`.
Windows-Smoke en Windows limpio sigue pendiente; una prueba focal local o ese
CI histórico no certifican el instalador ni sustituyen la aceptación de la tienda.

**Versión PostgreSQL comprobada el 10 de octubre de 2026:** en esta PC,
`C:\Program Files\PostgreSQL\18\bin\postgres.exe --version` devuelve
`postgres (PostgreSQL) 18.6`; `pg_ctl.exe --version` y `pg_restore.exe --version`
también devuelven 18.6. Las regresiones aisladas de recuperación A1, M1 y M2 se
ejecutaron con las funciones reales; A1 usa ese PostgreSQL 18.6 y taskkill real,
mientras M1/M2 comprueban DACL de archivos NTFS reales sin arrancar una base.
El comando reproducible de A1, desde la raíz del repositorio, es:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalador/tests/Recovery-Acl-MissingEntry.ps1 -PgBin "C:\Program Files\PostgreSQL\18\bin"
```

El instalador fija **18.6-5** y el SHA-256 de su archivo oficial en
`instalador/dependencias.lock.json` (`postgresql.version`, `postgresql.sha256`).
Se encontró la copia ya descargada en
`%LOCALAPPDATA%\FitStore POS\InstallerCache\postgresql-windows-x64.zip`.
Su SHA-256 es `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`,
igual al lock. Se comparó, sin extraer ni ejecutar código del ZIP, el SHA-256
de cada uno de sus nueve ejecutables requeridos con los instalados en la PC:
`postgres`, `pg_ctl`, `initdb`, `pg_isready`, `psql`, `pg_dump`, `pg_restore`,
`createdb` y `dropdb`; los nueve coinciden. Así se acredita que las herramientas
usadas por estas regresiones corresponden al ZIP 18.6-5, no solo que comparten
versión mayor. No se descargó ni instaló otro motor.

La comparación no acredita todas las DLL, configuración ni el payload completo
que se distribuirá. **Pendiente:** construir el payload con el lock y ejecutar
`instalador:validar` con `PGBIN` apuntando a su `postgres\bin`, además de
Windows-Smoke en la máquina limpia. El CI puede elegir otra versión instalada
en el runner: registre su `postgres.exe --version`; no deduzca 18.6 solo porque
el job esté verde.

Un segundo asistente se detiene antes de tocar archivos o activar un rollback.

Una actualización mayor de PostgreSQL se detiene expresamente: requiere una
migración asistida. Nunca copies una carpeta de datos de una versión mayor sobre
otra versión.

## Desinstalar

Usa **Configuración de Windows › Aplicaciones › Aplicaciones instaladas ›
Nexora POS › Desinstalar**.

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
`.env`, `secrets.json`, `server.json`, PFX y archivos temporales se protegen
inicialmente para `SYSTEM` y Administradores. Después LocalService recibe lectura
del `.env` de ejecución, `server.json` y `FitStore-server.pfx`, y los permisos
de carpetas necesarios para API/Web; no recibe lectura de `secrets.json`,
la clave de la CA ni los respaldos. La separación por SID de cada servicio sigue
pendiente (B8); LocalService es una identidad compartida.
`create-admin.ts` recibe las credenciales por
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
   instalador\dist\Nexora-POS-Setup-<versión>.exe
   instalador\dist\Nexora-POS-Setup-<versión>.exe.sha256
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
