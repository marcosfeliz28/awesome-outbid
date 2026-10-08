# Instalador de FitStore POS para Windows

Esta carpeta construye un instalador clásico NSIS de 64 bits. Se eligió NSIS en
lugar de Tauri porque el producto que se instala es un servidor local completo:
PostgreSQL, API, PWA HTTPS, servicios, firewall, certificados y tareas de
respaldo. Tauri no sustituye esas tareas de aprovisionamiento.

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
`instalador/dist/FitStore-POS-Setup-<versión>.exe`.

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
