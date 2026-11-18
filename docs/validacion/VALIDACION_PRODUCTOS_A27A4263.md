# Validación local de Productos `a27a4263`

Fecha: 18-nov-2026

Código revisado: `origin/dot/productos-sobre-inventario-18nov` → `a27a42632eafa8679e165ff5fd811d2b451e7cfb`

Rama de evidencia: `chatgpt-pc/capturas-dot-a27a4263`, fundada en `origin/nexora-cloud` `a85627a6f0737bd6c72d1019ac44aadaa19c7ea7`

## Alcance del primer recorrido

- Revisión en checkout separado de `a27a4263`; no se mezclaron ramas ni se modificó el código del producto.
- Vite escuchó solo en `127.0.0.1:14294`. Los puertos reservados `127.0.0.1:15494` y `127.0.0.1:14394` no se abrieron porque esta prueba usó respuestas simuladas y no inició API, PostgreSQL ni tiempo real.
- Playwright bloqueó cualquier host que no fuera `127.0.0.1`/`localhost`, y bloqueó service workers.
- No se usó la API real. Las respuestas de `/api/products`, `/api/categories`, `/api/settings`, refresco de sesión y registro de terminal fueron simuladas dentro del navegador.
- Datos exclusivamente ficticios: 25 productos QA, 3 categorías, un producto con 2 variantes y un lote. No contienen información de la tienda.
- Toda mutación de negocio quedó bloqueada con HTTP 405 y se registró en memoria. Resultado al final de los cuatro casos: `writes = []`. No se hicieron ventas, importaciones, impresiones, cambios de inventario ni escrituras de datos.
- Los POST simulados de refresco de sesión y registro de terminal solo establecieron la sesión ficticia local; no llegaron a un servidor.

## Casos ejecutados

| Caso | Idioma | Resultado |
|---|---|---|
| 1440 px, tema claro | ES | pasó |
| 1440 px, tema oscuro | EN | pasó |
| 390 px, tema claro | ES | pasó |
| 390 px, tema oscuro | EN | pasó |

En cada caso se verificó:

1. catálogo visible y conteos derivados de los 25 productos falsos;
2. ausencia de desborde horizontal del documento;
3. selección de otro producto en la ficha;
4. búsqueda por `Alfa`, reducción a un resultado y recuperación segura de la selección;
5. paginación 1/2 → 2/2 → 1/2;
6. apertura del formulario de variantes sin guardarlo;
7. etiquetas principales en español o inglés según el caso;
8. cambio de red del navegador a sin conexión: la barra mostró `Sin conexión`/`Offline` y no inventó una cantidad positiva de ventas pendientes;
9. cero solicitudes de escritura de negocio.

Comando del arnés local: `pnpm exec playwright test --config playwright.codex-productos.config.ts`. Resultado final: **4/4 pasaron en 13.2 s**.

## CI del código exacto

La ejecución [44253942994](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44253942994) corresponde exactamente a `a27a42632eafa8679e165ff5fd811d2b451e7cfb` y terminó en `success`:

- `windows-installer`: success
- `verify`: success
- `render-images`: success

Esto confirma el CI de ese SHA; no sustituye la validación visual ni certifica las fotos ausentes.

## Hallazgos

### PROD-QA-01 · Alta · El siguiente candidato debe conservar 66 WebP ya presentes en la base actual

`git diff --name-status a27a4263 a85627a6 -- apps/web/public/products/fotos/*.webp` devuelve **66 archivos `A`** en la base actual que no están en el candidato: 24 del lote 19, 25 del lote 20 y 17 del lote 21. El arnés usó deliberadamente `/products/fotos/INV-1001.webp`, uno de esos archivos: en `a27a4263` falló y el fallback mostró correctamente `Foto no disponible`/`Photo unavailable`.

Requisito: el siguiente candidato debe integrar Productos sobre `a85627a6` o conservar explícitamente esos 66 WebP. No se deben editar ni sustituir las fotos en esta rama de evidencia.

### PROD-QA-02 · Media · La ficha móvil queda a casi ocho mil píxeles del primer viewport

Con 25 productos y 20 filas en la primera página, la ficha lateral pasa debajo de toda la lista a 390 px. Medición después de seleccionar `Producto Beta QA` sin desplazar la página:

- claro ES: ficha a `7859 px` desde el inicio; `scrollY = 0`;
- oscuro EN: ficha a `7778 px`; `scrollY = 0`.

El cambio de selección no desplaza automáticamente a la ficha. La selección sí cambia en el DOM, pero la persona no ve el resultado hasta recorrer casi toda la página. Propuesta para el siguiente candidato: ficha plegable encima de la lista, panel inferior o botón que enfoque/desplace a la ficha con aviso accesible.

### PROD-QA-03 · Media · Inglés incompleto en una acción principal

En los dos casos EN, `Template`, `Import Excel` y `New product` se traducen, pero la acción principal **`Importar inventario`** permanece en español. Es visible en las capturas oscuras. Debe usar la misma preferencia ES/EN del catálogo.

### PROD-QA-04 · Baja · La barra fija de Mercancía puede cubrir temporalmente las acciones de una fila

A 390 px, la barra fija inferior `Mercancía`/`Goods received` ocupa 52 px más padding. Al abrir la página en la posición superior, cruza visualmente la fila `ACCIONES` del primer producto y cubre temporalmente parte de los botones Ver/Etiquetas/Variantes. El contenido tiene padding inferior, así que la fila se puede revelar desplazando; no es una pérdida permanente ni bloquea el recorrido, pero sí oculta el control situado bajo la barra en cada posición intermedia de scroll.

Propuesta: reservar el alto de la barra mediante `scroll-padding-bottom`/`scroll-margin-bottom` en tarjetas enfocables o ocultar esa CTA contextual en Productos si no es prioritaria allí.

## Capturas

Directorio: `docs/validacion/capturas-productos-a27a4263/`

- `1440-light-es.png`
- `1440-dark-en.png`
- `390-light-es.png`
- `390-dark-en.png`
- las mismas cuatro combinaciones con `-variants`, mostrando el formulario sin guardar.

## Límites del primer recorrido

- No se probó API real, PostgreSQL, SSE/WebSocket ni sincronización real; los puertos de API/tiempo real permanecieron cerrados.
- El estado offline se limitó a la red del navegador. Se comprobó que, sin ventas sintéticas pendientes, no aparece un contador positivo; no se insertó una venta offline.
- No se comparó con una imagen supuesta de Higgsfield.
- No se usaron datos reales, producción, Render, credenciales, PIN, impresora ni ventas.

## Confirmación con API local y PostgreSQL de demostración

La repetición usó el código exacto, en tema claro y español. El catálogo respondió HTTP 200 en ambos tamaños. La búsqueda «Bandas Resistance» dejó una fila y la ficha mostró ese producto. Se registraron cero operaciones y cero errores de página. Los servicios locales quedaron cerrados.

- **1440 × 900.** La ficha queda a 106 px del borde superior, visible con la lista completa y con una coincidencia. [Captura](capturas-productos-a27a4263/productos-api-1440.png)
- **390 × 844.** La ficha comienza 7.088 px por debajo de la primera pantalla con todos los resultados. Con un solo producto todavía queda 214 px por debajo. El contador escribe «1 productos». [Captura](capturas-productos-a27a4263/productos-api-390.png)

El siguiente candidato debe conservar las 66 fotos de la base vigente y hacer visible la ficha móvil al seleccionar un producto con 20 filas, manteniendo la búsqueda. Quedan pendientes la traducción de «Importar inventario» y el solape temporal de la barra Mercancía. [Mediciones](capturas-productos-a27a4263/mediciones-api-local.json)
