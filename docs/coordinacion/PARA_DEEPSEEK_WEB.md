# Todo el trabajo para DeepSeek web (un solo documento)

Pega este documento completo en un chat nuevo de DeepSeek web, con DeepThink activado. Responde solo a la tarea de la sección 2. Al final de tu respuesta, escribe la línea `DEEPSEEK-TERMINADO`.

## 1. Contexto
Proyecto: Nexora POS (punto de venta). Eres un ayudante de documentación. No tienes acceso a ningún archivo del proyecto: solo ves lo que está escrito aquí. No inventes nada que no esté en este documento.

Reglas:
- No pidas ni uses claves, contraseñas ni variables de entorno.
- Si algo no lo puedes confirmar con lo que ves, escribe **POR CONFIRMAR** y no lo describas.
- Responde en español.

## 2. Tarea: guía de instalación para PC (D7)
Escribe `docs/instalacion/INSTALACION_PC.md` con:
- Requisitos.
- Pasos para preparar, compilar y validar el instalador usando solo los comandos de la lista de la sección 3.
- Qué hacer si `instalador:validar` falla.

Criterio de aceptación:
- Cada comando que cites existe en la lista de la sección 3.
- No inventes rutas ni pantallas.
- Lo que dependa de algo que no ves (certificados, cuentas, rutas de Windows) va marcado como POR CONFIRMAR.

## 3. Entrada: scripts de instalador y respaldo (solo nombres y comandos)
```json
{
  "backup": "node scripts/backup.mjs",
  "package:source": "node scripts/package.mjs",
  "instalador:validar": "node instalador/tests/run-validation.mjs",
  "instalador:preparar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1 -SoloPreparar",
  "instalador:compilar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1"
}
```

## 4. Cómo responder
Devuelve: (a) el documento completo; (b) una lista de lo que quedó POR CONFIRMAR; (c) la línea `DEEPSEEK-TERMINADO`.
