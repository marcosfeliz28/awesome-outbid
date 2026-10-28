# Lote 2 para DeepSeek web (sin datos sensibles)

Entrada: scripts de instalador y respaldo del `package.json` raíz (nombres y comandos, sin claves ni variables de entorno).

## Tarea · D7 · Guía de instalación para PC (Windows)
Escribe en español `docs/instalacion/INSTALACION_PC.md` con: requisitos, pasos para preparar, compilar y validar el instalador, y qué hacer si `instalador:validar` falla. Usa solo los scripts de la lista.

Criterio de aceptación:
- Cada comando citado existe en la lista de scripts.
- No inventes rutas ni pasos de interfaz que no estén en los comandos.
- Si un paso depende de algo que no ves (por ejemplo, un certificado o una cuenta), márcalo como **POR CONFIRMAR** y no lo describas.

## Entrada · scripts de instalador y respaldo
```json
{
  "backup": "node scripts/backup.mjs",
  "package:source": "node scripts/package.mjs",
  "instalador:validar": "node instalador/tests/run-validation.mjs",
  "instalador:preparar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1 -SoloPreparar",
  "instalador:compilar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1"
}
```
