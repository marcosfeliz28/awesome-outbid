# Manual de demostración

## Cargar el inventario de la tienda (ronda 7)

El inventario de la tienda (por ejemplo `INVENTARIO_2026_Actualizado.xlsx`) se carga tal como está. El archivo necesita la hoja de inventario con estas columnas: **ID, DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y PRECIO DETALLE**.

1. Crea el administrador (`pnpm --filter @fitstore/api admin:create`, ver DESPLIEGUE.md).
2. Prueba sin guardar nada: `pnpm --filter @fitstore/api inventory:import ruta/al/INVENTARIO.xlsx --dry-run --sin-lotes --inactivar-precio-menor-o-igual-costo`.
3. Después de revisar el CSV y hacer un respaldo, carga: `pnpm --filter @fitstore/api inventory:import ruta/al/INVENTARIO.xlsx --sin-lotes --inactivar-precio-menor-o-igual-costo`.
   - `--sin-lotes` hace falta la primera vez: el administrador crea Suplementos y Maquillaje con lote y vencimiento obligatorios, y el Excel no los trae.
   - Sin esa opción, la carga se detiene sin escribir nada y explica qué hacer.
   - Con ella, se desactiva el control en esas categorías y queda en la bitácora.
   - `--inactivar-precio-menor-o-igual-costo` conserva los valores originales,
     pero impide vender los artículos con margen nulo o negativo hasta que se
     corrijan y activen. Un error al escribir una opción detiene la carga.
4. Abre `revision-inventario.csv` en Excel. Ahí están los productos que conviene revisar:
   - sin precio o sin costo (quedan **inactivos** y no se venden);
   - con precio igual o menor que el costo (quedan **inactivos** al usar la
     política segura);
   - con margen menor que 15% sin ITBIS;
   - sin existencia.

Qué hace la carga:

- **Productos:** crea uno por fila, en su categoría (Suplementos, Maquillaje, Fajas). La marca de los suplementos se toma del nombre ("Producto - Marca - Presentación").
- **Códigos:** el **ID** (1001, 1223…) es el código para cobrar. Si la REFERENCIA o la descripción ("Barcode 0815…") traen otro número, ese es el código de barras y también sirve para escanear.
- **Existencias:** entran al kardex como "Inventario inicial", con su costo.
- **Lotes:** el Excel no trae lotes ni vencimientos, así que esas categorías no los exigen y la caja vende sin pedir datos extra.
- **Archivo rechazado:** la carga no guarda nada y explica qué corregir si:
  - un ID, una REFERENCIA o un código de barras se repite;
  - una REFERENCIA es el ID de otra fila;
  - un código ya es de otro producto del sistema;
  - un número es ambiguo ("1.250" o "1,250": escríbelo 1250 o 1,25). Se aceptan "1,5", "1.250,50" y "1,250.50".

Al repetir la carga con el mismo archivo, o con uno corregido, no se duplica nada ni se pisa lo editado en la app (precio, costo promedio, mínimos, activo). Sólo:

- crea los productos nuevos;
- activa los que estaban inactivos porque les faltaba precio o costo y ahora los tienen;
- con `--actualizar-precios`, cambia los precios al valor del Excel y lo deja en la bitácora.

Las existencias de un producto ya cargado nunca se tocan: los cambios de stock se hacen con Mercancía o ajustes.

## Cobrar rápido en la caja

- **Por código:** escribe el ID del producto (por ejemplo 1002) o escanéalo y pulsa Enter: entra al carrito.
  - Si no queda stock, el aviso queda a la vista y el código queda seleccionado; el siguiente escaneo lo reemplaza.
  - Un código que no existe muestra "Código no encontrado".
- **Por palabras:** escribe palabras sueltas, sin acentos ni orden: "iso100 vanilla", "moira 275n", "cinturilla 2xs", "loreal". Si ningún producto tiene todas las palabras (por ejemplo "proteina whey", con los nombres en inglés), la caja muestra los más parecidos.
- **Catálogo:** la caja muestra hasta 120 tarjetas; escribe para encontrar el resto. Cada tarjeta muestra el nombre completo en dos líneas (con el tono, la talla o el sabor) y el código.

## Comenzar el día

1. Inicia sesión con tu correo y contraseña.
2. En **Caja**, pulsa **Abrir caja** e indica el efectivo inicial y una terminal única. Cada usuario y terminal puede tener una sola caja abierta.
3. En **Punto de venta**, busca un producto por nombre, SKU o código. Un lector USB/Bluetooth funciona como teclado: escanea y presiona Enter.
4. Si el producto tiene variantes, elige su talla, color, sabor o tono. El stock se controla por variante y, cuando corresponde, por lote.

## Cobrar

Agrega los productos al carrito. Ajusta cantidades o descuentos por línea y globales. Un vendedor necesita un PIN de gerente para superar el límite configurado, inicialmente 10%.

Pulsa **Cobrar**. Selecciona efectivo, tarjeta o transferencia e introduce el monto. **Agregar pago** permite combinar varios métodos. Para tarjeta se requieren los últimos cuatro dígitos y la aprobación del datáfono; no se almacenan números completos de tarjetas. Para transferencia se requieren banco y referencia.

Sólo el efectivo genera cambio. No se finaliza una factura incompletamente pagada. La API vuelve a calcular el total y comprueba el stock dentro de la transacción.

Después de finalizar, puedes imprimir un ticket, descargar el PDF o abrir un borrador de WhatsApp/correo. El operador realiza el envío; la aplicación no envía comunicaciones por su cuenta. Todos los documentos actuales son **internos y no fiscales**.

## Ventas en espera y cotizaciones

**En espera** guarda un carrito en el servidor. **Cotizar** lo guarda como proforma. El botón superior **En espera** permite recuperar ambos tipos. Las cantidades y precios se verifican nuevamente al facturar.

## Catálogo y compras

En **Productos**, crea productos con SKU y códigos únicos, precio, costo, categoría y fotografía por URL. El stock inicial se registra como recepción o ajuste, conservando el kardex. El botón de variantes genera la combinación de dos atributos. La ficha incluye General, Variantes, Lotes y Kardex.

Descarga **Plantilla** para importar `.xlsx`. La hoja Categorías contiene los IDs necesarios. La importación es atómica: si una fila falla, ninguna se guarda. Máximo 500 filas y 5 MB por archivo.

En **Compras**, crea proveedores y órdenes de uno o varios artículos. **Recibir** permite recepciones parciales con lote, vencimiento, flete y otros costos. El servidor prorratea los gastos y actualiza el costo promedio ponderado.

## Inventario

**Ajustar** exige motivo. Una entrada a productos con lote requiere número de lote y vencimiento; una salida exige elegir el lote existente. Merma y devolución a proveedor son tipos de salida, con cantidades negativas.

**Contar** guarda un conteo para aprobación de un gerente/administrador. Si hubo movimientos posteriores, el servidor exige repetirlo. En esta versión, los conteos aprobados son por variante sin lote; los productos con lote se ajustan desde su lote específico.

El POS aplica FEFO automáticamente y no vende lotes vencidos. Un lote vencido sigue registrado hasta que el operador lo retire como merma.

## Devolver o anular

Gerente y administrador pueden hacerlo desde **Ventas**, con una caja abierta. Una devolución elige artículo, cantidad, motivo y método de reembolso. Se conserva una nota de crédito interna. Productos abiertos de suplementos/maquillaje y cualquier producto dañado no pueden volver al stock vendible.

La demostración configura 30 días de devolución; el negocio debe confirmar ese plazo antes de utilizar datos reales. Las devoluciones repetidas no pueden superar la cantidad comprada.

La anulación exige motivo, conserva la factura y restaura inventario. Sólo se anulan ventas de la caja actual sin devoluciones previas. Para cajas anteriores, registra una devolución. Los cambios de talla se realizan como devolución y una nueva venta.

## Gastos y cierre

Registra un gasto con categoría, monto, método y fecha. Las tarjetas de presupuesto muestran el consumo del mes. La marca **recurrente** identifica gastos mensuales; la generación automática mensual todavía está pendiente.

En **Caja**, registra entradas/salidas con motivo. Para cerrar, declara efectivo, tarjeta y transferencia contados. El reporte mantiene esperado, contado y diferencias. Una diferencia total cero puede esconder diferencias compensadas entre métodos; revisa cada método.

## Reportes y promociones

**Reportes** ofrece 17 vistas con fechas y exportación PDF/Excel. Los detalles se limitan a 10,000 facturas por período; reduce el rango para exportaciones mayores. Ventas muestra montos con ITBIS; la ganancia usa ventas sin impuesto y costo guardado al vender, restando gastos y comisión bancaria.

**Promociones** permite porcentaje, descuento fijo por unidad, precio especial, N×M y segundo a mitad de precio. Liquidación prioriza productos sin ventas y próximos a vencer. El descuento sugerido considera ITBIS y costo; un descuento mayor requiere revisar el margen. Las ofertas de liquidación actuales afectan la variante completa, no sólo un lote.

## Trabajar sin conexión

Primero abre la app en línea y entra al POS para descargar catálogo, categorías, clientes, promociones y la caja actual. En producción, instala la PWA desde el navegador y espera a que cargue completamente antes de desconectarte.

**Las ventas sin conexión están desactivadas por defecto.** Es la opción más segura cuando varias cajas comparten inventario: dos laptops desconectadas no pueden reservar entre sí la última unidad. En ese estado, la caja permite consultar su copia local, pero exige conexión para finalizar una venta. Sólo el administrador puede habilitarlas en **Ajustes > Permitir ventas sin conexión**, después de aceptar que tendrá que revisar posibles conflictos al reconectar. Un equipo que ya está desconectado no puede recibir un cambio de configuración: después de activar o desactivar esta opción, conecta y actualiza todas las cajas antes de depender del nuevo valor.

Con esa opción habilitada, una venta iniciada sin conexión conserva un UUID y un número provisional en este dispositivo, y descuenta únicamente la copia local del stock de esa caja. Al volver la conexión se reintenta con el mismo UUID. El servidor crea una sola factura y asigna su número definitivo. Si cambiaron los precios, se cerró la caja o falta stock, queda **Requiere revisión** en Caja; la venta local no se borra. Habilitar esta función no garantiza que dos cajas offline no vendan la misma última unidad.

Si el cobro se inició en línea pero la respuesta se perdió, el sistema no puede saber de inmediato si el servidor lo registró. Conserva el mismo UUID como **Pendiente** sin imprimir ticket, limpiar el carrito ni descontar otra vez el stock local. No vuelvas a cobrar esa operación: al regresar la conexión se comprueba automáticamente y, si ya existía, no se duplica. El PIN del gerente nunca se guarda en el dispositivo; una aprobación que no llegó al servidor quedará para revisión.

Los descuentos superiores al límite no se autorizan offline. Cada usuario sólo sincroniza sus propias ventas. No borres datos del navegador ni reinstales la app mientras existan ventas pendientes. La recuperación de conflictos requiere revisar la operación física y sus pagos antes de reintentar.

## Atajos

| Tecla        | Acción                    |
| ------------ | ------------------------- |
| F2           | Buscar producto           |
| F4           | Elegir cliente            |
| F8           | Guardar carrito en espera |
| F12          | Cobrar                    |
| Ctrl/Cmd + K | Navegar entre pantallas   |
| Esc          | Cerrar diálogo            |

## Roles y configuración

El vendedor vende, consulta stock/precios, administra clientes y su caja. El servidor oculta costos y ganancias. Almacén recibe y ajusta inventario. Gerente administra compras, gastos, reportes, promociones y devoluciones. Administrador configura negocio, usuarios y permisos granulares.

En el menú de cuenta puedes cambiar de vendedor con PIN. Cambiarlo limpia el carrito sin guardar; guárdalo antes si quieres retomarlo. El cierre por inactividad usa los minutos configurados en Ajustes, tanto en cliente como en API. Cambiar contraseña o PIN revoca las sesiones anteriores.

## Descuentos por monto, notas de crédito y crédito

En la línea del carrito puedes indicar porcentaje o RD$. Se aplica el mayor de los dos y luego el descuento global; el total compara también las promociones. Un descuento superior al límite pide PIN de gerente. El intento incorrecto bloquea la autorización del solicitante tras cinco fallos, sin bloquear la cuenta del gerente.

Para usar una nota de crédito, selecciona el cliente y el método **Nota de crédito**, elige la nota y el monto. El saldo no puede excederse ni producir cambio.

El administrador puede habilitar **Ventas a crédito** en Ajustes. Selecciona cliente, agrega **A crédito** y su vencimiento. En **Ventas**, la columna **Saldo a crédito** muestra la deuda; **Registrar abono** cobra en tu caja abierta. El abono puede ser efectivo, tarjeta o transferencia. Una devolución reduce primero el saldo pendiente y reembolsa únicamente lo ya cobrado que corresponda.

## Caja, conexión y alertas

El cierre muestra las diferencias de efectivo, tarjeta y transferencia por separado. Una compensación entre métodos no oculta el faltante de efectivo. Gerentes pueden arquear cajas de vendedores desde el historial.

Antes de cerrar, sincroniza o revisa las ventas pendientes del dispositivo. Si otro dispositivo ya cerró la caja, una venta offline registrada durante su apertura puede sincronizarse: se recalcula el esperado y queda el reajuste auditado, conservando el conteo original.

**Stock negativo** está desactivado por defecto. Habilitarlo permite vender existencia sin lote por debajo de cero y genera advertencias; no omite vencimientos ni lotes obligatorios. Reconcilia el inventario con ajustes o recepciones y revisa el kardex.

Las alertas de baja venta comparan el mes anterior con el promedio de tres meses anteriores. Los descuentos inusuales se revisan por porcentaje y cantidad de descuentos diarios. Sus límites se editan en Ajustes. El Resumen añade mapa de horas pico y comparación anual.

## Solicitud de NCF

Ajustes permite preparar una solicitud de NCF. El cobro registra tipo y, para crédito fiscal, RNC o cédula del cliente. La preparación no emite un NCF: los recibos siguen identificados como documentos internos no fiscales.

## Controles de crédito y notas (revisión 2)

El gerente configura el límite de crédito de cada cliente. Crédito y contraentrega forman un mismo saldo pendiente: la deuda previa más la venta nueva no puede superar un límite mayor que cero. Se conserva la regla histórica del sistema: **límite 0 significa sin tope configurado**, no crédito prohibido; para impedir ambos tipos de venta se desactiva «Permitir ventas a crédito» en Ajustes. Ajustes también define el monto pendiente que exige aprobación, inicialmente RD$1,000; por encima de ese umbral el personal sin permiso `sale:manage` debe introducir el PIN de un gerente, mientras que quien ya tiene ese permiso autoriza con su propia sesión.

Para pagar con una nota, selecciona el cliente o introduce su código impreso. El vendedor sólo puede consultar notas del cliente seleccionado o buscar por código. Una nota asignada a un cliente requiere ese mismo cliente en la venta y su código o un PIN de gerente. Una nota sin cliente requiere siempre su código. Desde Ventas, el gerente imprime el PDF de la nota con su código. Cada uso queda auditado y no genera cambio.

Un abono por transferencia queda pendiente y reserva ese monto, pero la deuda sólo disminuye al verificarlo. La verificación repetida no vuelve a descontarlo. El abono entra al esperado de caja al verificarse; si la caja ya cerró, se recalculan sus diferencias y se audita el cambio.

Las ventas offline sólo se aceptan dentro del horario de la caja propia indicada y con captura de hasta 48 horas de antigüedad. El servidor audita la fecha original y la fecha de recepción. Una operación rechazada permanece como conflicto para revisión.

## Equipos y stock en tiempo real (ronda 3)

Cada navegador registra un equipo con un identificador propio al iniciar sesión. En **Configuración > Equipos**, gerente y administrador pueden cambiar su nombre (por ejemplo, Caja 1 o Celular principal), ver conexión, última actividad y caja abierta, y revocar sus sesiones. Al entrar por primera vez se asigna un nombre provisional que puedes cambiar. No compartas el mismo usuario entre cajas simultáneas: cada vendedor tiene su propia caja. Un usuario que cambia de equipo debe cerrar su caja anterior antes de abrir otra. Las cajas anteriores sin identificador de equipo se vinculan durante el primer registro.

El stock, inventario, resumen y alertas se actualizan por eventos SSE de la sucursal, después de confirmar la transacción. Si una variante del carrito se agota, aparece un aviso y el servidor vuelve a comprobar existencias al cobrar. Al recuperar la conexión se descarga el catálogo completo. Una conexión interrumpida se reintenta automáticamente; el navegador usa el token de sesión en una cabecera, nunca en la URL. La campana indica si hay alertas nuevas.

## Equipos aprobados y caja por equipo (ronda 4)

Cada computadora, laptop o celular que factura, cobra, abre o cierra caja, ajusta inventario o mueve mercancía debe ser un **equipo aprobado**. El navegador guarda un identificador y un secreto propios; no se pueden copiar a otro dispositivo para hacerse pasar por él.

- **Gerente o administrador** que entra en un equipo nuevo lo aprueba automáticamente.
- **Vendedor o almacén** en un equipo nuevo ve el aviso **Este equipo necesita aprobación**. Puede consultar, pero no operar. Un gerente lo aprueba escribiendo su PIN en ese mismo equipo, o desde **Configuración › Equipos › Aprobar**. Aprovecha para ponerle nombre (Caja 1, Laptop de Camila, Celular almacén).
- **Revocar** un equipo cierra sus sesiones y ese equipo no puede volver a operar. Si se registra como equipo nuevo, vuelve a necesitar aprobación.
- La lista de equipos muestra estado (aprobado, pendiente, revocado), si está conectado, el último usuario y la caja abierta.

La caja abierta pertenece a un usuario y a un equipo. Si entras desde otro equipo con tu caja abierta, Punto de venta y Caja muestran **Tu caja está abierta en «…»** y no permiten cobrar ahí. Puedes cerrarla y arquearla desde cualquier equipo, o pulsar **Trasladar caja aquí**: el vendedor necesita el PIN de un gerente y el traslado queda en la bitácora con ambos equipos. Un gerente puede cerrar la caja de un vendedor desde su propio equipo.

## Actualización a la ronda 6: equipos anteriores y compras

**Equipos registrados antes de la ronda 4.** Después de actualizar, aparecen como **Pendiente** con el aviso «Equipo de antes de la actualización». El identificador de un equipo antiguo no prueba que sea ese dispositivo, así que nadie opera con él hasta que un gerente lo aprueba:

1. Abre FitStore en ese equipo. Se identifica solo y queda pendiente con el nombre de quien lo reclamó.
2. Si ese es el dispositivo correcto, apruébalo con el PIN de gerente en el propio equipo o desde **Configuración › Equipos › Aprobar**. Si no reconoces a quien lo reclamó, pulsa **Revocar equipo**.
3. Un equipo antiguo que todavía no se ha identificado no se puede aprobar; ábrelo primero en el dispositivo.

Un gerente o administrador que reclama un equipo antiguo desde ese mismo dispositivo lo aprueba al hacerlo, y queda en la bitácora.

**Reporte de compras y cuentas por pagar.** Columnas:

- **Ordenado**: órdenes creadas en el periodo. Es un compromiso y no es deuda.
- **Compras**: lo recibido o facturado y aceptado, a su costo real con flete e impuestos. Cuenta con o sin orden y suma cada recepción parcial una sola vez.
- **Pagado** y **Pendiente**: Pendiente es Compras menos Pagado. Un valor negativo significa un anticipo al proveedor.
- **Sin conciliar**: recepciones antiguas sin total comprobable.

La fila **Recepciones sin proveedor (conciliar)** agrupa las recepciones que no pertenecen a ningún proveedor. Las compras de antes de la actualización se recuperaron de la bitácora; lo que no tenía evidencia suficiente quedó sin conciliar, sin inventar proveedor ni importe.

**Cantidades.** Todas las rutas aceptan como mínimo 0.001 y como máximo 3 decimales: venta, devolución, entrada, recepción de orden, ajuste, conteo y cotización.

## Mercancía desde el celular

Disponible para administrador, gerente y almacén. En el celular hay un botón grande **Mercancía** en la barra inferior. El vendedor no puede acceder a estos endpoints. Almacén puede registrar cantidades y costos de entrada, pero no consultar ganancias.

**ENTRADA**: proveedor y orden de compra son opcionales. Una orden carga sus cantidades pendientes; revisa sus costos antes de confirmar. Sin orden, agrega productos por selector, lector o cámara. **Escanear continuamente** deja la cámara abierta: cada lectura suma una unidad y vibra si el dispositivo lo permite. Una lectura repetida del mismo código se limita a una cada 1,2 segundos. Comprueba las cantidades antes de confirmar. Usa HTTPS y permite la cámara; también puedes escribir el código manualmente.

Busca productos por nombre, SKU, sabor, talla o color; cada resultado muestra la variante y sus existencias. Quien no ve costos (almacén) debe escribir el costo unitario de cada línea: la app nunca lo rellena con un valor inventado. Gerente y administrador ven el costo promedio actual, cuánto sube o baja y un aviso si el margen queda bajo. Cada línea permite editar cantidad y costo. Las categorías que lo exigen piden lote y vencimiento. No se recibe mercancía vencida ni se cambia la fecha de un lote existente. Un código desconocido ofrece **Crear producto rápido**: nombre, categoría, precio, costo, código y variante. La creación se guarda junto con la entrada, dentro de la misma transacción. Si la crea almacén, el producto queda **inactivo** con una alerta para que un gerente revise el precio y lo active antes de venderlo. Flete e impuestos adicionales se prorratean por valor y forman parte del costo promedio; no vuelvas a añadir impuestos que ya estén incluidos en el costo unitario.

Pulsa **Confirmar entrada**, revisa la confirmación y después **Imprimir etiquetas de lo recibido**. Las entradas confirmadas de este usuario quedan disponibles para reimprimir, incluidas las que se sincronizaron desde la cola. El diálogo del navegador requiere impresora configurada.

**SALIDA**: escanea o selecciona mercancía, revisa cantidad y lote cuando corresponda, y elige merma, dañado, vencido, muestra, uso interno o devolución a proveedor. Confirma antes de aplicar. La salida conserva motivo, usuario, equipo y hora en auditoría y kardex. Se permite retirar un lote vencido, pero no superar sus existencias.

## Mercancía sin conexión

Abre Mercancía en línea al menos una vez para descargar catálogo, categorías y proveedores. Instala la PWA y deja completar su precarga antes de trabajar offline, especialmente para usar la cámara. Las órdenes de compra y la extracción de facturas necesitan conexión; una entrada o salida ya revisada se puede guardar en la cola local.

Cada operación conserva un UUID, usuario y sucursal. Al reconectar se sincroniza una sola vez; los reintentos del mismo UUID no duplican recepciones ni movimientos. Las operaciones que chocan con stock, lotes o permisos quedan en **Requiere revisión**. **Reintentar** conserva sus datos; **Revisar** carga las líneas para corregirlas antes de confirmar otra vez. Si el servidor ya aceptó ese UUID con otros datos, lo rechaza: comprueba la operación confirmada antes de crear una distinta. No borres el almacenamiento ni reinstales mientras haya operaciones pendientes. Un equipo revocado no puede sincronizar.

## Importar factura del proveedor

Desde ENTRADA, selecciona proveedor si corresponde y pulsa **Importar factura del proveedor**. Usa Excel `.xlsx` o CSV con encabezados. Se reconocen columnas como Código, Referencia, Descripción, Producto, Cantidad, Costo o Precio unitario; si tu archivo usa otros nombres, escríbelos en el formulario (el mapeo se recuerda por proveedor). Los encabezados pueden estar debajo del membrete del proveedor. Se aceptan números como `1,200.00`, `RD$ 450`, `1.250,00` o `0,75`; CSV separado por coma, punto y coma o tabulador, incluido el que guarda Excel en español; los códigos conservan sus ceros iniciales. Las filas de sección, subtotal, ITBIS y total se omiten. Si una fila tiene cantidad o costo inválido, el aviso indica la fila. Máximo 1 MB para Excel/CSV (5 MB para fotos/PDF) y 200 líneas de productos.

Con `ANTHROPIC_API_KEY` configurada en el servidor también se aceptan fotos JPEG/PNG/WebP y PDF. Sin clave, el selector sólo ofrece Excel/CSV. Al usar foto/PDF, el documento se envía a Anthropic para extraer las líneas y el total. Por defecto se usa Claude Opus 5.5 (`claude-opus-5-5`) con salida estructurada; las líneas ilegibles se omiten y se avisa cuántas fueron. El modelo se puede configurar con `ANTHROPIC_MODEL`; nunca pongas la clave en el navegador ni en el ZIP.

La pantalla **Revisión de factura** es obligatoria. Busca coincidencias por barras, SKU, equivalencia del proveedor y similitud de nombre. La variante (sabor, tamaño, talla, color) sólo se elige sola si la factura la indica sin ambigüedad; si no, se sugiere el producto y debes elegir la variante en la lista. Cada línea muestra sugerencia, confianza y el texto original de la factura; revisa incluso las coincidencias exactas. Las líneas sin pareja se resaltan en amarillo y con texto: debes elegir o crear el producto. Puedes modificar cantidades, costos, lote y vencimiento. Ningún stock cambia al subir el archivo.

Compara el total de las líneas más flete e impuestos adicionales con el total de la factura. Si difiere, la app lo avisa y exige revisar y confirmar la diferencia. En Excel/CSV introduce el total manualmente; si la IA no lo identifica, introdúcelo también. Después de **Confirmar entrada** se crean recepción, movimientos, costo promedio, equivalencias de códigos y eventos. El comprobante original queda guardado de forma privada en PostgreSQL y se puede descargar desde la revisión. No se garantiza exactitud del OCR: la revisión humana es parte del proceso.
