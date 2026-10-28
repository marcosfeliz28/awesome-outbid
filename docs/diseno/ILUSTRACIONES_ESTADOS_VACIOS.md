# Ilustraciones para estados vacíos

Propuesta en revisión: carrito, inventario y reportes. Son SVG originales,
sin texto ni logotipos, con colores existentes de Obsidian Lumina. Se muestran
en los estados vacíos del carrito, de existencias y del reporte por período;
son decorativas, tienen texto alternativo vacío y tamaño adaptable.

La prueba `apps/web/src/visual-empty-assets.test.ts` comprueba tamaño, colores y que
los archivos no incluyan código activo ni referencias externas. Antes de crear
los recursos, la regresión fallaba con ENOENT para cada uno; tras crearlos,
las tres comprobaciones pasan. La prueba está incluida en `vitest.config.ts`.
La prueba focal, ESLint de los archivos afectados y el build web pasaron en
esta copia local. El build avisa que hay un chunk de más de 500 kB; el mayor
producido mide 1.230,69 kB, por debajo de 2 MiB.

Pendiente: revisión visual en temas claro y oscuro y tamaños móviles, capturas
y CI sobre el commit final. No es una aprobación para publicar.
