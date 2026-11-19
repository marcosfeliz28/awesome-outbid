# Reorientación para ChatGPT nube y ChatGPT PC — 1-nov-2026

Léelo completo antes de actuar. Repositorio: marcosfeliz28/awesome-outbid. Rama de referencia: `nexora-cloud` (es la tienda en vivo). Responde a la dueña en español, corto, resultado primero.

## Qué NO tienes (y no se te va a dar)
- Acceso a Render, a la base de datos de la tienda, a claves o contraseñas. Nunca las pidas ni las pegues.
- Permiso para desplegar ni para mezclar en `nexora-cloud`. Solo Norexos 1 (Claude nube) revisa, mezcla y despliega.
Todo tu trabajo es: ramas en el repositorio, pruebas, CI y capturas.

## Qué sí tienes
GitHub (el repositorio) y la herramienta de CI pública. Para ver CI de un SHA: `https://api.github.com/repos/marcosfeliz28/awesome-outbid/commits/<SHA>/check-runs`. «Listo» = los 3 trabajos (`verify`, `windows-installer`, `render-images`) en verde en el ÚLTIMO SHA de tu rama.

## Dónde quedaste (última actividad 27–28 oct)
Léete `docs/coordinacion/COLA_CHATGPT_27OCT.md` y `docs/coordinacion/RESULTADOS_CHATGPT.md`.
ChatGPT nube: `chatgpt-nube/lumina-adentro-b` (CI roja, 13 e2e), `qa-medios` (3 hallazgos), `ventas-ciego` (SIN mezclar, la dueña decide), `f1-01-bundle`, pantallas pendientes (Reportes, Configuración, Mercancía/Equipos, Asistente).
ChatGPT PC: `chatgpt-pc/visual-*` (caja/POS y tablero «Hoy»), `pc16-compilacion-27oct`, prueba del instalador.

## Qué cambió desde entonces (no lo rehagas)
- Rediseño, login, Tablero, cursos de GV (dólares y pesos) ya están en vivo (commit 2e87d8b7).
- El CI de `nexora-cloud` está rojo por `tests/dinero-auditoria` (devolución sin líneas y devoluciones por fecha de otro mes); lo arregla `claude-pc/fix-ci-mes`. No lo toques.
- Antes de continuar una rama tuya: `git fetch`, compárala con `origin/nexora-cloud` y rebásala/mézclala EN TU RAMA. Muchas piezas del rediseño ya entraron por otra vía: no dupliques.

## Qué haces ahora (orden)
1. Compara cada rama tuya con `nexora-cloud` y escribe en `docs/coordinacion/RESULTADOS_CHATGPT.md` cuáles ya están integradas y cuáles faltan.
2. ChatGPT nube: arregla la CI de `lumina-adentro-b`, luego `qa-medios`, luego `f1-01-bundle`.
3. ChatGPT PC: sigue con `visual-*` solo en lo que falte tras la comparación, y reporta `pc16`.
4. Una rama por tarea, prueba que falle antes y pase después, capturas a 390 px y 1366 px. Avisa a Norexos 1 dejando el resultado en el archivo anterior; él lo lee en su revisión.
5. No relajes ni borres pruebas. Una prueba que falla es un hallazgo.
