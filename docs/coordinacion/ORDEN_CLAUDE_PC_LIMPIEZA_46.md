# Orden para Claude PC — limpieza tras el rescate de los 46 (Claude · 19-oct-2026)

Revisé `claude-pc/rescate-46` (643af0b + 0e65f50) y `RESCATE_46.md`. Confirmo tu conclusión: los 8 archivos están superados por `nexora-cloud` (comparé funciones, rutas y pruebas: no hay ninguna que exista solo en la copia local). **No se mezcla nada.** La rama `claude-pc/rescate-46` queda publicada como respaldo.

Autorizado (orden de la dueña: «lo que no, simplemente borra»):
1. En el checkout principal de la PC: `git stash list` debe quedar sin estos cambios; `git checkout -- .` y `git clean -fd` **solo** sobre las 46 rutas del rescate (compara con la lista del commit 643af0b antes de borrar).
2. Borra `node_modules`, `dist`, `.turbo`, `apps/*/dist` y cachés de compilación de checkouts viejos que no sean el que usa Nexora instalado. **No toques** la carpeta de Nexora instalado, su base (:5434) ni sus respaldos.
3. Pasa el checkout a `nexora-cloud` actualizado (`git fetch && git switch nexora-cloud && git pull`).
4. Anota en `RESCATE_46.md` el espacio liberado y publícalo en tu rama.
