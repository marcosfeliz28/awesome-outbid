# Guía de instalación para PC (D7) — BORRADOR

> **Estado: BORRADOR. No cerrado.** Solo lo marcado como verificado viene del código (`instalador/build.ps1`, `package.json`). Lo marcado como [POR CONFIRMAR EN PC LIMPIA] no está probado y no debe darse por cierto hasta probarlo en una PC limpia.

## 1. Requisitos
- Windows con PowerShell.
- Node.js y pnpm 11 (el repo fija `pnpm@11.19.0` en `package.json`).
- Conexión a internet: el script descarga componentes (Node, PostgreSQL, WinSW) y los guarda en la caché local `%LOCALAPPDATA%\FitStore POS\InstallerCache`.
- [POR CONFIRMAR EN PC LIMPIA] Espacio en disco requerido. El script no lo comprueba.
- [POR CONFIRMAR EN PC LIMPIA] Permisos: el script descarga e instala WinSW y PostgreSQL; se sospecha que requiere Administrador, no verificado.

## 2. Preparar el instalador
Desde la raíz del repositorio:

```bash
pnpm instalador:preparar
```

Ejecuta `instalador/build.ps1` con `-SoloPreparar`.

## 3. Compilar el instalador
```bash
pnpm instalador:compilar
```

Ruta de salida: el instalador se genera en `instalador\dist` (verificado en `instalador/build.ps1`, variable `$dist`).

## 4. Validación automatizada
Las pruebas automatizadas del instalador se ejecutan con:

```bash
pnpm instalador:validar
```

Equivale a `node instalador/tests/run-validation.mjs` (verificado). Algunas pruebas lanzan PowerShell y pueden tocar SQL real: no correr en una PC con datos reales sin revisar antes.

## 5. Validación visual (manual)
- [POR CONFIRMAR EN PC LIMPIA] Abrir la aplicación desde el menú de inicio.
- [POR CONFIRMAR EN PC LIMPIA] Comprobar que la ventana principal carga sin pantalla en blanco.
- [POR CONFIRMAR EN PC LIMPIA] Comprobar que el número de versión coincide con el compilado.

## 6. Configuración
- [POR CONFIRMAR EN PC LIMPIA] Si la aplicación requiere configuración manual al abrirse. El script excluye los archivos `.env` del paquete, pero no está verificado que la app funcione sin ellos.

## 7. Qué hacer si `pnpm instalador:validar` falla
Revisar la salida de la prueba que falló. No está documentado en el repo un procedimiento de recuperación para el usuario final: [POR CONFIRMAR EN PC LIMPIA].

---
**Cierre de D7:** pendiente. Requiere una prueba completa en una PC limpia.

## 8. Resultado de la prueba en esta PC (28-oct, verificado)
- **Preparación** (`pnpm instalador:preparar`): correcta desde una ruta corta (`C:\nxp`). Descarga Node 24.21.0, PostgreSQL 18.6, WinSW 2.12.0 y Visual C++ Redistributable (`vc_redist.x64.exe`), todos desde su sitio oficial.
- **Fallo confirmado desde una ruta larga:** con el repo en una ruta profunda, el paso de manifiesto (`instalador/build.ps1`, línea 344) falla con «Could not find a part of the path»: es el límite de 260 caracteres de Windows. Solución en la guía: trabajar desde una ruta corta, o habilitar rutas largas (cambio de sistema, requiere Administrador: [POR CONFIRMAR]).
- **Compilación** (`pnpm instalador:compilar`): correcta. Genera `instalador\dist\Nexora-POS-Setup-0.1.1-prueba.exe` (141,7 MB) y su `.sha256`. El hash del archivo coincide con el `.sha256`.
- **Pruebas de contrato sin SQL** (`installer-session`, `web-server`, `deploy-lock`, `recovery-error-contract`, `recovery-documentation`): 19 pasan, 0 fallan.
- **No ejecutado aquí:** las pruebas en PowerShell de `run-validation.mjs` (incluyen SQL real y servicios) y la instalación del `.exe`. Eso queda para una PC limpia o una máquina virtual.
