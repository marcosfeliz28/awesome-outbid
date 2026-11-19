# Catálogo de la consulta de mejoras (13-nov-2026)

**Antes de leer esto:** haz el Paso 1 de `REVISION_USO_PC_13NOV.md` (tu lista a ciegas) y súbelo. Este catálogo se evalúa en el Paso 2.

Son **28 propuestas** de Claude, agrupadas por dimensión. Cada una pasó por un segundo revisor que intentó refutarla abriendo la evidencia; las que no sobrevivieron están al final, con el motivo. Ninguna está aprobada ni es una orden de construcción: son lo que se te pide evaluar.

**Cómo leer cada propuesta**

- **ID:** `DIS` diseño, `COM` comodidad, `MOD` modernidad.
- **Versión:** `tienda` (lo que usan las empleadas), `producto` (lo que se va a vender) o `ambas`.
- **Evaluador principal:** quién llena la ficha, nube o PC. Las **5 marcadas con ★** las evalúan los dos.
- **Evidencia:** `archivo:línea` en el commit `3705f7d8` de `nexora-cloud` (`git show 3705f7d8:<archivo> | sed -n 'A,Bp'`); las que empiezan por `producto-nexora:` son de esa rama.
- **Esfuerzo** y **Toca dinero** son la opinión de Claude: corrígelos en tu ficha.
- **Pregunta para ti:** lo que Claude no pudo resolver solo. Tu ficha la responde.
- **Orden:** dentro de cada dimensión, de más a menos peso según Claude. Si no estás de acuerdo con ese orden, dilo en tu Paso 4.

## Índice

| ID | Propuesta | Versión | Esfuerzo | Dinero | Evaluador |
|---|---|---|---|---|---|
| DIS-01 ★ | El Resumen muestra RD$ 0.00 y «Sin faltantes» mientras carga o si la consulta falla | ambas | pequeño | no | PC |
| DIS-02 | No perder los pagos escritos si la ventana de cobro se cierra por accidente | ambas | pequeño | no | PC |
| DIS-03 | Menú lateral: 19 entradas en una sola lista y cuatro íconos repetidos | ambas | pequeño | no | PC |
| DIS-04 | Centro de alertas agrupado por tipo, con el total real y sin tope oculto de 200 | ambas | mediano | no | PC |
| DIS-05 | Escala de letra con pasos reales: en la tienda unas 230 de 362 reglas de tamaño salen iguales (14 px) | ambas | mediano | no | PC |
| DIS-06 | El papel de 58 mm imprime con letra más grande que el de 80 mm | tienda | pequeño | no | PC |
| DIS-07 | Un solo juego de colores: hoy conviven --primary/--surface y --nx-* sin usarse igual | ambas | mediano | no | PC |
| DIS-08 | El estilo del punto de venta está en capas: «Cobrar» se define en 7 sitios | ambas | grande | no | PC |
| DIS-09 | La página de venta usa otro violeta que la app y no muestra ninguna pantalla del producto | tienda | mediano | no | PC |
| COM-01 ★ | Hoja de conteo: contar muchos productos de una vez, desde el celular | ambas | mediano | sí | PC |
| COM-02 ★ | Que la cajera pueda cobrar la venta en espera que preparó la vendedora | ambas | mediano | no | PC |
| COM-03 ★ | Ver el margen al cambiar precio o costo en Productos, con aviso si baja del mínimo | ambas | pequeño | no | PC |
| COM-04 | Escribir la cantidad en el carrito en vez de pulsar «+» una vez por unidad | ambas | pequeño | sí | PC |
| COM-05 | Devolver varios artículos de una misma venta en un solo paso | ambas | mediano | sí | PC |
| COM-06 | Traspasar varios productos en una sola operación, con buscador y existencia a la vista | ambas | mediano | sí | PC |
| COM-07 | Entregar comprobante al cliente cuando abona o salda un crédito | ambas | mediano | no | PC |
| COM-08 | Buscar un crédito pendiente por nombre del cliente o número de factura | ambas | pequeño | no | PC |
| COM-09 | Avisar si el cliente nuevo ya existe (mismo teléfono o cédula) antes de crearlo | ambas | mediano | no | PC |
| COM-10 | Cotización que se pueda imprimir o enviar al cliente, no solo guardar | ambas | mediano | no | PC |
| COM-11 | Crear y editar categorías desde la pantalla | ambas | mediano | no | PC |
| COM-12 | Un solo Excel de ida y vuelta: descargar el inventario, cambiarlo y volver a subirlo | ambas | mediano | sí | PC |
| COM-13 | Importar productos desde cualquier Excel: elegir columnas, plantilla y CSV | ambas | mediano | sí | PC |
| COM-14 | Paquete de cierre de mes para la contable en una sola descarga | ambas | mediano | no | PC |
| MOD-01 ★ | Modo práctica para que una empleada nueva aprenda a cobrar sin tocar la caja real | producto | grande | no | PC |
| MOD-02 | Arranque guiado también en la versión instalada, con categorías según el tipo de negocio | ambas | mediano | no | PC |
| MOD-03 | Imprimir directo en la térmica y abrir el cajón sin la ventana del navegador | tienda | mediano | sí | PC |
| MOD-04 | Que el recibo por WhatsApp salga con el número del cliente y el detalle de la compra | ambas | pequeño | no | PC |
| MOD-08 | Modo oscuro: seguir la preferencia del equipo y aplicarse antes de pintar la pantalla | ambas | pequeño | no | PC |

## Diseño (9)

Lo que se ve: letra, color, orden de la pantalla, impresos y la primera impresión del producto.

### DIS-01 ★ · El Resumen muestra RD$ 0.00 y «Sin faltantes» mientras carga o si la consulta falla

**Versión:** ambas · **Lo nota:** dueña, gerente · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** KpiStrip (solo existe en la tienda) hace su propia consulta a /dashboard/summary y no mira isPending ni error: buildKpis pone cero, así que mientras carga o si falla la franja muestra «Ventas de hoy RD$ 0.00 · 0 facturas» y «Alertas de inventario 0 · Sin faltantes». YearPie muestra «Sin ventas en {año}» cuando no hay datos, y WithoutCostCard (ZeroCost.tsx) devuelve null, de modo que «Productos sin costo» desaparece. QueryState existe en helpers.tsx y no se usa en ninguno de los tres en la tienda. En producto-nexora YearPie ya usa QueryState, pero solo en modo «quiet»; KpiStrip y ZeroCost no existen allí.
- **Evidencia:** `apps/web/src/kpiStripModel.ts:26`, `apps/web/src/KpiStrip.tsx:22`, `apps/web/src/YearPie.tsx:115`, `apps/web/src/ZeroCost.tsx:26`, `apps/web/src/helpers.tsx:177`, `producto-nexora:apps/web/src/YearPie.tsx:94`
- **Propuesta:** En KpiStrip, YearPie y WithoutCostCard distinguir tres estados: cargando (esqueleto), error («No se pudo cargar · Reintentar») y dato real. Mostrar cero solo cuando el servidor respondió cero. Reusar QueryState (como ya hace YearPie en producto-nexora en modo quiet) o una versión compacta para tarjetas.
- **Beneficio:** La dueña no toma «RD$ 0.00» o «Sin faltantes» como verdad cuando en realidad no hubo respuesta (internet lento, sesión vencida).
- **Riesgo:** Más esqueletos visibles en conexiones lentas; cuidar que el modo Impacto (cifras que cuentan) no anime desde un estado de error.
- **Pregunta para ti:** Para tarjetas pequeñas de un tablero, ¿qué patrón de error recomiendas: mensaje dentro de cada tarjeta, un solo aviso arriba del Resumen, o conservar el último dato con «actualizado hace X»?
- **Cómo se comprobaría:** Prueba que simule fallo de /dashboard/summary: la franja no muestra «RD$ 0.00» ni «Sin faltantes», sino el aviso con «Reintentar».

### DIS-02 · No perder los pagos escritos si la ventana de cobro se cierra por accidente

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** `Modal` usa el Dialog de Radix sin `onInteractOutside`: se cierra con la X, con Esc o tocando fuera. Los pagos ya agregados en el cobro (aprobación de tarjeta, referencia de transferencia) viven en el estado de `Checkout`, que se desmonta al cerrar. El conteo del cierre de caja también es estado local.
- **Evidencia:** `packages/ui/src/index.tsx:100`, `apps/web/src/POS.tsx:1853`, `apps/web/src/POS.tsx:1558`, `apps/web/src/Tienda.tsx:183`
- **Propuesta:** Dar a `Modal` una opción «tiene datos escritos»: con ella, Esc o un toque fuera piden confirmar («¿Salir sin terminar?») y solo la X o «Cancelar» cierran. Activarla en el cobro cuando hay pagos agregados y en el cierre de caja cuando hay conteo.
- **Beneficio:** Un toque fuera de la ventana en pantalla táctil ya no borra los datos de la tarjeta ni el conteo de billetes; menos repetir con el cliente delante.
- **Riesgo:** Un aviso de más estorba a quien cierra a propósito: debe salir solo cuando hay datos. Se cambia un componente que usan todas las ventanas del sistema.
- **Pregunta para ti:** ¿Es mejor pedir confirmación al cerrar, o conservar los pagos del cobro junto al borrador del carrito (`cartDraft.ts`) para que vuelvan al reabrir? ¿Qué riesgo hay en guardar en el equipo los últimos 4 y la aprobación de tarjeta?
- **Cómo se comprobaría:** Prueba e2e: agregar un pago con tarjeta y pulsar Esc o tocar fuera: sale la confirmación y, al cancelar, el pago sigue en la lista. Sin pagos, la ventana cierra como hoy.

### DIS-03 · Menú lateral: 19 entradas en una sola lista y cuatro íconos repetidos

**Versión:** ambas · **Lo nota:** dueña, gerente · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En la tienda el menú es una lista plana de 19 entradas bajo un único rótulo «TU NEGOCIO». El camión (Truck) se usa para Mercancía, Envíos del mensajero y Compras; la billetera (Wallet) para Conciliar transferencias y Caja; la campana (Bell) para Solicitudes de anulación y Alertas; ChartNoAxesCombined para Gastos y Reportes. En producto-nexora pasa lo mismo y peor: suma «Primeros pasos» (Sparkles, repetido con Promociones) y «Plan y facturación» (Wallet, tercera billetera).
- **Evidencia:** `apps/web/src/App.tsx:201`, `apps/web/src/App.tsx:237`, `apps/web/src/App.tsx:255`, `apps/web/src/App.tsx:1037`, `apps/web/src/styles.css:3262`, `producto-nexora:apps/web/src/App.tsx:243`
- **Propuesta:** Dar un ícono distinto a cada entrada y partir la lista en 4 secciones con rótulo (Vender, Mercancía, Dinero, Administración), conservando qué entradas ve cada rol.
- **Beneficio:** Dueña y gerente ubican la pantalla por forma y zona sin leer 19 renglones en un menú de 185 a 225 px de ancho.
- **Riesgo:** Cambiar orden o íconos desorienta unos días a quien ya los memorizó. Las pruebas e2e buscan las entradas por nombre, no por posición.
- **Pregunta para ti:** ¿Cómo agruparías estas 19 pantallas para una dueña de tienda que no es contadora, y qué ícono de lucide-react darías a Mercancía, Compras, Envíos del mensajero, Conciliar transferencias y Solicitudes de anulación?
- **Cómo se comprobaría:** Prueba unitaria: ningún ícono repetido en navigation; con la dueña, encontrar «Compras» y «Conciliar transferencias» toma menos de 5 segundos.

### DIS-04 · Centro de alertas agrupado por tipo, con el total real y sin tope oculto de 200

**Versión:** ambas · **Lo nota:** dueña y gerente · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Alertas pide la lista sin límite ni tipo; el servidor entrega 200 por defecto y deja el resto para páginas que la web no pide, así que el contador muestra como máximo 200. Se listan una por una, sin agrupar, y cada producto con existencia igual o menor a su mínimo (5 por defecto) genera la suya.
- **Evidencia:** `apps/web/src/Management.tsx:3089`, `apps/api/src/alerts.ts:872`, `apps/api/src/alerts.ts:478`, `apps/api/src/catalog.ts:184`
- **Propuesta:** Mostrar las alertas agrupadas por tipo con su total real (pedido al servidor), abrir un grupo para ver sus renglones por páginas, y permitir «Marcar todas como vistas» por grupo. Primero las de dinero y caja; al final las de inventario.
- **Beneficio:** La dueña ve primero lo que requiere decisión (caja, anulaciones, costos cambiados) y no una lista larga de productos con poca existencia.
- **Riesgo:** Marcar en bloque puede esconder una alerta importante; las de hechos (caja, anulación, costo) no deberían entrar en el marcado masivo.
- **Pregunta para ti:** El servidor ya tiene GET y PUT /alert-rules para apagar un tipo de alerta y ninguna pantalla lo usa. ¿Conviene exponerlo aquí, o es mejor fijar el stock mínimo por categoría para que las de inventario dejen de sobrar?
- **Cómo se comprobaría:** Prueba con 450 alertas nuevas: la pantalla muestra el total 450 repartido por tipo y se pueden ver todas. Marcar un grupo de inventario no toca las de caja.

### DIS-05 · Escala de letra con pasos reales: en la tienda unas 230 de 362 reglas de tamaño salen iguales (14 px)

**Versión:** ambas · **Lo nota:** cajera, gerente, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Tienda: en styles.css, 343 de 362 font-size usan max(var(--fs-min), N × var(--fs-scale)) con --fs-min 14px y --fs-scale 1.12 (tokens.css:76-77). Todo N de 7 a 12 px da 14 px: 229 reglas de una línea (más algunas con clamp) salen del mismo tamaño, y h3 (14 px × 1.12) solo llega a 15.7 px. Hay 50 expresiones de tamaño distintas, pero casi todo el texto chico se ve igual. Producto (producto-nexora): no tiene escala ni mínimo; usa px fijos y unas 300 reglas quedan entre 7 y 13 px, por debajo del mínimo de 14 px de la orden 99.
- **Evidencia:** `packages/ui/src/tokens.css:76`, `apps/web/src/styles.css:179`, `apps/web/src/styles.css:190`, `apps/web/src/styles.css:320`, `apps/web/src/styles.css:334`, `producto-nexora:apps/web/src/styles.css (font-size: 10px ×61, 12px ×60, 11px ×60, 9px ×38, 8px ×33)`
- **Propuesta:** Definir en packages/ui/src/tokens.css 5 pasos con nombre (nota 14, texto 16, subtítulo 18, título 22, cifra 28) y pasar cada regla de apps/web/src/styles.css al paso que le toca, sin bajar de 14 px (orden 99). Las notas se distinguen por color y peso, no por tamaño. En el producto, la misma escala reemplaza los px fijos menores de 14.
- **Beneficio:** Cajera y dueña distinguen de un vistazo título, dato y nota; desarrollo deja de escribir tamaños sueltos.
- **Riesgo:** Texto más grande puede desbordar en 320 px y en el monitor de caja 1366×768; hay que volver a pasar fuentes.spec y pos-pantalla.spec.
- **Pregunta para ti:** ¿Qué pasos de tamaño (y cuántos) propones para un POS que se lee a 60 cm, con mínimo 14 px y base 16 px? ¿Conviene subir los títulos o diferenciar las notas solo con color y peso para no ganar altura?
- **Cómo se comprobaría:** Prueba que mida tamaños en pantalla: máximo 6 valores distintos, ninguno menor de 14 px, y título, dato y nota de una tarjeta miden distinto.

### DIS-06 · El papel de 58 mm imprime con letra más grande que el de 80 mm

**Versión:** tienda · **Lo nota:** cajera, comprador del producto · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Tienda: en @media print el papel de 80 mm usa 13 px fijos (styles.css:5153) y el de 58 mm usa max(14px, 11.5px × 1.12) = 14 px (5162). La vista previa hace lo mismo: 12 px en 80 mm (4984-4985) y max(14px, 11px × 1.12) = 14 px en 58 mm (4991-4993). La rejilla de «productos vendidos» (.tp-daily-nums: 5ch 11ch 12ch más dos huecos de 6 px, línea 5105) ocupa 28 caracteres, y su comentario (5091-5092) dice que «cabe en 58 mm». A 14 px es probable que no quepa en los 50 mm útiles (58 mm menos 4 mm de margen por lado); es cálculo, no se imprimió. Producto: ya usa 11 px (vista previa) y 11.5 px (impresión) fijos en 58 mm, sin el mínimo de 14 px.
- **Evidencia:** `apps/web/src/styles.css:5153`, `apps/web/src/styles.css:5162`, `apps/web/src/styles.css:4991`, `apps/web/src/styles.css:5091`, `apps/web/src/styles.css:5105`, `producto-nexora:apps/web/src/styles.css:5384`, `producto-nexora:apps/web/src/styles.css:5553`
- **Propuesta:** En apps/web/src/styles.css, sacar .thermal-print y .print-preview de la escala de pantalla: tamaño fijo propio (como ya hace producto-nexora: 11–11.5 px en 58 mm) o variables --tp-letra-80 y --tp-letra-58 sin el mínimo de 14 px. Fijar con una prueba cuántos caracteres caben por renglón en cada papel.
- **Beneficio:** Si la tienda usa papel de 58 mm, recibos y cuadres sin renglones cortados; el de 80 mm queda igual. Alinea la tienda con el producto.
- **Riesgo:** No se comprueba sin imprimir en una térmica real de 58 mm; cada impresora escala distinto. Deducido del CSS, no se imprimió.
- **Pregunta para ti:** ¿Qué tamaño de letra y cuántos caracteres por renglón son habituales en térmicas de 58 y 80 mm con Consolas en negrita? ¿Conviene medir en pt o mm en vez de px para no depender del navegador?
- **Cómo se comprobaría:** Imprimir recibo y cuadre en 58 y 80 mm sin importes cortados; prueba que mida que la rejilla de 28 caracteres cabe en los 50 mm útiles.

### DIS-07 · Un solo juego de colores: hoy conviven --primary/--surface y --nx-* sin usarse igual

**Versión:** ambas · **Lo nota:** desarrollo, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Tienda: packages/ui/src/tokens.css define --nx-* con pares claro/oscuro de éxito, alerta y error (líneas 40-70), y packages/ui exporta 12 componentes Nx* (nx-primitivos.tsx) cuyo CSS se carga en main.tsx:10-11, pero ninguna pantalla de apps/web los usa. styles.css usa otro juego (--primary, --surface…) y más de 240 colores escritos a mano fuera de :root (315 hex en todo el archivo). .form-error (línea 1603, #fff0f0 / #c92e43, usada 31 veces en las pantallas) no tiene versión oscura; .badge.danger (411) tampoco. Producto: no carga tokens.css ni nx-primitivos.css y tiene 397 hex en styles.css; el problema de colores sueltos es igual o mayor.
- **Evidencia:** `packages/ui/src/tokens.css:40`, `apps/web/src/main.tsx:10`, `apps/web/src/styles.css:1603`, `apps/web/src/styles.css:411`
- **Propuesta:** Dejar un solo juego de variables (los nombres de styles.css más los pares de estado de tokens.css), usarlo en .form-error, .badge.* y avisos, y decidir si los Nx* se adoptan o se borran. Regla de stylelint que prohíba colores sueltos fuera de :root.
- **Beneficio:** El modo oscuro deja de depender de más de 30 parches por componente; cambiar el color de marca para un comprador es tocar una lista corta de variables.
- **Riesgo:** Cambio amplio de CSS sin pruebas de captura: un color puede moverse sin que nadie lo note. Hacerlo por familias, estados primero.
- **Pregunta para ti:** ¿Migrar las pantallas a los Nx* (NxButton, NxBadge, NxToast) o borrarlos y quedarse con Button/Badge actuales? ¿Qué lista mínima de variables de color necesita un POS con tema claro, oscuro y marca configurable?
- **Cómo se comprobaría:** Error de formulario en modo oscuro con fondo oscuro y contraste de 4.5:1 o más; stylelint en CI sin colores sueltos nuevos; ningún Nx* huérfano.

### DIS-08 · El estilo del punto de venta está en capas: «Cobrar» se define en 7 sitios

**Versión:** ambas · **Lo nota:** desarrollo, cajera · **Esfuerzo:** grande · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En styles.css (6,824 líneas) .pos-layout aparece en 10 bloques, .product-grid en 9 y .charge-button en 7 bloques base (líneas 2161, 5572, 5806, 6126, 6182, 6572, 6613, más variantes :hover/:disabled); hay 94 !important. Las pruebas e2e del POS (pos-pantalla.spec.ts, u1-pos.spec.ts) miden desbordes y tamaños, pero no hay comparación de capturas (ningún toHaveScreenshot). El producto tiene lo mismo: .pos-layout en 10 bloques, 123 !important en 8,524 líneas y sin capturas.
- **Evidencia:** `apps/web/src/styles.css:2161`, `apps/web/src/styles.css:5572`, `apps/web/src/styles.css:6572`, `tests/e2e/pos-pantalla.spec.ts:1`
- **Propuesta:** Primero añadir capturas de referencia del POS y del cobro (toHaveScreenshot de Playwright a 1366×768, 1280×720 y 390). Después mover el POS a pos.css con un bloque base por selector y uno por ancho, borrando las capas que ya no ganan.
- **Beneficio:** Cambiar algo de la caja exige hoy revisar hasta 10 bloques; con un solo lugar y capturas, la cajera no recibe sorpresas en su monitor.
- **Riesgo:** Es la pantalla con la que se cobra: consolidar sin capturas puede mover botones. Las capturas varían con fuentes y sistema; deben correr siempre en el mismo contenedor.
- **Pregunta para ti:** ¿Cómo consolidarías 10 capas de .pos-layout con menos riesgo: @layer de CSS, un archivo por ancho o container queries sobre el carrito? ¿Qué tolerancia de píxeles usarías en las capturas para que no fallen por suavizado?
- **Cómo se comprobaría:** Capturas de referencia iguales antes y después; cada selector del POS aparece una vez por ancho; menos de 20 !important en pos.css.

### DIS-09 · La página de venta usa otro violeta que la app y no muestra ninguna pantalla del producto

**Versión:** tienda · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** landing.css usa --primary #5b3fc4 y la landing declara theme-color #5b3fc4 (claro); la app usa --primary #7c3aed en styles.css y theme-color #7C3AED en su index.html. index.html y precios.html de la landing no tienen ninguna imagen, captura ni og:image (sí og:title y og:description); solo usan icon.svg. En docs/diseno/capturas ya hay capturas del POS y del tablero. La carpeta apps/landing vive solo en la rama de la tienda (nexora-cloud); producto-nexora no la tiene.
- **Evidencia:** `apps/landing/landing.css:13`, `apps/web/src/styles.css:66`, `apps/landing/index.html:27`, `apps/web/index.html:9`
- **Propuesta:** Tomar los colores de marca de una misma lista para landing y app, y añadir a la landing 3 capturas reales (punto de venta, cierre de caja, resumen en celular) con datos de demostración, más una imagen og:image para cuando el enlace se comparte.
- **Beneficio:** Quien llega a norexos.net ve el producto que va a recibir y reconoce el mismo color al entrar; el enlace compartido por WhatsApp muestra imagen.
- **Riesgo:** Las capturas envejecen con cada rediseño: deben salir del modo demostración (#demo) y regenerarse por script, nunca con datos reales de la tienda.
- **Pregunta para ti:** Para vender un POS a tiendas dominicanas pequeñas, ¿qué 3 pantallas mostrarías primero y en qué formato (captura fija, video corto o demo navegable)? ¿El violeta de marca debe ser #7c3aed (app) o #5b3fc4 (landing)?
- **Cómo se comprobaría:** La landing muestra capturas con datos de ejemplo; el color primario es el mismo valor en landing.css y styles.css; al pegar el enlace en WhatsApp aparece imagen.

## Comodidad (14)

Menos pasos y menos dudas para la cajera, la vendedora, la gerente y la dueña.

### COM-01 ★ · Hoja de conteo: contar muchos productos de una vez, desde el celular

**Versión:** ambas · **Lo nota:** dueña y gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** En Inventario, «Contar» abre un producto a la vez y envía un solo renglón, con la cantidad ya rellenada con la existencia del sistema. El servidor acepta hasta 1,000 renglones por conteo. La lista de conteos muestra fecha, número de artículos y estado, pero no lo contado ni la diferencia.
- **Evidencia:** `apps/web/src/Management.tsx:1150`, `apps/web/src/Management.tsx:1138`, `apps/api/src/inventory.ts:1536`, `apps/web/src/Management.tsx:983`
- **Propuesta:** Pantalla «Hoja de conteo»: elegir almacén y categoría, escribir o escanear lo contado de cada producto (casilla vacía, sin mostrar la existencia) y guardar todo como un solo conteo. Antes de «Aprobar ajuste», mostrar por producto: sistema, contado y diferencia.
- **Beneficio:** La dueña y la gerente hacen sus conteos sin libreta, sin Excel y sin pedirle a un agente que los aplique producto por producto.
- **Riesgo:** Un conteo mal digitado ajusta muchas existencias de una vez. Hoy un conteo aprobado con faltante se resta de la ganancia como merma.
- **Pregunta para ti:** El servidor rechaza aprobar si la existencia cambió después de contar («El stock cambió. Repite el conteo», inventory.ts:1629). Con la tienda abierta, ¿se descuentan las ventas hechas después de contar cada producto o se exige contar con la tienda cerrada?
- **Cómo se comprobaría:** Prueba: un conteo de 30 productos se guarda en un solo envío, la vista previa muestra las 30 diferencias y al aprobar queda un movimiento de conteo por cada producto con diferencia.

### COM-02 ★ · Que la cajera pueda cobrar la venta en espera que preparó la vendedora

**Versión:** ambas · **Lo nota:** vendedora, cajera, gerente · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Las ventas en espera y cotizaciones solo las ve y las recupera quien las guardó: la API filtra por el `userId` de quien pregunta en `GET /quotes` y en `POST /quotes/:id/convert`. Otra cajera de la sucursal no las ve; en un cambio de turno, o si la vendedora arma el pedido, hay que marcarlo de nuevo.
- **Evidencia:** `apps/api/src/admin.ts:743`, `apps/api/src/admin.ts:809`, `apps/web/src/POS.tsx:1691`
- **Propuesta:** Mostrar en «En espera» también las ventas en espera de la sucursal guardadas por otras personas, con el nombre de quien la guardó, y dejar recuperarlas a quien tenga `sale:write`; anotar en la bitácora quién la armó y quién la recuperó.
- **Beneficio:** La vendedora arma el pedido en el piso o desde el celular y la cajera solo cobra; en el cambio de turno no se pierden ni se repiten ventas a medias.
- **Riesgo:** Hay que decidir de quién es la venta y el incentivo (hoy, de quien cobra). Una cajera podría recuperar por error la venta de otra y dejarla sin su carrito.
- **Pregunta para ti:** ¿La venta recuperada debe quedar solo a nombre de quien cobra (como hoy) o guardar además «atendió: vendedora» para el incentivo? ¿Se comparten todas las ventas en espera de la sucursal o solo las que la vendedora marque «para caja»?
- **Cómo se comprobaría:** Prueba de integración: A guarda en espera; B, de la misma sucursal, la ve con el nombre de A, la recupera una sola vez y queda en bitácora quién la armó y quién la cobró.

### COM-03 ★ · Ver el margen al cambiar precio o costo en Productos, con aviso si baja del mínimo

**Versión:** ambas · **Lo nota:** dueña y gerente · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En la tienda, «Editar variante y precio» y «Nuevo producto» piden precio y costo sin mostrar el margen que resulta ni avisar si baja de 15 %. El aviso de margen bajo de 15 % solo aparece al registrar una entrada en Mercancía (con el 15 fijo en el código) y, después, como alerta general (que usa el ajuste «Margen bajo», 15 por defecto). La rama producto-nexora ya pide confirmar al guardar si el margen queda bajo 15 % (confirmMargin en catalogChecks.ts), pero tampoco muestra el margen mientras se escribe.
- **Evidencia:** `apps/web/src/Management.tsx:651`, `apps/web/src/Management.tsx:282`, `apps/web/src/Merchandise.tsx:1146`, `apps/api/src/alerts.ts:514`, `producto-nexora:apps/web/src/catalogChecks.ts:6`, `producto-nexora:apps/web/src/Management.tsx:710`
- **Propuesta:** Tienda: traer de producto-nexora marginWarning/confirmMargin (apps/web/src/catalogChecks.ts) a los dos formularios de Management.tsx. Ambas: mostrar mientras se escribe «Margen: N %» con la función margin de packages/shared (precio − costo sobre precio, sin restar ITBIS) y el aviso en rojo si queda bajo el mínimo. Solo aviso: no cambia la regla ni bloquea guardar.
- **Beneficio:** La dueña ve en el momento si un precio nuevo rompe su mínimo de 15 %, en vez de enterarse luego por una alerta o un reporte.
- **Riesgo:** Bajo. Si el formulario usa un mínimo distinto al de las alertas, la dueña vería dos criterios diferentes.
- **Pregunta para ti:** Mercancía compara contra 15 fijo y las alertas contra el ajuste «Margen bajo (%)» de Configuración. ¿El aviso debe leer siempre el ajuste, o el 15 % de la dueña debe ser un piso que el ajuste no pueda bajar?
- **Cómo se comprobaría:** En pantalla: precio 1,000 y costo 900 muestra «Margen: 10 %» con aviso; costo 800 muestra 20 % sin aviso. Prueba de unidad del cálculo con la función compartida.

### COM-04 · Escribir la cantidad en el carrito en vez de pulsar «+» una vez por unidad

**Versión:** ambas · **Lo nota:** cajera y vendedora · **Esfuerzo:** pequeño · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** En el carrito la cantidad es un texto fijo entre los botones «−» y «+»; cada toque en la tarjeta o cada escaneo suma 1. No hay campo para escribirla ni forma de poner «12*código» en el buscador: vender 12 unidades iguales son 12 toques o 12 escaneos.
- **Evidencia:** `apps/web/src/POS.tsx:1165`, `apps/web/src/POS.tsx:1168`, `apps/web/src/api.ts:136`, `apps/web/src/POS.tsx:818`
- **Propuesta:** Hacer editable la cantidad de la línea (tocar el número y escribir) y aceptar «cantidad*código» en el buscador de POS.tsx (`enterText`). El valor escrito pasa por la misma validación de existencia que hoy usan `choose` y el botón «+».
- **Beneficio:** Cajera y vendedora: las ventas de varias unidades iguales (al por mayor, cajas de suplementos) se arman en segundos y sin contar toques.
- **Riesgo:** Una cantidad mal escrita (120 por 12) cobra de más: hay que topar con la existencia y resaltar el cambio. El formato «cantidad*código» podría chocar con algún código real.
- **Pregunta para ti:** ¿Conviene un campo numérico siempre visible o un toque sobre el número que abra un teclado numérico grande en pantalla táctil? ¿El formato «cantidad*código» puede chocar con códigos de barras reales o con lectores Code 39 que envían asterisco?
- **Cómo se comprobaría:** Prueba e2e: escribir 12 en la línea deja 12 y el total correcto; escribir más que la existencia avisa cuántas quedan y no cambia; «3*código» + Enter agrega 3.

### COM-05 · Devolver varios artículos de una misma venta en un solo paso

**Versión:** ambas · **Lo nota:** gerente, cajera, cliente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** El formulario «Devolución» deja elegir un solo «Artículo a devolver» y envía `items` con una línea, aunque `POST /returns` acepta una lista. Devolver 3 artículos distintos son 3 formularios, 3 números NC y, con nota de crédito, 3 notas. Sigue anotado como abierto desde la auditoría de octubre (M6).
- **Evidencia:** `apps/web/src/Management.tsx:3832`, `apps/web/src/Management.tsx:3887`, `apps/api/src/sales.ts:3589`, `docs/AUDITORIA_05_V2_ESTADO.md:38`
- **Propuesta:** Cambiar el formulario por la lista de artículos de la venta con casilla, cantidad a devolver y estado (reingresa, abierto, dañado) por línea, un solo motivo y un solo método de reembolso; enviar todo en una llamada a `POST /returns` con el mismo `operationId`.
- **Beneficio:** Gerente y cliente resuelven la devolución una sola vez, con un NC y una nota de crédito; menos espera en caja y menos papeles que cuadrar.
- **Riesgo:** Toca reembolsos e inventario: hay que probar el reembolso total contra la caja y el reingreso por línea. En celular, un formulario más grande puede confundir si no se ve el total a devolver.
- **Pregunta para ti:** ¿El reembolso de varias líneas debe poder repartirse en dos métodos (parte efectivo, parte nota de crédito) o basta uno como hoy? ¿La API reparte bien el descuento global y el ITBIS cuando se devuelven varias líneas en una sola llamada?
- **Cómo se comprobaría:** Prueba de integración: devolver 2 líneas en una llamada crea un solo NC, reingresa cada cantidad y el reembolso es igual a la suma de hacerlas por separado.

### COM-06 · Traspasar varios productos en una sola operación, con buscador y existencia a la vista

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** «Traspasar mercancía» pide elegir el producto en una lista desplegable (los mismos productos del listado de Inventario), sin buscador ni escáner, y cada traspaso lleva un solo producto (lines con un solo renglón). El formulario del traspaso no muestra cuántas unidades hay en origen ni en destino; esas cifras solo están en la tabla Tienda/Casa que aparece más arriba en el mismo panel. El servidor acepta hasta 100 renglones por traspaso. La rama producto-nexora tiene el mismo formulario de un producto.
- **Evidencia:** `apps/web/src/WarehousesPanel.tsx:121`, `apps/web/src/WarehousesPanel.tsx:199`, `apps/web/src/WarehousesPanel.tsx:146`, `apps/web/src/WarehousesPanel.tsx:85`, `apps/api/src/warehouses.ts:39`, `producto-nexora:apps/web/src/WarehousesPanel.tsx:265`
- **Propuesta:** Cambiar el formulario por una lista de traspaso: buscar o escanear cada producto (como en Mercancía), ver al lado lo que hay en origen y en destino, poner la cantidad y confirmar todos los renglones juntos con un solo motivo, usando el mismo envío que ya existe.
- **Beneficio:** La dueña pasa mercancía de Casa a Tienda en un minuto y sin agente; hoy son un formulario y un motivo por cada producto.
- **Riesgo:** Un error de cantidad mueve varios productos a la vez. El traspaso no tiene «deshacer»: hay que hacer el traspaso contrario.
- **Pregunta para ti:** ¿Conviene reutilizar ProductSearch y ContinuousScanner de Merchandise.tsx dentro de WarehousesPanel o mover el traspaso a la pantalla Mercancía como tercer modo (Entrada / Salida / Traspaso)? Hoy solo lo ve quien tiene permiso «*».
- **Cómo se comprobaría:** Prueba: un traspaso de 5 productos crea un solo registro con 5 renglones; origen baja y destino sube lo mismo; repetir el envío con la misma clave no duplica.

### COM-07 · Entregar comprobante al cliente cuando abona o salda un crédito

**Versión:** ambas · **Lo nota:** cajera, cliente, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Al guardar un cobro de crédito («Registrar cobro») la pantalla solo muestra un aviso («Cobro registrado…») y cierra la ventana; en «Estado de cuenta» pasa lo mismo. No se imprime ni se envía nada al cliente que pagó; lo único que hay es el PDF del estado de cuenta, en la vista de administración.
- **Evidencia:** `apps/web/src/Tienda.tsx:1036`, `apps/web/src/Tienda.tsx:1044`, `apps/web/src/CreditAccounts.tsx:157`, `apps/web/src/CreditAccounts.tsx:305`
- **Propuesta:** Después de «Guardar cobro», mostrar una ventana como la de venta registrada con «Imprimir comprobante» (ticket térmico: cliente, factura, monto recibido, forma de pago, saldo que queda, quién recibió y fecha) y «WhatsApp».
- **Beneficio:** El cliente se va con prueba de su pago y la cajera con respaldo si hay reclamo; la dueña evita discusiones de «yo ya pagué».
- **Riesgo:** Con caja ciega a la cajera se le ocultan importes de su turno: el comprobante mostraría monto y saldo. Hay que decidir si eso rompe el cierre ciego.
- **Pregunta para ti:** ¿El comprobante de abono debe mostrar el saldo pendiente aunque a la cajera se le oculten importes con la caja abierta, o solo el monto recibido? ¿Necesita numeración propia (por ejemplo REC-000001) para buscarlo después?
- **Cómo se comprobaría:** Registrar un abono parcial en efectivo: aparece la ventana con «Imprimir comprobante»; el ticket trae cliente, factura, monto y saldo; reimprimir no duplica el cobro.

### COM-08 · Buscar un crédito pendiente por nombre del cliente o número de factura

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** «Créditos pendientes» por venta (la única vista de la cajera) pide `/cod/pending` solo con el estado y muestra hasta 500 ventas, de la más vieja a la más nueva. El buscador por nombre solo existe en «Por persona», reservada a administración. La cajera encuentra al cliente recorriendo la lista.
- **Evidencia:** `apps/web/src/Tienda.tsx:592`, `apps/web/src/Tienda.tsx:658`, `apps/api/src/sales.ts:4620`, `apps/web/src/CreditAccounts.tsx:206`
- **Propuesta:** Agregar sobre la lista por venta de `CodPending` (Tienda.tsx) un cuadro «Cliente o factura» que filtre en pantalla las filas ya cargadas por nombre del cliente o número FS, sin cambiar la API ni lo que cada rol puede ver.
- **Beneficio:** Cuando llega un cliente a pagar su crédito, la cajera lo encuentra escribiendo tres letras en vez de recorrer decenas de filas con gente esperando.
- **Riesgo:** Con más de 500 créditos abiertos, el filtro en pantalla no encuentra los que no se cargaron: habría que avisarlo o llevar la búsqueda a la API.
- **Pregunta para ti:** ¿Basta filtrar en pantalla las 500 filas cargadas o conviene llevar la búsqueda a `/cod/pending` desde ya? ¿Debe la cajera poder buscar por los últimos dígitos del teléfono, que hoy solo ve enmascarado?
- **Cómo se comprobaría:** Con 30 créditos de prueba, escribir parte del nombre deja solo las filas de ese cliente; al borrar vuelven todas; el total «Por cobrar» sigue siendo el de la lista completa.

### COM-09 · Avisar si el cliente nuevo ya existe (mismo teléfono o cédula) antes de crearlo

**Versión:** ambas · **Lo nota:** cajera, vendedora, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** «Nuevo cliente aquí mismo» envía nombre, teléfono, cédula y correo a `POST /customers`, que crea la fila sin buscar otra con el mismo teléfono o cédula. El teléfono es texto libre de hasta 30 caracteres y el modelo `Customer` no tiene restricción de único. La cajera ve los teléfonos enmascarados.
- **Evidencia:** `apps/api/src/admin.ts:278`, `apps/api/src/admin.ts:60`, `apps/web/src/POS.tsx:1444`, `apps/api/prisma/schema.prisma:296`
- **Propuesta:** En `POST /customers`, comparar teléfono (solo dígitos) y cédula con los clientes activos de la sucursal; si coincide, responder «Ya existe: Nombre (•••123)» y ofrecer «Usar ese cliente». Poner teclado numérico en el campo de teléfono del formulario rápido.
- **Beneficio:** No se crea a la misma clienta tres veces con nombres distintos: sus créditos, notas de crédito e historial quedan en una sola ficha.
- **Riesgo:** Familiares que comparten teléfono quedarían bloqueados si el aviso impide crear: debe ser aviso con «crear de todos modos». Comparar teléfonos viejos mal escritos puede fallar.
- **Pregunta para ti:** ¿El duplicado debe bloquear o solo avisar? ¿Conviene además una herramienta para unir los clientes ya duplicados (con sus créditos y notas de crédito) y cómo hacerlo sin alterar ventas cerradas?
- **Cómo se comprobaría:** Prueba de integración: crear un cliente con el teléfono de otro (con o sin guiones) devuelve el aviso con el nombre existente; «Usar ese cliente» lo selecciona sin crear otra fila.

### COM-10 · Cotización que se pueda imprimir o enviar al cliente, no solo guardar

**Versión:** ambas · **Lo nota:** vendedora, cajera, cliente · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** «Cotizar» guarda el carrito con tipo `quote` y avisa «Cotización guardada.». Luego solo aparece en «Ventas en espera y cotizaciones», donde la única acción es recuperarla al carrito, y eso la marca `converted`. No hay impresión, PDF ni envío de la cotización, y no guarda el precio de cada línea.
- **Evidencia:** `apps/web/src/POS.tsx:1317`, `apps/web/src/POS.tsx:484`, `apps/web/src/POS.tsx:1787`, `apps/api/src/admin.ts:818`
- **Propuesta:** Al guardar una cotización, ofrecer «Imprimir» (ticket térmico con `PrintSheet`) y «WhatsApp» con artículos, precios, total y vigencia; guardar en la cotización el precio de cada línea de ese día y no consumirla solo por consultarla o reimprimirla.
- **Beneficio:** La vendedora responde «¿cuánto me sale?» con un papel o un mensaje, sin dictar precios; el cliente vuelve con su cotización y se cobra desde ella.
- **Riesgo:** Si el precio cambia después, el papel promete otro total: hace falta vigencia visible y avisar la diferencia al recuperarla. Debe decir que no es comprobante fiscal.
- **Pregunta para ti:** Al recuperar una cotización vencida o con precio cambiado, ¿se cobra el precio de hoy avisando la diferencia (como ya hace el carrito) o se respeta lo cotizado como descuento con PIN de gerente? ¿Cuántos días de vigencia por defecto?
- **Cómo se comprobaría:** Guardar una cotización e imprimirla: salen artículos, precios, total, fecha y vigencia; sigue en la lista después de imprimir; al recuperarla, el carrito avisa si un precio cambió.

### COM-11 · Crear y editar categorías desde la pantalla

**Versión:** ambas · **Lo nota:** dueña y comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** La web solo lee las categorías: «Nuevo producto» y «Crear producto rápido» obligan a elegir una que ya exista. El servidor tiene la ruta para crear una categoría, pero ninguna pantalla la usa, y no hay ruta para editarla. Desde la pantalla, una categoría nueva solo nace al cargar el Excel de inventario.
- **Evidencia:** `apps/web/src/Management.tsx:248`, `apps/web/src/Merchandise.tsx:1449`, `apps/api/src/catalog.ts:249`, `apps/web/src/InventoryImport.tsx:426`
- **Propuesta:** Agregar en Productos una sección «Categorías» para administración: crear, renombrar, elegir color y marcar si exige lote y vencimiento. En el servidor, añadir la ruta de edición con registro en la bitácora y los mismos permisos que la de crear.
- **Beneficio:** La dueña abre una línea nueva sin pedir ayuda. Un negocio que compre el sistema arma sus propias categorías el primer día.
- **Riesgo:** Activar «exige lote» en una categoría con existencias sin lote puede trabar ventas o ajustes de esos productos; hay que validar antes de guardar.
- **Pregunta para ti:** ¿Qué debe pasar al marcar «exige lote y vencimiento» en una categoría que ya tiene existencias sin lote: impedirlo, o permitirlo solo para lo que entre desde ese día? ¿Se permite desactivar una categoría con productos?
- **Cómo se comprobaría:** En pantalla: crear «Cuidado de la piel», aparece en el selector de Nuevo producto y en el filtro de Productos. Prueba: una vendedora recibe 403 al intentar crear.

### COM-12 · Un solo Excel de ida y vuelta: descargar el inventario, cambiarlo y volver a subirlo

**Versión:** ambas · **Lo nota:** dueña y comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** Hay dos cargas por Excel. «Plantilla» + «Importar Excel» pide pegar el ID interno de la categoría, no tiene vista previa y ante un error muestra un mensaje genérico. «Importar inventario» sí tiene vista previa, pero exige columnas fijas y no ofrece plantilla; el reporte de inventario baja con otras columnas.
- **Evidencia:** `apps/api/src/catalog.ts:213`, `apps/web/src/Management.tsx:341`, `apps/api/src/inventory-import-core.ts:187`, `apps/api/src/reports.ts:981`
- **Propuesta:** Agregar en «Importar inventario» el botón «Descargar mi inventario en este formato» (las mismas columnas que lee el importador, vacío o con los productos actuales) y hacer que el botón «Plantilla» de Productos baje ese mismo archivo. Retirar la carga que pide el ID de categoría.
- **Beneficio:** Un cambio masivo de precios o costos es bajar, editar y subir con vista previa. Un dueño nuevo carga su catálogo sin conocer códigos internos.
- **Riesgo:** Un Excel mal editado cambia muchos precios o existencias de una vez; la vista previa y la casilla de confirmación ya existen. Quien use la plantilla vieja debe cambiar de archivo.
- **Pregunta para ti:** ¿Se conservan los encabezados heredados (SUB-GRUPO DE ARTICULO, PRECIO DETALLE) o el importador debe aceptar también nombres llanos (Categoría, Precio)? ¿La descarga debe traer la existencia, sabiendo que al subirla queda como conteo?
- **Cómo se comprobaría:** Prueba: descargar, subir sin tocar y la vista previa dice 0 cambios; cambiar un precio y la vista previa muestra exactamente 1 precio que cambia.

### COM-13 · Importar productos desde cualquier Excel: elegir columnas, plantilla y CSV

**Versión:** ambas · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** El importador exige los encabezados del Excel de la tienda: ID, DESCRIPCION, REFERENCIA, SUB-GRUPO…, EXISTENCIA, COSTO y PRECIO DETALLE; si falta uno responde «Faltan columnas en el Excel». Solo acepta .xlsx (el CSV que existe es solo para descargar la lista de cambios) y la pantalla no ofrece una plantilla para descargar. producto-nexora tiene el mismo código.
- **Evidencia:** `apps/api/src/inventory-import-core.ts:187`, `apps/api/src/inventory-import-core.ts:199`, `apps/web/src/InventoryImport.tsx:156`, `apps/web/src/InventoryImport.tsx:260`, `producto-nexora:apps/api/src/inventory-import-core.ts:200`
- **Propuesta:** Antes de la vista previa, un paso «¿qué columna es cuál?» que propone el emparejamiento por nombre parecido y deja corregirlo; botón «Descargar plantilla» y aceptar CSV. readInventory recibe el mapa de columnas; el resto de la carga y sus validaciones no cambian.
- **Beneficio:** Comprador que viene de Excel u otro sistema: carga su inventario sin rehacer su archivo. Soporte: menos cargas hechas a mano en cada instalación.
- **Riesgo:** Un emparejamiento equivocado (costo por precio) cargaría mal existencias y costos: la vista previa debe mostrar el margen (precio − costo)/precio y frenar si costo > precio o avisar si queda bajo 15 %.
- **Pregunta para ti:** ¿Vale la pena que la IA proponga el emparejamiento de columnas (el sistema ya lee facturas con IA) o bastan reglas por nombre? ¿Qué otros datos migrarías primero: clientes, saldos de crédito o proveedores?
- **Cómo se comprobaría:** Un Excel con columnas «Código, Nombre, Cant., Costo, Precio» y el mismo contenido en CSV llegan a la misma vista previa y cifras que el archivo con los encabezados originales.

### COM-14 · Paquete de cierre de mes para la contable en una sola descarga

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** Cada reporte se elige en el menú, se le ponen las fechas y se descarga por separado en Excel o PDF. El «Excel para la contable» existe solo para las compras y está en otra pantalla (Compras, Recepciones; ruta goods-receipts/export, que prepara el 606). El informe formal diario o mensual sale solo en PDF. No hay reporte de créditos por cobrar en el menú de Reportes.
- **Evidencia:** `apps/web/src/Management.tsx:2969`, `apps/web/src/Management.tsx:2721`, `apps/web/src/Purchases.tsx:507`, `apps/web/src/FormalReports.tsx:39`, `apps/api/src/inventory.ts:1394`
- **Propuesta:** En Reportes, botón «Cierre de mes»: se elige el mes y baja un solo libro de Excel con una hoja por tema, usando las consultas que ya existen: ventas detalladas, compras y cuentas por pagar (goods-receipts/export), gastos y presupuesto, estado de resultados y ventas o ingresos por método de pago. Los créditos por cobrar no tienen reporte hoy: habría que sacarlos de la consulta de créditos de clientes o dejarlos fuera.
- **Beneficio:** La dueña entrega el mes a la contable con una sola descarga, en vez de entrar reporte por reporte y a la pantalla de Compras.
- **Riesgo:** Que el libro se tome por declaración fiscal. No lo es: el sistema no emite comprobantes fiscales. Los formatos de la DGII (606 y 607) quedan por confirmar con la contable.
- **Pregunta para ti:** ¿Qué hojas y columnas necesita de verdad la contable cada mes y en qué orden? ¿Un libro con varias hojas o un ZIP con los archivos actuales? ¿Debe incluir el inventario al cierre, que hoy no se puede sacar a una fecha pasada?
- **Cómo se comprobaría:** Prueba: los totales de cada hoja del libro de octubre son iguales a los de su reporte individual para las mismas fechas. Una vendedora no puede descargarlo.

## Modernidad (5)

Lo que un sistema de punto de venta actual ya hace y este todavía no.

### MOD-01 ★ · Modo práctica para que una empleada nueva aprenda a cobrar sin tocar la caja real

**Versión:** producto · **Lo nota:** cajera nueva, comprador del producto, soporte · **Esfuerzo:** grande · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** No hay dónde practicar sin crear ventas reales. En la tienda, la lista del primer día manda probar la impresión con una venta real autorizada y anularla, y dice «si no hay autorización, no crear facturas de prueba»; la pantalla «Demo» es un tablero de ejemplo solo para administración y el menú no tiene «Primeros pasos». En producto-nexora, «Primeros pasos» crea productos de ejemplo con existencia real en la propia empresa, abre la caja y lleva a cobrar: las ventas de prueba quedan como ventas reales.
- **Evidencia:** `docs/guias/CHECKLIST_DIA_1.md:15`, `apps/web/src/Demo.tsx:1`, `docs/sistema/PANTALLAS.md:40`, `producto-nexora:apps/web/src/Onboarding.tsx:124`, `producto-nexora:apps/web/src/Onboarding.tsx:184`
- **Propuesta:** Un «Modo práctica» que el gerente enciende para una usuaria: el Punto de venta trabaja con un catálogo de ejemplo y una banda fija «PRÁCTICA», no llama a `POST /sales` y el recibo sale marcado «PRUEBA»; con 5 ejercicios guiados: efectivo, tarjeta, pago mixto, venta en espera y cierre.
- **Beneficio:** La empleada nueva aprende sin miedo a dañar inventario o caja; quien compra el producto capacita a su gente sin llamar a soporte ni crear ventas falsas.
- **Riesgo:** El peor error es cobrar una venta real creyendo que es práctica, o al revés: la banda debe ser imposible de ignorar y el modo no debe poder encenderse con la caja abierta.
- **Pregunta para ti:** ¿Es más seguro un modo práctica dentro de la misma instalación (sin llamar a la API de ventas) o una empresa de demostración aparte con datos de ejemplo? ¿Cuál cuesta menos mantener? ¿Debe «Primeros pasos» de producto-nexora pasar a usar ese modo en vez de crear productos y ventas reales?
- **Cómo se comprobaría:** Prueba de integración: completar una venta en modo práctica no crea filas de venta, pago, inventario ni caja; la banda «PRÁCTICA» se ve en Punto de venta, cobro y recibo.

### MOD-02 · Arranque guiado también en la versión instalada, con categorías según el tipo de negocio

**Versión:** ambas · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En la versión instalada no hay asistente de arranque: la guía solo dice «En Configuración, completa los datos reales del negocio» y el arranque de create-admin.ts crea las categorías de la tienda (Suplementos, Ropa deportiva, Fajas, Accesorios de gym, Maquillaje); los productos nacen con marca «FitStore». Es igual en las dos ramas. producto-nexora ya tiene «Primeros pasos» (Onboarding.tsx: 2 pantallas que crean las categorías del tipo de negocio, más una lista que se marca sola con logo y RNC, primera cajera y NCF), pero solo se activa con el registro web (registration.ts), no con el instalador.
- **Evidencia:** `docs/INSTALADOR.md:45`, `apps/api/scripts/create-admin.ts:181`, `packages/shared/src/index.ts:793`, `apps/api/prisma/schema.prisma:100`, `producto-nexora:apps/web/src/Onboarding.tsx:42`, `producto-nexora:apps/api/src/registration.ts:118`, `producto-nexora:apps/api/scripts/create-admin.ts:181`
- **Propuesta:** Reusar Onboarding.tsx y onboarding.ts de producto-nexora en la instalación: que create-admin.ts en modo bootstrap no cree las categorías de la tienda y deje settings.onboarding activo, para que el dueño elija tipo de negocio, nombre, logo, cajera, producto y ticket de prueba al primer ingreso. Se puede cerrar y retomar.
- **Beneficio:** Comprador: empieza a vender sin llamar a soporte. Dueña: menos horas de instalación por cada licencia de US$149.
- **Riesgo:** Cambiar create-admin.ts afecta al instalador y a sus pruebas. Las plantillas por tipo de negocio hay que mantenerlas.
- **Pregunta para ti:** ¿Se trae onboarding.ts de producto-nexora tal cual al instalador o se hace uno más corto? ¿Qué 5 tipos de negocio dominicanos pondrías primero (hoy: general, retail, beauty, fitness, services) y qué categorías, impuesto y ajustes llevaría cada plantilla?
- **Cómo se comprobaría:** En una instalación limpia, una persona sin ayuda imprime un ticket de prueba con su nombre en menos de 30 minutos, y si eligió ferretería no existe la categoría «Fajas».

### MOD-03 · Imprimir directo en la térmica y abrir el cajón sin la ventana del navegador

**Versión:** tienda · **Lo nota:** cajera · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** PC

- **Hoy:** En la tienda todo impreso sale con window.print() (Prints.tsx:39) y la guía pide escoger la térmica en la ventana del navegador; el acceso directo instalado abre el navegador normal (explorer.exe con la URL) y la app de escritorio (src-tauri/src/main.rs) solo abre la ventana. No hay código de cajón. El producto ya lo tiene: comandos Tauri print_thermal y open_cash_drawer, rutas /cash-sessions/drawer-open y drawer-open/automatic con bitácora y permiso cash:drawer, y controles en DesktopPrinterControls.tsx.
- **Evidencia:** `apps/web/src/Prints.tsx:39`, `docs/GUIA_PRIMER_DIA.md:19`, `instalador/scripts/Install-FitStore.ps1:264`, `apps/web/src-tauri/src/main.rs:3`, `producto-nexora:apps/web/src-tauri/src/main.rs:19`, `producto-nexora:apps/api/src/cash.ts:779`, `producto-nexora:apps/api/src/cash.ts:855`, `producto-nexora:apps/web/src/DesktopPrinterControls.tsx:36`
- **Propuesta:** Traer a la tienda la vía ya hecha en el producto (app de escritorio Tauri con thermal.rs, rutas de cajón en cash.ts y DesktopPrinterControls.tsx) y probarla con la térmica y el cajón reales de la tienda, en vez de diseñar una vía nueva.
- **Beneficio:** Cajera: un paso menos en cada venta y el cajón abre solo al cobrar en efectivo. Comprador: es lo que espera de cualquier punto de venta.
- **Riesgo:** Depende de la marca de impresora y de Windows: sin prueba en equipo real no vale. Un cajón que abre sin venta es riesgo de efectivo; cada apertura debe quedar en bitácora.
- **Pregunta para ti:** ¿Conviene llevar a la tienda la app de escritorio del producto (impresión térmica directa y cajón con bitácora) o la tienda, que trabaja en el navegador, gana más con el navegador en modo aplicación e impresión silenciosa? ¿Qué falta probar en equipo real?
- **Cómo se comprobaría:** En la caja real: 20 ventas seguidas imprimen sin ventana intermedia; el cajón abre solo con efectivo; cada apertura manual aparece en la bitácora con usuario y motivo.

### MOD-04 · Que el recibo por WhatsApp salga con el número del cliente y el detalle de la compra

**Versión:** ambas · **Lo nota:** cajera, cliente · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El botón «WhatsApp» del recibo arma `wa.me/` con los dígitos del teléfono tal como están guardados, sin código de país. A quien no ve datos de clientes (la cajera) la API le entrega el teléfono enmascarado y la pantalla lo descarta: el enlace sale sin destinatario. El texto solo lleva número de recibo y total.
- **Evidencia:** `apps/web/src/POS.tsx:2481`, `apps/web/src/POS.tsx:2422`, `apps/web/src/POS.tsx:2418`, `apps/api/src/common.ts:307`
- **Propuesta:** En la ventana de venta registrada, un campo «WhatsApp del cliente» que la cajera escribe o confirma (se antepone 1 si son 10 dígitos) y un texto con artículos, cantidades y total. Si el cliente no tenía teléfono, ofrecer guardarlo en su ficha.
- **Beneficio:** El recibo llega de verdad al cliente con un toque; se gasta menos papel y queda el teléfono para créditos y recordatorios.
- **Riesgo:** La cajera escribiría un teléfono que hoy se le oculta a propósito (SEC-05): hay que decidir si eso es aceptable. Un número mal escrito manda el recibo a otra persona.
- **Pregunta para ti:** ¿Es mejor que la cajera escriba el número que le dicta el cliente, o que el servidor envíe el recibo (API de WhatsApp Business o correo) sin mostrarle el teléfono? ¿Qué costo y requisitos tendría esa API para una tienda pequeña? (por confirmar)
- **Cómo se comprobaría:** Con usuaria cajera: tras cobrar, escribir 8095550000 abre el chat de 18095550000 con artículos y total; sin número, el botón lo pide en vez de abrir un chat vacío.

### MOD-08 · Modo oscuro: seguir la preferencia del equipo y aplicarse antes de pintar la pantalla

**Versión:** ambas · **Lo nota:** dueña, gerente, cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El tema sale de localStorage («fitstore-theme») y, si no hay nada, siempre es claro: no consulta prefers-color-scheme (la landing sí). Se aplica en un useEffect de App.tsx, después de montar React (main.tsx solo fija dataset.visual), y la barra del navegador queda fija en #7C3AED en los dos temas. Igual en producto-nexora (api.ts:121, App.tsx:1084).
- **Evidencia:** `apps/web/src/api.ts:117`, `apps/web/src/App.tsx:697`, `apps/web/index.html:9`, `apps/landing/landing.css:22`
- **Propuesta:** En main.tsx, junto a dataset.visual, fijar data-theme antes de dibujar: lo guardado o, si no hay, la preferencia del sistema. Al cambiar de tema, actualizar también meta theme-color con el color de fondo del tema.
- **Beneficio:** Quien usa el celular o la laptop en oscuro no tiene que buscar la luna en cada equipo nuevo y se evita el posible destello claro al abrir (deducido del código).
- **Riesgo:** Una caja con Windows en oscuro abriría en oscuro sin pedirlo; en tiendas muy iluminadas el tema claro puede leerse mejor.
- **Pregunta para ti:** ¿El punto de venta debe seguir el tema del sistema o quedarse siempre en claro salvo que la cajera lo cambie? ¿Qué tema se lee mejor en un mostrador con mucha luz?
- **Cómo se comprobaría:** Con el sistema en oscuro y sin preferencia guardada, la app abre en oscuro sin cuadro claro previo (captura del primer cuadro); theme-color cambia con el tema.
