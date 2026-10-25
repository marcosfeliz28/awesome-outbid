# PC-19 · Lo que solo se puede verificar en Windows

Estado de la licencia local de Nexora POS Local: qué cubre el CI, qué exige una VM Windows y qué queda abierto.

## Verificado por CI / Node (sin Windows)

- Firma Ed25519, vinculación con `installationId`, vencimiento, impago, reloj atrasado y rutas HTTP: `tests/product-local-license.test.ts`.
- Cola del navegador y 423: `tests/product-local-license-web.test.ts`.
- El perfil local renombra servicio, puerto (4301) y ACL de la carpeta de licencia: `instalador/tests/product-local-profile.test.mjs`.
- Contrato estático `tests/windows-license-acl-contract.test.mjs` (en `instalador/tests/run-validation.mjs`): el script de VM conserva sus guardas y revisa los mismos archivos que el instalador protege (`license.json`, `clock.json`, `state.json`, `.env`, `work\.env`). Si alguien quita una guarda o cambia un archivo en un lado, falla. **No prueba ACL reales**, solo que ambos lados hablan de lo mismo.

## Solo verificable en una VM Windows desechable

Ejecutar `instalador/tests/Windows-License-Acl.ps1 -ConfirmDisposableVm -TestPrivateKeyPath <clave privada de PRUEBA>` en una VM limpia con **solo** Nexora POS Local, compilado con la clave pública de pruebas correspondiente (nunca claves reales). Deja `resultado.json` como evidencia. Comprueba:

1. ACL (`icacls` + `Get-Acl`) de la carpeta `license` y de `license.json`, `clock.json`, `state.json`, `.env`, `work\.env`: solo SYSTEM, Administradores y la cuenta de la API escriben donde corresponde; ni Users, Everyone ni Authenticated Users aparecen.
2. El servicio `NexoraLocalAPI` corre como cuenta virtual propia (`NT SERVICE\NexoraLocalAPI`), sus procesos tienen ese propietario, escribe en `license` y no en `Data` ni en la instalación.
3. Un usuario local estándar no puede crear, sobrescribir, renombrar, borrar ni reemplazar `license.json`, ni editar `clock.json`, `state.json` ni `.env`; los hashes no cambian.
4. Sin licencia: `GET /api/local-license/status` responde 200 en solo lectura y un `POST` responde 423. Con token firmado de prueba: modo escritura. Con `license.json` corrupto o `clock.json` adelantado, falla cerrado; con token `unpaid`, 423.

## No pude verificar (esta rama)

- Nada de lo anterior se ejecutó: esta PC aloja la tienda real y no se corrieron instaladores, servicios ni puertos. El script solo se analizó con el parser de PowerShell.
- Supuestos del script a confirmar en la VM: que `Start-Process -Credential` funcione desde la consola de la VM, que la API sirva HTTP en `127.0.0.1:4301` y que `POST /api/products` sea una ruta de escritura (el guardia de licencia actúa antes que la autenticación).
- Cómo queda la ACL real tras una actualización (el instalador reaplica `Grant-FitStoreApplicationAccess`).
- Renovación real contra la nube, impago real y reloj atrasado de punta a punta (como pide `LICENCIA_LOCAL.md`).

## Hallazgos de la auditoría CPC-9 que NO se corrigen aquí (ChatGPT PC)

- **Reloj** (puntos 3 y 7): un reloj muy adelantado deja sin renovar la licencia; el desfase de 5 minutos bloquea.
- **Cola sin conexión** (punto 4): solo se guardan 60 licencias y un lote con una venta fuera de vigencia da 423 para todo el lote.
- **Clave de CI en release** (punto 9): `build.ps1` no rechaza la clave pública de pruebas en un build final.
- Tampoco: emisor/activación en la nube, `tenantId`/máquina en lo firmado, mayúsculas en rutas, procesos de fondo y retención en solo lectura.
