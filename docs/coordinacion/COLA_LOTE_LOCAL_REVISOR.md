# Cola del lote local — tareas del Revisor (29-oct-2026)

Para pegar en `docs/coordinacion/COLA_LOTE_LOCAL.md` (rama `claude-pc/cola2-26oct`). Reglas: `docs/seguridad/LOTE-LOCAL-REGLAS-29OCT.md`. Todas son de **solo lectura sobre el repo**; escriben **un archivo nuevo** en `docs/diseno/borradores-local/` de una rama `claude-pc/lote-local-<n>`, nunca en `nexora-cloud` ni `producto-nexora`. Revisa **Claude PC** antes de subir. Sin credenciales, sin `.env*`, sin `docs/operacion|legal`, sin `*.csv|*.xlsx|*.jsonl`, sin cifras de dinero. Todo borrador empieza con «Borrador sin verificar, hecho por modelo local». Modelo sugerido: `qwen2.5-coder:14b` para código y listados; `deepseek-r1` para resúmenes de texto.

| # | Entrada (lee) | Salida (escribe) | Criterio de aceptación | Modelo |
|---|---|---|---|---|
| L1 | `scripts/*.mjs` y `scripts/*.ts` (solo los archivos, no su ejecución) | `docs/diseno/borradores-local/indice-scripts.md` | Una fila por archivo existente (verificable con `ls scripts`), una línea de «qué hace» sacada de su cabecera o comentario; lo dudoso dice «verificar». Ningún script se ejecuta. | qwen2.5-coder:14b |
| L2 | `apps/web/src/*.tsx` | `docs/diseno/borradores-local/mapa-web.md` | Una fila por componente (nombre del archivo, qué pantalla o panel parece ser). Mismo número de filas que archivos `.tsx`. | qwen2.5-coder:14b |
| L3 | `docs/venta/*.md` | `docs/diseno/borradores-local/erratas-venta.md` | Lista de erratas de ortografía y gramática en español con archivo y línea. No edita los originales. No toca cifras ni datos legales; si una frase es dudosa, la marca. | deepseek-r1 |
| L4 | `AGENTS.md` y `docs/coordinacion/*.md` | `docs/diseno/borradores-local/glosario-siglas.md` | Cada sigla o término interno (CI, ITBIS, DGII, «Llaves», «Taller»…) con definición de una línea y el archivo donde aparece; sin inventar: si no está definido en el repo, escribe «no definido». | deepseek-r1 |
| L5 | Ramas `origin/deepseek/*` (solo `git diff --stat` y `git log`) | `docs/diseno/borradores-local/resumen-ramas-deepseek.md` | Una fila por rama: archivos tocados, líneas añadidas, resumen de 1-2 líneas basado en los nombres de archivo y mensajes de commit. Cifras iguales a `git diff --stat`. | deepseek-r1 |
| L6 | `docs/**/*.md` (solo texto) | `docs/diseno/borradores-local/enlaces-rotos.md` | Lista de enlaces relativos a archivos del repo que **no existen** (se comprueba con `ls`); cada fila con archivo, línea y destino roto. Cero falsos positivos en una muestra de 10 que revisa Claude PC. | qwen2.5-coder:14b |
| L7 | `apps/api/src/*.ts` (solo nombres de archivo y comentarios de cabecera) | `docs/diseno/borradores-local/mapa-api.md` | Una fila por archivo con su propósito aparente. No copia reglas de dinero ni valores; si el archivo es de caja, ventas, inventario o autenticación, solo escribe «área sensible: no resumir». | qwen2.5-coder:14b |
| L8 | `docs/auditoria/*.md` | `docs/diseno/borradores-local/pendientes-auditoria.md` | Lista de hallazgos que aparecen como «pendiente» o «abierto» con archivo y línea de origen; nada de hallazgos nuevos. Claude PC comprueba 5 al azar contra el original. | deepseek-r1 |

Si falta archivo de entrada, no existe la carpeta o el modelo no puede cumplir el criterio, la tarea se marca «no hecha» y se explica; no se rellena con suposiciones.

---
## Tanda 2 (29-oct-2026) — para qwen-optimizado
Mismas reglas de arriba: solo lectura del repo, un archivo nuevo en `docs/diseno/borradores-local/` por tarea, rama `claude-pc/lote-local-<n>`, revisa Claude PC, encabezado «Borrador sin verificar, hecho por modelo local», sin ejecutar nada ni leer `.env*`/datos del negocio. Donde el criterio dice «coincide», Claude PC lo comprueba con una orden de solo lectura (`grep`, `wc`, `ls`).

| # | Entrada (lee) | Salida (escribe) | Criterio de aceptación |
|---|---|---|---|
| M1 | `package.json` de la raíz y de cada carpeta en `apps/*` y `packages/*` | `docs/diseno/borradores-local/scripts-npm.md` | Por cada `package.json`, tabla «nombre del script → comando literal», copiada sin cambios; coincide exactamente con el archivo. |
| M2 | Los mismos `package.json` (solo `dependencies` y `devDependencies`) | `docs/diseno/borradores-local/dependencias.md` | Tabla paquete, versión, dónde se declara; mismo número de filas que entradas en cada archivo; versiones idénticas. No añade dependencias ni sugiere actualizar. |
| M3 | Nombres de archivo en `tests/` y `apps/*/tests` (solo `ls` y `wc -l`; **no abre el contenido**) | `docs/diseno/borradores-local/mapa-pruebas.md` | Una fila por archivo con ruta y número de líneas; coincide con `wc -l`. |
| M4 | `packages/shared/src/index.ts` (solo líneas que empiezan por `export`) | `docs/diseno/borradores-local/exports-shared.md` | Lista de nombres exportados con su tipo (función, constante, tipo); coincide con `grep -E '^export'`. No explica reglas de dinero ni copia cuerpos de funciones. |
| M5 | Todo el código en `apps/` y `packages/` (excluye `node_modules`, pruebas) | `docs/diseno/borradores-local/todo-fixme.md` | Cada `TODO`/`FIXME`/`XXX` con ruta, línea y texto literal; mismo conteo que `grep -rnE 'TODO|FIXME|XXX'`. Ningún hallazgo inventado. |
| M6 | `apps/web/src/*.css` | `docs/diseno/borradores-local/mapa-css.md` | Una fila por archivo `.css` con tamaño en líneas y el componente `.tsx` al que parece corresponder (por nombre); lo dudoso dice «verificar». Mismo número de filas que archivos. |
| M7 | `.github/workflows/*.yml` (solo lectura) | `docs/diseno/borradores-local/resumen-workflows.md` | Por workflow: nombre, cuándo se dispara, nombres de sus jobs y de sus pasos. **No lista nombres de secretos ni valores.** Coincide con los archivos. |
| M8 | `docs/diseno/borradores-local/*.md` ya generados (L3, L4 y los de esta tanda) | `docs/diseno/borradores-local/INDICE.md` | Un índice con enlace, tamaño y una línea de qué contiene cada borrador; todos los enlaces existen (`ls`). No modifica los borradores. |

---
## Tanda 3 (29-oct-2026) — para qwen-optimizado
Mismas reglas de siempre: lectura del repo, un archivo nuevo en `docs/diseno/borradores-local/` por tarea (nunca `docs/operacion`, `docs/legal`, `docs/seguridad` ni `.env*`), rama `claude-pc/lote-local-tanda3`, encabezado «Borrador sin verificar», revisa Claude PC. **S1, S4, S5 y S6 son de revisión de seguridad:** se hacen como lectura del código y **nunca copian valores** (ni claves, ni URLs con credenciales, ni contenido de variables). Todo criterio se comprueba con `grep`, `ls` o `wc`.

| # | Entrada (lee) | Salida (escribe) | Criterio de aceptación |
|---|---|---|---|
| S1 | `apps/` y `packages/` (código, no pruebas) | `docs/diseno/borradores-local/variables-leidas.md` | Solo **nombres** de variables de entorno que el código lee (`process.env.X`), cada una con archivo:línea de su primer uso. La lista coincide con `grep -rhoE 'process\.env\.[A-Z_0-9]+' \| sort -u`. No lista valores ni abre `.env*`. |
| S2 | `apps/api/src/*.ts` | `docs/diseno/borradores-local/endpoints-api.md` | Una fila por ruta HTTP declarada (método + ruta + archivo:línea). El número de filas coincide con el `grep -c` de los decoradores o llamadas de rutas que se usó (se escribe cuál). Sin copiar cuerpos de funciones. |
| S3 | `package.json` de cada paquete + el código | `docs/diseno/borradores-local/dependencias-sin-uso.md` | Paquetes declarados que no aparecen en ningún `import`/`require` (verificado con `grep -r`). Cada fila dice «posible, verificar». No sugiere eliminar nada. |
| S4 | `apps/web/src` y `apps/api/src` | `docs/diseno/borradores-local/hosts-externos.md` | Lista de **dominios** que aparecen en URLs literales `http(s)://` del código (solo el dominio, nunca la ruta completa ni parámetros), con archivo:línea. Coincide con `grep -rhoE 'https?://[a-zA-Z0-9.-]+' \| sort -u`. |
| S5 | `apps/` y `packages/` (código, no pruebas) | `docs/diseno/borradores-local/patrones-riesgosos.md` | Cada uso de `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function` o `document.write` con archivo:línea. Mismo conteo que `grep -rnE` de esos patrones. No evalúa si es peligroso: solo lista. |
| S6 | `apps/web/src` | `docs/diseno/borradores-local/almacenamiento-web.md` | Cada uso de `localStorage`, `sessionStorage` o `indexedDB` con archivo:línea y **solo el nombre de la clave** si es una cadena literal; nunca los valores. Mismo conteo que `grep -rnE`. |
| S7 | `apps/` y `packages/` (código) | `docs/diseno/borradores-local/catch-vacios.md` | Cada bloque `catch` vacío o que solo ignora el error, con archivo:línea. Coincide con el conteo de `grep`; si una línea no se puede confirmar con `grep`, se marca «verificar». |
| S8 | `apps/` y `packages/` (código) | `docs/diseno/borradores-local/archivos-grandes.md` | Archivos de más de 800 líneas con su número de líneas (`wc -l`), ordenados de mayor a menor. Mismo conjunto que `find ... \| xargs wc -l` filtrado a >800. |

Un borrador que no cubra todo el alcance debe decir «PARCIAL» y cuántos archivos miró de cuántos.
