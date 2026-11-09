# Instalador de Nexora POS para Windows

Esta carpeta construye un instalador clásico NSIS de 64 bits. Se eligió NSIS en
lugar de Tauri porque el producto que se instala es un servidor local completo:
PostgreSQL, API, PWA HTTPS, servicios, firewall, certificados y tareas de
respaldo. Tauri no sustituye esas tareas de aprovisionamiento.

**Importante:** este instalador configura una base local para un servidor único;
no lo instales en cada laptop si todas las cajas deben compartir la base cloud de
Render. Para el uso cloud compartido, cada equipo debe abrir la PWA publicada y
añadirla como aplicación desde su navegador. La versión nativa de escritorio
conectada a la cloud no está empaquetada aquí.

## Construir en Windows 11

Abre PowerShell en la raíz del repositorio y ejecuta:

```powershell
corepack enable
pnpm instalador:compilar
```

El script verifica Node 24 y pnpm, instala las dependencias bloqueadas, compila
la API y la PWA, descarga Node, PostgreSQL, WinSW y Microsoft Visual C++ Runtime
comprobando SHA-256 y, donde corresponde, la firma Authenticode. Incluye los
binarios oficiales completos de PostgreSQL 18 para Windows e instala NSIS con
`winget` si hace falta. El resultado queda en
`instalador/dist/Nexora-POS-Setup-<versión>.exe`. El nombre y la identidad
visibles son Nexora POS / Grupo Macgen. La ruta interna heredada `FitStore POS`
se conserva para que las instalaciones existentes puedan actualizarse sin mover
ni perder datos.

Para preparar el contenido sin invocar NSIS:

```powershell
pnpm instalador:preparar
```

Para ejecutar las validaciones que no necesitan Windows:

```text
pnpm instalador:validar
```

La validación comprueba también la sintaxis de todos los scripts PowerShell y el
orden de las barreras de mantenimiento: cerrar ventas antes del respaldo,
staging con manifiesto antes de actualizar, rollback desde `.onInstFailed` y
restauración validada con transacción única. También exige exclusión de una sola
instancia y servicios sin autoarranque hasta que la versión nueva responda en
API y HTTPS.

Los artefactos de `instalador/build/` y `instalador/dist/` son generados. No
contienen datos de la tienda ni contraseñas predeterminadas.

## Compilado en CI y firma de código

El job `windows-installer` de `.github/workflows/ci.yml` compila el instalador
en el runner Windows con `instalador/build.ps1 -SinInstalarNSIS` (instala NSIS
con Chocolatey si falta) y lo sube como artefacto de GitHub Actions:
`Nexora-POS-Setup-<versión>` con el `.exe` y `<nombre>.exe.sha256.txt`.

- Solo en empujes a `nexora-cloud`, `claude-pc/*` y `chatgpt-*/*` (no en pull
  requests).
- Se conserva 7 días. Se descarga en la pestaña **Actions** › la ejecución ›
  **Artifacts**.
- No usa secretos. **El `.exe` no está firmado:** Windows SmartScreen avisará
  «editor desconocido». Antes de instalarlo, compara el SHA-256 del `.txt`
  con `Get-FileHash .\Nexora-POS-Setup-<versión>.exe`.

### Firma de código (pendiente; no se creó nada)

Cuando la dueña compre un certificado de firma de código (OV o EV) a nombre de
Grupo Macgen:

1. Exportar el certificado con su clave privada a `.pfx` con contraseña.
   Nunca subirlo al repositorio.
2. En GitHub: **Settings › Secrets and variables › Actions › New repository
   secret**. Guardar `WINDOWS_CERT_PFX_BASE64` (el `.pfx` en base64:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`) y
   `WINDOWS_CERT_PASSWORD`. Mejor como secretos de un _environment_ protegido
   (p. ej. `firma`) que solo use `nexora-cloud`.
3. Agregar, entre «Compilar el instalador» y la subida del artefacto, un paso
   que decodifique el `.pfx` en `$env:RUNNER_TEMP`, firme con
   `signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f <pfx> /p <clave>`,
   borre el `.pfx` y recalcule el SHA-256. Los certificados EV suelen exigir
   un token físico o un servicio de firma en la nube (Azure Trusted Signing,
   DigiCert KeyLocker): en ese caso el paso usa su herramienta en vez del `.pfx`.
4. La prueba `tests/cloud-deploy.test.ts` exige hoy «sin secretos ni
   signtool»: actualizarla en el mismo cambio.
