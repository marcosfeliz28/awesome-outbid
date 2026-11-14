# Instalación limpia · informe de Claude PC · 14-nov-2026 (orden 126)

**Estado: INSTALACIÓN FALLIDA con cuenta estándar (14-nov, 11:47 UTC−04).** Windows 10 Pro 22H2 (build 19045.3803) limpio con cuenta local `NexoraPrueba`. El instalador copió los archivos a `C:Program FilesFitStore POS` (`VERSION` 13), pero terminó con «La instalación no se completó correctamente» al no poder escribir en `C:ProgramDataFitStore POS` (log `instalador.log`). No se abrió Nexora ni se probó caja, venta, cierre ni respaldo.

Rama: `claude-pc/instalacion-limpia-14nov`, desde `origin/nexora-cloud` (ae3c750b). Solo documentos, sin código, sin Render, sin producción, sin datos reales.

## Comprobaciones hechas en el host (sin ejecutar nada)

| Dato | Valor observado |
| --- | --- |
| VM | `FitStore-INST1-Win10`, Hyper-V generación 2, 4 procesadores, 8 GiB de inicio |
| Estado de la VM | **Saved** (no se inició ni se abrió la consola en esta sesión) |
| EXE preparado | `Nexora-POS-Setup-0.1.1-prueba.exe`, 141,778,408 bytes |
| SHA-256 del EXE | `42F50D6F44481258BD3C3E02F543B24972815052B290F35CB96C87BE1A2C548F`, **coincide** con el informe de ChatGPT PC (orden 126) |
| Copia a la VM | No hecha (depende de llegar al escritorio) |

## Paso a paso (orden 126)

| Paso | Resultado | Motivo |
| --- | --- | --- |
| 1 · Cuenta de Windows (cuenta local de prueba) | **Hecho** | Cuenta `NexoraPrueba` (offline) creada con permiso de la dueña. Privacidad de OOBE: se aceptaron los valores por defecto en la VM de prueba; Cortana: «Not now»; Edge: «Next now». |
| 2 · `winver` y captura | Pendiente | Esperando el escritorio. |
| 3 · Copia del EXE, SHA-256, instalación, tamaño, tiempo, avisos de Windows | No probado | Solo se comprobó el hash en el host. |
| 4 · Abrir caja, venta, cierre, respaldo y restauración | No probado | Depende de 1 a 3. |
| 5 · Guardar la VM en Saved y cerrar conexiones | Pendiente | La VM está Running; se guardará al terminar. |
| 6 · Informe | Este documento | Estado parcial. |
| 7 · Un solo push y 3 CI | Ver commit en la respuesta | |

## Qué hace falta para continuar

1. Que confirmes que puedo crear la cuenta local de prueba en la VM. La clave la escribirías tú o la pondrías en tu gestor de contraseñas; yo no la anoto en ningún archivo.
2. O bien, que tú completes el paso 1 y me dejes la VM en el escritorio. Entonces sigo con los pasos 2 a 6.
3. Para ver las pantallas necesito acceso de control de pantalla al host (ventana de Hyper-V). No lo he pedido en esta sesión.

## Nota

Este informe no declara la instalación «certificada». Su único resultado verificado es la coincidencia del SHA-256 del EXE.

## Resultado de la instalación (14-nov, 11:44–11:47 UTC−04)

- **Windows:** Windows 10 Pro, versión 22H2, compilación **19045.3803** (`winver`, captura pendiente de guardar).
- **Cuenta:** `NexoraPrueba`, local, **usuario estándar** (el grupo Administradores aparece como «deny only»).
- **Instalador:** `Nexora-POS-Setup-0.1.1-prueba.exe`, 141,778,408 bytes, SHA-256 `42F50D6F…C548F`, **igual** en el host y en la VM. Inicio: 11:44:14.
- **Pantallas del instalador:** usuario dueño (nombre, correo, clave, PIN de 6 dígitos), aviso de respaldos en `C:ProgramDataFitStore POSBackups`, y «Instalar».
- **Advertencias de Windows:** no apareció SmartScreen ni aviso de editor desconocido durante la ejecución (el EXE se lanzó desde el DVD de datos; no se revisó si Windows lo bloqueó antes).
- **Fallo:** tras copiar los archivos, el instalador mostró «La configuración de Nexora POS no terminó» y luego «Instalación anulada». Indicó revisar `C:ProgramDataFitStore POSlogsinstalador.log`, que **no existe**.
- **Causa observada:** la cuenta estándar no puede escribir en `C:ProgramDataFitStore POS` (acceso denegado al crear un archivo de prueba). El instalador no pide elevación ni gestiona cuentas sin permisos de administrador.
- **Hallazgo de texto:** en las pantallas del instalador aparecen caracteres dañados («dueÃ±o», «contraseÃ±a», «configuraciÃ³n»): codificación UTF-8 leída como ANSI.
- **Hallazgo de pantalla:** en el paso del correo, el campo recibió texto de más al escribir (portapapeles). Se corrigió; no afecta al instalador.

## Paso a paso (orden 126), estado final

| Paso | Resultado |
| --- | --- |
| 1 · Cuenta local | **Hecho** (`NexoraPrueba`, estándar) |
| 2 · `winver` | **Hecho** (22H2, 19045.3803). Captura no guardada |
| 3 · Copia, SHA-256, instalación | Copia y SHA **Hecho**; instalación **Falla** |
| 4 · Caja, venta, cierre, respaldo y restauración | **No probado** (la app no quedó configurada) |
| 5 · Guardar la VM | **Hecho**: VM en estado Saved, con el instalador fallido y el DVD de datos montado |
| 6 · Informe | Este documento |
| 7 · Un solo push y 3 CI | Pendiente de este commit |

## Qué falta para cerrar la prueba

1. Decidir si la cuenta de prueba debe ser **administradora** (cambio de privilegio en la VM) o si se aprueba la elevación (UAC) con una clave de administrador local. Hasta entonces, no se puede declarar la instalación ni la prueba funcional.
2. Corregir la codificación de los textos del instalador y el comportamiento sin permisos de administrador, en el repositorio de instalador (no se ha tocado aquí).
3. Repetir la instalación y los pasos 4 y 5.

No se declara la instalación «certificada».

## Segundo intento (14-nov, 11:49 UTC−04)

- **Verificado:** `NexoraPrueba` **sí es miembro de Administradores** (`net localgroup`), pero corría sin elevación (`IsInRole(Administrator)` = False). El primer fallo era por falta de elevación; no hizo falta cambiar privilegios.
- **Advertencia de Windows (UAC):** «Do you want to allow this app from an unknown publisher to make changes to your device?» — `Nexora-POS-Setup-0.1.1-prueba.exe`, **Publisher: Unknown**, origen «Hard drive on this computer». Coincide con el hallazgo de que el EXE no está firmado (NotSigned).
- **Decisión:** no se aprueba el UAC desde esta sesión. Es una advertencia que exige intervención de la persona; no se eluden ni se desactivan protecciones. El aviso queda abierto en la VM para que la dueña decida.
- **Pendiente para completar:** (1) aprobar o rechazar el UAC; (2) si se aprueba, repetir las pantallas del instalador; (3) probar caja, venta, cierre y respaldo; (4) verificar la firma del EXE antes de distribuirlo.

## Tercer intento, con la decisión de la dueña (14-nov, 12:05–12:08 UTC−04)

Autorización de la dueña (`16fb9887`): aprobar el aviso UAC **solo** en la VM desechable, sin firmar ni tocar protecciones.

- **Lo que pasó con el UAC:** no lo aprobé yo. En el segundo intento apareció el aviso «unknown publisher» (`Publisher: Unknown`). Al relanzar a las 12:05 el instalador apareció directamente en el asistente, sin aviso UAC visible en mis capturas. **No puedo confirmar quién aprobó la elevación** ni si se mostró un aviso que no vi; queda registrado así.
- **Proceso residual:** el primer intento (sin elevar, PID 1808, 11:44:18) seguía vivo tras cerrar su ventana y mantenía el bloqueo. Mensaje al relanzar: «Ya hay otra instalación, actualización o desinstalación de Nexora POS en curso. Espera a que termine antes de volver a intentarlo.» Lo detuve (PID 1808) dentro de la VM.
- **Contraseñas:** «Las contraseñas no coinciden» por texto residual del portapapeles; corregido.
- **Fallo nuevo (exacto):** «Error abriendo archivo para escritura: C:\Program Files\FitStore POS\runtime\postgresql\bin\icudt77.dll. Presione abortar para anular la instalación, reintentar para volver a intentar escribir el archivo, u omitir para ignorar este archivo.» Reintentar falló igual. Al abortar: «Instalación Anulada — No pudo escribirse: …icudt77.dll».
- **Causa probable (no confirmada del todo):** hay procesos `postgres` y `pg_ctl` (PID 7716, padre `services.exe`) ejecutándose desde la carpeta de instalación, que bloquean los DLL. Sin elevación no pude leer la ruta del ejecutable ni el nombre del servicio. Hace falta una sesión elevada para confirmarlo y limpiarlo; no lo hice, porque es una acción distinta de la autorizada.

## Fallos y textos (acumulado)

| # | Dónde | Texto exacto / síntoma | Causa observada |
| --- | --- | --- | --- |
| 1 | Primer intento, sin elevar | «La configuración de Nexora POS no terminó. Los datos existentes no se borraron. Revisa: C:\ProgramData\FitStore POS\logs\instalador.log» | Acceso denegado a `ProgramData\FitStore POS` (confirmado con escritura de prueba). **Sin log**: la carpeta no se podía escribir, así que el propio registro de error no se creó. Falla a medias: archivos copiados a `Program Files`. |
| 2 | Segundo intento | «Ya hay otra instalación… en curso» | Proceso residual del intento 1 (PID 1808). |
| 3 | Tercer intento | «Error abriendo archivo para escritura … icudt77.dll» → «Instalación Anulada» | Probablemente PostgreSQL del instalador en ejecución (ver arriba). |

## Textos con caracteres rotos (codificación UTF-8 leída como ANSI)

Observados en pantallas del instalador: «dueÃ±o», «contraseÃ±a», «Repetir contraseÃ±a», «guÃ¡rdalas», «dÃ­gitos», «conservarÃ¡n 30 dÃ­as», «Respaldos automÃ¡ticos», «configuraciÃ³n», «instalaciÃ³n», «Ya hay otra instalaciÃ³n, actualizaciÃ³n o desinstalaciÃ³n», «Ã³». La dueña indicó que la corrección (marca BOM) está en `mejora/instalador-bom-14nov`, pendiente de su CI; esta prueba **no valida el EXE definitivo**.

## Lo que no se probó

Caja, venta de prueba, cierre de caja, respaldo y restauración: **no probados**, porque la app no llegó a instalarse.

## Estado

- VM `FitStore-INST1-Win10`: detenida tras el aborto y guardada en Saved (con los archivos parciales de `Program Files`).
- Para completar: sesión elevada para confirmar y detener los procesos `postgres`/`pg_ctl`, y después repetir la instalación. Cualquier paso de elevación debe aprobarlo la dueña.
