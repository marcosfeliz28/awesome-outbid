# Validación local · Productos integrado `ce128988`

Fecha: 18-nov-2026

Código revisado: `origin/dot/productos-head-integrado-18nov` → `ce128988eb7ad6ab83ad12ce0674c796a95fac7b`.

Correcciones incluidas: `8ab75f9c5fec3867c57605d4756a04a9223c26cf`.

Línea base comparable: `a27a42632eafa8679e165ff5fd811d2b451e7cfb`.

## Condiciones exactas

- Checkout separado y detached del SHA exacto; no se modificó ni publicó ninguna rama.
- Vite escuchó únicamente en `127.0.0.1:14294`.
- No se inició API, PostgreSQL ni tiempo real en 15494/14394. Las respuestas API fueron simuladas dentro de Playwright.
- Todo host fuera de `localhost`/`127.0.0.1` fue bloqueado y los service workers se bloquearon.
- Datos sintéticos: 25 productos, 3 categorías, un producto con dos variantes y un lote. Un producto usó deliberadamente una URL inexistente.
- Sesión ficticia de administración. Las mutaciones de negocio devolvían 405 y se contaban; resultado final: cero escrituras.
- No hubo ventas, importaciones, impresiones, operaciones, datos reales, credenciales, producción ni Render.

## Resultado

`pnpm exec playwright test --config playwright.codex-productos.config.ts` → **4/4 pasaron en 13.6 s**:

Pruebas focales sin navegador: `pnpm exec vitest run tests/productos-presentacion.test.ts tests/catalog-image.test.ts` → **17/17 pasaron**.

1. 1440 px, claro, español.
2. 1440 px, oscuro, inglés.
3. 390 px, claro, español.
4. 390 px, oscuro, inglés.

Los cuatro casos validaron:

- ausencia de desborde horizontal (`0 px`);
- conteos derivados de los 25 productos falsos;
- foto real local `INV-1001.webp` cargada (`naturalWidth > 0`);
- URL rota sustituida por `/products/accessories.svg`, aviso visible y contador `Sin fotografía`/`Without a photograph` actualizado a `1`;
- selección directa del producto 20;
- búsqueda `Alfa`, reducción a un resultado y fallback de la selección al único resultado;
- paginación 1/2 → 2/2 → 1/2;
- modal de variantes abierto y cerrado sin guardar;
- botón inglés `Import inventory` y aviso explícito de que la revisión interna continúa en español;
- cambio de red del navegador a `Sin conexión`/`Offline`, sin contador positivo ficticio de ventas pendientes;
- cero solicitudes de escritura de negocio.

## Comparación con la línea base `a27a4263`

### Corregido

1. **Fotos recuperadas.** `git diff --name-status a27a4263 ce128988 -- apps/web/public/products/fotos/*.webp` devuelve 66 archivos `A`: 24 del lote 19, 25 del lote 20 y 17 del lote 21. `INV-1001.webp` se mostró en tabla y ficha. No se usó la 67.ª foto que solo existe en una punta posterior.
2. **Ficha móvil reordenada.** En la línea base estaba después de las 20 tarjetas, a 7859 px claro/7778 px oscuro. Ahora aparece antes del listado:
   - claro ES: `previewTop=546`, `previewBottom=992`, `panelTop=1012`;
   - oscuro EN: `previewTop=507`, `previewBottom=953`, `panelTop=973`.
3. **Selección estable.** Seleccionar el producto 20 mediante el selector de la ficha superior no mueve la página: `scrollY 0 → 0`; la ficha actualiza su contenido en el primer viewport.
4. **Etiqueta principal en inglés.** `Import inventory` ya no permanece en español. El modal informa que la revisión interna sigue en español.
5. **Fallback también en la tabla.** La miniatura rota del segundo producto muestra el placeholder, sin bucle de error.

### Hallazgo pendiente · PROD-INT-QA-01 · Media

La barra fija `Mercancía`/`Goods received` mide 68 px y todavía tapa controles del catálogo al cruzarlos:

- 390 claro, posición inicial: cubre **43 px** del botón `Ver ficha` de la ficha previa;
- 390 oscuro: cubre **4 px** de `View details` y **7 px** del campo `Search name, SKU or brand`.

El botón cubierto puede revelarse desplazando la página, pero en la composición inicial el CTA de Mercancía se dibuja encima del control de Productos. Propuesta: esconder esa barra contextual en Productos o reservar su altura antes del siguiente bloque mediante espaciado/scroll-margin, sin reducir el área táctil. La repetición debe confirmar que Ver ficha y la búsqueda se pueden pulsar sin desplazar la pantalla.

### Limitación declarada · PROD-INT-QA-02 · Baja

En modo inglés, el botón y el título de importación están traducidos, pero el propio modal avisa: `The import review is currently displayed in Spanish.` Esto ya no es una traducción silenciosamente incompleta; sigue siendo una cobertura bilingüe parcial que debe decidirse antes de declarar la pantalla 100 % EN.

## Evidencia local externa

Este directorio contiene:

- cuatro PNG de pantalla completa: `1440/390 × light/dark`;
- cuatro PNG con el modal de variantes;
- dos PNG móviles del fallback de foto;
- un PNG móvil del aviso de importación en inglés;
- `metricas-saneadas.json` con SHA, condiciones y medidas sin secretos.

## Límites

- No se probó API real, PostgreSQL, SSE/WebSocket, importación efectiva ni sincronización real.
- El estado offline se limitó al navegador y no se insertó una venta pendiente.
- No se comparó con una PNG supuesta de Higgsfield.
- No se certifica producción ni datos reales.
