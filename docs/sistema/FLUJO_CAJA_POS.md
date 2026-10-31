# Flujo de caja y punto de venta, paso a paso

Rama `cola-n26` (= `nexora-cloud`). Etiquetas copiadas del código tal cual. Cada paso lleva `archivo:línea`.

Resumen de pantallas que usa el cajero: **Caja** (abrir y cerrar) y **Punto de venta** (vender). Las dos están en el menú lateral (`apps/web/src/App.tsx:209`, `:250`).

---

## 0. Antes de empezar

- Entrar: pantalla de acceso con campo «Tu usuario o correo» y «Tu contraseña», botón **«Entrar a mi tienda»** (`apps/web/src/App.tsx:466`, `:512`). La contraseña temporal se cambia al entrar (`apps/web/src/App.tsx:546`).
- El equipo (computadora) debe estar **aprobado**. Si no, sale «Este equipo necesita aprobación … un gerente debe aprobarlo: con su PIN aquí mismo o desde Configuración › Equipos» (`apps/web/src/realtime.tsx:513-516`). Sin equipo aprobado no se puede vender ni mover mercancía (`apps/api/src/common.ts` decorador `RequireTerminal`, usado en `apps/api/src/sales.ts:1475` y `apps/api/src/cash.ts:838`).
- Cambiar de cajera sin salir: menú de la cuenta › **«Cambiar de usuario con PIN»** (`apps/web/src/App.tsx:1159`). No se puede cambiar con PIN a alguien con más permisos (`apps/api/src/auth.ts:845-859`).

## 1. Abrir la caja

1. Menú lateral › **Caja** (`apps/web/src/App.tsx:250`).
2. Si no hay caja abierta se ve el título «Una caja que siempre cuadra» y el botón **«Abrir caja»** (`apps/web/src/Management.tsx:1670-1677`), o en el centro **«Abrir mi caja»** con el texto «Tu día empieza con una caja abierta» (`:1740-1744`).
3. Se abre la ventana **«Abrir mi caja»** (`:2017`). Campo **«Efectivo inicial»** (`:2022`). El sistema sugiere lo que la misma persona dejó en su último cierre: «Sugerido: lo que dejaste en tu último cierre.» (`:2025-2028`, API `apps/api/src/cash.ts:1433-1468`).
4. Si el fondo es **menor** que lo sugerido aparece **«Nota si el fondo es menor que el sugerido»** y es obligatoria; no pide PIN (`apps/web/src/Management.tsx:2029-2039`; `apps/api/src/cash.ts:868-885`).
5. Se guarda con `POST /cash-sessions/open` (`apps/api/src/cash.ts:837-947`). Requiere permiso `cash:write`. Una persona solo puede tener **una caja abierta**; si pulsa «Abrir» otra vez devuelve la misma (`apps/api/src/cash.ts:893-908`). La caja es de quien la abre, no del equipo.
6. En el Punto de venta el estado pasa de «Caja sin abrir» a **«Caja abierta»** (`apps/web/src/POS.tsx:1024-1028`). Si se intenta cobrar sin caja: «Abre tu caja antes de cobrar.» (`:523`); además aparece el enlace **«Abre tu caja para comenzar»** que lleva a Caja (`:1218-1221`).
7. Si la caja quedó abierta en **otro equipo**: «Tu caja está abierta en «…». Para cobrar aquí, trasládala a este equipo o ciérrala en el otro.» con el botón **«Trasladar caja aquí»** y la ventana «Trasladar caja a este equipo» (botón **«Trasladar caja»**; pide PIN de gerente según el caso) (`apps/web/src/realtime.tsx:629-668`; API `apps/api/src/cash.ts:1061-1111`).

Caja ciega: mientras está abierta, quien no tiene `profit:read` ni `sale:manage` no ve los montos esperados. El texto: «Arqueo ciego activo…» (`apps/web/src/managementMessages.ts:41-44`, `apps/web/src/Management.tsx:1731-1736`; regla `apps/api/src/common.ts:70-72`).

## 2. Abrir el Punto de venta y elegir cliente

1. Menú › **Punto de venta** (`apps/web/src/App.tsx:209`). Título «Punto de venta» (`apps/web/src/POS.tsx:902`).
2. El cliente es **obligatorio**. Botón **«Selecciona el cliente»** con la leyenda «Elegir cliente · F4» (`:1033-1051`; atajo F4 `:567-571`). Si se pulsa «Cobrar» sin cliente se abre la ventana con el aviso «Selecciona o crea el cliente antes de cobrar.» (`:517-521`).
3. Ventana **«¿Para quién es esta venta?»** (`:1318`): buscar por «Nombre, teléfono o cédula» (`:1420`); Enter elige el primero si es único (`:1426-1441`). «Consumidor final» sale primero si existe (`:360-377`). Si no está: **«Nuevo cliente aquí mismo»** (`:1474-1477`) → formulario «Nombre del cliente *», «Teléfono», «RNC o cédula», «Correo electrónico» → **«Guardar y usar cliente»** (`:1354-1409`).
4. Interruptor «al por mayor» (`WholesaleToggle`, `apps/web/src/POS.tsx:1052`; solo cambia el incentivo de la cajera a la mitad, no los precios: `apps/api/prisma/schema.prisma` campo `wholesale` de `Sale`).

## 3. Agregar productos al carrito

**No existe un botón «Agregar».** El producto entra al carrito de cualquiera de estas tres formas:

### 3.1 Un clic en la tarjeta del catálogo (la forma normal)

- Cada producto es una tarjeta-botón; `onClick={() => onAdd(p)}` en `apps/web/src/POS.tsx:1543`. La tarjeta tiene un ícono «+» solo de adorno (`:1565-1567`), no es un botón aparte.
- Si el producto tiene **una sola variante**, entra directo (`:425-430`). Si tiene varias, abre la ventana con el nombre del producto y «Elige la combinación para esta venta.» (`:1284-1314`) y se pulsa la variante (talla, color, sabor).
- Cada pulsación suma **1 unidad**; para más se usa el **+** del carrito (`:1093-1106`) o se vuelve a pulsar la tarjeta.
- Una tarjeta sin existencia está deshabilitada («Agotado»), salvo que Configuración permita stock negativo y la categoría no exija lote (`:1551-1553`, `:1560-1563`). Si no alcanza: «No hay suficiente stock de X (quedan N).» (`:397-405`).
- Filtrar por categoría: pestañas «Todos los productos» y una por categoría (`:958-982`).

### 3.2 Buscador (nombre o código)

- Campo con placeholder **«Código o nombre del producto»** y etiqueta «F2» (`:904-919`). F2 lo enfoca (`:563-566`). Si se escribe sin tener el foco en un campo, el texto va solo al buscador (`:639-653`).
- La búsqueda entiende palabras sueltas, sin tildes ni orden (`:660-701`).
- **Enter** en el buscador: si el texto es un código exacto de barras o SKU, lo agrega (`:714-731`, `:815-820`); si el nombre da **un solo** producto, lo agrega (o abre las variantes si tiene varias) (`:831-846`); si hay varios o ninguno: «No se agregó nada: elige el producto en la lista.» / «…no hay productos con esas palabras.» (`:847-852`). Un código que no existe: «Código no encontrado: X.» (`:829-830`, `:811`).

### 3.3 Lector de código de barras o cámara

- Un lector USB escribe como teclado y manda Enter: entra por el buscador (3.2). Pitido corto al agregar, grave si falla; se puede apagar con el botón «Pitido del lector» (`:933-948`; `apps/web/src/scanSound.ts`).
- Botón de cámara (aria «Escanear con cámara», `:949-955`): ventana **«Escanear código de barras»** «Centra el código en la cámara.» (`:2993-3000`).
- Mientras carga el catálogo, los escaneos quedan en cola y se agregan al terminar (`:739-755`).

### 3.4 Ajustar el carrito

- **Venta actual** (`:1021`), contador de artículos (`:1031`). Por línea: **−** «Reducir X» y **+** «Aumentar X» (`:1086-1106`), **×** «Quitar X» (`:1163-1168`).
- Pie del carrito: **«Limpiar»** (vacía con 8 s para «Deshacer», `:489-512`, `:1244-1247`), **«En espera»** (F8, guarda el carrito: `:456-488`, `:1236-1239`), **«Cotizar»** (guarda como cotización, `:1240-1243`). El botón superior **«En espera»** abre «Ventas en espera y cotizaciones» para recuperarlas (`:929-932`, `:1702`).
- **«Preguntas»** abre preguntas rápidas sin IA (`:921-928`, `apps/web/src/QuickQuestions.tsx`).

## 4. Descuentos

- Por línea: campo **%** (aria «Descuento de X», 0-100) y campo **RD$** (aria «Descuento por monto de X») (`apps/web/src/POS.tsx:1108-1159`). Si se pasa de 100 % o del importe de la línea no se aplica y avisa (`:1124-1127`, `:1150-1155`).
- Global: **«Descuento global»** en % (`:1186-1207`).
- Líneas + global se combinan: `100 − (100−línea)(100−global)/100` (`:150-163`).
- **Promociones automáticas**: la caja usa el **mayor** entre el descuento manual y el de la promoción vigente (`:340-353`); el recibo nombra la promoción aplicada (`:2247-2250`). No se toca el precio de la variante.
- Al cobrar, si hay cualquier descuento: campo obligatorio **«Motivo del descuento»** (mín. 3 letras) (`:2908-2921`); queda en la auditoría de la venta.
- **PIN de gerente por descuento:** si algún descuento efectivo supera el «Descuento máximo del vendedor (%)» de Configuración (10 % por defecto: `apps/api/prisma/seed.ts:543`) y la persona no tiene `sale:manage`, aparece el campo «PIN del gerente para aprobar la venta · El descuento supera N % permitido al cajero.» (`apps/web/src/POS.tsx:1866-1884`, `:2448-2459`).
  - DUDOSO: la API pide el PIN cuando el descuento pasa el límite a cualquiera que no sea `*` (`apps/api/src/sales.ts:696-698`); la pantalla no lo pide a quien tiene `sale:manage` (`POS.tsx:1866`). Para un gerente (no `*`) puede salir el error «Esta operación requiere el PIN de un gerente.» (`sales.ts:701-707`) sin que la pantalla se lo haya pedido. No se probó.
- Aviso de margen: si hay descuento y la persona ve utilidades (`profit:read`), sale «Esta venta queda con margen X %. El aviso es informativo.» cuando baja de «Margen bajo» (15 % por defecto) (`:1915-1919`, `:2903-2907`).

## 5. Cobrar

1. Botón verde **«Cobrar»** con «F12» (`:1224-1234`; en celular, barra inferior `:1256-1283`). Solo habilitado con carrito no vacío.
2. Verificaciones (`:513-536`): sin cliente → pide cliente; sin caja abierta → «Abre tu caja antes de cobrar.»; caja en otro equipo → «Tu caja está abierta en «…». Trasládala a este equipo para cobrar.»
3. Se abre **«Todo listo para cobrar»** (`:2438`): «Total de esta venta», ITBIS incluido (`:2439-2447`).

### 5.1 Métodos de pago (botones exactos)

Cuadrícula de métodos (`:2535-2574`). Se elige el método, se escribe el monto («Monto del pago», `:2663-2685`) y se pulsa **«Agregar pago»** (`:2817-2824`). Se pueden combinar varios (hasta 20, `packages/shared/src/index.ts:639`). Pagos distintos de efectivo no pueden generar cambio (`packages/shared/src/index.ts:366-370`).

| Botón | Qué pide | Cita |
|---|---|---|
| **Efectivo** | Monto. Atajos «Exacto», 100, 200, 500, 1,000, 2,000. Calcula el **Cambio**. | `POS.tsx:2537`, `:2686-2704`, `:2853` |
| **Dólares (US$)** | Monto en dólares. Usa la **tasa del dólar de Configuración** y muestra «Tasa RD$ X por US$ 1 · Equivale a …». El cambio se da en pesos. Si no hay tasa: «No hay tasa del dólar en Configuración: no se puede cobrar en dólares.» Se guarda como efectivo con moneda USD. | `POS.tsx:2538`, `:1920-1957`, `:2676-2684` |
| **Tarjeta** | **Últimos 4 dígitos**, **Número de aprobación**, **Marca** (Visa/Mastercard/Amex), **Terminal** (lista de «Terminales de tarjeta» de Configuración; obligatorio si hay lista), **Tipo de tarjeta** (Crédito/Débito). La API exige últimos 4 y aprobación. | `POS.tsx:2539`, `:2705-2775`; `sales.ts:993-995` |
| **Transferencia** | **«Cuenta donde cayó»** (lista desplegable con «Cuentas de banco para transferencias» de Configuración; si no hay lista, es texto libre) y **«Referencia»**. Ambos obligatorios. Queda **por verificar** (ver `FLUJO_COBROS_Y_TRANSFERENCIAS.md`). | `POS.tsx:2540`, `:2776-2816`; `sales.ts:996-997`, `:1380` |
| **Nota de crédito** | **«Código impreso de la nota»** (32 caracteres) y **«Nota de crédito disponible»** (lista). Notas sin cliente exigen el código; las demás pueden aprobarse con PIN de gerente. No sirve para vender sin pago. | `POS.tsx:2541`, `:2610-2654`; `sales.ts:1062-1090` |
| **Contraentrega** | Venta que sale ahora y se cobra cuando el mensajero trae el dinero. Exige cliente. Método interno `cod`, etiqueta «Contraentrega (paga al recibir)». | `POS.tsx:2545`, `:2490-2491`, `:2655-2662` |
| **Crédito** | Igual que contraentrega pero etiquetada «Crédito (paga después)». También método interno `cod` (la etiqueta es solo estadística). Exige cliente. | `POS.tsx:2548`, `:1798-1802`, `:2071` |

- Hay además el atajo **«Vender a crédito (queda pendiente)»**: toma todo lo que falta y lo deja como crédito/contraentrega sin escribir montos; pide confirmar con **«Sí, vender a crédito»** y escoger «Crédito (paga después)» o «Contraentrega (paga al recibir)» (`:2460-2534`, función `:1996-2013`). Necesita **cliente** y **conexión** (`:1998-2009`).
- **PIN de gerente en crédito/contraentrega** (`packages/shared/src/index.ts:446`): crédito sobre el umbral «RD$ 1,000» (`creditApprovalThreshold`); contraentrega de quien no tiene `sale:manage` sobre el umbral, o por cualquier monto si «Habilitar ventas a crédito» está apagado en Configuración; deuda abierta del cliente + esta venta sobre el umbral; y lo dejado por cobrar en el turno sobre «RD$ 3,000» (`receivableShiftLimit`). El servidor repite la regla y, si hace falta, la pantalla muestra el campo del PIN (`POS.tsx:2280-2289`).
- **PIN de gerente en nota de crédito** sin código impreso: «La nota de crédito necesita aprobación del gerente.» (`POS.tsx:1872-1884`).
- Servidor, ventas a crédito puro (método `credit`): exige estar habilitado y fecha de vencimiento (`sales.ts:1053`); la pantalla de caja nunca envía `credit`, siempre `cod` con etiqueta.
- **Con envío:** si hay pago por transferencia o tarjeta aparece la casilla «Con envío (el cliente pagó el envío junto con la transferencia o tarjeta)», «Monto del envío» (1-5,000) y «Mensajero» (por defecto «Addison»). El envío va aparte del total (no es venta, ganancia ni ITBIS) y se paga luego en «Envíos del mensajero» (`:2857-2902`; regla servidor `sales.ts:722-733`).
- **Solicitud de NCF:** solo si Configuración tiene «Preparar solicitud (sin emisión fiscal)»: lista **«Solicitud de NCF»** con «Sin solicitud», «B01 · Crédito fiscal» (pide RNC o cédula) y «B02 · Consumidor final». Es preparación de datos; el comprobante sigue siendo interno (`:2580-2608`; `sales.ts:1050-1056`).
- Quitar un pago: botón «Quitar pago» (`:2836-2843`). Se ve «Pendiente» y «Cambio» (`:2847-2856`).

### 5.2 Finalizar

- Botón **«Finalizar venta»** (`:2927-2941`). Se habilita cuando: hay pagos, no queda «Pendiente», no falta el PIN y, si hay descuento, hay motivo. Debajo, una guía en texto de qué falta (`:2030-2040`, `:2942-2946`).
- La API crea la venta con número **FS-0000000** (siete dígitos, consecutivo por sucursal) (`apps/api/src/sales.ts:1095-1114`), descuenta inventario y registra pagos. Estado del pago: transferencia → `pending_verification`; crédito/contraentrega → `pending`; el resto → `ok` (`sales.ts:1377-1381`).
- Si el precio o una promoción cambió en otro equipo: «Los precios cambiaron: …. El total ya está actualizado: revisa los pagos y finaliza otra vez.» (`POS.tsx:2276-2277`, `:2303-2327`).

## 6. Recibo, comprobante e impresión

- **El recibo se genera solo** al finalizar y se muestra la ventana **«¡Una venta más, una meta más cerca!»** con el total, el número FS-xxxxxxx, el badge «Venta registrada» y el «Cambio» (`POS.tsx:2336-2379`). Si hubo crédito: «CRÉDITO · PENDIENTE DE PAGO» y el monto pendiente (`:2363-2375`).
- **¿Se imprime solo?** Depende de Configuración › «Imprimir el recibo automáticamente al cobrar» (`apps/web/src/Management.tsx:4031-4032`; por defecto apagado, `apps/api/src/admin.ts:123`). Si está activo: `printSoon()` (`POS.tsx:2267-2268`). Si no, se pulsa **«Imprimir recibo»** (`:2381-2384`, llama `window.print()`).
- Otros botones: **«Recibo PDF»** (`:2385-2398`; API `apps/api/src/sales.ts:4450`), **«WhatsApp»** y **«Correo»** con el texto del recibo (`:2399-2426`), **«Nueva venta»** (`:2428-2430`).
- Ancho del ticket 80 mm o 58 mm según Configuración (`POS.tsx:2431`; `admin.ts:91`).
- El recibo es **«DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL»**; el NCF solo se imprime si la venta ya trae uno y el modo es electrónico (`apps/web/src/Prints.tsx:509-510`, `:546-553`). Con solicitud B01/B02 imprime «Solicitud NCF … · pendiente de emisión fiscal» (`:625-626`). No hay NCF real emitido por este sistema.
- Reimpresión: pantalla **Ventas** › icono de descarga (PDF) en la fila (`Management.tsx:3247-3257`).
- Sin internet: solo si Configuración lo permite («Permitir ventas sin conexión»), la venta queda «Guardada en este dispositivo · Pendiente de sincronizar» con número LOCAL-xxxxxxxx; crédito, contraentrega, nota de crédito y descuentos con PIN requieren conexión (`POS.tsx:2146-2207`; `apps/api/src/admin.ts:96`). Por defecto está apagado.

## 7. Devolución y nota de crédito (NC)

1. Menú › **Ventas**; fila de la venta › **«Devolver»**. Requiere `sale:manage` y **caja propia abierta** («Abre tu caja para procesar devoluciones.») (`Management.tsx:3296-3319`).
2. Ventana **«Devolución · FS-…»** (`:3640`): «Artículo a devolver», «Cantidad», «Motivo», **«Método de reembolso»** (Efectivo, Tarjeta, Transferencia o **Nota de crédito**), casillas «Reingresar al stock vendible», «Producto abierto», «Producto dañado» (`:3643-3690`). API `POST /returns` (`apps/api/src/sales.ts:3223`).
3. Se crea la devolución con número **NC-000000** (`sales.ts:3350`). Si el reembolso es en efectivo desde la caja de **otra persona**, hace falta el PIN de su dueña o de otro gerente (`sales.ts:3046-3060`); si no hay efectivo suficiente: «No hay suficiente efectivo en caja para este reembolso. Reembolsa por el medio del pago original o como nota de crédito.» (`sales.ts:3336-3339`).
4. Con método «Nota de crédito» se crea la nota con un **código de canje** de 32 caracteres hex y saldo (`apps/api/prisma/schema.prisma` modelo `CreditNote`).
5. **¿Se imprime la nota?** No sale sola al devolver. Se imprime a mano: en **Ventas** › abrir la venta (ojo) › botón **«Imprimir nota NC-000000»** (solo `sale:manage`) (`Management.tsx:3390-3404`). Descarga un **PDF A4** «Nota de crédito · NC-… / Nota interna de crédito · no fiscal», con importe, saldo, motivo y el «Código para presentar en caja» (`apps/api/src/sales.ts:3469-3522`, ruta `GET /returns/:id/credit-note.pdf`). No se imprime en el ticket térmico.
6. Usarla: en el cobro, método **Nota de crédito**, escribir el código y elegir la nota (sección 5.1). Una nota con cliente solo la usa ese cliente (`sales.ts:1081`).

## 8. Anulación

- **Cajera:** en **Ventas**, solo sobre una venta suya completada y sin solicitud pendiente: **«Solicitar anulación»** → «Tipo de motivo» (Solicitud del cliente, Venta duplicada, Error de pago, Error de artículo, Otro) + «Explica el motivo» (`Management.tsx:3280-3295`, `:3555-3587`; API `apps/api/src/sales.ts:1862`).
- **Administración (`*`):** en **Ventas** › **«Anular»** (si no tiene devoluciones ni abonos válidos) con motivo → «Sí, anular venta» (`Management.tsx:3320-3334`, `:3540-3554`; API `POST /sales/:id/void`, `apps/api/src/sales.ts:2369-2377`). O en **Solicitudes de anulación** › **«Aprobar y anular»** (`apps/web/src/VoidRequests.tsx:123-129`). Nadie aprueba su propia solicitud (`sales.ts:2081`, `:2404`).
- Efecto: se conserva la venta con motivo y usuario, se revierte el inventario y deja de contar en ventas. Si la caja original ya cerró y hubo efectivo, el reembolso sale de la caja **abierta** de quien anula (`Management.tsx:3543`; `sales.ts:2429-2441`). Una venta cobrada en dólares con caja cerrada no se anula: se hace devolución (`sales.ts:2422-2427`).

## 9. Movimientos de efectivo durante el día

- Caja › **«Movimiento»** (`Management.tsx:1688-1692`). Ventana «Movimiento de efectivo»: Tipo («Entrada de efectivo» / «Salida de efectivo»), Monto, Motivo, y «PIN del gerente» (solo para salidas que superen el límite del turno; RD$ 1,000 por defecto: `apps/api/src/cash.ts:1010`, `apps/api/src/admin.ts:145-148`) (`Management.tsx:2057-2101`).
- Una salida nunca deja el efectivo por debajo de cero: «No hay suficiente efectivo en caja.» (`cash.ts:1036-1041`).

## 10. Cierre ciego y cuadre

1. Antes: **cerrar el lote del verifón** (datáfono). La ventana lo recuerda: «Antes de cerrar: cierra el lote del verifón (datáfono) para que los cobros con tarjeta caigan el próximo día.» (`apps/web/src/Tienda.tsx:329-332`).
2. Caja › **«Cerrar y arquear»** (`Management.tsx:1693`) → ventana **«Cuadre y cierre de caja»** (`Tienda.tsx:314`).
3. Texto: «Conteo ciego: declara lo que realmente tienes. La comparación con lo esperado aparece después de cerrar.» (`apps/web/src/managementMessages.ts:37-40`).
4. Se llena (`Tienda.tsx:334-453`):
   - **«Detalles de monedas»**: cantidad de cada denominación (1, 5, 10, 20, 25, 50, 100, 200, 500, 1,000, 2,000) → «Efectivo contado (Sub-total)» (`packages/shared/src/index.ts:649`).
   - **«Vale de caja»** (solo si ve esperados): exige nota y PIN de **otro** gerente; genera alerta alta (`apps/api/src/cash.ts:1139-1165`, `:1366-1385`).
   - **«Dólares US$»** / **«Euros €»** si hay tasa en Configuración.
   - **«Tarjeta declarada»** (obligatorio): el total que imprimió el verifón al cerrar el lote.
   - **«Número de lote del verifón»**: obligatorio si hubo cobros con tarjeta (`cash.ts:1196-1210`).
   - **«Entregado»** (efectivo que se le entrega a la dueña) y **«Dejado en caja»** (calculado; será el fondo sugerido de la próxima apertura) (`packages/shared/src/index.ts:687-700`).
   - **«Notas del cierre»**, y la casilla obligatoria «Confirmo que conté efectivo y tarjeta. Las transferencias las suma el sistema.»
5. Botón **«Cerrar caja e imprimir cuadre»** (`Tienda.tsx:464-467`). `POST /cash-sessions/:id/close` (`cash.ts:1112`).
6. Reglas del cierre en el servidor:
   - Las **transferencias las suma el sistema**, no la cajera (`cash.ts:1213`).
   - Si tarjeta, efectivo o dólares **no cuadran** y quien cierra es cajera (o gerente cerrando SU caja, salvo `*`): no cierra sin el **PIN de otra persona con permiso** y una **justificación del descuadre** (mín. 10 letras). El mensaje no dice cuánto falta ni sobra (`cash.ts:1248-1300`). Mensajes: «El total de tarjeta no coincide con el sistema…», «La caja no cuadra con el sistema. Vuelve a contar…» (`:1268-1274`).
   - Desde el **2.º intento** que no cuadra, todo cierre pide justificación y PIN: «Ya hubo 2 intentos de cierre que no cuadraron…» (`cash.ts:46-48`, `:1254-1268`).
   - Diferencia mayor a «cashDifferenceLimit» (RD$ 100 por defecto) → exige nota y crea alerta «cash_difference» (`cash.ts:203-226`, `:1390-1410`).
   - Un gerente/administración puede cerrar la caja de otra persona («cierre de emergencia»; el cuadre muestra a ambos) (`Tienda.tsx:321-328`; `cash.ts:1335-1350`).
   - No se cierra si hay ventas sin sincronizar en el equipo (`Tienda.tsx:247-256`).
7. Después de cerrar se imprime solo el **Cuadre** (`Management.tsx:2102-2112`, `apps/web/src/Tienda.tsx:76-81`), y se pregunta «¿También deseas imprimir los productos vendidos de esta caja?» con **«Sí, imprimir productos»** / **«No»** (`Tienda.tsx:95-114`). Otros impresos: «Productos vendidos de esta caja», «Facturas por forma de pago» (`Tienda.tsx:115-141`). Desde el historial: botones «Cuadre», «Venta diaria», «Por forma de pago» (`Tienda.tsx:475-505`).
8. Cómo se calcula lo esperado en efectivo: apertura + pagos en efectivo − cambio + entradas − salidas − reembolsos en efectivo; tarjeta y transferencia aparte; transferencias rechazadas no cuentan; los abonos solo cuentan una vez aplicados (`apps/api/src/cash.ts:55-113`).
9. Después del cierre, si una transferencia se verifica o se sincroniza una venta, el cuadre se recalcula y queda en la bitácora (`apps/api/src/sales.ts:2785-2800`).

## 11. Reglas de bolsillo para la cajera

- Una venta sin cliente no se cobra; sin caja abierta no se cobra.
- Todo descuento lleva motivo.
- Transferencia = banco + referencia, siempre.
- Tarjeta = últimos 4 + aprobación (+ terminal).
- El PIN de gerente nunca es el propio (`apps/api/src/security.ts:92-136`), salvo la dueña.
- Antes de cerrar caja: cerrar el lote del verifón y contar efectivo y tarjeta a ciegas.
