# Orden para Claude PC — rescate y limpieza de los 46 archivos sin guardar (19-oct-2026)

Autorización de la dueña: «analízalo, verifica cuáles vamos a utilizar, utilízalo, publícalo; lo que no, bórralo».

1. En el checkout principal de la PC (rama `main`, 717 commits atrás), crea la rama `claude-pc/rescate-46` y confirma ahí los 46 archivos tal cual, después de revisar que no haya secretos (si hay, quítalos y avisa sin repetirlos). Publica la rama.
2. Compara contra `origin/nexora-cloud` (no contra `main`). Los 38 que ya están publicados (`c0b7105` y posteriores) no se usan.
3. Para los 8 restantes (`alerts.ts`, `cash.ts`, `reports.ts`, `Tienda.tsx`, `AUDITORIA_CLAUDE_2_CORRECCIONES.md`, `RONDA_NEXORA_CHATGPT.md`, `tests/api.test.ts`, `tests/claude-round2.test.ts`): escribe en `docs/coordinacion/RESCATE_46.md` qué diferencia útil tienen frente a `nexora-cloud` (función nueva, prueba nueva, o ya superado). No los mezcles: Claude decide.
4. Cuando la rama esté publicada, deja el checkout principal limpio: `git checkout -- .` y borra los archivos nuevos sin seguimiento de esa lista, y borra carpetas de compilación/`node_modules` viejas que no se usen, para liberar espacio. Pasa el checkout a `nexora-cloud` actualizado.
5. Informe corto a la dueña: espacio liberado y resultado.
