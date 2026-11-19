# Línea base de la primera tanda de mejoras · 13-nov-2026

**Actualización del 14-nov:** la sección 9 comprueba DIS-01, EST-03, COM-08 y MOD-08 sobre `1d118b16`, con 93 capturas web nuevas. COM-08 pasa con el alcance de datos de cada rol; DIS-01, EST-03 y MOD-08 conservan subcasos pendientes. El intento de instalación limpia llegó a Windows OOBE y se detuvo antes de la etapa de cuenta; Nexora todavía no se ejecutó en la VM. Véase [instalación del 14-nov](INSTALACION_LIMPIA_14NOV.md). Se conservan todas las evidencias anteriores.

**Actualización del 13-nov:** el «después» de DIS-01 y EST-03 sobre `7244c21a` está registrado en la sección 8, con 19 capturas nuevas. La franja superior, el aviso de error, el menú y la conservación del carrito mejoraron; quedan hallazgos reproducidos sobre ceros en «HOY» y reintentos. El «antes» y sus 79 capturas se conservan.

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
- **Después actualizado:** la sección 8 conserva la comprobación de `7244c21a`; la sección 9 añade DIS-01, EST-03, COM-08 y MOD-08 sobre `1d118b16`, el 14-nov. COM-03, DIS-02 y EFI-01 siguen pendientes de su comprobación posterior.
- El CI que se dispare al publicar esta rama se informará por su SHA exacto. Este documento no certifica una corrección de código ni un despliegue.

Plantilla para añadir el «después», sin reemplazar el «antes»:

| ID | SHA integrado y fecha | Mismos datos/rol/viewport | Capturas después | Comparación y resultado | Límite pendiente |
| --- | --- | --- | --- | --- | --- |
| DIS-01 | `1d118b16`, 14-nov | Mismo fixture; fechas 12/13/14-nov; dueña, 1366/390 | Secciones 8.1 y 9.1 | Carga corregida; al terminar los 503 reaparecen ceros sin Reintentar | Estado final de consulta fallida |
| EST-03 | `1d118b16`, 14-nov | Mismo error y carrito preparado; dueña, 1366/390 | Secciones 8.2 y 9.2 | Aviso/carrito/Volver a Caja pasan; Reintentar no pide de nuevo Resumen | Renovar datos defectuosos antes de redibujar |
| COM-08 | `1d118b16`, 14-nov | 15 créditos; vendedora/dueña, 1366/390 | Sección 9.3 | Pasa nombre con/sin acento, factura, teléfono disponible por rol, contador y vacío | Filtra los resultados cargados; no busca datos que el rol no recibe |
| COM-03 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| MOD-08 | `1d118b16`, 14-nov | Sistema oscuro; sin clave y elección manual, 1366/390 | Sección 9.4 | Sistema/elección guardada pasan; destello claro capturado a 1366 | Primer pintado de escritorio |
| DIS-02 | Pendiente | Pendiente | Pendiente | Pendiente | — |
| EFI-01 | Pendiente | Pendiente | Pendiente | Pendiente | Panel gráfico de Red |

## 8. Después de DIS-01 y EST-03 · 13-nov-2026

Código comprobado: **`7244c21ad26eb217b47fdc0e930ea14b3c4cc5bc`**, obtenido con `git fetch origin` y confirmado como `origin/nexora-cloud`. Rama de esta comprobación: `chatgpt-pc/despues-dis01-est03-13nov`. No se modificó código ni se desplegó.

Se usaron la misma versión de Chromium (153.0.8010.12), Windows 11 Pro, viewports **1366×900 y 390×844**, idioma `es-DO`, zona `America/Santo_Domingo`, build web de producción local, service worker bloqueado y sin limitación artificial de CPU/red. Dependencias congeladas, generación de Prisma y `pnpm build` terminaron correctamente. No se ejecutó una suite general de regresión porque esta entrega solo modifica documentos y capturas.

Para conservar los datos, se copió la base descartable de la línea base **estando detenida** a la carpeta local ignorada de este worktree. No se usó la base de la tienda. Se confirmó otra vez la respuesta válida de hoy: **RD$ 5,100 / 17 facturas**. No se hicieron ventas, cobros ni cambios de precio nuevos. La caja de prueba preexistente pertenece a otro equipo; en EST-03 se dejó así porque se comprueba la conservación de un carrito, no la autorización para finalizar un cobro.

Evidencia nueva: [registro de ejecución](datos/tanda1-13nov-despues-dis01-est03.json), [manifiesto con dimensiones y SHA-256](datos/tanda1-13nov-despues-dis01-est03-capturas.json), y 19 PNG en `capturas/tanda1-13nov-despues-dis01-est03/`. Las capturas y registros anteriores no se sobrescribieron.

### 8.1 DIS-01 · Franja corregida; quedan ceros en «HOY»

Se repitieron exactamente las intercepciones de la sección 1 en contextos nuevos: **Este mes** responde normalmente y solo se retiene o responde 503 a `GET /api/dashboard/summary?from=2026-11-13&to=2026-11-13`. Para el fallo se esperó **«No se pudo cargar»**, después de los dos intentos HTTP 503 del navegador, en lugar de capturar el primer fallo durante el reintento automático. Para carga se capturó antes del timeout de 12 segundos.

| Estado | Franja «Resumen de hoy», ambos tamaños | Bloque inferior «HOY», ambos tamaños |
| --- | --- | --- |
| Consulta diaria pendiente | Ventas e inventario: **— / Cargando…** | **RD$ 0.00 / 0 facturas**, costo y ganancia 0 |
| Consulta diaria fallida | Ventas e inventario: **— / No se pudo cargar** | **RD$ 0.00 / 0 facturas**, costo y ganancia 0 |
| Respuesta válida, sin intercepción | **RD$ 5,100.00 / 17 facturas** | **RD$ 5,100.00 / 17 facturas**, costo 3,060 y ganancia 2,040 |

La tarjeta Cajas activas mantiene **1 caja abierta**: consulta una ruta independiente que sí respondió. En la franja superior ya no aparecen «Sin faltantes» ni importes cero mientras falta la respuesta diaria. **Ese tramo pasa** la comparación con el «antes».

| Evidencia después | 1366 px | 390 px |
| --- | --- | --- |
| Carga, franja superior | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-cargando-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-cargando-390.png) |
| Fallo, franja superior | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-fallida-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-fallida-390.png) |
| Carga, «HOY» inferior | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-cargando-hoy-inferior-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-cargando-hoy-inferior-390.png) |
| Fallo, «HOY» inferior | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-fallida-hoy-inferior-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-fallida-hoy-inferior-390.png) |
| Control con respuesta válida | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-respuesta-valida-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/DIS-01-despues-respuesta-valida-390.png) |

**Hallazgo DIS-01-A · cumplimiento parcial:** al desplazarse a «Ventas por día», el bloque **HOY sigue presentando ceros como datos** durante esos mismos estados. No son los importes reales del fixture. Comparte la consulta diaria, pero `apps/web/src/Dashboard.tsx:49-73` sigue convirtiendo la ausencia de datos en 0; ese archivo no cambió en `7244c21a`. La franja sí usa el estado en `KpiStrip.tsx:35` y `kpiStripModel.ts:30-44`.

**Hallazgo DIS-01-B · reintento pendiente:** con solo la consulta diaria fallida no aparece ningún botón **Reintentar** en la página (0 botones en ambos tamaños). El reintento de `QueryState` corresponde al período mensual, que aquí respondió bien. El criterio original de la sección 1 pedía aviso y reintento para este fallo; hay aviso, pero falta esa acción.

**Resultado:** comparación ejecutada y documentada a ambos tamaños. Se acepta la franja superior; no se da por cerrada DIS-01 en todo el Resumen mientras «HOY» muestre cifras falsas y el fallo diario no tenga una acción de reintento.

### 8.2 EST-03 · Aviso, menú y carrito conservados; límite de Reintentar

Se repitió el error de la sección 2: HTTP **200**, `Content-Type: application/json`, cuerpo **`{"alerts":{}}`** en una consulta de `/api/dashboard/summary?...`. Para comprobar la promesa de conservar el carrito, se añadió esta preparación antes del mismo error:

1. Entrar como dueña directamente en `/#pos`, en un contexto nuevo, para no tener el Resumen previamente en caché.
2. Buscar **Bandas Resistance**, elegir **Lila**, cantidad **1**, precio/total **RD$ 300**. Elegir **Adriana Torres** mediante F4, sin abrir ni finalizar el cobro. Capturar el carrito.
3. Activar la intercepción y abrir **Resumen** desde el menú. La respuesta del período mensual mal formada basta para provocar el mismo error de dibujo.
4. Capturar el aviso. Pulsar **Reintentar** una vez con la intercepción todavía activa; comprobar que la aplicación conserva el aviso, sin quedar vacía.
5. **Retirar la intercepción**, sin recargar ni borrar caché. Pulsar **Reintentar inmediatamente** y contar las nuevas consultas de `/dashboard/summary`.
6. En móvil, abrir y cerrar el menú mientras sigue el aviso. Pulsar **Volver a Caja** y comparar el carrito. Después navegar por el menú a **Productos → Punto de venta** y volver a compararlo.

| Comprobación | 1366 px | 390 px |
| --- | --- | --- |
| Aviso «Esta pantalla tuvo un problema. Tu carrito y tus ventas guardadas no se perdieron.» | Pasa | Pasa |
| Botones Reintentar y Volver a Caja visibles | Pasa | Pasa |
| Raíz de aplicación conservada (`#root` con 1 hijo) | Pasa | Pasa |
| Menú disponible y navegación Productos → Punto de venta | Pasa | Pasa; también se capturó el menú abierto sobre el aviso |
| Volver a Caja navega a `#pos` | Pasa | Pasa |
| Carrito antes/después: clienta, artículo, variante, cantidad y total | **Idéntico** | **Idéntico** |
| Reintentar tras retirar el fallo, con dato defectuoso fresco en caché | **0 consultas nuevas; el aviso permanece** | **0 consultas nuevas; el aviso permanece** |

| Evidencia después | 1366 px | 390 px |
| --- | --- | --- |
| Carrito preparado antes del error | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-carrito-antes-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-carrito-antes-390.png) |
| Aviso que reemplaza la pantalla vacía | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-aviso-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-aviso-390.png) |
| Reintentar después de retirar el fallo | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-reintentar-sin-fallo-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-reintentar-sin-fallo-390.png) |
| Volver a Caja, carrito conservado | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-volver-caja-1366.png) | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-volver-caja-390.png) |
| Menú abierto con el aviso todavía detrás | Menú ya visible en la captura del aviso | [Captura](capturas/tanda1-13nov-despues-dis01-est03/EST-03-despues-menu-con-aviso-390.png) |

Alcance visual del carrito: a 390 px se ven clienta, artículo, variante, cantidad y total completos. A 1366 px, el aviso preexistente de «caja abierta en otro equipo» ocupa parte del panel y la línea de artículo no queda visible en esos PNG; se ven clienta, contador de 1 artículo y total RD$ 300. La igualdad del artículo/variante/cantidad en escritorio se acredita además por la comparación del texto DOM completo, antes y después, conservado en el registro JSON. No se cambió el estilo ni se ocultó el aviso para fabricar un encuadre.

**Hallazgo EST-03-A · recuperación incompleta para este caso:** al retirar la respuesta defectuosa y reintentar aproximadamente **248 ms / 241 ms** después de recibirla, no se hizo otra petición y se volvió a mostrar el aviso. La respuesta mal formada estaba guardada como éxito HTTP 200 en una consulta todavía fresca. `PageErrorBoundary.tsx:27` reinicia el indicador de error, pero no invalida esa consulta; `main.tsx:21-23` mantiene `staleTime: 30000`. El hallazgo se refiere a **este reintento inmediato con datos defectuosos en caché**, no demuestra que todos los tipos de error sean irrecuperables. No se limpió caché ni se recargó para atribuir al botón una recuperación que no produjo.

**Resultado:** el reemplazo de la pantalla vacía, la disponibilidad del menú, Volver a Caja y la conservación del carrito **pasan** a ambas anchuras. El reintento inmediato del caso mal formado **no pasa**. No se tocaron ventas guardadas; el aviso las menciona, pero esta comprobación no simula un corte durante una transacción.

### 8.3 Cierre de esta comprobación

- **Terminado:** repetición de los dos casos a 1366 y 390 px; 19 capturas, registro de respuestas/acciones, comparación con el «antes» y resultados por subcriterio.
- **Sin bloqueos de entorno:** se pudieron reproducir y capturar ambos casos. El antiguo bloqueo del panel gráfico de Red de EFI-01 no interviene en estas dos pruebas.
- **Pendiente de corrección por Norexos 1:** DIS-01-A/B y EST-03-A. Se documentan, no se implementan en esta rama. La aceptación completa de ambas mejoras queda pendiente de resolverlos y repetir esos subcasos.
- **Alcance respetado:** solo documentos, capturas y registros de prueba sin credenciales. Ningún cambio de aplicación ni despliegue. Se cerraron navegador, API, web y PostgreSQL de prueba al terminar cada mejora; los puertos 3013/5183/5443 quedaron libres.

## 9. Comprobación de la Cola 14-nov · tercer recorrido

Base fija: **`1d118b16e779ab41827d60daee0e59295747f643`**, confirmada después de `git fetch origin`. Incluye los retoques DIS-01/EST-03 de `3400247e`, el buscador COM-08 de `98dc8ec0` y el tema MOD-08 de `ed5826f9`. Rama de entrega: `chatgpt-pc/despues3-14nov`. Orden leída: «Cola 14-nov», al final de `ORDENES_CHATGPT_PC.md`.

Se repitieron las pruebas en local con **Chromium 153.0.8010.12**, Windows 11 Pro, **1366×900 y 390×844**, idioma `es-DO` y zona `America/Santo_Domingo`. Se utilizó una copia detenida de la misma base descartable, con los 15 créditos originales. No se registraron ventas o cobros nuevos. Se trasladó únicamente la caja de prueba al equipo del contexto cuando hizo falta encuadrar el carrito; no se alteraron importes ni permisos. Los avisos transitorios se cerraron con su botón antes de la recaptura móvil de EST-03.

Preparación finalizada con salida 0: `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm build`. La web se sirvió con Vite preview; API/web/PostgreSQL en 127.0.0.1 y puertos 3013/5183/5443. Service worker bloqueado y sin limitación artificial de CPU/red. Se usó tema claro en los recorridos funcionales y preferencia oscura del navegador para MOD-08, coherente con Windows ya configurado en oscuro. No se cambiaron ajustes de Windows. La VM de instalación estuvo activa durante parte del recorrido; los tiempos de pintado descritos son observaciones de esta ejecución, no una estimación general de rendimiento.

Hay **93 PNG web** y **17 JPEG nativos de la VM**, todos sin retoque. El [manifiesto del 14-nov](datos/despues3-14nov-capturas.json) registra formato, dimensiones y SHA-256 de los 110 archivos. Las capturas web respetan los dos tamaños; las de Hyper-V conservan el tamaño nativo de su ventana y sus bytes originales, con extensión `.jpg` ajustada al formato recibido. Registros: [DIS-01](datos/despues3-14nov-dis01.json), [EST-03](datos/despues3-14nov-est03.json), [COM-08](datos/despues3-14nov-com08.json), [MOD-08](datos/despues3-14nov-mod08.json).

### 9.1 DIS-01 · Carga correcta; fallo final todavía incorrecto

El 14-nov los datos válidos del fixture son diferentes por día:

| Fecha de consulta | Tarjeta | Venta válida | Facturas |
| --- | --- | ---: | ---: |
| 13-nov | Ayer | RD$ 5,100 | 17 |
| 14-nov | Hoy | RD$ 0 | 0 |
| 12-nov | Otro día | RD$ 9,650 | 3 |

Que Hoy muestre 0 **después de una respuesta válida** es correcto. El problema se comprueba con Ayer y Otro día, que tienen ventas confirmadas.

Pasos repetidos a ambos tamaños:

1. Entrar como dueña, en un contexto nuevo, Resumen → Este mes.
2. Dejar responder el período mensual. Interceptar solo consultas diarias `from=to` de 12, 13 y 14-nov; elegir **12/11/2026** en «Buscar otro día» para que sea una tercera fecha real.
3. Retener las tres consultas para capturar la carga, antes del timeout. En otro contexto, responder **503** con el mismo JSON de fallo de la línea base.
4. En el caso de error, esperar **los dos 503 de cada fecha** y el estado final, no el primer intento que aún está cargando. Contar botones Reintentar.
5. Retirar la intercepción y hacer el control en un contexto nuevo con las respuestas válidas.

| Estado observado | 1366 y 390 px |
| --- | --- |
| Carga de Ayer/Hoy/Otro día | **— / Cargando…** en las tres: pasa |
| Franja superior durante carga/fallo | Mantiene **—** y el motivo: pasa |
| Después de agotarse los dos 503 por fecha | Las tres tarjetas inferiores vuelven a **RD$ 0.00 / 0 facturas / costo y ganancia 0**: no pasa |
| Reintentar en las tarjetas fallidas | **0 botones**; no se pudo ejecutar esa acción porque no existe en ese estado |
| Control con respuesta válida | Ayer 5,100/17, Hoy 0/0 y Otro día 9,650/3: coincide con la API |

| Captura | 1366 px | 390 px |
| --- | --- | --- |
| Tres tarjetas cargando | [Ver](capturas/despues3-14nov/DIS-01-cargando-tres-dias-1366.png) | [Ver](capturas/despues3-14nov/DIS-01-cargando-tres-dias-390.png) |
| Tres tarjetas después del fallo final | [Ver](capturas/despues3-14nov/DIS-01-fallida-tres-dias-1366.png) | [Ver](capturas/despues3-14nov/DIS-01-fallida-tres-dias-390.png) |
| Franja superior con el mismo fallo | [Ver](capturas/despues3-14nov/DIS-01-fallida-franja-1366.png) | [Ver](capturas/despues3-14nov/DIS-01-fallida-franja-390.png) |
| Control válido | [Ver](capturas/despues3-14nov/DIS-01-control-valido-1366.png) | [Ver](capturas/despues3-14nov/DIS-01-control-valido-390.png) |

**Pendiente DIS-01-C:** el cambio de `Dashboard.tsx:62` solo entra en la rama sin cifras si `!data && query.fetchStatus !== "idle"`. Al acabar el fallo, la consulta queda idle y cae en la presentación de ceros. El botón Reintentar de esa rama tampoco queda disponible. La corrección resuelve la espera, pero no cumple el estado final de error pedido en la cola. No se modificó este código.

### 9.2 EST-03 · Reintentar no renueva el Resumen defectuoso

Se repitió el caso de la sección 8.2: dueña en `/#pos`, Adriana Torres, 1 Bandas Resistance/Lila, total RD$ 300. Se preparó la caja de prueba en el mismo equipo para que el aviso de traslado no ocupara el espacio del carrito. Al abrir Resumen se devolvió HTTP 200 con **`{"alerts":{}}`**. Después de aparecer el aviso se retiró la intercepción y se pulsó Reintentar inmediatamente, mientras la respuesta mal formada seguía fresca en caché. Se contaron específicamente las solicitudes de `/api/dashboard/summary`, no las de otras listas.

| Comprobación | 1366 px | 390 px |
| --- | --- | --- |
| Aviso y botones Reintentar / Volver a Caja | Visibles | Visibles |
| Nuevas consultas de Resumen tras Reintentar | **0** | **0** |
| Aviso permanece después de retirar el fallo y reintentar | Sí | Sí |
| Contenido normal del Resumen recuperado | No | No |
| Volver a Caja | Navega a `#pos` | Navega a `#pos` |
| Carrito antes/después | Texto completo idéntico, artículo/variante/cantidad/clienta/total conservados | Idéntico; recapturado sin el aviso transitorio superpuesto |

| Captura | 1366 px | 390 px |
| --- | --- | --- |
| Carrito preparado | [Ver](capturas/despues3-14nov/EST-03-carrito-antes-1366.png) | [Ver](capturas/despues3-14nov/EST-03-carrito-antes-390.png) |
| Aviso de pantalla con problema | [Ver](capturas/despues3-14nov/EST-03-aviso-1366.png) | [Ver](capturas/despues3-14nov/EST-03-aviso-390.png) |
| Después de Reintentar con la intercepción ya retirada | [Ver](capturas/despues3-14nov/EST-03-despues-reintentar-1366.png) | [Ver](capturas/despues3-14nov/EST-03-despues-reintentar-390.png) |
| Carrito recuperado al volver | [Ver](capturas/despues3-14nov/EST-03-carrito-despues-1366.png) | [Ver](capturas/despues3-14nov/EST-03-carrito-despues-390.png) |

**Pendiente EST-03-B:** `PageErrorBoundary.tsx:31-32` llama al callback y restablece inmediatamente el indicador de fallo. `App.tsx:1250` invalida consultas sin esperar a renovar las que quedaron inactivas al caer la pantalla. En este caso concreto no llega una nueva consulta de Resumen antes del nuevo intento de dibujo. Se mantienen el aviso, el menú y el carrito, pero no se cumple la recuperación pedida. No se borró caché ni se recargó para presentar como éxito lo que no produjo el botón.

### 9.3 COM-08 · Buscador comprobado

Se abrió Caja → Créditos pendientes, **Por venta**, con los mismos **15 créditos** y RD$ 4,500 pendientes. Se probaron ambos tamaños con vendedora y dueña. El campo visible dice exactamente **«Buscar por cliente, factura o teléfono»**.

| Prueba | Resultado en ambos tamaños | Capturas 1366 / 390 |
| --- | --- | --- |
| Lista inicial de vendedora | 15 filas y buscador visible | [1366](capturas/despues3-14nov/COM-08-vendedora-lista-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedora-lista-390.png) |
| `María Jiménez` | 1 de 15; FS-0000858 | [1366](capturas/despues3-14nov/COM-08-vendedor-nombre-acento-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-nombre-acento-390.png) |
| `maria jimenez` | La misma FS-0000858, sin exigir acentos | [1366](capturas/despues3-14nov/COM-08-vendedor-nombre-sin-acento-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-nombre-sin-acento-390.png) |
| `FS-0000861` | 1 de 15; Valentina Ramos | [1366](capturas/despues3-14nov/COM-08-vendedor-factura-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-factura-390.png) |
| Dueña: `1-809-555-0007` | 1 de 15; Valentina, ignorando guiones | [1366](capturas/despues3-14nov/COM-08-admin-telefono-guiones-1366.png) / [390](capturas/despues3-14nov/COM-08-admin-telefono-guiones-390.png) |
| Dueña: `18095550007` | La misma fila que con guiones | [1366](capturas/despues3-14nov/COM-08-admin-telefono-digitos-1366.png) / [390](capturas/despues3-14nov/COM-08-admin-telefono-digitos-390.png) |
| Vendedora: sufijo `0-0-7` | 1 de 15, usando los dígitos disponibles para su rol | [1366](capturas/despues3-14nov/COM-08-vendedor-telefono-sufijo-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-telefono-sufijo-390.png) |
| `zzzinexistente` | **0 de 15 en los resultados cargados** y **No hay coincidencias** | [1366](capturas/despues3-14nov/COM-08-vendedor-sin-coincidencias-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-sin-coincidencias-390.png) |
| Borrar la búsqueda | Restablece las 15 filas | [1366](capturas/despues3-14nov/COM-08-vendedor-limpiar-1366.png) / [390](capturas/despues3-14nov/COM-08-vendedor-limpiar-390.png) |

Los resultados positivos muestran **«1 de 15 en los resultados cargados»**. Ninguna de las 18 búsquedas/limpiezas observadas produjo una petición nueva a la lista; se filtran las filas ya recibidas, conforme al texto del contador.

Alcance por rol: la vendedora recibe el teléfono enmascarado. Buscar el teléfono completo `1-809-555-0007` con ese rol devuelve 0, aunque el sufijo visible sí encuentra la fila; se capturó también [a 1366](capturas/despues3-14nov/COM-08-vendedor-telefono-completo-1366.png) y [a 390](capturas/despues3-14nov/COM-08-vendedor-telefono-completo-390.png). La prueba de teléfono completo con guiones se considera pasada con la dueña, que sí recibe ese dato. No se cambiaron permisos ni se expusieron dígitos adicionales a la vendedora.

**Resultado:** COM-08 pasa los casos solicitados dentro de los datos disponibles por rol. La búsqueda opera sobre resultados cargados; esta prueba de 15 filas no certifica una búsqueda de todo el historial del servidor. Referencias: `Tienda.tsx:673-692` y `codPendingSearch.ts:7-28`.

### 9.4 MOD-08 · Sistema y elección manual pasan; destello de escritorio pendiente

Windows ya estaba en oscuro: `AppsUseLightTheme=0`, `SystemUsesLightTheme=0`, leídos sin modificarlos. Cada contexto de este caso declaró `prefers-color-scheme: dark`; antes de probar la recarga se confirmó que **no existía `fitstore-theme`**. Se capturaron los cuadros del navegador durante la navegación, junto con lecturas de tema/fondo y eventos de pintado. No se inyectaron estilos ni se retrasaron recursos.

| Condición | 1366 px | 390 px |
| --- | --- | --- |
| Sistema oscuro y sin elección guardada | Resuelve y termina en **dark** | Resuelve y termina en **dark** |
| Botón a claro, recarga manteniendo sistema oscuro | Guarda **light** y sigue claro | Guarda **light** y sigue claro |
| Botón a oscuro, recarga con preferencia de sistema clara | Guarda **dark** y sigue oscuro | Guarda **dark** y sigue oscuro |
| Ausencia de destello claro en la recarga sin clave | **No pasa en esta captura:** cuadro claro entre anterior y oscuro | **No se observó un cuadro claro** en esta secuencia |

| Evidencia | 1366 px | 390 px |
| --- | --- | --- |
| Primeros cuadros nuevos de la recarga | [f01: claro](capturas/despues3-14nov/MOD-08-sistema-oscuro-sin-guardado-1366-f01.png), [f02: oscuro](capturas/despues3-14nov/MOD-08-sistema-oscuro-sin-guardado-1366-f02.png) | [f00: oscuro](capturas/despues3-14nov/MOD-08-sistema-oscuro-sin-guardado-390-f00.png), [f01: oscuro](capturas/despues3-14nov/MOD-08-sistema-oscuro-sin-guardado-390-f01.png) |
| Oscuro estable sin clave guardada | [Ver](capturas/despues3-14nov/MOD-08-sistema-oscuro-estable-1366.png) | [Ver](capturas/despues3-14nov/MOD-08-sistema-oscuro-estable-390.png) |
| Claro guardado, sistema oscuro | [Ver](capturas/despues3-14nov/MOD-08-eleccion-clara-sistema-oscuro-1366.png) | [Ver](capturas/despues3-14nov/MOD-08-eleccion-clara-sistema-oscuro-390.png) |
| Oscuro guardado, sistema claro | [Ver](capturas/despues3-14nov/MOD-08-eleccion-oscura-sistema-claro-1366.png) | [Ver](capturas/despues3-14nov/MOD-08-eleccion-oscura-sistema-claro-390.png) |

Se conservaron **26 cuadros de escritorio y 23 de móvil**, ordenados por `fNN` en el manifiesto. En escritorio, f00 conserva la pantalla anterior oscura y no se cuenta como primer cuadro nuevo; f01 muestra el fondo claro. El registro midió fondo claro a 20/26/42.9 ms, `first-paint` a 36 ms y tema oscuro ya aplicado en la muestra de 61.8 ms. Esto respalda un pintado claro previo al oscuro.

En móvil, la lectura de fondo claro a 53.4 ms fue **anterior** al primer pintado (72 ms); el tema ya era oscuro en la muestra de 64.5 ms. Los primeros cuadros capturados son oscuros. Esa lectura previa no se presenta como prueba de un destello visible móvil. No se deduce una duración universal ni una tasa de cuadros de estas cifras.

**Pendiente MOD-08-A:** hay un destello de escritorio reproducido. La resolución del tema y la prioridad manual funcionan. `main.tsx:20` aplica el tema antes de montar React, pero el HTML no lo aplica antes de cargar el módulo y el CSS parte de claro (`styles.css:59-89`); esa secuencia es compatible con lo capturado. No se cambió la implementación.

### 9.5 Instalación limpia: el ISO arrancó; Nexora sigue pendiente

Se comprobó el ISO real por montaje de solo lectura, firmas de ejecutables de Microsoft y metadatos WIM/ESD. Después se intentó el arranque de la VM **FitStore-INST1-Win10**. Tras responder a tiempo al prompt del DVD, Windows Setup arrancó y **Windows 10 Pro se instaló en el disco virtual vacío de 80 GB**, reinició y llegó a OOBE. El fallo de arranque del 12-nov no permite seguir afirmando que ese ISO esté dañado.

La instalación se detuvo en **«Let's add your account»**, antes del escritorio. No se ingresaron credenciales, no se creó una cuenta y **Nexora no se instaló ni ejecutó**. La skill [Computer Use](C:/Users/marco/.codex/plugins/cache/openai-bundled/computer-use/26.1106.51428/skills/computer-use/SKILL.md), en su guía enlazada, indica **«Do not automate user authentication dialogs»**; esta etapa requiere intervención manual. No se eludió el diálogo ni se cambiaron opciones de privacidad.

El EXE exacto del HEAD está preparado y verificado, sin ejecutarlo en el host: versión **0.1.1-prueba**, **141,778,408 bytes**, SHA-256 **`42f50d6f44481258bd3c3e02f543b24972815052b290f35cb96c87be1a2c548f`**, **NotSigned**, procedente del trabajo `windows-installer` de [CI 43594157456](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/43594157456). No se atribuye a un artefacto antiguo ni se presenta su descarga como aceptación de instalación.

El recorrido completo, hashes del ISO y del DVD de transferencia, capturas y lo no ejecutado están en [INSTALACION_LIMPIA_14NOV.md](INSTALACION_LIMPIA_14NOV.md). Al cierre: **Win10 Saved, memoria asignada 0; Win11 Off; vmconnect cerrado; ISO desmontado en el host**. Quedan sin ejecutar en Nexora instalado: entrar/crear dueña, vender, cerrar caja y respaldo/restauración.

### 9.6 Estado de entrega del 14-nov

- **Terminado:** lectura de la cola vigente, cuatro comprobaciones de uso a ambos tamaños, 93 capturas web, 17 capturas de la VM, registros y comparación en este mismo documento. Revisión independiente de datos y encuadres, incluidos los fotogramas del tema.
- **Pendiente de corregir:** fallo final de DIS-01, renovación de datos de EST-03 y destello de MOD-08 a 1366. Son resultados fallidos de pruebas ejecutadas, no bloqueos para arrancar el entorno. COM-08 pasa con el alcance por rol explicado.
- **Bloqueado:** continuación de OOBE/cuenta y posterior aceptación gráfica del EXE en Windows limpio. Se conservó la VM guardada para que la persona complete esa etapa. El ISO ya no es el bloqueo demostrado.
- **Cierre:** navegadores, API, web y PostgreSQL de prueba cerrados; puertos 3013/5183/5443 libres. Solo documentos y capturas en la rama; sin cambios de código ni despliegue. El [CI del commit base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/43594157456) terminó con `verify`, `windows-installer` y `render-images` en **success**; esto no certifica una instalación Nexora que no se ejecutó.
