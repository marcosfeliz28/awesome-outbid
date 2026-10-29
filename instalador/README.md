# Instalador de Norexos para Windows

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

Para una instalación nueva del **producto local** separada de la tienda, ejecuta
`pnpm instalador:producto-local`. Produce
`instalador/dist/Norexos-Local-Setup-<versión>.exe`. Usa carpeta,
ProgramData, claves de registro, servicios, tarea de respaldo, base y rol
`nexoralocal`, y puertos propios (PostgreSQL 5544, API 4301, web 4473).
El perfil se aplica al contenido preparado antes de crear su manifiesto y no
modifica los archivos fuente del instalador heredado. La ruta de la tienda
permanece intacta. Si el perfil falla, la compilación se detiene.
Para construirlo debes proporcionar `NEXORA_LICENSE_PUBLIC_KEY` (clave pública
Ed25519 PEM, con saltos `\n` literales si se pasa en una sola línea). El
constructor la valida y activa la política de licencia en la API y la PWA.
Sin una licencia firmada, la instalación inicia en solo lectura.

**Estado:** este perfil está comprobado por prueba de aislamiento de rutas y
configuración. Falta ejecutar el instalador y su actualización sobre Windows
10 y 11 limpios con PostgreSQL real, además del rollback de la variante local.
No distribuir este EXE antes del emisor de licencias, PC-20 a PC-22 y esas pruebas.

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
`instalador/dist/Norexos-Setup-<versión>.exe`. El nombre y la identidad
visibles son Norexos / Grupo Macgen. La ruta interna heredada `FitStore POS`
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
