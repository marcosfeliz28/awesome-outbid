# Trabajo de toda la noche para Claude PC (30-oct-2026)
Orden de la dueña: Claude PC no debe quedar sin trabajo esta noche. Norexos 1 no estará consultando a cada rato: trabaja en orden, avisa con LISTA (rama, SHA, 3 CI en verde) y sigue con la siguiente. Antes de preguntar cómo funciona el sistema, grep en `docs/sistema` (skill `base-sistema`). Todo lo de abajo es solo docs y pruebas nuevas (no toca dinero ni caja). Ramas desde origin/nexora-cloud (no desde producto). Usa el modelo local (qwen-optimizado) para redacción; los conteos, listados y verificaciones los hacen scripts, no el modelo.

## A. Cola del modelo local (ya escrita): N26–N41 en `COLA_LOCAL_ACTIVA_NUEVA.json`. Ejecuta N34–N41 primero.

## B. Bloque 15 — scripts y pruebas (rama `claude-pc/bloque15`, un commit por tarea)
93. `tests/docs-sistema-citas.test.ts`: lee `docs/sistema/*.md`, extrae cada cita `archivo:línea` y comprueba que el archivo existe y la línea existe (rangos incluidos). Debe pasar hoy; falla si alguien cita una línea inexistente.
94. `tests/docs-sistema-indice.test.ts`: `docs/sistema/INDICE.json` es JSON válido y lista exactamente los .md de la carpeta; `CAMBIOS.md` existe con encabezado de tabla.
95. Script `scripts/etiquetas-menu.mjs`: extrae del código (App.tsx) las etiquetas del menú y las compara con la tabla de `docs/sistema/PANTALLAS.md`; salida `docs/auditoria/MENU_VS_PANTALLAS.md` con diferencias.
96. Script que cuenta en `apps/web/src` y `docs/` las apariciones de «Nexora POS», «Nexora» y «Norexos» por archivo → `docs/auditoria/NOMBRE_PRODUCTO_CONTEO.md` (insumo de la etapa E1 del cambio de nombre; solo contar, no cambiar).
97. Script que lista las rutas de la API (`@Get/@Post/...` en apps/api/src) con su `@Permit` → `docs/auditoria/RUTAS_Y_PERMISOS.md` (tabla ruta | método | permiso | archivo:línea). Solo lectura.
98. Script que lista las pruebas (`tests/*.test.ts`) con su primer `describe` → `docs/auditoria/MAPA_DE_PRUEBAS.md`.
99. Script que detecta en `docs/` y `apps/web/src` textos con tildes rotas o `?` en medio de palabras en español → `docs/auditoria/TILDES_NUEVAS.md` (solo informe).
100. Script que verifica en `docs/venta/*.md` y `docs/diseno/borradores-local/*.md` que no aparezcan «e-CF», «DGII» ni «Nexora POS» como promesa → `docs/auditoria/PROHIBIDOS_EN_BORRADORES.md` con archivo:línea.

## C. Revisión de los borradores del modelo local (cuando el runner termine N34–N41)
Por cada salida: pasa los scripts de conteo (no el modelo), marca «ACEPTADA» o «RECHAZADA» con el motivo en `docs/diseno/borradores-local/INFORME_REVISION.md`. Las rechazadas se reintentan una vez; si fallan otra vez, se anotan y se pasa a la siguiente.

## D. Al terminar B y C
Avisa «cola baja» en `LISTA_CLAUDE_PC.md`. Si ya terminaste todo, repón tú mismo la cola con tareas del mismo tipo sacadas de `docs/sistema` (cada tarea con entrada exacta, salida bajo docs/, criterio verificable con grep o wc).
