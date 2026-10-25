# INST-1 / PC-19: guiones preparados para la VM limpia

Fecha: 2026-10-25 (America/La_Paz).

Estado: **preparado, todavía no ejecutado dentro de la VM**. Este documento no
certifica ACL ni licencia en Windows limpio; esa evidencia se añadirá al mismo
commit PC-19 después de la ejecución autorizada en la VM.

## Procedencia controlada

Se importaron de `origin/claude-pc/windows-escritorio` únicamente estos cambios,
sin mezclar esa rama:

- `docs/producto/PRUEBA_WINDOWS_LIMPIO.md`: commit `8182f2d`, blob
  `89e076fdac60ad9f856997ef23419201541b118f`;
- `instalador/tests/Windows-License-Acl.ps1`: commit `b6a9ffa`, blob de origen
  `f4576144711311767cd67342002fceee94f5f639`;
- contrato estático y conexión a `instalador:validar`: commit `458fbfa`, blob
  de la prueba `6e51308a80bf4433bc03f37954ec610cc8dff4d9`.

No se importaron cambios de Render, workflows, API, base de datos ni
credenciales de la rama de Claude PC.

## Adaptación necesaria para la base INST-1

El script de origen generaba licencias v1. La base obligatoria `c6bb896d` usa la
licencia v2: empresa, equipo, instalación, vigencia y estado forman parte del
payload firmado. El guion ahora:

1. toma `PRODUCT_LOCAL_TENANT_ID` del entorno instalado o usa el UUID local por
   defecto;
2. calcula `deviceHash` exactamente como la API, a partir de `MachineGuid` y
   SHA-256;
3. firma `['nexora-local-license', 2, tenantId, deviceHash, installationId,
   issuedAt, expiresAt, status]` con una clave Ed25519 exclusivamente de prueba;
4. conserva las guardas que exigen elevación, VM reconocida y ausencia de los
   servicios y puertos de la tienda.

El contrato estático comprueba tanto las guardas/ACL como los campos y la
serialización de licencia v2 para que el script no vuelva a derivar del código.

## Verificación local previa

```text
node --test tests/windows-license-acl-contract.test.mjs
2 pruebas pasadas; 0 fallidas.
```

La primera invocación completa falló cerrado al llegar a las pruebas PostgreSQL
porque la consola no tenía `PGBIN`. Se repitió indicando explícitamente la
instalación local de PostgreSQL 18, siempre sobre fixtures temporales:

```powershell
$env:PGBIN='C:\Program Files\PostgreSQL\18\bin'
pnpm instalador:validar
```

Resultado final: código 0; `Validación del instalador correcta: 27 archivos
requeridos y controles de seguridad.` El bloque nuevo reportó 2/2 pruebas
pasadas. No se ejecutó `Windows-License-Acl.ps1` en esta PC.

## Ejecución pendiente en la VM

El paso siguiente debe crear un instalador local con una clave pública efímera
y ejecutar como administrador, solo dentro de la VM desechable:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\instalador\tests\Windows-License-Acl.ps1 `
  -TestPrivateKeyPath <clave-privada-ed25519-de-prueba> `
  -EvidenceDir <carpeta-de-evidencia> `
  -ConfirmDisposableVm
```

La clave privada debe destruirse junto con la VM y nunca debe llegar al
repositorio, a GitHub ni a un instalador publicable.
