# Catálogo de la consulta de mejoras (13-nov-2026)

**Antes de leer esto:** haz el Paso 1 de `CONSULTA_MEJORAS_CHATGPT_13NOV.md` (tu lista a ciegas) y súbelo. Este catálogo se evalúa en el Paso 2.

Son **82 propuestas** de Claude, agrupadas por dimensión. Cada una pasó por un segundo revisor que intentó refutarla abriendo la evidencia; las que no sobrevivieron están al final, con el motivo. Ninguna está aprobada ni es una orden de construcción: son lo que se te pide evaluar.

**Cómo leer cada propuesta**

- **ID:** `EST` estructura, `DIS` diseño, `COM` comodidad, `SEG` seguridad, `EFI` eficiencia, `MOD` modernidad.
- **Versión:** `tienda` (lo que usan las empleadas), `producto` (lo que se va a vender) o `ambas`.
- **Evaluador principal:** quién llena la ficha, nube o PC. Las **12 marcadas con ★** las evalúan los dos.
- **Evidencia:** `archivo:línea` en el commit `3705f7d8` de `nexora-cloud` (`git show 3705f7d8:<archivo> | sed -n 'A,Bp'`); las que empiezan por `producto-nexora:` son de esa rama.
- **Esfuerzo** y **Toca dinero** son la opinión de Claude: corrígelos en tu ficha.
- **Pregunta para ti:** lo que Claude no pudo resolver solo. Tu ficha la responde.
- **Orden:** dentro de cada dimensión, de más a menos peso según Claude. Si no estás de acuerdo con ese orden, dilo en tu Paso 4.

## Índice

| ID | Propuesta | Versión | Esfuerzo | Dinero | Evaluador |
|---|---|---|---|---|---|
| EST-01 ★ | Un solo código con interruptor «tienda / producto» en vez de dos ramas que se alejan | ambas | grande | no | nube |
| EST-02 ★ | Un solo cálculo de promociones y descuentos para API, caja y cola sin conexión | ambas | mediano | sí | nube |
| EST-03 ★ | Pantalla de «algo falló» por pantalla, en vez de quedar toda la app en blanco | ambas | pequeño | no | nube |
| EST-04 ★ | Anotar en la venta el NCF que el negocio emitió por su medio actual | tienda | mediano | sí | nube |
| EST-05 | Partir sales.ts (5,162 líneas, 34 rutas) en archivos por flujo | ambas | mediano | no | nube |
| EST-06 | Partir Management.tsx por pantalla y cargar cada pantalla solo cuando se abre | ambas | mediano | no | nube |
| EST-07 | Sacar la decisión del cobro de Checkout a un módulo con pruebas propias | ambas | mediano | sí | nube |
| EST-08 | Códigos de error fijos en la API para que la web no decida por el texto del mensaje | ambas | pequeño | no | nube |
| EST-09 | Marcar en el ajuste si es corrección de conteo o pérdida, sin adivinarlo por el motivo | ambas | mediano | sí | nube |
| EST-10 | Inventario valorizado a una fecha (para el cierre de mes) | ambas | mediano | no | nube |
| EST-11 | Permisos con nombre para lo que hoy solo permite el acceso total (*) | ambas | mediano | no | nube |
| EST-12 | Un solo lector de Configuración: con tipos, valores por defecto en un sitio y sin el logo | ambas | mediano | sí | nube |
| EST-13 | Una sola tabla de pantallas y revisar el permiso antes de dibujar | ambas | mediano | no | nube |
| EST-14 | Sacar del código los datos de la tienda: prefijo FS-, mensajero «Addison» y «Grupo Macgen» | producto | mediano | sí | nube |
| EST-15 | Que la versión instalada conozca el plan vendido: cajas, usuarios, sucursales y vigencia | ambas | mediano | no | nube |
| EST-16 | Varias sucursales de verdad, o dejar de ofrecer «3 sucursales» hasta tenerlas | producto | grande | sí | nube |
| EST-17 | Separar las correcciones de datos de la tienda de las migraciones que recibe cada cliente | producto | pequeño | sí | nube |
| EST-18 | Llevar los informes antiguos al registro REPORTES y quitar la cadena if/else de reports.ts | ambas | mediano | no | nube |
| EST-19 | Tipos de venta, caja y ajustes en lugar de any en la ruta del dinero | ambas | mediano | no | nube |
| EST-20 | Contratos de respuesta por ruta en packages/shared en vez de la lista global de safe() | ambas | grande | no | nube |
| EST-21 | Guardar los conflictos de ventas sin conexión en su propia tabla, no en la bitácora | ambas | mediano | sí | nube |
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
| SEG-01 ★ | Segundo factor para gerencia y administración al entrar desde un equipo nuevo | ambas | mediano | no | nube |
| SEG-02 ★ | Adjuntar la foto del comprobante de transferencia en el momento del cobro | ambas | mediano | no | PC |
| SEG-03 | Aviso cuando alguien cambia un precio de venta (y cuando lo devuelve) | ambas | pequeño | no | nube |
| SEG-04 | Cuentas de agentes y de soporte marcadas como tales, sin poder de PIN | ambas | mediano | no | nube |
| SEG-05 | PIN de gerente: rechazar los fáciles y los repetidos entre personas | ambas | pequeño | no | nube |
| SEG-06 | Botón «Comprobar existencias»: la verificación triple dentro del sistema | ambas | mediano | no | nube |
| SEG-07 | Clave de operación en ajustes de inventario y órdenes de compra: un reintento no duplica | ambas | pequeño | sí | nube |
| SEG-08 | Avisar y sincronizar antes de cerrar sesión con ventas sin enviar | ambas | pequeño | no | PC |
| SEG-09 | Pedir almacenamiento persistente para la cola de ventas sin conexión | ambas | pequeño | no | nube |
| SEG-10 | Bitácora con sello diario para detectar filas cambiadas o borradas | ambas | mediano | no | nube |
| SEG-11 | La cabecera que bloquea el micrófono choca con la búsqueda por voz | tienda | pequeño | no | nube |
| SEG-12 | Revisión automática de dependencias con fallos conocidos en cada cambio | ambas | pequeño | no | nube |
| SEG-13 | Copia de seguridad fuera de la laptop para el cliente instalado, sin técnico | producto | mediano | no | PC |
| SEG-14 | Respaldo local del instalador cifrado con una frase del comprador | ambas | mediano | no | PC |
| SEG-15 | Instalación en Windows: que la API solo escuche en la propia PC | ambas | pequeño | no | PC |
| SEG-16 | Certificado raíz del instalador limitado a la tienda y con la clave protegida | ambas | mediano | no | PC |
| SEG-17 | IA en la versión instalada sin dejar la clave del proveedor en la laptop del cliente | producto | grande | no | PC |
| SEG-18 | Versión del contrato de la venta sin conexión y huella con lista fija de campos | ambas | mediano | sí | nube |
| EFI-01 ★ | Después de cada venta la caja vuelve a bajar el catálogo y los clientes completos | ambas | pequeño | no | nube |
| EFI-02 | El servidor pregunta a la base cada 150 ms aunque nadie esté vendiendo | ambas | pequeño | no | nube |
| EFI-03 | Un empuje de solo documentos corre las tres pruebas completas y cancela la anterior | ambas | pequeño | no | nube |
| EFI-04 | verify corre todo en fila: unidad, integración y 34 archivos de navegador uno por uno | ambas | mediano | no | nube |
| EFI-05 | El tablero lanza 18 consultas a la vez y se recalcula con cada línea vendida | ambas | mediano | sí | nube |
| EFI-06 | La lista de clientes llega entera y suma todas las ventas de la historia en cada carga | ambas | mediano | no | nube |
| EFI-07 | Cada petición hace cuatro lecturas seguidas a la base solo para comprobar la sesión | ambas | mediano | no | nube |
| EFI-08 | Los pagos no tienen índice por fecha ni por estado, y se buscan así cada 30 segundos | ambas | pequeño | no | nube |
| EFI-09 | Guardar la foto de evidencia de un cobro en tabla aparte, no dentro del pago | tienda | mediano | sí | nube |
| EFI-10 | Refrescar solo lo que cambió en vez de volver a pedir todo tras cada guardado | ambas | mediano | no | nube |
| EFI-11 | Avisos de stock sin recorrer ni reescribir el catálogo entero cada vez | ambas | mediano | no | nube |
| EFI-12 | Plazo de respuesta por defecto en todas las llamadas, no solo al cobrar | ambas | mediano | sí | nube |
| MOD-01 ★ | Modo práctica para que una empleada nueva aprenda a cobrar sin tocar la caja real | producto | grande | no | PC |
| MOD-02 | Arranque guiado también en la versión instalada, con categorías según el tipo de negocio | ambas | mediano | no | PC |
| MOD-03 | Imprimir directo en la térmica y abrir el cajón sin la ventana del navegador | tienda | mediano | sí | PC |
| MOD-04 | Que el recibo por WhatsApp salga con el número del cliente y el detalle de la compra | ambas | pequeño | no | PC |
| MOD-05 | Que cada equipo informe su versión y el servidor exija una mínima | ambas | mediano | no | nube |
| MOD-06 | Módulos que se encienden por negocio: incentivos, mensajería y demás | producto | mediano | no | nube |
| MOD-07 | La API no mide cuánto tarda cada ruta: solo se entera cuando algo da error 500 | ambas | pequeño | no | nube |
| MOD-08 | Modo oscuro: seguir la preferencia del equipo y aplicarse antes de pintar la pantalla | ambas | pequeño | no | PC |

## Estructura (21)

Cómo está armado el código y los datos: lo que hace que cambiar algo sea barato o caro, y lo que separa la tienda del producto.

### EST-01 ★ · Un solo código con interruptor «tienda / producto» en vez de dos ramas que se alejan

**Versión:** ambas · **Lo nota:** desarrollo · **Esfuerzo:** grande · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La rama viva nexora-cloud no tiene «Primeros pasos» ni «Plan y facturación»: viven en producto-nexora, que por regla de coordinación nunca se mezcla hacia la tienda. Desde la base común del 25-oct hay 443 commits solo en producto-nexora y 820 solo en nexora-cloud (git rev-list). Los documentos de venta de esta rama remiten al instalador de esta rama (docs/INSTALADOR.md). producto-nexora ya tiene un interruptor de edición: PRODUCT_TENANCY=required en la API y VITE_PRODUCT_TENANCY en la web (productMode, PRODUCT_MODE), usado en 7 archivos para cambiar «la dueña» por «la administración», «Addison» por «Mensajero» y el reporte por empresa.
- **Evidencia:** `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:461`, `docs/sistema/README.md:64`, `docs/venta/MANUAL_1_PAGINA.md:3`, `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md:10`, `producto-nexora:apps/api/src/tenant-context.ts:75`, `producto-nexora:apps/web/src/productTenancy.ts:22`
- **Propuesta:** Dejar un solo tronco y usar como interruptor de edición el PRODUCT_TENANCY / VITE_PRODUCT_TENANCY que producto-nexora ya tiene (tenant-context.ts, productTenancy.ts), leído al arrancar la API y al compilar la web: la edición producto oculta GV y la marca MacGen y enciende «Primeros pasos» y «Plan y facturación». Traer de producto-nexora solo esas piezas, una por rama, con las pruebas de la tienda en verde. Exige revisar la regla «producto-nexora nunca se mezcla hacia nexora-cloud».
- **Beneficio:** Desarrollo y dueña: cada arreglo de caja llega una sola vez a lo que se vende y se acaba la duda de qué código recibe el cliente que paga.
- **Riesgo:** Mezcla grande: puede romper la tienda si se hace de golpe. Va contra la regla escrita de no mezclar producto-nexora hacia la tienda (INSTRUCCIONES_ACTUALES.md:461) y la «separación total» de ARQUITECTURA_NEXORA_PRODUCTO.md; obliga a decidir qué se descarta de producto-nexora (multiempresa y RLS).
- **Pregunta para ti:** Con agentes que construyen y una sola sesión que despliega, ¿qué cuesta menos en 6 meses: un tronco con interruptor de edición, dos ramas con mezclas periódicas o un núcleo común en un paquete? ¿Qué harías con la multiempresa ya hecha?
- **Cómo se comprobaría:** Compilar con edición=producto y que una prueba falle si aparece «MacGen» o «GV» en la web; con edición=tienda, las pruebas e2e actuales pasan sin cambios.

### EST-02 ★ · Un solo cálculo de promociones y descuentos para API, caja y cola sin conexión

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** El descuento de una promoción se calcula en tres copias: promotionDiscount en sales.ts, discountFor en POS.tsx y promotionDiscount en pendingSales.ts; una prueba vigila que den lo mismo. La copia de POS.tsx no tiene la regla de lote (scope.lotId da 0) de las otras dos; hoy POST /promotions no admite lotId, así que la diferencia es latente.
- **Evidencia:** `apps/api/src/sales.ts:592`, `apps/web/src/POS.tsx:118`, `apps/web/src/pendingSales.ts:13`, `tests/promociones-paridad.test.ts:1`, `apps/api/src/admin.ts:1366`
- **Propuesta:** Mover a packages/shared una función pura que reciba precio, cantidad, descuento de línea, descuento global y promociones vigentes, y devuelva el % efectivo, el nombre de la promoción y los totales. Usarla en complete() de sales.ts, en POS.tsx y en pendingSales.ts, y borrar las tres copias.
- **Beneficio:** Cajera y dueña: el total que muestra la caja es siempre el que cobra el servidor. Desarrollo: una regla de precio se cambia en un solo sitio.
- **Riesgo:** Toca la ruta de cobro: una diferencia de un centavo dispara «los precios o promociones cambiaron». Exige correr la tabla de casos actual antes y después.
- **Pregunta para ti:** ¿La función compartida debe devolver solo el porcentaje (como hoy) o ya los importes con Decimal? La regla de lote da 0 en la API y en la cola y no se puede crear por la API: ¿se elimina o se implementa después de asignar el lote por vencimiento?
- **Cómo se comprobaría:** tests/promociones-paridad.test.ts y calidad-dinero-api.test.ts pasan con la misma tabla de casos; promotionDiscount y discountFor ya no existen en apps/; «nxm» se calcula solo en packages/shared.

### EST-03 ★ · Pantalla de «algo falló» por pantalla, en vez de quedar toda la app en blanco

**Versión:** ambas · **Lo nota:** cajera, gerente, dueña, soporte · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** App.tsx monta <Shell/> y <Toasts/> sin barrera de errores: en apps/web y packages/ui no hay ErrorBoundary, componentDidCatch ni un manejador global propio de errores. Un fallo al dibujar cualquier pantalla desmonta la aplicación entera, incluida la caja, y deja la página en blanco.
- **Evidencia:** `apps/web/src/App.tsx:1421`, `apps/web/src/main.tsx:27`, `apps/web/src/App.tsx:1246`
- **Propuesta:** Envolver el contenido de <main> en App.tsx con una barrera de errores con clave por pantalla: muestra «Esta pantalla falló» con Reintentar y Recargar, deja vivo el menú y manda el error a monitoring.ts. El carrito ya se recupera solo con cartDraft.ts.
- **Beneficio:** La cajera no pierde la caja por un error en otra pantalla, y soporte recibe el fallo con el nombre de la pantalla donde ocurrió.
- **Riesgo:** Una barrera puede tapar errores que hoy se notan enseguida: hay que registrar siempre el error y probar que Reintentar no repite un cobro.
- **Pregunta para ti:** ¿Basta una barrera alrededor de <main> o hace falta otra dentro de Checkout (POS.tsx:1829), para que un fallo al dibujar el recibo no cierre la ventana de una venta que ya se cobró?
- **Cómo se comprobaría:** Prueba que hace fallar una pantalla a propósito: sale el aviso con Reintentar, el menú sigue funcionando y el carrito del POS sigue intacto al volver.

### EST-04 ★ · Anotar en la venta el NCF que el negocio emitió por su medio actual

**Versión:** tienda · **Lo nota:** gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** En la tienda, con ncfMode «prepared» (el único modo además de «disabled», admin.ts:110) la caja guarda el tipo pedido (B01 o B02) y el RNC del cliente, y el recibo dice «pendiente de emisión fiscal». Ningún código escribe Sale.ncf ni pasa fiscalStatus a emitido; el Excel de ventas sale con la columna NCF vacía. El producto ya lo resolvió con el modo «sequences»: el negocio declara sus rangos de NCF y cada venta toma el siguiente número y queda emitida (takeNcf), con recibo fiscal y libro de NCF.
- **Evidencia:** `apps/web/src/POS.tsx:2657`, `apps/api/src/sales.ts:1193`, `apps/api/src/receipt-pdf.ts:250`, `apps/api/src/reports.ts:1810`, `producto-nexora:apps/api/src/sales.ts:1192`, `producto-nexora:apps/api/src/ncf-sequences.ts:73`, `producto-nexora:apps/web/src/Management.tsx:4393`
- **Propuesta:** Si la dueña quiere comprobantes en la tienda, traer del producto el modo «sequences» (ncf-sequences.ts, NcfSequenceSettings y la asignación en sales.ts) en lugar de construir una pantalla manual nueva. Si prefiere seguir emitiendo fuera del sistema, una pantalla «Comprobantes por completar» que deje a gerencia anotar el NCF emitido (formato validado, único, con bitácora) usando las mismas restricciones de la migración 202610300001_ncf_coherencia del producto.
- **Beneficio:** Contador del negocio: un solo listado une cada venta con su comprobante. Comprador: cubre el hueco mientras el sistema no emita.
- **Riesgo:** Puede dar la impresión de que el sistema factura: los textos deben ser claros. La norma de la DGII sobre e-CF y sus plazos está por confirmar con un contador.
- **Pregunta para ti:** ¿Vale la pena este puente manual o es mejor ir directo a un proveedor autorizado de e-CF? Con el calendario de la DGII (por confirmar), ¿qué mínimo fiscal necesita un punto de venta que no emite para seguir siendo vendible?
- **Cómo se comprobaría:** Una venta con solicitud B01 aparece en la lista; al escribir un NCF válido pasa a «Emitido» y sale en el Excel de ventas; un NCF repetido o mal formado se rechaza.

### EST-05 · Partir sales.ts (5,162 líneas, 34 rutas) en archivos por flujo

**Versión:** ambas · **Lo nota:** desarrollo · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** apps/api/src/sales.ts tiene 5,162 líneas y 34 rutas en una sola clase: vender, sincronizar, anular, devolver, cobrar créditos, verificar transferencias y corregir costos. Solo complete() ocupa unas 800 líneas (724 a 1527). cash.ts importa de sales.ts y sales.ts de cash.ts (dependencia circular).
- **Evidencia:** `apps/api/src/sales.ts:634`, `apps/api/src/sales.ts:724`, `apps/api/src/cash.ts:41`, `apps/api/src/sales.ts:615`
- **Propuesta:** Crear apps/api/src/sales/ con venta.ts (approve, complete, sync), anulaciones.ts, correcciones.ts, pagos.ts, devoluciones.ts y credito.ts: un controlador por archivo, mismas rutas, sin cambiar reglas. Mover cashLock, terminalName y MONEY_TRANSACTION a cash.ts para quitar el ciclo.
- **Beneficio:** Desarrollo y revisores: cada cambio de dinero toca un archivo de 500 a 900 líneas; menos choques entre ramas y revisiones más cortas y seguras.
- **Riesgo:** Mueve código de cobro. Seis pruebas leen sales.ts como texto y docs/sistema lo cita por número de línea más de 200 veces: hay que reanclarlas y coordinar con las ramas abiertas.
- **Pregunta para ti:** ¿Partir primero solo por archivos (mover sin tocar) y dejar para después el corte interno de complete(), o hacer ambos a la vez? ¿Un controlador Nest por archivo, o uno solo que delega en funciones por flujo?
- **Cómo se comprobaría:** Mismas 34 rutas y respuestas: pnpm check, integración y e2e pasan sin cambiar expectativas; una comprobación de ciclos de importación no encuentra ninguno entre cash y sales.

### EST-06 · Partir Management.tsx por pantalla y cargar cada pantalla solo cuando se abre

**Versión:** ambas · **Lo nota:** cajera, vendedora, desarrollo · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** En nexora-cloud (tienda), Management.tsx tiene 4,814 líneas y exporta 12 pantallas; App.tsx las importa todas de entrada junto con Gv, Mercancía y Dashboard (recharts), sin React.lazy ni Suspense (solo @zxing va bajo demanda). La rama producto-nexora ya usa React.lazy por pantalla, pero su Management.tsx (5,024 líneas) sigue siendo un solo archivo y un solo trozo.
- **Evidencia:** `apps/web/src/App.tsx:88`, `apps/web/src/Management.tsx:244`, `apps/web/src/Management.tsx:3207`, `apps/web/vite.config.ts:26`, `producto-nexora:apps/web/src/App.tsx:102`
- **Propuesta:** Mover cada pantalla a su archivo (screens/Catalog.tsx, Cash.tsx, SalesHistory.tsx, Configuration.tsx…), dejar DataTable, Heading y Filter en un módulo común y llevar a la tienda la carga con React.lazy que ya tiene el producto. Workbox precachea los .js, así que siguen abriendo sin conexión.
- **Beneficio:** La caja debería abrir más rápido en celulares y equipos lentos al no cargar de entrada reportes, configuración ni gráficos; el código queda en archivos que una persona puede revisar.
- **Riesgo:** Hay pruebas que leen Management.tsx y POS.tsx como texto y se rompen al mover código; un trozo que no carga tras un despliegue necesita la barrera de errores.
- **Pregunta para ti:** ¿Qué pantallas deben quedar en el arranque para la cajera (POS, Ventas, Caja) y cuáles diferir? ¿Conviene primero solo partir el archivo y medir con vite build? ¿Cómo evitar que tienda y producto sigan separándose en App.tsx?
- **Cómo se comprobaría:** El trozo inicial del build pesa menos que antes; entrar como cajera no descarga el código de Reportes ni Configuración; todas las pantallas abren sin conexión.

### EST-07 · Sacar la decisión del cobro de Checkout a un módulo con pruebas propias

**Versión:** ambas · **Lo nota:** cajera, dueña, desarrollo · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** finish() de Checkout (POS.tsx) decide en unas 260 líneas dentro del componente si la venta se envía, se guarda en el equipo o queda «sin respuesta». Solo una parte está fuera y probada: offlineSaleAction (offlinePolicy.ts: guardar, reintentar o bloquear). El repositorio no tiene Testing Library ni jsdom: varias pruebas leen POS.tsx como texto y comparan la posición de cadenas.
- **Evidencia:** `apps/web/src/POS.tsx:2118`, `apps/web/src/POS.tsx:2223`, `apps/web/src/offlinePolicy.ts:5`, `tests/caja-web-ticket.test.ts:73`, `package.json:30`
- **Propuesta:** Mover finish, saveLocal y preserveUnanswered a un módulo checkoutSale.ts con dependencias inyectadas (api, localDB, reloj), como ya hace applyPendingSaleReprice en pendingSales.ts, y probar cada rama: en línea, sin red, sin respuesta, crédito, PIN y UUID repetido.
- **Beneficio:** Los casos límite del cobro (corte a mitad, respuesta perdida) quedan probados sin navegador; un cambio de pantalla ya no altera la lógica del dinero sin que falle una prueba.
- **Riesgo:** Es mover la ruta de cobro: un descuido cambia cuándo se guarda la venta o se descuenta el stock local. Debe hacerse sin cambiar comportamiento y con las e2e de venta offline en verde.
- **Pregunta para ti:** ¿Ampliar la función pura que ya existe (offlineSaleAction) para que devuelva enviar/guardar/conservar/bloquear, o extraer todo el flujo con sus efectos? ¿Qué ramas de finish() no cubren hoy tests/e2e/store.spec.ts y caja-web.spec.ts?
- **Cómo se comprobaría:** Una prueba unitaria por cada rama del cobro; desaparecen las aserciones que leen POS.tsx como texto; las e2e «venta offline…» siguen pasando.

### EST-08 · Códigos de error fijos en la API para que la web no decida por el texto del mensaje

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La API lanza errores de texto libre (bad, conflict y denied: más de 400 usos) y solo tiene 4 códigos fijos. La web decide qué hacer buscando frases con expresiones regulares («requiere el PIN de un gerente», «UUID ya corresponde», «no cuadra») y api.ts descarta el campo code de la respuesta.
- **Evidencia:** `apps/api/src/common.ts:85`, `apps/web/src/POS.tsx:2357`, `apps/web/src/Tienda.tsx:283`, `apps/web/src/api.ts:351`
- **Propuesta:** Dar código fijo a los errores sobre los que la web actúa (precio cambió, falta PIN de gerente, UUID usado, tarjeta no coincide, caja no cuadra, intentos de cierre), con la lista en packages/shared; api.ts pasa code al error y POS.tsx, Tienda.tsx y pendingSales.ts comparan el código, no la frase.
- **Beneficio:** Cajera: corregir la redacción de un mensaje ya no puede dejar sin aparecer el campo del PIN o el aviso de precio. Producto: base para traducir mensajes.
- **Riesgo:** Una versión vieja de la web guardada en el equipo sigue buscando la frase: los textos actuales no deben cambiar hasta que todas las cajas se actualicen.
- **Pregunta para ti:** ¿Basta con código solo para los errores que la web distingue (unos 8) o conviene exigir código en todo bad()/conflict()? ¿Qué formato es mejor para el producto: constantes en inglés (MANAGER_PIN_REQUIRED) o claves por módulo?
- **Cómo se comprobaría:** Prueba: cambiar el texto de un mensaje en la API no rompe la caja; buscar «.test(e.message)» en apps/web/src ya no encuentra reglas de negocio.

### EST-09 · Marcar en el ajuste si es corrección de conteo o pérdida, sin adivinarlo por el motivo

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** Un ajuste negativo cuenta como «corrección de conteo» (no resta de la ganancia neta) si su motivo, texto libre, contiene conteo, teddy, auditor, reversa, casa a 0, no existe o no hay; si no, cuenta como pérdida. El formulario «Ajustar» solo ofrece Ajuste, Merma y Devolución a proveedor.
- **Evidencia:** `apps/api/src/inventory.ts:388`, `apps/api/src/reports.ts:462`, `apps/web/src/Management.tsx:1051`, `.claude/skills/mercancia/SKILL.md:29`
- **Propuesta:** Agregar al ajuste un campo obligatorio «Clase»: corrección de conteo, pérdida o merma, regalo, uso interno. Guardarlo en el movimiento y que COUNT_CORRECTION_SQL lea ese campo para los movimientos nuevos; la búsqueda por palabras queda solo para los anteriores a la fecha del cambio.
- **Beneficio:** La ganancia neta deja de depender de una palabra escrita en el motivo. En el producto para vender, la regla no arrastra palabras de esta tienda.
- **Riesgo:** Toca cómo se calcula la ganancia neta desde la fecha del cambio. Si se migra mal, cambian cifras de meses ya revisados. Requiere el sí de la dueña.
- **Pregunta para ti:** El conteo físico aprobado (tipo «count») posterior al 16-oct hoy resta como merma, y el mismo faltante hecho con «Ajustar» y la palabra «conteo» no resta. ¿Cuál debe ser la regla única y qué clases exactas debe elegir la dueña?
- **Cómo se comprobaría:** Prueba: dos ajustes de −1 con el mismo motivo y distinta clase; solo el de clase pérdida baja la ganancia neta. Los totales de octubre no cambian antes y después del cambio.

### EST-10 · Inventario valorizado a una fecha (para el cierre de mes)

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** «Inventario valorizado» y «Valor del inventario por categoría y almacén» calculan con la existencia y el costo promedio de este momento (no reciben fechas). La pantalla de Reportes les muestra los filtros Desde y Hasta, pero no cambian el resultado. No hay tabla que guarde una foto del inventario por fecha; el kardex (InventoryMovement) sí guarda por movimiento balanceAfter y unitCost.
- **Evidencia:** `apps/api/src/reports.ts:960`, `apps/api/src/reportes/inventario.ts:131`, `apps/web/src/Management.tsx:3014`, `apps/api/prisma/schema.prisma:207`, `apps/api/src/inventory.ts:482`, `apps/api/src/inventory.ts:854`
- **Propuesta:** Que estos dos reportes acepten una fecha de corte y calculen la existencia de ese día con el último saldo del kardex (balanceAfter) de cada producto y almacén hasta esa fecha. Sin fecha, siguen como hoy. Quitar Desde y Hasta donde no aplican.
- **Beneficio:** La dueña saca el inventario al 31 de un mes aunque lo pida días después, y la pantalla deja de ofrecer un filtro que no hace nada.
- **Riesgo:** balanceAfter no significa lo mismo en todos los movimientos: en stockChange es la existencia total de la variante (inventory.ts:482) y en los movimientos por almacén es lo del almacén (inventory.ts:854); hay que comprobarlo antes de reconstruir por almacén. El costo promedio diario no se guarda aparte (solo el unitCost de cada movimiento), así que valorar con el costo de hoy da otra cifra que la del día real. Productos sin movimientos en el kardex quedarían en cero.
- **Pregunta para ti:** ¿Es más fiable reconstruir desde el kardex o guardar una foto automática el último día de cada mes (existencia y costo por producto)? Si se reconstruye, ¿con qué costo se valora: el de hoy o el unitCost del último movimiento antes de la fecha?
- **Cómo se comprobaría:** Prueba: sacar el reporte con fecha de ayer, registrar hoy una entrada y una venta, y volver a pedirlo con fecha de ayer: da las mismas unidades por producto.

### EST-11 · Permisos con nombre para lo que hoy solo permite el acceso total (*)

**Versión:** ambas · **Lo nota:** dueña, comprador del producto, soporte · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** 44 rutas llevan @Permit("*"), el permiso total. Ahí se mezclan la administración del sistema (usuarios, roles, bitácora) y operaciones del negocio (verificar transferencias, traspasos Casa-Tienda, cobros de crédito). No hay ruta para crear roles y PUT /roles/:id acepta cualquier texto como permiso.
- **Evidencia:** `apps/api/src/sales.ts:3138`, `apps/api/src/warehouses.ts:114`, `apps/api/src/admin.ts:1067`, `apps/api/src/admin.ts:1317`
- **Propuesta:** Dar un permiso con nombre a cada grupo de rutas * (payments:verify, inventory:transfer, credit:collect, users:manage, settings:write, audit:read...), que * siga cubriéndolos todos, y validar PUT /roles contra esa lista cerrada. Nadie pierde acceso; se vuelve posible un rol intermedio.
- **Beneficio:** Se puede delegar una tarea (verificar transferencias, hacer traspasos) a una contadora, supervisora o agente sin darle también usuarios, roles, configuración y bitácora.
- **Riesgo:** Tocar 44 decoradores de autorización: un nombre mal puesto abre o cierra una operación de dinero. Exige prueba por ruta con cada rol antes y después.
- **Pregunta para ti:** ¿Qué agrupación mínima de permisos sirve a una tienda pequeña sin volver la pantalla de roles incomprensible? ¿Conviene además permitir crear roles nuevos desde la pantalla o solo por migración, como se hizo con gerente_gv?
- **Cómo se comprobaría:** scripts/rutas-permisos.mjs muestra 0 rutas de negocio con * a secas; prueba: el rol admin conserva las 44 rutas y un rol con solo payments:verify recibe 403 en /users y /roles.

### EST-12 · Un solo lector de Configuración: con tipos, valores por defecto en un sitio y sin el logo

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** Settings.data es JSON: la escritura se valida (configSchema), pero se lee sin tipo con findUnique en 33 sitios, cada uno con su valor por defecto (cardFeePercent ?? 2.5 en tres lugares de sales.ts; lowMargin ?? 15 en alerts.ts, 0.15 fijo en inventory-import-core.ts). El logo (hasta 200 KB) va dentro y AuthGuard lee la fila entera en cada petición.
- **Evidencia:** `apps/api/src/common.ts:669`, `apps/api/src/sales.ts:1433`, `apps/api/src/inventory-import-core.ts:37`, `apps/api/src/admin.ts:920`, `apps/api/src/admin.ts:77`
- **Propuesta:** Crear settings.ts con un esquema zod de lectura, partiendo de configSchema (valores por defecto en un solo sitio), y una función branchSettings(db, branchId) con caché de pocos segundos, usada por AuthGuard, ventas, caja, alertas e importación. Guardar el logo en su propia fila o columna, fuera de data.
- **Beneficio:** Dueña: un cambio en Configuración vale igual en todas las pantallas. Todas: cada clic deja de leer el logo de la base. Desarrollo: ningún valor por defecto repetido.
- **Riesgo:** Toca cómo se leen comisión de tarjeta, límite de descuento y topes de crédito: un valor por defecto distinto cambia cobros. La caché tarda segundos en ver un cambio.
- **Pregunta para ti:** ¿Caché en memoria (solo sirve si hay un único proceso de API) o leer solo el campo con SQL (data->>'campo') sin caché? ¿El margen mínimo de la importación debe leerse de Configuración o quedar fijo en 15 % como regla de la dueña?
- **Cómo se comprobaría:** «settings.findUnique» queda solo en settings.ts; cambiar cardFeePercent se refleja igual en venta, corrección de método y cobro de crédito; una petición autenticada no trae el logo.

### EST-13 · Una sola tabla de pantallas y revisar el permiso antes de dibujar

**Versión:** ambas · **Lo nota:** vendedora, cajera, desarrollo, comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** En nexora-cloud cada pantalla se declara en 4 sitios de App.tsx: la lista navigation, el mapa pages, las excepciones del guardia y el título. El guardia corre en un useEffect, después de dibujar: con #reports la pantalla se monta y consulta antes de redirigir (la API exige reports:read). La rama producto-nexora resuelve la pantalla al dibujar (safePage), pero mantiene navigation y pages separados.
- **Evidencia:** `apps/web/src/App.tsx:202`, `apps/web/src/App.tsx:764`, `apps/web/src/App.tsx:966`, `apps/web/src/App.tsx:1107`, `producto-nexora:apps/web/src/App.tsx:1061`
- **Propuesta:** Unir todo en una tabla de rutas {id, etiqueta, ícono, permiso, pantalla, enMenú} y, en la tienda, resolver la pantalla permitida durante el render como ya hace el producto con safePage. Los atajos F7/F9/F10 y el buscador Ctrl+K leen la misma tabla.
- **Beneficio:** Agregar o apagar una pantalla (también por plan en la versión que se vende) se hace en un solo lugar, y nadie ve el parpadeo de una pantalla que no le toca.
- **Riesgo:** Tocar la navegación puede romper enlaces guardados (#month-report?from=…) y las pruebas e2e que navegan por hash.
- **Pregunta para ti:** ¿Alcanza una tabla propia con hash o conviene una librería de rutas (React Router o TanStack Router), pensando en enlaces directos a una venta o producto y en apagar módulos por plan en la versión que se vende?
- **Cómo se comprobaría:** Prueba e2e: una vendedora que abre #reports o #settings nunca ve esa pantalla ni dispara sus consultas; una pantalla nueva se registra tocando un solo archivo.

### EST-14 · Sacar del código los datos de la tienda: prefijo FS-, mensajero «Addison» y «Grupo Macgen»

**Versión:** producto · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** nexora-cloud tiene datos de la tienda en el código: la factura empieza siempre con «FS-», el mensajero por defecto es «Addison» y los PDF del informe formal y de ingresos por día imprimen «Grupo Macgen». La rama producto-nexora ya usa el nombre configurado y un mensajero genérico, pero conserva «FS-». Los controladores de GV se registran siempre.
- **Evidencia:** `apps/api/src/sales.ts:1149`, `apps/api/src/sales.ts:1158`, `apps/api/src/formal-report.ts:531`, `apps/api/src/income-report.ts:480`, `apps/api/src/app.ts:100`, `origin/producto-nexora:apps/api/src/tenant-context.ts:77`
- **Propuesta:** Pasar a Configuración, en el tronco común, el prefijo de factura y de devolución, el mensajero por defecto y el nombre del negocio de todos los PDF, en vez de un interruptor de entorno solo en la rama del producto. Dejar GV (cursos de GV Makeup Studio) como módulo que se activa por negocio. La tienda conserva sus valores actuales como datos.
- **Beneficio:** Comprador del producto: sus facturas y reportes llevan su nombre y su numeración, sin rastro de otra empresa. Soporte: no hay que preparar una versión por cliente.
- **Riesgo:** Si el valor configurado falta o se cambia, la numeración de facturas de la tienda podría cambiar de formato; «FS-» debe quedar fijo para la sucursal actual.
- **Pregunta para ti:** ¿El prefijo debe poder cambiarse después de emitir facturas o fijarse al crear el negocio? ¿GV se separa como módulo activable dentro del mismo código o se retira de la versión que se vende (hoy no está en la rama producto-nexora)?
- **Cómo se comprobaría:** Buscar «Macgen», «Addison» y «"FS-"» en apps/api/src solo encuentra comentarios; una instalación de prueba con otro nombre genera factura y PDF sin esos textos; la tienda sigue en FS-.

### EST-15 · Que la versión instalada conozca el plan vendido: cajas, usuarios, sucursales y vigencia

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La hoja de precios vende límites (Instalado: 1 sucursal y hasta 3 cajas; Nube Medio 5 cajas y Completo 10; 20 facturas con IA al mes). En la tienda el código no los lee: la ruta que crea usuarios no cuenta cuántos hay, la lectura de facturas tiene un tope fijo de 30 al día por usuario y solo la IA de ventas mira un plan (IA_VENTAS_PLAN). producto-nexora sí limita usuarios, equipos y sucursales con enforcePlanQuota (billing-plans.ts), pero solo con PRODUCT_TENANCY=required, bloquea con error 409 y sus planes (Autoservicio, Básico, Pro, Premium en pesos) no son los de la hoja de precios; tiene local-license.ts (Ed25519) para la instalada, que no se vende porque falta el servidor emisor (PC-19).
- **Evidencia:** `docs/venta/HOJA_DE_PRECIOS.md:7`, `apps/api/src/admin.ts:1066`, `apps/api/src/ai-daily-limit.ts:5`, `apps/api/src/assistant.ts:48`, `producto-nexora:apps/api/src/billing-plans.ts:27`, `producto-nexora:apps/api/src/local-license.ts:74`, `docs/piloto/LISTO_PARA_VENDER.md:102`
- **Propuesta:** Un archivo de plan firmado por Norexos (cliente, cajas, usuarios, sucursales, IA, fin de actualizaciones) que la API de la versión instalada verifica al arrancar y muestra en «Acerca de», reutilizando la verificación Ed25519 de local-license.ts y los contadores de enforcePlanQuota. Al pasar un límite avisa al dueño; nunca bloquea cobrar ni cerrar caja. Alinear BILLING_PLANS con la hoja de precios.
- **Beneficio:** Dueña: lo que cobra coincide con lo que el cliente usa, sin revisarlo a mano. Comprador: ve en pantalla qué incluye su plan y hasta cuándo.
- **Riesgo:** Una licencia mal hecha puede dejar a un cliente sin vender; por eso solo avisa. El intento anterior (PC-19 en docs/piloto/LISTO_PARA_VENDER.md) quedó en «corregir» y sin servidor emisor.
- **Pregunta para ti:** ¿Avisar o bloquear al pasar el límite (el producto web hoy bloquea con 409)? ¿Reutilizar local-license.ts (Ed25519) de producto-nexora o empezar con un archivo firmado más simple? ¿Cómo se emite y renueva sin montar un servidor de licencias?
- **Cómo se comprobaría:** Con un plan de 3 usuarios, al crear el cuarto el dueño ve el aviso y la venta sigue; «Acerca de» muestra plan y fecha; un archivo alterado se rechaza y queda en la bitácora.

### EST-16 · Varias sucursales de verdad, o dejar de ofrecer «3 sucursales» hasta tenerlas

**Versión:** producto · **Lo nota:** comprador del producto · **Esfuerzo:** grande · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** La hoja de precios de la tienda ofrece «Nube Completo» con 3 sucursales y el producto vende los planes Pro (2 sucursales) y Premium (5) en billing-plans.ts, pero en ninguna de las dos ramas hay ruta ni pantalla para crear una sucursal: el usuario nuevo hereda la sucursal de quien lo crea (admin.ts:1103 en la tienda; en el producto, admin.ts cerca de la línea 1238, solo con el control de cupo de sucursales). En la tienda el nombre de categoría, el SKU y el código de barras son únicos en toda la base; en el producto son únicos por empresa (tenantId), lo que sí sirve para un catálogo compartido entre sucursales.
- **Evidencia:** `docs/venta/HOJA_DE_PRECIOS.md:12`, `apps/api/src/admin.ts:1103`, `apps/api/prisma/schema.prisma:62`, `apps/api/prisma/schema.prisma:124`, `producto-nexora:apps/api/src/billing-plans.ts:8`, `producto-nexora:apps/api/src/billing-plans.ts:62`, `producto-nexora:apps/api/prisma/schema.prisma:166`
- **Propuesta:** Decidir el modelo y construir lo mínimo en el producto: ruta y pantalla para crear sucursal y asignar usuarios y equipos a ella; catálogo y clientes compartidos por empresa y, por sucursal, su almacén, sus cajas y sus cierres; selector de sucursal para el dueño y reportes «todas / una». Mientras no exista, no ofrecer más de 1 sucursal en la hoja de precios ni en los planes Pro/Premium.
- **Beneficio:** Comprador con dos locales: ve cada tienda y el total sin llevar dos sistemas. Dueña: no vende algo que el sistema todavía no hace.
- **Riesgo:** Es el cambio más grande de la lista: toca inventario, caja y reportes. Hecho a medias mezcla existencias y cierres entre locales.
- **Pregunta para ti:** ¿Modelar la sucursal como branchId separado (hoy aísla todo, también el catálogo) o como almacén vendible más cajas dentro de un mismo negocio (ya existen Warehouse y traspasos)? ¿Qué reportes consolidados son indispensables?
- **Cómo se comprobaría:** Con dos sucursales de prueba: el mismo código de barras se vende en ambas, cada una cierra su caja, un traspaso mueve existencias y el dueño ve ventas por sucursal y el total.

### EST-17 · Separar las correcciones de datos de la tienda de las migraciones que recibe cada cliente

**Versión:** producto · **Lo nota:** soporte · **Esfuerzo:** pequeño · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** La carpeta de migraciones incluye dos correcciones de datos de la tienda (202611100001 y 202611100002): 35 UPDATE de costo sobre líneas de venta identificadas por su UUID, con números de factura y SKU en comentarios y en la bitácora que insertan. En otra base no cambian filas, pero el instalador de Windows aplica todas las migraciones de Prisma.
- **Evidencia:** `apps/api/prisma/migrations/202611100002_corrige_costo_prd001/migration.sql:29`, `apps/api/prisma/migrations/202611100001_corrige_costo_maquillaje/migration.sql:37`, `docs/INSTALADOR.md:54`
- **Propuesta:** Dejar migrations/ solo para estructura. Las correcciones de datos de un negocio van a una carpeta aparte con un comando propio que anota cada una en una tabla y solo corre en ese despliegue. Escribir la regla en MIGRACIONES_SEGURAS.md y hacerla cumplir con una prueba.
- **Beneficio:** Comprador del producto: su instalación no contiene ni ejecuta correcciones de otra empresa. Dueña y soporte: cada corrección de costos queda listada aparte, con fecha y orden.
- **Riesgo:** Las dos migraciones ya aplicadas no se pueden quitar ni editar (Prisma guarda su suma de comprobación): la regla solo vale hacia adelante. El comando nuevo es otra vía para tocar costos.
- **Pregunta para ti:** ¿Las correcciones puntuales deben ir por un comando versionado en el repositorio, o por la ruta con PIN que ya existe (POST /sales/:id/items/:itemId/cost) dejando SQL solo para lo que ninguna ruta cubre?
- **Cómo se comprobaría:** Prueba en tests/cloud-deploy.test.ts que rechaza una migración nueva con UPDATE de Sale, SaleItem o Payment por id; migrations/ no recibe más UUID ni números de factura de un negocio.

### EST-18 · Llevar los informes antiguos al registro REPORTES y quitar la cadena if/else de reports.ts

**Versión:** ambas · **Lo nota:** dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** GET /reports/:name (reports.ts, líneas 890 a 1578) atiende cuatro caminos a la vez: el registro REPORTES de la carpeta reportes/, la lista STORE_REPORTS, los listados LISTINGS y una cadena if/else con 14 informes antiguos (profit, abc, cash, by-payment…) que arma su propio Excel y PDF en la misma función. La pantalla de Reportes aún los ofrece.
- **Evidencia:** `apps/api/src/reports.ts:890`, `apps/api/src/reports.ts:917`, `apps/api/src/reports.ts:1003`, `apps/api/src/reports.ts:1547`, `apps/web/src/Management.tsx:2723`
- **Propuesta:** Convertir cada informe antiguo en un ReportDef (título, grupo, marca de margen y run) dentro de apps/api/src/reportes/ y servirlo con el mismo camino de pantalla, Excel y PDF que ya usan los reportes del registro. Borrar la cadena if/else y su exportación propia cuando el último esté migrado.
- **Beneficio:** Dueña y gerente: todos los reportes salen por el mismo camino de pantalla, Excel y PDF. Desarrollo: un reporte nuevo es un archivo, no otra rama de una función de casi 690 líneas.
- **Riesgo:** Un informe antiguo puede cambiar cifras, columnas o permisos al migrar (devoluciones, caja ciega). Hay que comparar fila por fila antes de borrar el código viejo.
- **Pregunta para ti:** ¿Se migran los 14 informes antiguos o se retiran los que ya tienen equivalente en el registro nuevo? La pantalla de Reportes aún los lista y assistant.ts usa ReportsController: ¿qué orden de migración es más seguro?
- **Cómo se comprobaría:** Prueba que pide cada informe antes y después con los mismos datos y compara filas y totales; la función report() queda en menos de 60 líneas.

### EST-19 · Tipos de venta, caja y ajustes en lugar de any en la ruta del dinero

**Versión:** ambas · **Lo nota:** desarrollo, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** api() y post() devuelven any si no se indica tipo. Checkout recibe session: any, config: any y customers: any[], y guarda la respuesta en let sale: any; PendingSale.receipt es any. Hay 104 líneas con any en Management.tsx y 49 en POS.tsx. Solo la entrada (SaleInput) viene tipada desde packages/shared.
- **Evidencia:** `apps/web/src/api.ts:324`, `apps/web/src/POS.tsx:1841`, `apps/web/src/POS.tsx:2285`, `apps/web/src/api.ts:61`
- **Propuesta:** Definir en packages/shared los tipos de respuesta que usa el cobro (Sale, CashSession, Settings, Promotion, Customer, recibo local) y tipar con ellos Checkout, la cola y Caja; después cambiar el tipo por defecto de api() a unknown para que cada pantalla declare lo que espera.
- **Beneficio:** El compilador avisa cuando la API cambia un campo de dinero (total, creditBalance, expected.cash) en vez de que la pantalla muestre vacío o NaN en producción.
- **Riesgo:** Pasar el valor por defecto a unknown hace fallar la compilación en cientos de usos: debe hacerse por etapas, empezando por POS y Caja.
- **Pregunta para ti:** ¿Tipos escritos a mano en shared, generados desde Prisma o los controladores de NestJS, o esquemas zod que además validen la respuesta al llegar? ¿Cuál cuesta menos mantener en un equipo pequeño?
- **Cómo se comprobaría:** pnpm typecheck pasa sin any en Checkout, pendingSales.ts y Cash; renombrar un campo de la respuesta de /sales hace fallar la compilación del cliente.

### EST-20 · Contratos de respuesta por ruta en packages/shared en vez de la lista global de safe()

**Versión:** ambas · **Lo nota:** desarrollo · **Esfuerzo:** grande · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** Lo que ve la caja se filtra con safe(): una lista global de 212 nombres de campo, válida para cualquier respuesta (hasta encabezados como «Fecha»); saleHistoryDto es otra lista aparte. packages/shared comparte esquemas de entrada y cálculos, pero ningún contrato de respuesta; la web declara sus tipos a mano y api() devuelve any por defecto.
- **Evidencia:** `apps/api/src/common.ts:377`, `apps/api/src/sales.ts:183`, `apps/web/src/api.ts:324`, `apps/web/src/api.ts:18`
- **Propuesta:** Definir en packages/shared un esquema zod de respuesta por ruta de dinero (venta, historial, caja, cuadre), con su variante por permiso, y usarlo para filtrar la salida en la API y para tipar api<T>() en la web. Empezar por POST /sales y GET /sales y retirar safe() ruta por ruta.
- **Beneficio:** Desarrollo y soporte: un campo que cambia de nombre rompe la compilación y no una pantalla; queda escrito qué ve cada rol en cada respuesta.
- **Riesgo:** Trabajo largo (206 rutas). Si un esquema omite un campo que la web usa, esa pantalla queda vacía; safe() oculta costos por omisión y no puede retirarse de golpe.
- **Pregunta para ti:** ¿Vale la pena validar con zod la salida (costo por respuesta) o basta un tipo TypeScript compartido más pruebas? ¿Generar OpenAPI desde zod sirve al producto, dado que el Swagger actual no describe los cuerpos (casi todos los @Body son unknown)?
- **Cómo se comprobaría:** tsc falla si la web lee un campo que el esquema no declara; cash-privacy.test.ts y ventas-caja-ciega-postgres.test.ts siguen pasando sin cambios.

### EST-21 · Guardar los conflictos de ventas sin conexión en su propia tabla, no en la bitácora

**Versión:** ambas · **Lo nota:** gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** El estado de una venta sin conexión en conflicto vive en AuditLog: la venta intentada, quién la entregó y si gerencia la descartó son filas offline_sale_conflict y offline_sale_discarded, y cada venta nueva consulta la bitácora dentro de su transacción para saber si ese UUID fue descartado.
- **Evidencia:** `apps/api/src/sales.ts:828`, `apps/api/src/sales.ts:1665`, `apps/api/src/offline-sales.ts:54`, `apps/api/src/offline-sale-review.ts:108`
- **Propuesta:** Crear OfflineSaleConflict (offlineUuid único, branchId, userId, estado pendiente/descartada/registrada, venta intentada, totales, quién resolvió y motivo). La sincronización y la revisión leen y escriben ahí; AuditLog queda solo como rastro de lo ocurrido.
- **Beneficio:** Gerente: la lista de ventas por revisar sale de una tabla con estado claro. Desarrollo: depurar o archivar la bitácora ya no puede cambiar qué ventas se aceptan.
- **Riesgo:** Hay que pasar los conflictos abiertos de la bitácora a la tabla nueva sin perder ninguno; durante el cambio una venta ya descartada no debe volver a entrar.
- **Pregunta para ti:** ¿La tabla nueva debe reemplazar también la alerta «offline:<uuid>» (hoy el estado está en Alert y en AuditLog) o solo la parte de la bitácora? ¿Cómo tratar los conflictos anteriores a la migración?
- **Cómo se comprobaría:** offline-review-api.test.ts pasa igual; ninguna regla de negocio usa auditLog.findFirst con action offline_sale_*; borrar filas de AuditLog en una base de prueba no reabre una venta descartada.

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

## Seguridad (18)

Quién puede hacer qué, qué queda registrado y qué pasa si algo o alguien falla.

### SEG-01 ★ · Segundo factor para gerencia y administración al entrar desde un equipo nuevo

**Versión:** ambas · **Lo nota:** dueña, gerente · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** El inicio de sesión solo comprueba la contraseña. Si la cuenta tiene sale:manage o *, el equipo nuevo desde el que entra queda aprobado solo al registrarse. Lo único que ocurre es un aviso de «entrada desde un equipo no aprobado». No existe ningún segundo factor en el código.
- **Evidencia:** `apps/api/src/auth.ts:457`, `apps/api/src/auth.ts:503`, `apps/api/src/realtime.ts:170`, `apps/api/src/realtime.ts:216`
- **Propuesta:** Para cuentas con sale:manage o *: pedir un código de app autenticadora (TOTP, con códigos de respaldo impresos) cuando el inicio de sesión no viene de un equipo ya aprobado, y no aprobar el equipo nuevo hasta pasarlo. En los equipos aprobados de la tienda no se pide nada más.
- **Beneficio:** Una contraseña de dueña o gerente robada o adivinada deja de bastar para entrar y aprobar un equipo propio. Las cajeras no notan ningún cambio.
- **Riesgo:** Si la dueña pierde el celular y los códigos de respaldo se queda fuera; hace falta un camino de recuperación seguro. Los agentes que entran con cuenta de administrador también lo necesitarían.
- **Pregunta para ti:** ¿TOTP, aprobación desde un equipo ya aprobado, o código por Telegram/WhatsApp? ¿Se exige a sale:manage o solo a *? ¿Cómo se recupera la dueña sin soporte técnico y sin abrir un hueco?
- **Cómo se comprobaría:** Prueba: admin con contraseña correcta desde equipo sin aprobar recibe «falta el código» y el equipo queda pendiente; con código entra. Desde equipo aprobado entra como hoy.

### SEG-02 ★ · Adjuntar la foto del comprobante de transferencia en el momento del cobro

**Versión:** ambas · **Lo nota:** cajera, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En el cobro, la transferencia solo pide «Cuenta donde cayó» y «Referencia», escritas a mano. La foto de evidencia (`ProofPicker`) solo aparece en el cobro de créditos (`CodCollect`). En la tienda, la API solo acepta foto en pagos de tipo abono (`entryType: "installment"`) y la guarda como imagen dentro de la base de datos (hasta 2 MB). En producto-nexora la API ya acepta foto en transferencias pendientes de verificar, la guarda en almacenamiento de archivos y «Conciliar transferencias» permite subirla después; pero el cobro de la venta tampoco la pide en el momento.
- **Evidencia:** `apps/web/src/POS.tsx:2853`, `apps/api/src/sales.ts:4189`, `apps/api/src/sales.ts:121`, `apps/web/src/Tienda.tsx:1211`, `producto-nexora:apps/api/src/sales.ts:3743`, `producto-nexora:apps/web/src/TransferReconciliation.tsx:196`
- **Propuesta:** Tienda: traer de producto-nexora el cambio de `proofPayment` (aceptar transferencias `pending_verification`) y el almacenamiento de archivos para las fotos. Ambas: mostrar `ProofPicker` en `Checkout` (POS.tsx) al elegir «Transferencia» y subir la foto después de registrar la venta, como ya hace `CodCollect`; mostrarla en Ventas y en «Conciliar transferencias».
- **Beneficio:** La dueña verifica contra el banco viendo el comprobante; la cajera queda respaldada si escribió mal la referencia.
- **Riesgo:** En la tienda las fotos (hasta 2 MB) van dentro de la base de datos: ampliar su uso sin traer antes el almacenamiento de archivos de producto-nexora la hace crecer. Sin conexión no se puede subir. Si es obligatoria, es un paso más en el cobro.
- **Pregunta para ti:** ¿Foto obligatoria u opcional en las transferencias de venta? ¿Conviene traer primero a la tienda el almacenamiento de archivos de producto-nexora antes de ampliar el uso de fotos?
- **Cómo se comprobaría:** Cobrar con transferencia adjuntando foto: la venta se registra, la miniatura sale en el detalle de la venta y en la conciliación; si la subida falla, la venta queda y se avisa.

### SEG-03 · Aviso cuando alguien cambia un precio de venta (y cuando lo devuelve)

**Versión:** ambas · **Lo nota:** dueña, gerente · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** PATCH /variants/:id guarda en la bitácora la acción «price_change» para cualquier edición de la variante, cambie o no el precio. Solo crea una alerta cuando cambia el costo (cost_change). Un cambio del precio de venta no genera ningún aviso.
- **Evidencia:** `apps/api/src/catalog.ts:523`, `apps/api/src/catalog.ts:540`, `apps/api/src/catalog.ts:568`
- **Propuesta:** Cuando price cambie de verdad: registrar precio anterior y nuevo en una acción propia (las demás ediciones pasan a «update») y crear una alerta con quién, cuánto y las ventas hechas con ese precio. Marcar como alta el patrón «bajó y volvió al valor anterior en el mismo día».
- **Beneficio:** Hace visible el incumplimiento de la regla de la dueña «no cambiar precios por una oferta» y el truco de bajar un precio, vender y volver a subirlo.
- **Riesgo:** Una carga de precios legítima (lista nueva del proveedor) puede llenar la campana de avisos; hay que agruparlos por persona y día. No cambia ningún precio ni cálculo.
- **Pregunta para ti:** ¿Cómo distinguir un ajuste de lista legítimo de un cambio sospechoso sin inundar de avisos: por tamaño del cambio, por ventas dentro de una ventana, por quién lo hace? ¿La importación masiva debe avisar igual?
- **Cómo se comprobaría:** Prueba: cambiar solo el código de barras no crea alerta; bajar el precio crea una con antes/después; bajar, vender y restaurar el mismo día crea la alerta alta con la factura.

### SEG-04 · Cuentas de agentes y de soporte marcadas como tales, sin poder de PIN

**Versión:** ambas · **Lo nota:** dueña, soporte · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** El agente entra con un usuario normal de rol administrador (lectura y escritura) cuya contraseña vive en el entorno o en un archivo local. User no tiene ningún campo que distinga a una persona de un agente, y toda cuenta activa con sale:manage o * cuenta como aprobadora por PIN.
- **Evidencia:** `docs/coordinacion/claude-nube/LEEME_CLAUDE_NUBE.md:16`, `docs/coordinacion/claude-nube/entrar.py:23`, `apps/api/prisma/schema.prisma:18`, `apps/api/src/security.ts:103`
- **Propuesta:** Añadir a User un tipo «agente/soporte»: esas cuentas quedan fuera de managerPinApproval y del cambio de usuario con PIN, no pueden crear usuarios ni cambiar roles, y cada fila suya en la bitácora lleva la marca «agente» para poder filtrar y resumir a la dueña lo que escribieron cada día.
- **Beneficio:** La dueña distingue de un vistazo lo que hizo una persona de lo que hizo un agente, y una credencial de agente filtrada no sirve para aprobar con PIN ni para crearse otro usuario.
- **Riesgo:** Los agentes hoy hacen tareas reales con esa cuenta (mercancía, correcciones): hay que listar qué rutas necesitan antes de recortar, o se quedan a medias en plena operación.
- **Pregunta para ti:** La orden 107 ya prevé un rol de solo lectura. Para las tareas de escritura del agente, ¿es mejor este tipo de cuenta con contraseña, o llaves de servicio con vencimiento y permisos propios, revocables desde Configuración?
- **Cómo se comprobaría:** Prueba: el PIN de una cuenta tipo agente no aprueba un descuento (cuenta como fallo); POST /users con esa cuenta da 403; la bitácora filtra por «agente».

### SEG-05 · PIN de gerente: rechazar los fáciles y los repetidos entre personas

**Versión:** ambas · **Lo nota:** gerente, dueña · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** El PIN nuevo de un usuario (newPinSchema, admin.ts:212) solo exige 6 dígitos: 123456 o 000000 pasan, y no se compara con el de otras personas. La contraseña de cajera sí rechaza secuencias y repetidos (isNonTrivialCashierPassword). La aprobación identifica al gerente solo por el PIN, y managerPinApproval prevé que dos gerentes tengan el mismo. En producto-nexora el PIN de la dueña al registrar el negocio ya pasa por isNonTrivialCashierPassword, pero el de los usuarios creados o editados después no.
- **Evidencia:** `apps/api/src/admin.ts:212`, `apps/api/src/admin.ts:1075`, `apps/api/src/admin.ts:1135`, `apps/api/src/password-policy.ts:32`, `apps/api/src/security.ts:113`, `producto-nexora:apps/api/src/registration.ts:18`
- **Propuesta:** Al crear o cambiar un PIN, pasar el valor por isNonTrivialCashierPassword (ya existe) y compararlo con el pinHash de los demás usuarios activos de la sucursal: si coincide con otro, o con la contraseña de 6 dígitos de la misma cajera, se rechaza con un mensaje que no diga de quién es.
- **Beneficio:** Una aprobación con PIN siempre señala a una sola persona, y adivinar un PIN en pocos intentos deja de ser posible con los valores típicos.
- **Riesgo:** Rechazar un PIN «porque ya está en uso» le revela a la administradora que alguien más lo tiene. Los PIN flojos ya guardados siguen valiendo hasta que se cambien.
- **Pregunta para ti:** ¿Es aceptable ese aviso de «PIN en uso» (solo lo ve la administración) o es mejor que la caja pida elegir primero al gerente que aprueba, para que el PIN no identifique por sí solo? ¿Se obliga a cambiar los PIN flojos existentes?
- **Cómo se comprobaría:** Pruebas: 123456, 111111 y un PIN igual al de otro usuario activo dan 400; un PIN válido y único se guarda. Con dos gerentes, cada aprobación queda a nombre del correcto.

### SEG-06 · Botón «Comprobar existencias»: la verificación triple dentro del sistema

**Versión:** ambas · **Lo nota:** dueña y soporte · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La orden de verificar cada cambio de mercancía por 3 o 4 caminos la cumple un programa externo (mercancia.py) que compara existencia, reporte de almacenes, último saldo del kardex y suma de movimientos. El kardex que entrega el servidor trae como máximo 200 movimientos, y el programa omite la suma si hay más.
- **Evidencia:** `docs/coordinacion/claude-nube/mercancia.py:52`, `docs/coordinacion/claude-nube/mercancia.py:64`, `.claude/skills/mercancia/SKILL.md:22`, `apps/api/src/inventory.ts:667`
- **Propuesta:** Agregar una ruta de solo lectura que, para todos los productos y cada almacén, compare en la base la existencia guardada, el último saldo del kardex y la suma de sus movimientos, y un botón en Inventario que liste solo los que no coinciden, con sus tres cifras.
- **Beneficio:** La dueña comprueba todo el inventario con un botón, sin agente ni costo por uso, y un descuadre se ve el mismo día en vez de en el próximo conteo.
- **Riesgo:** Si hay descuadres viejos legítimos (cargas iniciales, productos con lote), la primera lista puede ser larga y alarmar. Con muchos movimientos la consulta puede ser pesada.
- **Pregunta para ti:** ¿La suma de movimientos del kardex debe ser igual a la existencia en todos los casos (inventario inicial, lotes, almacén Casa) o hay casos correctos donde no? ¿Debe correr sola cada noche y crear una alerta, o solo al pulsar el botón?
- **Cómo se comprobaría:** Prueba: con datos sanos la lista sale vacía; al alterar a mano la existencia de un producto en una base de prueba, aparece solo ese producto con sus tres cifras.

### SEG-07 · Clave de operación en ajustes de inventario y órdenes de compra: un reintento no duplica

**Versión:** ambas · **Lo nota:** gerente · **Esfuerzo:** pequeño · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** POST /inventory/adjustments (ajuste, merma, devolución a proveedor) y POST /purchase-orders no aceptan clave de operación: repetir el envío crea otro movimiento u otra orden. Otras rutas sí la tienen, cada una a su modo: ayudante idempotent en admin.ts, tabla propia en cobros y en Mercancía, y búsqueda en AuditLog por JSON en sales.ts.
- **Evidencia:** `apps/api/src/inventory.ts:672`, `apps/api/src/inventory.ts:1001`, `apps/api/src/admin.ts:219`, `apps/api/src/sales.ts:2405`, `apps/api/prisma/schema.prisma:874`
- **Propuesta:** Agregar operationId (uuid, opcional como fija la decisión 25) al cuerpo de ambas rutas y una columna única que admita nulos en InventoryMovement y PurchaseOrder; reutilizar el ayudante idempotent de admin.ts movido a common.ts. La web genera la clave al abrir el formulario, como ya hace en CreditAccounts.tsx y Tienda.tsx.
- **Beneficio:** Gerente y almacén: un doble clic o una respuesta perdida no descuenta la merma dos veces ni crea dos órdenes; el inventario valorizado no se descuadra.
- **Riesgo:** Cambia rutas que mueven existencias y agrega columnas a tablas calientes (InventoryMovement); las pruebas y clientes que llaman sin clave deben seguir funcionando.
- **Pregunta para ti:** La decisión 25 dejó la clave opcional por compatibilidad con una web vieja: ¿mantenerlo aquí? ¿Conviene una sola tabla de operaciones (como MerchandiseOperation: id, huella, resultado) para todas las rutas en vez de una columna por modelo?
- **Cómo se comprobaría:** Prueba de integración: dos POST iguales con la misma clave dejan un solo InventoryMovement y devuelven la misma respuesta; misma clave con otros datos responde 400.

### SEG-08 · Avisar y sincronizar antes de cerrar sesión con ventas sin enviar

**Versión:** ambas · **Lo nota:** cajera, gerente, dueña · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** «Cerrar sesión» llama endSession() sin mirar la cola; el cambio con PIN solo la revisa si se pasa a una cuenta GV. syncSales envía únicamente las ventas del usuario con sesión, y la API rechaza una venta sin conexión con más de 48 horas, salvo que gerencia la registre desde la revisión. La venta de quien se fue espera a que vuelva a entrar en ese equipo.
- **Evidencia:** `apps/web/src/App.tsx:1229`, `apps/web/src/App.tsx:1356`, `apps/web/src/api.ts:551`, `apps/api/src/sales.ts:866`
- **Propuesta:** Antes de cerrar sesión o cambiar de usuario, contar las ventas pendientes de esa persona: con conexión, sincronizarlas primero; si quedan, mostrar cuántas son, que solo ella puede enviarlas desde este equipo y la hora límite de las 48 horas, y pedir confirmación.
- **Beneficio:** Evita que una venta cobrada el sábado quede sin registrar hasta el lunes y termine como conflicto que gerencia debe resolver; gerencia sabe quién debe volver a entrar.
- **Riesgo:** Es un aviso más al salir; sin conexión no se puede resolver en el momento y la cajera puede confirmar sin leer.
- **Pregunta para ti:** ¿Conviene que gerencia pueda enviar desde su sesión las ventas pendientes de otra persona conservando quién cobró? Hoy la API exige que la caja sea de quien envía (cada usuario vende solo en su caja, DECISIONES punto 39) y gerencia solo resuelve las que ya están en conflicto.
- **Cómo se comprobaría:** Prueba e2e: con una venta LOCAL- pendiente, «Cerrar sesión» en línea la sincroniza antes de salir; sin conexión muestra el aviso con la cantidad y la hora límite.

### SEG-09 · Pedir almacenamiento persistente para la cola de ventas sin conexión

**Versión:** ambas · **Lo nota:** cajera, dueña, soporte · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** Las ventas cobradas sin conexión viven solo en IndexedDB (Dexie, tabla sales) hasta sincronizar; el propio código dice que son «la única copia». En apps/web no se llama navigator.storage.persist() ni estimate(): el almacenamiento queda como lo trate cada navegador por defecto. La ayuda solo pide «no borres sus datos».
- **Evidencia:** `apps/web/src/api.ts:63`, `apps/web/src/api.ts:290`, `apps/web/src/App.tsx:1318`
- **Propuesta:** Al registrar el equipo (registerTerminal) pedir navigator.storage.persist() y mostrar en Configuración › Equipos si quedó con almacenamiento persistente y cuánto espacio le queda; si el navegador lo niega, avisar antes de permitir vender sin conexión en ese equipo.
- **Beneficio:** Menos riesgo de perder ventas ya cobradas si el equipo se queda sin espacio o el navegador limpia datos; soporte ve qué equipos no son seguros para vender sin internet.
- **Riesgo:** Cada navegador decide por su cuenta si lo concede (cómo responden Chrome, Firefox y Safari: por confirmar) y no protege contra «borrar datos del sitio» hecho a mano.
- **Pregunta para ti:** ¿Cómo responden hoy Chrome Android, Safari iOS y Edge a persist() en una PWA instalada frente a una pestaña? ¿Aplica en Safari algún borrado por falta de uso a esta cola? (todo por confirmar con documentación vigente)
- **Cómo se comprobaría:** Configuración › Equipos muestra «almacenamiento persistente: sí/no» por equipo; navigator.storage.persisted() devuelve true en las cajas de la tienda.

### SEG-10 · Bitácora con sello diario para detectar filas cambiadas o borradas

**Versión:** ambas · **Lo nota:** dueña, comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** AuditLog no tiene número de secuencia ni hash, y ninguna migración la protege con disparadores. La propia API reescribe filas al anonimizar un cliente y borra las de inicio de sesión y PIN a los 400 días. GET /audit-log solo devuelve las últimas 300. No hay con qué detectar una fila cambiada o borrada en la base.
- **Evidencia:** `apps/api/prisma/schema.prisma:792`, `apps/api/src/admin.ts:393`, `apps/api/src/retention.ts:178`, `apps/api/src/retention.ts:48`, `apps/api/src/admin.ts:1331`
- **Propuesta:** Tarea nocturna que calcule un SHA-256 de las filas del día (campos que nunca cambian: id, fecha, usuario, acción, entidad), encadenado con el sello del día anterior, lo guarde en una tabla y lo envíe fuera (respaldo y resumen a la dueña). Un botón «Verificar bitácora» recalcula y compara.
- **Beneficio:** La dueña y el comprador pueden probar que nadie (ni soporte, ni un agente, ni quien tenga la base) quitó o cambió un registro de dinero.
- **Riesgo:** La anonimización y la purga legítimas cambian filas: el sello debe cubrir solo campos fijos o registrar esas excepciones, o dará falsas alarmas. Un día sin sellar queda sin protección.
- **Pregunta para ti:** ¿Basta un sello diario o conviene encadenar cada fila al insertarla (más fuerte, pero serializa las ventas)? ¿Qué campos entran al sello si before/after se redactan por la Ley 172-13 y la IP se borra a los 90 días?
- **Cómo se comprobaría:** Prueba con Postgres: sellar un día, cambiar o borrar una fila de AuditLog por SQL y ver que «Verificar bitácora» señala ese día; anonimizar un cliente no dispara la alarma.

### SEG-11 · La cabecera que bloquea el micrófono choca con la búsqueda por voz

**Versión:** tienda · **Lo nota:** cajera, vendedora · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La web se sirve con Permissions-Policy «microphone=()» en Render y en el instalador. El Punto de venta de la tienda ya trae búsqueda por voz con SpeechRecognition y, si el navegador responde «not-allowed», muestra «Sin permiso de micrófono: dalo en el navegador e intenta otra vez», cosa que la cajera no puede arreglar. En producto-nexora la cabecera es la misma pero el POS no tiene búsqueda por voz.
- **Evidencia:** `deploy/render/security-headers.conf:7`, `instalador/runtime/web-server.mjs:61`, `apps/web/src/POS.tsx:864`, `apps/web/src/POS.tsx:895`
- **Propuesta:** Confirmar en Chrome, Edge y Safari si microphone=() impide SpeechRecognition (por confirmar). Si lo impide, cambiar a microphone=(self) en las dos cabeceras y añadir una prueba que falle si la cabecera prohíbe una función que el código de la web usa. Lo mismo afectaría al micrófono del asistente ya decidido (D3 y C7 del levantamiento del 12-nov).
- **Beneficio:** La búsqueda por voz ya programada funciona al desplegarse, en vez de fallar con un mensaje que manda a la cajera a cambiar un permiso que no puede conceder.
- **Riesgo:** Abrir el micrófono al propio sitio amplía un poco lo que un script inyectado podría pedir; el navegador sigue preguntando al usuario la primera vez.
- **Pregunta para ti:** ¿Permissions-Policy microphone=() bloquea webkitSpeechRecognition en Chrome/Edge de escritorio, Chrome de Android y Safari de iOS? ¿Hay otra directiva que afecte al reconocimiento de voz en el navegador?
- **Cómo se comprobaría:** Prueba e2e con la cabecera real: el botón de micrófono llega a «escuchando» sin error not-allowed. Prueba estática: toda función usada por la web aparece permitida en la cabecera.

### SEG-12 · Revisión automática de dependencias con fallos conocidos en cada cambio

**Versión:** ambas · **Lo nota:** desarrollo, soporte · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** Dependabot solo vigila las acciones de GitHub, no los paquetes npm, en las dos ramas. Ni «pnpm check», ni scripts/verify.mjs, ni el CI ejecutan una auditoría de dependencias; hoy depende de la regla manual de INSTRUCCIONES_ACTUALES («pnpm audit sin altas/críticas») y de la tarea 27 de la cola de Claude PC, que sigue PENDIENTE. La auditoría del 30-oct encontró 3 avisos altos y 1 moderado; en la tienda se corrigieron body-parser, multer y qs con overrides y quedó zod 3 pendiente. En producto-nexora esos overrides no están en pnpm-workspace.yaml.
- **Evidencia:** `.github/dependabot.yml:5`, `package.json:16`, `.github/workflows/ci.yml:77`, `docs/auditoria/SEGURIDAD_20_PUNTOS.md:44`, `pnpm-workspace.yaml:10`, `producto-nexora:pnpm-workspace.yaml:6`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:433`, `docs/coordinacion/COLA_PERMANENTE_CLAUDE_PC.md:39`
- **Propuesta:** Añadir a .github/dependabot.yml el ecosistema npm (solo actualizaciones de seguridad, agrupadas) y un paso del CI con «pnpm audit --prod --audit-level high» y una lista de excepciones con fecha (hoy, zod), para que un aviso alto nuevo se vea el mismo día. En producto-nexora, antes de activar el paso, llevar los overrides de body-parser, multer y qs.
- **Beneficio:** Un fallo conocido en una librería del servidor se detecta sin depender de que alguien se acuerde de correr la auditoría a mano.
- **Riesgo:** Un aviso nuevo en una dependencia indirecta puede poner el CI en rojo y frenar un despliegue urgente hasta anotar la excepción. Más PR automáticos que revisar.
- **Pregunta para ti:** ¿El paso debe bloquear el despliegue o solo avisar? ¿Cómo se lleva la excepción de zod 3 hasta migrar a zod 4 sin que tape avisos nuevos del mismo paquete? ¿El instalador de Windows necesita su propia revisión?
- **Cómo se comprobaría:** El CI muestra el paso de auditoría en verde con la excepción de zod; al fijar a propósito una versión vulnerable en una rama de prueba, el paso se pone en rojo.

### SEG-13 · Copia de seguridad fuera de la laptop para el cliente instalado, sin técnico

**Versión:** producto · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El respaldo del instalador queda en la misma laptop y su registro dice «No se ha verificado una copia fuera de este equipo». La API ya tiene respaldo cifrado a Google Drive, pero solo se activa con variables de entorno que el instalador no escribe (su .env lleva 6 líneas).
- **Evidencia:** `instalador/scripts/Backup-FitStore.ps1:94`, `instalador/scripts/Install-FitStore.ps1:176`, `apps/api/src/drive-backup.ts:98`, `docs/venta/HOJA_DE_PRECIOS.md:20`, `producto-nexora:instalador/installer/FitStore.nsi:257`
- **Propuesta:** Que el instalador genere BACKUP_ENCRYPTION_KEY, apunte PG_DUMP_BIN a su pg_dump y deje lista la pantalla de respaldo para que el dueño conecte su destino con un botón. Aviso en Resumen si pasan 48 h sin copia externa. La frase de cifrado se entrega impresa al instalar.
- **Beneficio:** Comprador: si roban o se daña la laptop no pierde su negocio. Dueña: menos riesgo de reclamo por pérdida de datos de un cliente.
- **Riesgo:** Un cliente de Google OAuth compartido dentro del instalador expone su secreto, y Google puede exigir verificar la app. Si el cliente pierde la frase, la copia no se abre.
- **Pregunta para ti:** ¿Qué destino externo es más realista para una tienda sin técnico: Google Drive con OAuth, una carpeta que el dueño elige (USB o OneDrive) con copia cifrada, o almacenamiento de Norexos incluido en la renovación anual?
- **Cómo se comprobaría:** En una PC de prueba: conectar el destino, forzar un respaldo, borrar la base y restaurar desde la copia externa; el aviso de 48 h aparece al desconectar el destino.

### SEG-14 · Respaldo local del instalador cifrado con una frase del comprador

**Versión:** ambas · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El respaldo diario del instalador es un pg_dump sin cifrar, legible por SYSTEM, administradores y la cuenta de Windows registrada como lectora de respaldos. Por defecto queda en la carpeta Backups de la propia PC, pero la carpeta destino se puede cambiar (-Destino / backupPath) y el propio código prevé que OneDrive la lea. Lleva la base entera, con los hashes de contraseñas y de PIN (4 a 6 dígitos). El respaldo a Drive de la API sí se cifra con AES-256-GCM (formato NXBK).
- **Evidencia:** `instalador/scripts/Backup-FitStore.ps1:14`, `instalador/scripts/Backup-FitStore.ps1:49`, `instalador/scripts/Backup-FitStore.ps1:94`, `instalador/scripts/FitStore.Common.ps1:274`, `instalador/scripts/FitStore.Common.ps1:295`, `apps/api/src/auth.ts:834`, `apps/api/src/drive-backup-core.ts:23`
- **Propuesta:** Cifrar el .dump local con el mismo formato NXBK que ya usa el respaldo a Drive (createEncryptStream de drive-backup-core.ts), con una frase que el comprador define al instalar y anota en papel. Restore-FitStore.ps1 la pide. Así la copia puede ir a USB, a una carpeta de OneDrive o a otro disco sin exponer la base.
- **Beneficio:** El comprador puede sacar su copia fuera de la PC (o ya la manda a una carpeta sincronizada) sin que quien encuentre la USB o entre a su OneDrive lea clientes, ventas y hashes de claves.
- **Riesgo:** Si el comprador pierde la frase, sus respaldos no sirven. Hay que obligarlo a probar una restauración al instalar y dejarle la frase impresa. Test-BackupArchive (pg_restore --list) tendría que validar después de descifrar.
- **Pregunta para ti:** ¿Frase elegida por el comprador, clave atada a la PC con DPAPI (inútil si la PC muere) o las dos? ¿Cómo se hace que una tienda pequeña no pierda la frase sin que soporte la guarde?
- **Cómo se comprobaría:** Prueba en Windows: el archivo de respaldo no se abre con pg_restore --list; con la frase correcta restaura y cuadra; con una frase mala falla con mensaje claro.

### SEG-15 · Instalación en Windows: que la API solo escuche en la propia PC

**Versión:** ambas · **Lo nota:** comprador del producto, soporte · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** En la tienda la API escucha en 0.0.0.0 si no se define API_HOST, y el .env que escribe el instalador (Write-EnvironmentFile) no la define; en producto-nexora main.ts ni siquiera lee API_HOST: escucha siempre en 0.0.0.0. En la PC del cliente queda escuchando en todas las interfaces y lo único que impide alcanzarla desde la red es la regla de firewall «FitStore POS - Bloquear API directa» (puerto 3001). El servidor web local ya llama a la API por 127.0.0.1.
- **Evidencia:** `apps/api/src/main.ts:86`, `producto-nexora:apps/api/src/main.ts:88`, `instalador/scripts/Install-FitStore.ps1:172`, `instalador/scripts/Install-FitStore.ps1:180`, `instalador/scripts/Configure-Network.ps1:171`, `instalador/runtime/web-server.mjs:67`
- **Propuesta:** Que Write-EnvironmentFile añada API_HOST=127.0.0.1 y TRUSTED_PROXIES=loopback al .env local (TRUSTED_PROXIES ya acepta la sintaxis de Express, apps/api/src/rate-limit.ts:145). En producto-nexora, además, hacer que main.ts lea API_HOST como ya hace la tienda. La regla de firewall se conserva como segunda barrera y se corrige el comentario de main.ts que dice que el instalador necesita 0.0.0.0.
- **Beneficio:** Si el cliente apaga el firewall o lo sustituye un antivirus, la API sin HTTPS sigue sin poder alcanzarse desde otro equipo de su red.
- **Riesgo:** Una actualización reescribe el .env de instalaciones existentes: si algún script o servicio llegara a la API por otra dirección que no sea 127.0.0.1 dejaría de funcionar.
- **Pregunta para ti:** ¿Hay algún caso real en Windows (IPv6 ::1, cuenta de servicio con SID restringido, reinicio de red) en que escuchar solo en 127.0.0.1 rompa el proxy local o la tarea de respaldo?
- **Cómo se comprobaría:** En la prueba de humo de Windows: con el firewall apagado, conectar al puerto 3001 por la IP de la red falla, y https://<ip>:4173/api/health responde.

### SEG-16 · Certificado raíz del instalador limitado a la tienda y con la clave protegida

**Versión:** ambas · **Lo nota:** comprador del producto, soporte · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El instalador crea una autoridad certificadora propia válida 10 años, con clave exportable, pathlength=1 y sin restricción de nombres. Exporta FitStore-CA.pfx (protegido con una contraseña que se guarda en secrets.json, en la misma carpeta de datos, y con permisos de archivo restringidos), la instala como raíz de confianza de Windows y copia el .cer al escritorio para instalarlo en cada celular. Igual en tienda y en producto-nexora.
- **Evidencia:** `instalador/scripts/Configure-Network.ps1:50`, `instalador/scripts/Configure-Network.ps1:58`, `instalador/scripts/Configure-Network.ps1:60`, `instalador/scripts/Configure-Network.ps1:63`, `instalador/scripts/FitStore.Common.ps1:38`, `instalador/scripts/Install-FitStore.ps1:277`
- **Propuesta:** En New-FitStoreCa (Configure-Network.ps1), emitir la CA con pathlength=0 y con Name Constraints que solo permitan los nombres del equipo y rangos de IP privadas, y guardar su clave como no exportable en el almacén de certificados de Windows en lugar de exportar un .pfx cuya contraseña vive en la misma carpeta de datos.
- **Beneficio:** Si alguien copia la carpeta de datos de esa PC (que trae el .pfx y secrets.json juntos), no obtiene una llave capaz de hacerse pasar por el banco o el correo ante los celulares y la PC del cliente.
- **Riesgo:** Sin .pfx, restaurar en otra PC obliga a crear una CA nueva y reinstalar el certificado en cada celular. La clave de la CA se sigue necesitando para reemitir el certificado del servidor (cada 24 meses o si cambia la IP), así que debe quedar usable en el almacén local. Algún sistema viejo puede no aplicar restricciones por IP.
- **Pregunta para ti:** ¿iOS y Android actuales respetan Name Constraints con rangos de IP en una raíz instalada a mano? ¿New-SelfSignedCertificate permite esa extensión? ¿Clave no exportable, o borrar la clave y renovar la CA cada vez?
- **Cómo se comprobaría:** Prueba en Windows: el certificado raíz muestra pathlength=0 y Name Constraints; un certificado para otro dominio firmado con esa CA es rechazado por el navegador; no existe FitStore-CA.pfx y la reemisión del certificado del servidor sigue funcionando.

### SEG-17 · IA en la versión instalada sin dejar la clave del proveedor en la laptop del cliente

**Versión:** producto · **Lo nota:** dueña · **Esfuerzo:** grande · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** La IA (preguntas y lectura de facturas) llama al proveedor directo desde la API con ANTHROPIC_API_KEY. En la versión instalada esa clave vive en el .env de la laptop del cliente: el instalador solo conserva la que ya exista y no escribe IA_VENTAS_PLAN ni ASSISTANT_MODEL.
- **Evidencia:** `instalador/scripts/Install-FitStore.ps1:174`, `apps/api/src/assistant.ts:681`, `apps/api/src/invoice.ts:374`, `docs/venta/HOJA_DE_PRECIOS.md:9`
- **Propuesta:** Un servicio pequeño de Norexos («pasarela de IA») que guarda la clave, recibe las llamadas de cada instalación identificada por su plan, aplica el cupo mensual y mide el costo. La API instalada apunta a la pasarela con una variable; la clave del proveedor nunca sale de Norexos.
- **Beneficio:** Dueña: su clave y su factura de IA no quedan en manos de cada cliente y puede cortar a quien no paga. Comprador: activa la IA sin tocar archivos.
- **Riesgo:** Servicio nuevo que hay que mantener en línea y proteger. Los datos de ventas del cliente pasarían por Norexos: contrato y privacidad deben decirlo. Sin internet no hay IA.
- **Pregunta para ti:** ¿Pasarela propia o que cada cliente ponga su propia clave del proveedor (sin margen para Norexos, pero sin servicio que mantener)? Si es pasarela, ¿cómo autenticar cada instalación y evitar que la usen como acceso gratis a la IA?
- **Cómo se comprobaría:** En una instalación de prueba el .env no tiene clave del proveedor, la pregunta a la IA responde, el medidor de Norexos registra tokens por cliente y al pasar el cupo responde «límite alcanzado».

### SEG-18 · Versión del contrato de la venta sin conexión y huella con lista fija de campos

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** La huella que evita duplicar una venta (requestHash) es el SHA-256 del cuerpo completo ya validado, sin el PIN. Por eso saleSchema repite en comentarios que un campo nuevo va «sin valor por defecto: la huella offline no cambia», y complete() ya compara dos huellas por un caso heredado. La venta en cola no lleva versión.
- **Evidencia:** `apps/api/src/sales.ts:754`, `packages/shared/src/index.ts:582`, `apps/api/src/sales.ts:780`, `apps/web/src/POS.tsx:2369`
- **Propuesta:** Calcular la huella con una función de packages/shared sobre una lista fija de campos (cliente, caja, líneas, descuentos y pagos: método y monto) y guardar su versión con la venta; la cola envía contractVersion. El servidor acepta la huella vieja y la nueva mientras dure la transición.
- **Beneficio:** Cajera: reintentar tras una actualización una venta ya registrada (respuesta perdida) no se rechaza con «el UUID ya corresponde a otra venta». Desarrollo: agregar un campo deja de ser riesgoso.
- **Riesgo:** Toca la protección contra ventas duplicadas: si la huella nueva ignora un campo que distingue dos cobros, un reintento distinto se aceptaría como igual. Exige pruebas con ventas ya guardadas.
- **Pregunta para ti:** ¿Qué campos deben entrar en la huella para que dos cobros distintos nunca coincidan (¿referencia de transferencia, notas, envío?) y cuánto tiempo hay que aceptar la huella vieja, dado el plazo de 48 h de las ventas sin conexión?
- **Cómo se comprobaría:** Prueba: agregar al esquema un campo con valor por defecto no cambia la huella de una venta ya guardada; reenviarla devuelve la misma factura y otra distinta con el mismo UUID se rechaza.

## Eficiencia (12)

Tiempo de respuesta, carga sobre la base y tiempo que tarda en comprobarse un cambio.

### EFI-01 ★ · Después de cada venta la caja vuelve a bajar el catálogo y los clientes completos

**Versión:** ambas · **Lo nota:** cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** Al terminar una venta, POS.tsx llama a invalidateQueries() sin filtro y lo espera (await). Eso vuelve a pedir todo lo abierto en la caja: el catálogo entero en páginas de 200 con lotes (y lo reescribe en IndexedDB), clientes, categorías, promociones, ajustes y caja. El stock ya llega aparte por stock.changed.
- **Evidencia:** `apps/web/src/POS.tsx:2347`, `apps/web/src/api.ts:414`, `apps/web/src/api.ts:475`, `apps/web/src/realtime.tsx:192`
- **Propuesta:** Tras cobrar, invalidar solo lo que la venta cambia (caja, ventas, deuda del cliente, tablero) y sin esperar la recarga. El catálogo no se vuelve a bajar: el stock ya se corrige con el aviso stock.changed; se recarga entero solo al reconectar o cuando el servidor avisa que cambió un precio.
- **Beneficio:** Cajera: la caja queda lista para la siguiente venta sin esperar descargas. Servidor: cada venta deja de disparar la descarga completa del catálogo en esa caja.
- **Riesgo:** Si el aviso en vivo se cae, la pantalla puede mostrar stock o precio viejo un rato. El servidor igual valida al cobrar y ya existe el recálculo de precios.
- **Pregunta para ti:** ¿Qué consultas debe refrescar la caja tras una venta para no mostrar datos viejos (caja, crédito del cliente, promociones con cupo) y cuáles sobran? ¿Hay algún caso en que el catálogo completo sí deba recargarse tras cobrar?
- **Cómo se comprobaría:** Con 2.000 productos, contar las peticiones GET /api/products por venta (hoy 10, meta 0) y el tiempo desde la respuesta de POST /sales hasta que el botón de cobrar se libera.

### EFI-02 · El servidor pregunta a la base cada 150 ms aunque nadie esté vendiendo

**Versión:** ambas · **Lo nota:** dueña y comprador del producto · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** RealtimeHub usa setInterval de 150 ms mientras haya una pantalla conectada a /api/events; cada vuelta hace un findMany sobre RealtimeEvent: hasta 400 consultas por minuto, haya o no cambios. La auditoría de infraestructura del 10-oct lo anotó (M9) y sigue igual. En el PRODUCTO la base está en la PC del cliente.
- **Evidencia:** `apps/api/src/realtime.ts:75`, `apps/api/src/realtime.ts:120`, `docs/coordinacion/auditoria-2026-10-10/04-infraestructura-v2.md:34`
- **Propuesta:** Sondeo adaptable: 150 ms solo durante los 10 s siguientes a un evento y 1 s en reposo. Alternativa mayor: LISTEN/NOTIFY de PostgreSQL, con pg_notify en el disparador que ya inserta el evento, dejando el sondeo lento como respaldo.
- **Beneficio:** Dueña: menos carga fija sobre la base de 0,5 CPU. Comprador del producto: la PC de la tienda descansa cuando nadie vende.
- **Riesgo:** En reposo, el primer aviso de stock puede tardar hasta 1 s. LISTEN/NOTIFY exige una conexión fija fuera de Prisma y más pruebas.
- **Pregunta para ti:** ¿Sondeo adaptable (pocas líneas) o LISTEN/NOTIFY con una conexión dedicada? ¿Qué retraso máximo del aviso de stock entre dos cajas es aceptable para no ofrecer la misma última unidad?
- **Cómo se comprobaría:** Consultas por minuto con la tienda quieta (pg_stat_database o registro de Prisma): de unas 400 a menos de 70. Retraso del aviso entre dos cajas en la prueba stock-en-vivo: menos de 1,5 s.

### EFI-03 · Un empuje de solo documentos corre las tres pruebas completas y cancela la anterior

**Versión:** ambas · **Lo nota:** desarrollo · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** ci.yml corre en cada push y PR, sin filtro de rutas, los tres trabajos (verify, render-images, windows-installer) y cancela la corrida anterior de la rama; anota ~35 min por corrida. De los últimos 200 commits sin mezclas, 106 tocan solo docs/, archivos .md o .claude/ (git log -200 --no-merges).
- **Evidencia:** `.github/workflows/ci.yml:2`, `.github/workflows/ci.yml:15`, `.github/workflows/ci.yml:18`, `vitest.config.ts:11`
- **Propuesta:** Detectar al inicio qué cambió: si solo son documentos, correr únicamente las pruebas de documentos (docs-sistema, tildes, afirmaciones) y no cancelar una corrida de código en curso. Los tres nombres de trabajo se conservan para la regla de despliegue.
- **Beneficio:** Desarrollo: el código deja de hacer fila detrás de empujes de documentos. Se dejan de gastar minutos compilando instalador e imágenes sin cambios.
- **Riesgo:** Un verde «saltado» puede tapar que el último código nunca terminó de probarse; el despliegue debe exigir verde completo del último commit con código.
- **Pregunta para ti:** ¿Cómo garantizar que el commit que se despliega tiene las tres pruebas completas si los empujes de documentos se saltan trabajos: comparar contra el último SHA con verde completo, o llevar los documentos de coordinación a otra rama?
- **Cómo se comprobaría:** Un empuje de solo documentos termina en menos de 3 min y no cancela la corrida anterior; uno con código corre los tres trabajos. Minutos de Actions por semana, antes y después.

### EFI-04 · verify corre todo en fila: unidad, integración y 34 archivos de navegador uno por uno

**Versión:** ambas · **Lo nota:** desarrollo · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** verify hace en un solo trabajo: migrar, sembrar, respaldo, pnpm check (tipos, lint, pruebas, build), instalar Chromium sin caché y verify.mjs, que corre la integración con fileParallelism: false y después Playwright con workers: 1 sobre 34 archivos. Nada se reparte entre máquinas.
- **Evidencia:** `.github/workflows/ci.yml:77`, `scripts/verify.mjs:260`, `playwright.config.ts:17`, `vitest.integration.config.ts:55`
- **Propuesta:** Partir verify en trabajos paralelos, cada uno con su base: (1) tipos, lint, unidad y build; (2) integración de API; (3) navegador en 3 partes con --shard. Guardar en caché el Chromium de Playwright. Un trabajo final llamado verify resume el resultado.
- **Beneficio:** Desarrollo: la espera por empuje baja de unos 30 min a lo que tarde el trabajo más lento, sin quitar ninguna prueba.
- **Riesgo:** Se gastan más minutos de ejecutor en total (instalar y sembrar se repite) y pueden aparecer pruebas que dependían del orden o de datos de otra.
- **Pregunta para ti:** ¿Cuánto tarda hoy cada paso de verify? Según eso, ¿conviene partir en trabajos con --shard o basta subir los workers de Playwright dando a cada uno su propia base y API?
- **Cómo se comprobaría:** Duración total de la corrida en Actions, antes y después (meta: menos de 15 min), con el mismo número de pruebas ejecutadas en el informe de vitest y de Playwright.

### EFI-05 · El tablero lanza 18 consultas a la vez y se recalcula con cada línea vendida

**Versión:** ambas · **Lo nota:** dueña y gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** GET /dashboard/summary ejecuta 18 consultas en un Promise.all (más una previa de cajas abiertas para quien no ve el arqueo) sobre el mismo pool de 10 conexiones que usan las ventas. La web invalida «dashboard» en cada aviso stock.changed y además pide el año completo cada 60 s. No hay caché: cada tablero abierto lo recalcula todo desde las tablas de ventas. Igual en producto-nexora.
- **Evidencia:** `apps/api/src/reports.ts:358`, `apps/api/src/database-pool.ts:12`, `apps/web/src/realtime.tsx:215`, `apps/web/src/YearPie.tsx:43`
- **Propuesta:** Guardar en memoria la respuesta de summary, year y breakdown por sucursal, período y nivel de permiso, y reutilizarla mientras no haya escrituras, con el mismo contador «generation» que AlertCacheInterceptor ya sube en cada cambio.
- **Beneficio:** Dueña y gerente: tablero al instante. Cajeras: los reportes dejan de competir con el cobro por las mismas conexiones a la base.
- **Riesgo:** Una clave de caché mal separada podría mostrar ganancia o arqueo a quien no debe. Con más de una instancia de la API, la caché en memoria deja de ser fiable.
- **Pregunta para ti:** ¿Caché por «generación» en memoria (hoy hay una sola instancia) o reducir las 18 consultas a menos? ¿Cómo formar la clave para que nunca se cruce lo que ve la dueña con lo que ve quien no puede ver el arqueo?
- **Cómo se comprobaría:** Con el año de prueba (unas 110.000 ventas) y 3 tableros abiertos: consultas a la base por minuto y tiempo de POST /sales (el 5 % más lento) mientras tanto, antes y después.

### EFI-06 · La lista de clientes llega entera y suma todas las ventas de la historia en cada carga

**Versión:** ambas · **Lo nota:** cajera y gerente · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** GET /customers devuelve todos los clientes activos sin límite. Para quien ve datos personales (gerencia) agrupa además todas las ventas completadas de la sucursal por cliente (groupBy) y, por cada cliente, recorre ese resultado tres veces con find(); en producto-nexora son cuatro (añade la deuda). La caja sin ese permiso recibe la lista entera enmascarada y sin totales; la pide al abrir y la guarda en el equipo. Gestión (Management.tsx) también la pide.
- **Evidencia:** `apps/api/src/admin.ts:255`, `apps/api/src/admin.ts:262`, `apps/api/src/admin.ts:272`, `apps/web/src/POS.tsx:288`, `producto-nexora:apps/api/src/admin.ts:281`, `producto-nexora:apps/api/src/admin.ts:291`
- **Propuesta:** Dar a la caja una búsqueda de clientes en el servidor (q, límite) sin totales, y calcular gasto, compras y última compra solo en la pantalla Clientes, paginada, con un Map por customerId en vez de tres find() por fila.
- **Beneficio:** Cajera: elegir cliente no depende del tamaño de la lista. Gerente: Clientes abre igual de rápido con miles de clientes y años de ventas.
- **Riesgo:** La caja usa la lista guardada para vender sin conexión; con búsqueda en servidor hay que conservar una copia local reducida (nombre y límite de crédito).
- **Pregunta para ti:** ¿Cuántos clientes y ventas tiene hoy la tienda y a partir de qué tamaño se nota? Para vender sin conexión, ¿qué campos mínimos del cliente debe guardar la caja y cada cuánto refrescarlos?
- **Cómo se comprobaría:** Con 5.000 clientes y 100.000 ventas de prueba: tiempo y peso de GET /customers antes y después. La venta a crédito sin conexión sigue encontrando al cliente.

### EFI-07 · Cada petición hace cuatro lecturas seguidas a la base solo para comprobar la sesión

**Versión:** ambas · **Lo nota:** cajera, gerente y dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** AuthGuard, antes de atender cualquier ruta, lee uno tras otro: usuario con rol, ajustes de la sucursal (para el tiempo de sesión), la sesión y, si la sesión va ligada a un equipo, el equipo. Son 3 o 4 idas a la base por petición (más una escritura de actividad como mucho una vez por intervalo). La conexión de avisos en vivo repite 3 lecturas parecidas (sesión, usuario, ajustes) cada 15 s por pantalla abierta. Igual en producto-nexora.
- **Evidencia:** `apps/api/src/common.ts:659`, `apps/api/src/common.ts:669`, `apps/api/src/common.ts:676`, `apps/api/src/common.ts:699`, `apps/api/src/realtime.ts:525`
- **Propuesta:** Una sola consulta SQL que una sesión, usuario, rol y equipo, y tener en memoria el tiempo de sesión de los ajustes (se refresca al guardar Ajustes). Mismas reglas y mismos rechazos; solo cambia cuántas veces se va a la base.
- **Beneficio:** Todas las pantallas responden algo más rápido y la base recibe cerca de la cuarta parte de lecturas de sesión; se nota con varias cajas y pantallas que sondean.
- **Riesgo:** Es la puerta de seguridad: un error deja pasar una sesión revocada o saca a todas las cajas. Exige en verde las pruebas de sesión, bloqueo y equipos.
- **Pregunta para ti:** ¿Vale la pena tocar el guardián por este ahorro? Si sí, ¿consulta única con JOIN o caché de pocos segundos por sesión, sabiendo que revocar un equipo o desactivar a un usuario debe cortar el acceso de inmediato?
- **Cómo se comprobaría:** Contar consultas por petición autenticada desde un equipo con el registro de Prisma: de 4 a 1. Revocar un equipo o desactivar un usuario sigue dando 401 en la siguiente petición.

### EFI-08 · Los pagos no tienen índice por fecha ni por estado, y se buscan así cada 30 segundos

**Versión:** ambas · **Lo nota:** gerente y dueña · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La tabla Payment solo tiene índices por saleId y cashSessionId (migración 202610200001_perf_indexes_links); la rama producto-nexora tiene los mismos más tenantId. Conciliar transferencias consulta cada 30 s (refetchInterval: 30000) GET /payments/pending-transfers, que busca pagos con method = 'transfer' y status = 'pending_verification', y el reporte «Entradas por cuenta» (reportes/dinero.ts) filtra pagos por p."createdAt". Ni status ni createdAt de Payment tienen índice.
- **Evidencia:** `apps/api/prisma/schema.prisma:493`, `apps/api/src/sales.ts:3055`, `apps/web/src/TransferReconciliation.tsx:50`, `apps/api/src/reportes/dinero.ts:141`, `producto-nexora:apps/api/prisma/schema.prisma:553`
- **Propuesta:** Una migración con un índice parcial de Payment para status = 'pending_verification' y otro por createdAt, hecha como 202610200001 (nunca aborta el despliegue), solo si EXPLAIN ANALYZE sobre la base de carga muestra mejora.
- **Beneficio:** Gerente y dueña: Conciliar y «Entradas por cuenta» siguen rápidos cuando haya años de pagos acumulados.
- **Riesgo:** Cada índice hace un poco más lenta la escritura de un pago y ocupa disco; crear el índice bloquea escrituras en Payment mientras se construye.
- **Pregunta para ti:** Con el volumen real de pagos por año, ¿estos dos índices se justifican? ¿Qué otras búsquedas reales (venta por número con «contiene», créditos abiertos por saldo) merecen índice según EXPLAIN sobre la base de carga?
- **Cómo se comprobaría:** EXPLAIN ANALYZE de las tres consultas sobre la base de carga de un año: el plan usa el índice y el tiempo baja. Prueba nueva al estilo de perf-indexes-postgres.test.ts.

### EFI-09 · Guardar la foto de evidencia de un cobro en tabla aparte, no dentro del pago

**Versión:** tienda · **Lo nota:** gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** En nexora-cloud la foto de un abono (hasta 2 MB) se guarda como base64 en Payment.proofUrl. GET /sales, el cuadre y los créditos pendientes traen los pagos completos y luego descartan la foto; la auditoría 06 lo dejó «Parcial» (D-M6): solo cashExpected usa select. GV ya usa tabla aparte (GvProof) y la rama producto-nexora, un almacén de objetos.
- **Evidencia:** `apps/api/src/sales.ts:4152`, `apps/api/src/sales.ts:1765`, `apps/api/src/cash.ts:327`, `apps/api/src/cash.ts:56`, `apps/api/prisma/schema.prisma:1186`, `docs/coordinacion/auditoria-2026-10-10/06-datos-concurrencia-v2.md:46`, `origin/producto-nexora:apps/api/src/tenant-object-store.ts:1`
- **Propuesta:** Crear PaymentProof (paymentId único, tipo, tamaño, data en Bytes) igual que GvProof, o reutilizar el almacén de objetos del producto; POST y GET /payments/:id/proof leen y escriben ahí, y Payment guarda solo si hay foto, tipo y tamaño. Copiar las fotos existentes en una tarea aparte y vaciar proofUrl después de verificar la copia.
- **Beneficio:** Gerente y dueña: Ventas, Caja y cuadre dejan de arrastrar megabytes por cada abono con foto; menos memoria y menos tiempo con la caja bloqueada.
- **Riesgo:** Migración sobre Payment, que se escribe en cada cobro: si la copia falla se pierde evidencia de un pago. Debe hacerse en dos pasos y fuera de horario.
- **Pregunta para ti:** ¿Tabla con Bytes en PostgreSQL (como GvProof) o el mismo almacén de objetos que ya usa la rama del producto? ¿Cuántos pagos con foto hay hoy y cuánto pesa la columna proofUrl en producción? (por confirmar: no se consultó la base)
- **Cómo se comprobaría:** Prueba con 20 fotos de 2 MB: GET /sales y el cuadre no leen ninguna columna de imagen y responden en el mismo tiempo que sin fotos; cada foto anterior se sigue descargando.

### EFI-10 · Refrescar solo lo que cambió en vez de volver a pedir todo tras cada guardado

**Versión:** ambas · **Lo nota:** cajera, gerente, dueña · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** Hay 29 llamadas a invalidateQueries() sin clave: tras cada venta (POS.tsx), en cada FormModal al guardar, al sincronizar y al reconectar. Con el POS abierto eso vuelve a pedir el catálogo completo (páginas de 200), clientes, cajas, promociones y ajustes. Al reconectar, el catálogo se descarga dos veces seguidas.
- **Evidencia:** `apps/web/src/POS.tsx:2347`, `apps/web/src/helpers.tsx:302`, `apps/web/src/realtime.tsx:191`, `apps/web/src/api.ts:414`
- **Propuesta:** Crear queryKeys.ts con las claves por dominio y cambiar las invalidaciones globales por las claves que toca cada operación (una venta: cash-sessions, sales, dashboard; el stock ya llega por el canal en vivo). En «ready» no invalidar catalog, que se acaba de cargar.
- **Beneficio:** Menos datos y menos espera después de cada cobro en celulares y conexiones lentas; menos carga para el servidor con varias cajas abiertas.
- **Riesgo:** Si falta una clave, alguna pantalla puede mostrar un dato viejo hasta recargar; hay que revisar una por una las 29 llamadas.
- **Pregunta para ti:** ¿Qué datos deben refrescarse sí o sí tras una venta para que la cajera no vea nada viejo (caja, créditos, stock) y cuáles pueden esperar al aviso en vivo? ¿Conviene pasar las escrituras a useMutation, que hoy no se usa en ningún archivo?
- **Cómo se comprobaría:** En el inspector de red: después de un cobro en línea no se vuelve a pedir /products ni /customers; al reconectar, /products se pide una sola vez.

### EFI-11 · Avisos de stock sin recorrer ni reescribir el catálogo entero cada vez

**Versión:** ambas · **Lo nota:** cajera, vendedora, comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** En nexora-cloud, al reconectar («ready») realtime.tsx llama apply() por cada variante y cada llamada copia el catálogo completo en memoria; la rama producto-nexora ya no hace esa copia en «ready». En las dos ramas, cada aviso stock.changed lee de IndexedDB la copia local del catálogo, la recorre entera y la vuelve a guardar completa.
- **Evidencia:** `apps/web/src/realtime.tsx:170`, `apps/web/src/realtime.tsx:184`, `apps/web/src/realtime.tsx:203`, `producto-nexora:apps/web/src/realtime.tsx:211`
- **Propuesta:** En la tienda, en «ready» actualizar el carrito en una sola pasada (refreshCart ya lo hace) sin llamar apply() por variante. En ambas, en stock.changed conservar los objetos de los productos que no cambian, como hace discountLocalStock, y guardar el stock local en una tabla Dexie por variante.
- **Beneficio:** Menos trabajo al volver la conexión y cuando otra caja vende muchas líneas; pesa más en celulares y en catálogos grandes de otros negocios (el bloqueo real no se ha medido).
- **Riesgo:** Cambiar el esquema de Dexie exige una versión nueva de la base local y cuidar que la copia sin conexión siga mostrando el stock correcto.
- **Pregunta para ti:** ¿Con cuántos productos y variantes empieza a notarse el bloqueo en un celular de gama baja? ¿Vale más la tabla de stock por variante o basta juntar los avisos en lotes (cada 250 ms) antes de escribir la copia local?
- **Cómo se comprobaría:** Con un catálogo de prueba de 2,000 variantes, «ready» y 20 avisos seguidos no bloquean la pantalla más de 100 ms; el stock sin conexión coincide con el del servidor.

### EFI-12 · Plazo de respuesta por defecto en todas las llamadas, no solo al cobrar

**Versión:** ambas · **Lo nota:** cajera, gerente · **Esfuerzo:** mediano · **Toca dinero:** sí · **Evaluador principal:** nube

- **Hoy:** api() solo corta la espera si la llamada pasa timeout: lo hacen el cobro, cerrar sesión y 3 llamadas de importación de inventario (renovar sesión y las descargas tienen plazo propio). El resto, incluidos /sales/sync (api.ts) y el cierre de caja (Tienda.tsx), espera el plazo del navegador. Mientras syncSales espera, syncing sigue en true y la cola no se reintenta.
- **Evidencia:** `apps/web/src/api.ts:183`, `apps/web/src/api.ts:559`, `apps/web/src/Tienda.tsx:262`, `apps/web/src/App.tsx:808`
- **Propuesta:** Dar a api() un plazo por defecto (por ejemplo 20 s en lecturas y en /sales/sync, que es idempotente por offlineUuid) que cada llamada pueda cambiar; al vencer lanza NetworkError, como ya hace el cobro. Las escrituras sin clave de idempotencia se deciden una por una.
- **Beneficio:** Con internet malo los botones dejan de quedarse en «Procesando…» durante minutos y la cola de ventas vuelve a intentar sola.
- **Riesgo:** Una escritura que vence pudo quedar registrada. Movimientos de caja, gastos, pagos a proveedor y abonos ya llevan operationId (DECISIONES, puntos 25 y 37); las que no, como el ajuste de inventario, podrían duplicarse.
- **Pregunta para ti:** ¿Qué POST no llevan todavía clave de idempotencia (visto: ajuste de inventario; por revisar: abrir y cerrar caja, promociones, clientes) y qué plazo es sensato para cada uno con una conexión móvil lenta?
- **Cómo se comprobaría:** Con el servidor sin contestar, cada pantalla avisa «sin conexión» antes de 30 s, la sincronización automática vuelve a dispararse y nada se duplica al reintentar.

## Modernidad (8)

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

### MOD-05 · Que cada equipo informe su versión y el servidor exija una mínima

**Versión:** ambas · **Lo nota:** soporte, dueña, comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La versión del cliente (__NEXORA_VERSION__) solo se muestra en «Acerca de». api() envía únicamente Content-Type y Authorization, y el registro del equipo manda id, nombre y secreto: el servidor no sabe qué versión usa cada caja. La versión nueva se busca cada hora y al abrir o cerrar caja y se aplica sola con la caja libre; «Ocultar» solo quita el aviso.
- **Evidencia:** `apps/web/src/App.tsx:165`, `apps/web/src/api.ts:334`, `apps/web/src/realtime.tsx:136`, `apps/web/src/pwaUpdate.ts:150`
- **Propuesta:** Enviar la versión en un encabezado de api() y guardarla al registrar el equipo; la API responde con la mínima admitida. Si la caja está por debajo, busca la versión nueva de inmediato (ya existe el evento nexora:check-update) y el aviso no se puede ocultar; Configuración › Equipos muestra la de cada uno.
- **Beneficio:** Soporte ve qué caja quedó vieja sin ir al equipo, y se evita que una pantalla antigua mande datos con formato viejo a una API nueva, en la tienda y en cada cliente del producto.
- **Riesgo:** Un mínimo mal puesto puede forzar una actualización en plena jornada; debe respetar la regla actual de no recargar con carrito o ventanas abiertas.
- **Pregunta para ti:** ¿Bloquear las escrituras de un cliente por debajo del mínimo o solo avisar? La API ya deja campos opcionales para no romper una PWA anterior (DECISIONES, punto 25). ¿Cómo encaja con el instalador de Windows, donde cada caja guarda la versión vieja en su service worker?
- **Cómo se comprobaría:** Configuración › Equipos lista la versión de cada equipo; con una caja en versión vieja de prueba, el aviso no se puede ocultar y se aplica al vaciar el carrito.

### MOD-06 · Módulos que se encienden por negocio: incentivos, mensajería y demás

**Versión:** producto · **Lo nota:** comprador del producto · **Esfuerzo:** mediano · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** En la tienda el menú trae «GV Makeup Studio» (gv:read; el administrador tiene «*»), los roles gv y gerente_gv, el mensajero por defecto «Addison» y el reporte «por empresa» GV/MacGen. En producto-nexora eso ya está resuelto: no hay entrada GV en el menú ni roles gv, y con PRODUCT_TENANCY el mensajero es «Mensajero» y el reporte por empresa usa el nombre del negocio. Lo que falta en el producto: «Incentivos» sigue siempre en el menú y la lista modules que guarda «Primeros pasos» (sales, inventory, purchases, customers, reports, expenses) no filtra menú ni rutas.
- **Evidencia:** `apps/web/src/App.tsx:290`, `packages/shared/src/index.ts:786`, `packages/shared/src/index.ts:845`, `apps/api/src/reportes/margen.ts:54`, `producto-nexora:apps/web/src/App.tsx:332`, `producto-nexora:apps/api/src/onboarding.ts:9`, `producto-nexora:apps/api/src/reportes/margen.ts:55`
- **Propuesta:** En producto-nexora, hacer que la lista onboarding.modules de Settings (que ya guarda onboarding.ts) más incentivos y mensajería decida el menú en App.tsx y que un guardia responda 404 en las rutas de un módulo apagado. En la tienda no cambia nada.
- **Beneficio:** Comprador: ve solo lo que usa. Dueña: puede cobrar módulos extra, como plantea docs/venta/PROPUESTA_PRECIOS.md.
- **Riesgo:** Un guardia mal puesto apagaría pantallas que el negocio usa: la migración debe dejar todo encendido en las empresas existentes.
- **Pregunta para ti:** ¿Apagar módulos con una lista en Settings (por negocio, sin reinstalar) o con la edición al compilar? ¿Qué otras piezas separarías como módulo (vencimientos y lotes, crédito, dólares) y cuáles deben quedar siempre encendidas?
- **Cómo se comprobaría:** En producto, una empresa que no eligió compras ni incentivos no ve esas entradas y sus rutas responden 404; las demás empresas quedan igual.

### MOD-07 · La API no mide cuánto tarda cada ruta: solo se entera cuando algo da error 500

**Versión:** ambas · **Lo nota:** soporte y desarrollo · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** nube

- **Hoy:** La API envía a Sentry solo errores 5xx, con tracesSampleRate 0; SENTRY-API.md dice que no hay trazas de servidor. main.ts no registra la duración de las peticiones. La web muestrea el 10 % y solo si se compiló con DSN. No hay dónde ver qué ruta está lenta ni desde cuándo, ni en la nube ni en una PC instalada.
- **Evidencia:** `apps/api/src/monitoring.ts:23`, `docs/SENTRY-API.md:5`, `apps/web/src/monitoring.ts:125`, `apps/api/src/main.ts:42`
- **Propuesta:** Un interceptor global que mida cada petición por patrón de ruta (sin ids ni datos), escriba en el registro las que pasen de 1 s y guarde en memoria el tiempo típico y el del 5 % más lento por ruta, visibles para la dueña y soporte en una ruta de solo lectura.
- **Beneficio:** Soporte y desarrollo: se ve qué pantalla se puso lenta y cuándo, en la nube y en la PC de un cliente, sin esperar a que la cajera llame.
- **Riesgo:** Registrar de más puede filtrar datos o llenar el registro: solo método, patrón de ruta, estado y milisegundos. En memoria, los números se pierden al reiniciar.
- **Pregunta para ti:** ¿Medición propia en memoria y registro (sirve también al instalador sin internet) o activar trazas de Sentry al 5-10 % solo en la nube? ¿Qué umbral marca «lento» para cobrar y cuál para reportes?
- **Cómo se comprobaría:** Tras un día de uso: tabla con tiempo típico y del 5 % más lento de POST /sales, GET /products y GET /dashboard/summary. Una petición forzada de 2 s sale en el registro sin datos personales.

### MOD-08 · Modo oscuro: seguir la preferencia del equipo y aplicarse antes de pintar la pantalla

**Versión:** ambas · **Lo nota:** dueña, gerente, cajera · **Esfuerzo:** pequeño · **Toca dinero:** no · **Evaluador principal:** PC

- **Hoy:** El tema sale de localStorage («fitstore-theme») y, si no hay nada, siempre es claro: no consulta prefers-color-scheme (la landing sí). Se aplica en un useEffect de App.tsx, después de montar React (main.tsx solo fija dataset.visual), y la barra del navegador queda fija en #7C3AED en los dos temas. Igual en producto-nexora (api.ts:121, App.tsx:1084).
- **Evidencia:** `apps/web/src/api.ts:117`, `apps/web/src/App.tsx:697`, `apps/web/index.html:9`, `apps/landing/landing.css:22`
- **Propuesta:** En main.tsx, junto a dataset.visual, fijar data-theme antes de dibujar: lo guardado o, si no hay, la preferencia del sistema. Al cambiar de tema, actualizar también meta theme-color con el color de fondo del tema.
- **Beneficio:** Quien usa el celular o la laptop en oscuro no tiene que buscar la luna en cada equipo nuevo y se evita el posible destello claro al abrir (deducido del código).
- **Riesgo:** Una caja con Windows en oscuro abriría en oscuro sin pedirlo; en tiendas muy iluminadas el tema claro puede leerse mejor.
- **Pregunta para ti:** ¿El punto de venta debe seguir el tema del sistema o quedarse siempre en claro salvo que la cajera lo cambie? ¿Qué tema se lee mejor en un mostrador con mucha luz?
- **Cómo se comprobaría:** Con el sistema en oscuro y sin preferencia guardada, la app abre en oscuro sin cuadro claro previo (captura del primer cuadro); theme-color cambia con el tema.

## Descartadas antes de entrar (21)

El segundo revisor las refutó, o quedaron fuera por repetir otra o por pesar menos que el resto. No necesitan ficha. Si crees que alguna se descartó mal, dilo en tu Paso 4.

- **Número de factura y de devolución únicos por negocio, no en toda la base** (refutada): Ya está resuelto en producto-nexora (unicidad por empresa) y, para la tienda, ya estaba levantado en una auditoría anterior. Además, los códigos de producto son globales a propósito (decisión 36a de docs/DECISIONES.md).
- **Sacar del código la identidad de la tienda para poder vender el producto** (refutada): Ya existe en producto-nexora: modo producto con entrada neutra, mensajero genérico y una comprobación que falla si aparece la marca de la tienda. Lo que queda está en EST-14.
- **El mínimo de 14 px no se cumple fuera de styles.css (incentivos, importar, gráficas)** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **«Grupo Macgen» está fijo en reportes PDF y es el logo por defecto del recibo** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Entrada y menú muestran datos fijos de la tienda de la dueña, no los del negocio** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Puntos de quiebre: 12 anchos distintos; el menú cambia a 780 px y las tablas a 768** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Contraste y accesibilidad revisados por herramienta en cada cambio (axe-core en CI)** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Nota de crédito en ticket térmico con código que se escanea, no 32 letras a mano** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Mostrar a la cajera cuánto incentivo le dejó la venta al terminar de cobrar** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Código consecutivo automático para cada producto nuevo** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Cambiar el rol de una usuaria desde «Editar usuario»** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Configurar a quién y por dónde llegan los avisos desde la pantalla** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Detectar el uso repetido de un token de sesión ya gastado** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Instalación local y Docker: las mismas cabeceras de seguridad que la nube** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Las fotos de comprobante se cargan en memoria al listar ventas o cuadrar la caja** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Inventario baja todas las variantes con sus lotes y lo repite en cada cambio de stock** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **La tienda carga todas las pantallas de golpe; dividirlas quedó solo en la otra rama** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **En la versión instalada, la web y los datos viajan sin comprimir por la red de la tienda** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Quitar la marca de Grupo MacGen de lo que ve e imprime un cliente nuevo** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Aviso de versión nueva y lugar fijo de descarga para la versión instalada** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
- **Recibo digital por WhatsApp con enlace al detalle y teléfono en formato internacional** (sin comprobar): No se llegó a comprobar con un segundo revisor; quedó fuera.
