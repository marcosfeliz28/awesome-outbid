# B8: servicios independientes y claves HTTPS

API y Web declaran cuentas virtuales `NT SERVICE\FitStoreAPI` y
`NT SERVICE\FitStoreWeb`. Al registrar los servicios se habilita
`sc.exe sidtype <servicio> unrestricted`. El SID calculado antes de registrar
se compara en la regresion con el resultado real de `sc.exe showsid`.

La API recibe lectura de `work/.env`. La Web recibe lectura de `server.json`
y `pki/FitStore-server.pfx`. Ambas leen los ejecutables; cada una escribe en
su propia carpeta de registros. No reciben acceso a `secrets.json`, la clave
privada de la CA, PostgreSQL ni respaldos. Se retiran los permisos compartidos
de LocalService antes de establecer los nuevos permisos.
La lectura de ejecutables se hereda desde una sola regla de la raiz de la
instalacion. Las renovaciones conservan esa regla si coincide y no recorren
ni rehacen las ACL del arbol inmutable de `node_modules`.

`caPfxPassword` y `serverPfxPassword` son aleatorias e independientes. La
migracion conserva la clave antigua de la CA y el campo antiguo `pfxPassword`
para las herramientas restauradas por un rollback. Solo reemite el certificado
del servidor. Si hay una interrupcion tras guardar secretos, la discrepancia
con `server.json` fuerza otra emision al reanudar. No se cambia el certificado
de confianza que ya instalaron las cajas.

Rollback consulta las cuentas registradas realmente por SCM y admite SYSTEM,
LocalService y las dos cuentas virtuales. Restituye permisos segun cada cuenta
y elimina los SID nuevos al volver a una version antigua. Las versiones que
usan LocalService comparten necesariamente esa identidad: se conserva su
comportamiento antiguo, incluido el directorio de registros.

## Evidencia local

En Windows PowerShell 5.1, `Service-Isolation.ps1 -InstallerRoot <base>/instalador`
falla contra 496030f con `B8: lectores incorrectos ... work/.env` ejecutando la
funcion real `Grant-FitStoreApplicationAccess`. La misma prueba pasa con B8:
ACL NTFS reales, SID Windows, rollback mixto y SYSTEM, migracion idempotente.
`Service-Pfx-Passwords.ps1` crea certificados descartables en CurrentUser y
ejecuta la funcion real `New-FitStoreServerCertificate`: cada PFX acepta su
clave y rechaza la del otro. Retira los certificados al terminar.

Tambien pasan Application-Service-Privacy, Rollback-Service-Sid,
Rollback-ServiceAccount-FaultInjection y PowerShell-Parse. La prueba antigua
de registro de rollback sigue siendo una simulacion; la nueva regresion B8
no simula las funciones de ACL ni las de exportacion del certificado.
`pnpm check` pasa: typecheck, lint, 45 archivos de prueba aprobados, 480
pruebas aprobadas y 9 omitidas por condiciones preexistentes, compilacion web
y API. El primer intento requirio generar el cliente Prisma en el worktree.

Este host no tiene un token elevado: estas pruebas no certifican instalacion
SCM, inicio real bajo las cuentas virtuales ni certificados en LocalMachine.
Falta Windows-Smoke en un Windows limpio elevado, incluidos actualizacion y
rollback desde SYSTEM/LocalService y desde las cuentas virtuales. No se ha
desplegado ni contactado produccion.
