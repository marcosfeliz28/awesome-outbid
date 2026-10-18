# Área 8 — Instalador de Windows y escritorio

**Alcance:** auditoría estática del instalador, servicios locales, respaldos, restauración, actualización/rollback y desinstalación en `origin/nexora-cloud` (`cf6f7022ab9682db45327558e5dd18946a7b1473`). Sin modificar aplicación, instalador ni pruebas. No se usaron secretos, Render, producción ni datos de negocio.

**Entorno y comandos:** Windows reporta versión de sistema `10.0.26300`; `pnpm install --frozen-lockfile` terminó correctamente (pnpm 11.19.0). Las pruebas PowerShell se invocaron con Windows PowerShell 5.1 (`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`), no con el host PowerShell 7.6.5.

## Hallazgos

| ID | Severidad | Archivo:línea | Qué pasa | Reproducción mínima / resultado | Parche propuesto | Prueba que debería fallar hoy |
|---|---|---|---|---|---|---|
| W-01 | MEDIO | `instalador/installer/FitStore.nsi:256-270,339`; `instalador/scripts/Install-FitStore.ps1:362-387`; `instalador/scripts/Backup-FitStore.ps1:12-17`; `instalador/scripts/FitStore.Common.ps1:276-292` | El diálogo de instalación promete que se elija una carpeta OneDrive/USB para el respaldo diario y dice que habrá copia local temporal si falla ese destino. La ruta elegida sí se escribe al INI y al estado, pero `Initialize-FitStoreBackupStorage` cambia siempre `backupPath` a `Paths.LocalBackups`; tanto instalación como cada llamada de backup terminan escribiendo en `%ProgramData%\FitStore POS\Backups`. La copia fuera de la laptop nunca se realiza automáticamente y la selección visible no tiene efecto. La guía posterior describe correctamente que la copia externa se configura aparte, pero no resuelve la contradicción del instalador. | Prueba de contrato existente: `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File instalador/tests/Backup-Privacy.ps1` → `PASS A4: destino privado migrado, copia antigua intacta y reprotegida.` La prueba ejercita la función real que sustituye la ruta anterior por `Paths.LocalBackups`; el flujo completo de instalación no se ejecutó en una máquina limpia. El efecto se obtiene también siguiendo el valor `BackupPath` guardado por NSIS hasta la llamada al inicializador descrita en las líneas citadas. | O bien eliminar/deshabilitar el selector y explicar que el destino es siempre local, o implementar de verdad el destino externo con ACL y manejo de desconexión; en cualquiera de las opciones, distinguir explícitamente el respaldo local del off-site y comprobar la ruta efectiva en la pantalla/registro. | Añadir una regresión de integración del flujo de configuración: elegir una carpeta externa y verificar que el trabajo diario la use; si el producto solo admite ruta local, verificar que el UI no anuncie ni acepte una ruta distinta. |

No se hallaron otros defectos confirmados dentro de esta revisión estática acotada. W-01 es el único hallazgo del área; no se ejecutó una instalación completa para demostrar el flujo de punta a punta.

## Controles comprobados como presentes

- El archivo de respaldo se crea con DACL restringida desde el primer byte; incluye SYSTEM/Administradores y, si hay SID de cuenta compatible, lectura sin escritura al usuario (`FitStore.Common.ps1:233-258`). Los tests de privacidad verifican ACL protegida y rechazo de Users/Everyone.
- El `pg_dump` usa formato custom, se valida con `pg_restore --list`, se genera SHA-256 y el log aclara que validación local no significa copia externa (`Backup-FitStore.ps1:47-95`).
- La tarea diaria está programada a las 2 a. m. bajo SYSTEM, `StartWhenAvailable` y `MultipleInstances IgnoreNew` (`Install-FitStore.ps1:243-250`).
- Restauración: se detienen web/API, se crea una copia de seguridad, el dump se prueba en una base temporal con migraciones y chequeo de tablas esenciales, y el reemplazo activo usa `--single-transaction --exit-on-error`; hay recuperación automática con el respaldo previo (`Restore-FitStore.ps1:118-225`).
- Actualización/rollback: Preflight cierra la aplicación, verifica y protege el respaldo antes de mover el snapshot; el rollback valida el manifiesto y conserva el estado ante fallo. La recuperación explícita comprueba servicios detenidos/deshabilitados, SHA del dump y actividad posterior antes de restaurar (`Preflight-FitStore.ps1:47-210`; `Rollback-FitStoreUpdate.ps1`; `Recover-FitStoreUpdate.ps1:299-355`).
- Con borrado de datos en desinstalación, se copia fuera del árbol, se vuelve a verificar SHA/manifiesto y se aborta antes de retirar servicios/borrar datos ante error (`Uninstall-FitStore.ps1:45-127,163-170`).

## Pruebas ejecutadas

Todos los comandos siguientes usaron Windows PowerShell 5.1 y terminaron con código 0:

```text
Backup-Privacy.ps1                 PASS W2 ACL; A5 sin elevación; archivo privado; A4 destino local
Backup-Reader-Privacy.ps1          PASS A5 SID lector solo lectura
Preflight-Backup-Privacy.ps1       PASS 3h6 dump, SHA y JSON privados e intactos
Restore-FaultInjection.ps1         Fault injection correcta: base activa fixture intacta y temporales eliminados
Recovery-WorkingDirectory.ps1      PASS 3h4 directorios instalados rechazados; externo permitido
Backup-AzureAD-Warning.ps1         PASS aviso y sin Users/Everyone
Recovery-Acl-Interruption.ps1      PASS diario/ACL de recuperación tras interrupción
Recovery-Activity-Guard.ps1        PASS comprobaciones de actividad, historial y tablas
Recovery-Schema-Contract.ps1       PASS núcleo de esquema y cotejo dinámico
Preflight-Rollback-Contract.ps1    PASS A6 rollback habilitado antes de Preflight
Uninstall-Backup-Preservation.ps1  PASS B10 copia privada y verificada; fallo de copia aborta
```

`pnpm check`, `pnpm instalador:validar`, build del EXE, `Windows-Smoke.ps1` y actualización/restauración de extremo a extremo no se corrieron en esta área.

## No verificado

- Instalación limpia y actualización real en Windows 11 VM/disco dedicado, servicio PostgreSQL, apagón real durante cada fase, restauración de dump íntegro y corrupto, ni comportamiento de OneDrive/USB.
- La revisión no demuestra que el dump/restauración funcione en la máquina de la dueña ni verifica respaldos existentes. Los tests de contrato/fault-injection usan fixtures aislados; algunos casos de recuperación usan lógica SQL/ACL local, no datos de tienda.
- Las cuentas Azure AD reciben un aviso y no obtienen permiso automático de lectura al backup según el código y el test `Backup-AzureAD-Warning.ps1`; la sincronización externa para ese tipo de identidad requiere configuración asistida (limitación documentada, no hallazgo independiente).
