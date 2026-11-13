# Línea base de la primera tanda de mejoras · 13-nov-2026

Base observada: `origin/nexora-cloud` **`511d223f0c0c512f54b900265b2c6c1e59d4c560`**. Rama de entrega: `chatgpt-pc/linea-base-mejoras-13nov`. Orden: sección «Cola 13-nov (2)» de `docs/coordinacion/ORDENES_CHATGPT_PC.md` en esa base.

Los siete casos tienen un «antes» reproducido a **1366×900 y 390×844 píxeles**, pasos y criterio para comparar después. Se entregan **79 PNG**, incluidos 47 fotogramas de recarga del tema, y tres registros JSON sin cabeceras, cookies, tokens ni cuerpos de clientes. La única limitación de herramienta es la captura del panel gráfico de Red: Chromium con ventana falló al arrancar con `browserType.launch: spawn UNKNOWN`. La medición de peticiones sí se completó en el navegador mediante su protocolo de Red, el mismo que alimenta DevTools.

## Condiciones para repetir la comparación

- Windows 11 Pro, compilación 26300; Chromium **153.0.8010.12**; zoom y escala de página 1; zona de negocio `America/Santo_Domingo`; idioma `es-DO`. 390 px representa un viewport de teléfono, no una prueba en un teléfono físico.
- Compilación web de producción local (`pnpm build` y Vite preview), API `127.0.0.1:3013`, web `127.0.0.1:5183`, PostgreSQL embebido `127.0.0.1:5443`. Service worker bloqueado en el contexto de prueba; sin limitación artificial de CPU o red.
- Preparación ejecutada correctamente: `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm build`. Se aplicaron 68 migraciones en una base nueva. El seed creó 60 productos, 228 variantes, 20 clientes ficticios y 846 ventas. No equivale a ejecutar `pnpm check` ni la suite de integración.
- Roles: dueña demo Valeria Rivera (`admin`) salvo COM-08, observado con la vendedora demo Camila López (`seller`). No se modificaron permisos ni reglas del negocio.
- Fixture de créditos: abrir una caja de prueba de la dueña con fondo 0; crear **15 ventas por API**, una por clienta, de 1 unidad de **Bandas Resistance / Rosa / FIT-0038-2**, precio RD$ 300, pago `cod` por RD$ 300 y `receivableKind: credit`. Usar un `offlineUuid` nuevo por venta. Elegir las primeras 14 clientas por nombre, excluyendo Valentina Ramos; crear la de **Valentina Ramos al final**. Resultado observado: FS-0000847 a FS-0000861, RD$ 4,500 pendientes. Se usó la API normal, no se inventaron filas de ventas mediante SQL.
- EFI-01 añadió dos ventas en efectivo de **Bandas Resistance / Lila / FIT-0038-1**, RD$ 300 cada una: FS-0000862 y FS-0000863. La repetición de DIS-01 se hizo después de preparar esos datos: la respuesta válida de hoy confirmó **RD$ 5,100 y 17 facturas**, frente a los ceros mostrados durante el fallo.
- Los precios y costos escritos en COM-03 se cancelaron sin guardar. DIS-02 no finalizó ventas. Las alteraciones de respuestas de DIS-01/EST-03 ocurrieron solo en el navegador, sin editar archivos de aplicación.
- Se cerraron navegador, API, web y PostgreSQL al terminar cada punto. Al cierre se verificó que 3013, 5183 y 5443 no escuchaban. No se modificó código, lockfile, infraestructura ni datos de la tienda; no hubo despliegue.

Los números de factura y las fechas cambiarán al regenerar el seed otro día. Para el «después», conservar cantidad, orden, producto, precios, rol, viewport y caché de esta comparación; usar la fecha de negocio de la ejecución en los filtros.

## Cobertura del «antes»

| ID | Resultado observado | 1366 px | 390 px |
| --- | --- | --- | --- |
| DIS-01 · Resumen | La consulta diaria pendiente o fallida se presenta como RD$ 0.00 y «Sin faltantes» | [Espera](capturas/tanda1-13nov/DIS-01-cargando-1366.png), [fallo](capturas/tanda1-13nov/DIS-01-fallida-1366.png) | [Espera](capturas/tanda1-13nov/DIS-01-cargando-390.png), [fallo](capturas/tanda1-13nov/DIS-01-fallida-390.png) |
| EST-03 · Error de dibujo | Raíz de React vacía, sin mensaje ni recuperación | [Pantalla](capturas/tanda1-13nov/EST-03-error-dibujo-1366.png) | [Pantalla](capturas/tanda1-13nov/EST-03-error-dibujo-390.png) |
| COM-08 · Créditos | 15 filas sin buscador en «Por venta»; lectura y desplazamiento hasta la clienta | [Inicio](capturas/tanda1-13nov/COM-08-lista-inicio-1366.png), [clienta](capturas/tanda1-13nov/COM-08-clienta-encontrada-1366.png) | [Inicio](capturas/tanda1-13nov/COM-08-lista-inicio-390.png), [clienta](capturas/tanda1-13nov/COM-08-clienta-encontrada-390.png) |
| COM-03 · Margen | No aparece margen al escribir precio 1000 y costo 900 u 800 | [Costo 900](capturas/tanda1-13nov/COM-03-precio1000-costo900-1366.png), [costo 800](capturas/tanda1-13nov/COM-03-precio1000-costo800-1366.png) | [Costo 900](capturas/tanda1-13nov/COM-03-precio1000-costo900-390.png), [costo 800](capturas/tanda1-13nov/COM-03-precio1000-costo800-390.png) |
| MOD-08 · Tema | Fondo claro al recargar con oscuro guardado; sin preferencia guardada arranca claro | [Claro transitorio](capturas/tanda1-13nov/MOD-08-recarga-1366-f01.png), [oscuro estable](capturas/tanda1-13nov/MOD-08-oscuro-estable-1366.png) | [Claro transitorio](capturas/tanda1-13nov/MOD-08-recarga-390-f00.png), [oscuro estable](capturas/tanda1-13nov/MOD-08-oscuro-estable-390.png) |
| DIS-02 · Cobro | Escape y clic fuera descartan el pago y lo escrito | [Antes](capturas/tanda1-13nov/DIS-02-Escape-antes-1366.png), [reabierto](capturas/tanda1-13nov/DIS-02-Escape-reabierto-detalle-1366.png) | [Antes](capturas/tanda1-13nov/DIS-02-Escape-antes-390.png), [reabierto](capturas/tanda1-13nov/DIS-02-Escape-reabierto-390.png) |
| EFI-01 · Después de cobrar | Diez GET, incluida la descarga del catálogo | [Antes](capturas/tanda1-13nov/EFI-01-antes-finalizar-1366.png), [venta registrada](capturas/tanda1-13nov/EFI-01-venta-completada-1366.png) | [Antes](capturas/tanda1-13nov/EFI-01-antes-finalizar-390.png), [venta registrada](capturas/tanda1-13nov/EFI-01-venta-completada-390.png) |

## 1. DIS-01 · Resumen: carga y consulta fallida

Pasos exactos:

1. Entrar como dueña y abrir Resumen con período **Este mes**. En un perfil/contexto nuevo, no reutilizar una consulta diaria ya resuelta en memoria.
2. En la intercepción de red del navegador, dejar pasar las consultas del mes, del día anterior, de cajas y del resto de la aplicación. Interceptar **solo** `GET /api/dashboard/summary?from=2026-11-13&to=2026-11-13` (cambiar ambas fechas por hoy al repetir).
3. Para «cargando», mantener esa petición sin responder. Cuando el período mensual haya cargado y se vea la sección «Resumen de hoy», capturar antes del timeout de 12 segundos.
4. Abrir otro contexto/página sin la consulta diaria en caché. Para «consulta fallida», devolver HTTP **503**, JSON `{"message":"Fallo de consulta simulado para linea base"}`, únicamente en esa misma ruta. Esperar a recibir el 503 y capturar las tarjetas.
5. Repetir ambos estados a 1366 y 390 px. Retirar la intercepción al terminar.

Hoy las dos situaciones muestran **Ventas de hoy RD$ 0.00 / 0 facturas / Alertas de inventario 0 / Sin faltantes**, sin un estado pendiente o fallido dentro de esas tarjetas. La caja puede mostrar 1 porque su consulta independiente sí respondió. El dato válido era RD$ 5,100 y 17 facturas. Las capturas de espera y fallo son casi iguales: el [registro de estados](datos/tanda1-13nov-estados.json) acredita cuál petición se retuvo y cuál respondió 503.

No se debe bloquear todo el Resumen para intentar obtener esos ceros: cuando falla también la consulta del período, `QueryState` muestra carga/error y oculta el contenido. Ese comportamiento existente no elimina el problema de la consulta diaria independiente. Referencias de la base: `Dashboard.tsx:306`, `KpiStrip.tsx:22`, `kpiStripModel.ts:26` y `:44`, `helpers.tsx:186`.

**Qué debe verse después:** mientras falte la respuesta diaria debe verse «Cargando»; si falla, un aviso claro y reintento; solo una respuesta válida puede presentar RD$ 0.00 y «Sin faltantes» como datos confirmados.

## 2. EST-03 · Pantalla de error

Pasos exactos:

1. Entrar como dueña en un contexto de navegador nuevo y abrir Resumen.
2. Interceptar una respuesta de `/api/dashboard/summary?...` y sustituir solo su cuerpo por **`{"alerts":{}}`**, conservando HTTP 200 y `Content-Type: application/json`.
3. Esperar el error de dibujo. Capturar a ambas anchuras. Retirar la intercepción y recargar para recuperar la aplicación.

Hoy aparece una **pantalla vacía**, sobre el fondo claro, sin explicación ni botón. Se confirmó `#root.childElementCount = 0` y texto del cuerpo vacío. El error registrado fue **`R?.alerts?.slice is not a function`** en la compilación minificada. Los PNG vacíos son evidencia intencional, no imágenes dañadas. El error y la respuesta inyectada constan en el registro de estados. Referencias: `Dashboard.tsx:472`, `main.tsx:26` y ausencia de un límite de errores que recupere esta raíz en `App.tsx`.

**Qué debe verse después:** ante la misma respuesta mal formada debe aparecer una pantalla de recuperación en español con una acción para volver a intentar, conservando una interfaz utilizable y sin mostrar una traza técnica al usuario.

## 3. COM-08 · Encontrar un crédito de una clienta

Precondición: las 15 ventas pendientes del fixture, última **Valentina Ramos / FS-0000861**, y equipo de prueba aprobado. Entrar como vendedora. No se registra ningún cobro.

Pasos exactos y conteo:

1. Desde el menú, abrir **Caja**. En móvil, primero pulsar **Abrir menú** y después **Caja**.
2. Partir del inicio de la página (`scrollY=0`). Mantener **Pendientes** y la vista por venta; localizar el bloque «Créditos pendientes».
3. Leer los nombres y desplazarse en incrementos de **600 píxeles**, hasta que la tarjeta de Valentina esté completamente visible, dejando libres la cabecera y la barra inferior. Capturar el inicio de la lista y el hallazgo.

| Medida | 1366×900 | 390×844 |
| --- | ---: | ---: |
| Filas recibidas | 15 | 15 |
| Campos de búsqueda dentro del bloque | 0 | 0 |
| Clics de navegación | 1 | 2 |
| Desplazamientos de 600 px desde el inicio de Caja | 5 | 11 |
| Acciones observadas hasta encuadrar la clienta | **6** | **13** |

El conteo no incluye iniciar sesión, preparar datos ni el tiempo de leer cada nombre. Son acciones de rueda reproducibles, no una afirmación de que todo teléfono necesite exactamente once gestos. El [registro de uso](datos/tanda1-13nov-uso.json) conserva el conteo y el punto inicial. Las capturas de inicio se encuadraron después en la cabecera del bloque para que el contador de 15 y RD$ 4,500 se lea completo.

La ausencia de búsqueda se refiere a **Por venta**, visible para cajera/vendedora. La dueña ya dispone de **Por persona**, con búsqueda por nombre y paginación; no se presenta esa función como inexistente. Referencias: `Tienda.tsx:585-684`, `CreditAccounts.tsx:206`, `sales.ts:4588-4626` (máximo 500 ventas en la respuesta actual).

**Qué debe verse después:** en la lista por venta, un campo «Cliente o factura» debe encontrar Valentina por parte del nombre o FS-0000861 por número, sin recorrer las otras catorce tarjetas; borrar el filtro debe restaurar la lista y aclarar el significado del total.

## 4. COM-03 · Margen antes de guardar precio o costo

Pasos exactos:

1. Como dueña, abrir **Productos → Ver Bandas Resistance → Variantes → Editar precio** de **Lila / FIT-0038-1**.
2. En «Editar variante y precio», cambiar **Precio** a **1000** y **Costo promedio** a **900**. Capturar antes de guardar.
3. Mantener precio 1000 y cambiar costo a **800**. Capturar de nuevo.
4. Repetir los dos pares a ambas anchuras y pulsar **Cancelar**. No guardar los precios de muestra.

Hoy solo aparecen Precio, Costo promedio y Código de barras; **no aparece margen ni aviso** al cambiar los valores. Los márgenes de comparación son 10 % y 20 %, usando `(precio − costo) / precio × 100`, sin restar ITBIS. El precio/costo persistidos se conservaron en RD$ 300 / RD$ 180. Referencias: `Management.tsx:627-677`, `helpers.tsx:249-317`, `packages/shared/src/index.ts:483-487`.

**Qué debe verse después:** antes de Guardar, precio 1000/costo 900 debe mostrar margen 10 % y avisar si está bajo el umbral configurado; al escribir costo 800 debe actualizarse a 20 %, sin modificar la regla monetaria ni guardar automáticamente.

## 5. MOD-08 · Tema oscuro al recargar

Precondición verificada: Windows ya tenía **AppsUseLightTheme=0 y SystemUsesLightTheme=0**. No se cambió la configuración del equipo. El navegador también declaró `prefers-color-scheme: dark`.

Pasos exactos:

1. Abrir un perfil nuevo sin `localStorage["fitstore-theme"]`, entrar y recargar. Registrar qué tema elige: hoy queda **light** aunque el sistema esté oscuro. [1366](capturas/tanda1-13nov/MOD-08-sistema-oscuro-sin-preferencia-1366.png), [390](capturas/tanda1-13nov/MOD-08-sistema-oscuro-sin-preferencia-390.png).
2. Pulsar **Activar modo oscuro**; comprobar que se guarda `fitstore-theme=dark` y se ve oscuro estable.
3. Iniciar captura de fotogramas del navegador, recargar y esperar a que aparezca **Activar modo claro**. Repetir en ambos viewports sin alterar estilos ni `data-theme` desde la prueba.
4. Revisar la secuencia: en escritorio `f01` es fondo claro y `f02` todavía muestra «Cargando datos…» claro; los fotogramas siguientes pasan a oscuro. En móvil `f00` es claro y `f01` ya muestra carga oscura. `1366-f00` conserva el último cuadro anterior a la recarga y no se cuenta como primer pintado nuevo.

Se conservaron **26 fotogramas de escritorio y 21 de móvil**, sin interpolar ni retocar. Los nombres `MOD-08-recarga-<ancho>-fNN.png` conservan su orden. El [manifiesto](datos/tanda1-13nov-capturas.json) enumera todas las imágenes. Se confirma la secuencia clara→oscura, **no una duración universal ni una medición de FPS**. Referencias: `api.ts:117`, `App.tsx:696-698`, `index.html`, `styles.css:59-89`.

**Qué debe verse después:** con oscuro guardado, el primer fotograma pintado al recargar debe ser oscuro y continuar así durante la carga; si no hay preferencia guardada, debe respetarse la preferencia oscura del sistema conforme al alcance que implemente Norexos 1.

## 6. DIS-02 · Cerrar el cobro con un pago preparado

Precondición: caja propia abierta en el mismo equipo, carrito con 1 Bandas Resistance / Lila por RD$ 300 y clienta Adriana Torres seleccionada. Si la caja se abrió en otro contexto, trasladar **solo esa caja de prueba** al equipo actual antes de comenzar; esa preparación no forma parte del cierre accidental.

Pasos exactos, repetidos de forma independiente para ambas vías y anchuras:

1. Abrir **Cobrar / F12**; en «Todo listo para cobrar», escribir **123.45** en **Monto del pago** y pulsar **Agregar pago**.
2. Escribir **77.77** como siguiente monto, sin agregarlo. Capturar: pago Efectivo RD$ 123.45, monto escrito 77.77 y pendiente RD$ 176.55.
3. Cerrar con **Escape**. Abrir de nuevo con F12 y capturar. Repetir desde el paso 1, cerrando esta vez con **un clic en el fondo fuera del diálogo**.
4. No pulsar Finalizar venta.

Hoy ambas vías cierran **sin confirmación**. Al reabrir se pierde el pago de RD$ 123.45 y el texto 77.77; el campo vuelve a **300**, no hay filas de pago y el pendiente vuelve a **RD$ 300.00**. El producto y la clienta del carrito se conservan. En escritorio se añadieron capturas inferiores para ver la lista vacía y el saldo completo.

| Vía | Escritorio, antes / reabierto | Móvil, antes / reabierto |
| --- | --- | --- |
| Escape | [Antes](capturas/tanda1-13nov/DIS-02-Escape-antes-1366.png) / [detalle reabierto](capturas/tanda1-13nov/DIS-02-Escape-reabierto-detalle-1366.png) | [Antes](capturas/tanda1-13nov/DIS-02-Escape-antes-390.png) / [reabierto](capturas/tanda1-13nov/DIS-02-Escape-reabierto-390.png) |
| Clic fuera | [Antes](capturas/tanda1-13nov/DIS-02-fuera-antes-1366.png) / [detalle reabierto](capturas/tanda1-13nov/DIS-02-fuera-reabierto-detalle-1366.png) | [Antes](capturas/tanda1-13nov/DIS-02-fuera-antes-390.png) / [reabierto](capturas/tanda1-13nov/DIS-02-fuera-reabierto-390.png) |

Referencias: `POS.tsx:1571-1580` desmonta Checkout; `:1866-1885` inicia sus estados locales; `packages/ui/src/index.tsx:99` permite cerrar el modal.

**Qué debe verse después:** Escape y clic accidental fuera no deben descartar silenciosamente un cobro modificado; al volver deben conservarse los pagos y lo escrito, o pedirse una confirmación explícita antes de descartarlos.

## 7. EFI-01 · Peticiones inmediatamente después de vender

Pasos exactos:

1. Con el mismo catálogo de 60 productos/228 variantes, entrar como dueña, abrir Punto de venta y esperar a que acaben las consultas iniciales y la conexión de eventos. Mantener caché caliente; no activar «Disable cache».
2. Agregar una Bandas Resistance / Lila, elegir Adriana Torres y agregar pago **Efectivo RD$ 300 exactos**.
3. Vaciar el registro de red antes de **Finalizar venta**. Marcar como t=0 la recepción de la respuesta de **POST /api/sales**. No pulsar Nueva venta ni navegar durante los cinco segundos siguientes.
4. Contar las solicitudes iniciadas entre t=0 y t=5 s. Separar el POST que registra la venta de las lecturas posteriores. Repetir con otra venta a 390 px.

Se instrumentaron eventos reales `Network.requestWillBeSent`, `responseReceived` y `loadingFinished` de Chromium. `encodedDataLength` mide los bytes recibidos incluidos encabezados; el tamaño lógico del JSON se midió aparte, sin guardar el cuerpo. La caché caliente puede revalidar respuestas, por eso ambos tamaños son diferentes. Son KB decimales (1000 bytes), no KiB.

| Petición GET posterior | Bytes transferidos, 1366 | Bytes transferidos, 390 | JSON lógico, ambas |
| --- | ---: | ---: | ---: |
| `/api/alerts?status=new` | 944 | 944 | 61,743 |
| `/api/assistant/status` | 942 | 942 | 144 |
| `/api/products?limit=200&page=1` | **195,943** | **195,943** | **194,937** |
| `/api/categories` | 943 | 943 | 1,344 |
| `/api/customers` | 8,997 | 8,997 | 7,994 |
| `/api/cash-sessions` | 1,634 | 1,634 | 633 |
| `/api/promotions` | 941 | 941 | 2 |
| `/api/settings` | 943 | 943 | 426 |
| `/api/credit-notes?customerId=CLIENTA_DEMO` | 941 | 941 | 2 |
| `/api/credit-notes` | 999 | 941 | 2 |
| **Total: 10 GET** | **213,227 = 213.227 KB** | **213,169 = 213.169 KB** | **267,227 = 267.227 KB** |

El POST de venta, excluido del total anterior, recibió 3,008 bytes en cada caso y tardó 86/66 ms en este entorno local. Las diez consultas comenzaron aproximadamente entre 2 y 11 ms después de la respuesta. No se extrapolan esos tiempos a internet ni a producción. El catálogo representa aproximadamente el **92 % de la transferencia posterior**. Registro reproducible: [tanda1-13nov-red.json](datos/tanda1-13nov-red.json), sin cabeceras ni credenciales y con el identificador de clienta sustituido por `CLIENTA_DEMO`.

La captura gráfica de la pestaña Red quedó **bloqueada** por `browserType.launch: spawn UNKNOWN` al intentar Chromium con ventana (`headless:false`). No se fabricó una imagen de DevTools. Las capturas enlazadas muestran el cobro previo y la confirmación de las ventas FS-0000862/863; el JSON contiene la medición de Red real.

Referencia causal de la base: tras registrar la venta, `POS.tsx:2359-2360` ejecuta `client.invalidateQueries()` sin filtro; catálogo y listas activas se consultan de nuevo. Esto es una observación para la implementación de Norexos 1, no un cambio realizado aquí.

**Qué debe verse después:** después de una venta, deben actualizarse caja, stock y datos afectados sin volver a descargar indiscriminadamente el catálogo y listas sin cambios; repetir esta ventana de cinco segundos debe demostrar la reducción respecto de diez GET y unos 213 KB, sin perder consistencia de stock, caja o recibo.

## Pendientes y entrega

- **Completado:** siete líneas base a ambos tamaños, pasos exactos, criterios de aceptación, capturas, medición de Red y revisión visual de encuadres. El índice con dimensiones y SHA-256 permite comprobar que los PNG conservan sus píxeles.
- **Bloqueado:** solo la captura del panel gráfico de Red, por el fallo de arranque indicado; no impidió medir las peticiones reales. No hay otro caso sin reproducir.
- **Pendiente por diseño:** el «después» de cada ID. Se repetirá el mismo caso cuando Norexos 1 comunique que la mejora correspondiente está integrada en `nexora-cloud`; no se da por implementada ninguna de las siete.
- El CI que se dispare al publicar esta rama se informará por su SHA exacto. Este documento no certifica una corrección de código ni un despliegue.

Plantilla para añadir el «después», sin reemplazar el «antes»:

| ID | SHA integrado y fecha | Mismos datos/rol/viewport | Capturas después | Comparación y resultado | Límite pendiente |
| --- | --- | --- | --- | --- | --- |
| DIS-01 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| EST-03 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| COM-08 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| COM-03 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| MOD-08 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| DIS-02 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| EFI-01 | Pendiente | Pendiente | Pendiente | Pendiente | Panel gráfico de Red |
