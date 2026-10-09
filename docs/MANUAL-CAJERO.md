# Manual breve del cajero — Nexora POS

Esta guía explica cómo iniciar sesión, cobrar y cerrar la caja. Los recibos que genera hoy Nexora son comprobantes internos; no son comprobantes fiscales ni emiten NCF.

## 1. Entrar y preparar la caja

1. En la pantalla de acceso, escribe tu **usuario** (por ejemplo, `mfeliz`) y tu contraseña. No escribas un correo electrónico si tu cuenta está configurada con nombre de usuario.
2. En el menú, abre **Caja** y pulsa **Abrir mi caja**. Introduce el efectivo que queda como fondo inicial y guarda. Si el fondo es menor que lo que dejó el último cierre (el monto sugerido), escribe una nota que explique la diferencia y pide el PIN a un gerente; la diferencia queda en la bitácora. Cada persona y equipo debe usar su propia caja; no intentes abrirla varias veces si ya tienes una sesión abierta.
3. Si aparece que el equipo necesita aprobación, pide a Marcos o Génesis que lo apruebe en **Configuración > Equipos**. Si dice que ya existe una caja para el usuario o terminal, revisa primero **Caja** y pide a un administrador que compruebe las sesiones abiertas.
4. Vuelve a **Punto de venta**. Si el sistema dice que abras la caja, no podrás terminar una venta hasta abrirla.

## 2. Preparar una venta

1. Selecciona al cliente en el panel derecho, donde dice **Selecciona el cliente** (también puedes usar **F4**). Toda venta nueva requiere un cliente identificado; no existe la opción de vender como “consumidor final”.
2. Si no está en la lista, pulsa **Nuevo cliente aquí mismo**. Escribe su nombre; teléfono, RNC/cédula y correo son opcionales. Pulsa **Guardar y usar cliente**. Se seleccionará para esta venta.
3. Busca el artículo por nombre, SKU o código en la barra de búsqueda; también puedes escanear el código de barras y pulsar Enter. El artículo se agrega al carrito. Si tiene talla, color, tono u otra variante, elige la correcta. Revisa el precio, la variante y el stock antes de seguir.
4. En el carrito, usa **− / +** para cambiar la cantidad. El sistema no permitirá superar el stock disponible salvo que la tienda tenga habilitado stock negativo para ese producto.
5. Si tu rol tiene permiso, escribe un descuento en la línea o usa **Descuento global**. Un descuento que supere tu límite pedirá el PIN de una persona gerente autorizada. Verifica el total antes de cobrar.

## 3. Cobrar y completar el comprobante

1. Pulsa **Cobrar** o la tecla **F12**.
2. Elige **Efectivo**, **Tarjeta** o **Transferencia**, indica el monto y pulsa **Agregar pago**. Para dividir el pago, agrega los métodos uno por uno hasta que **Pendiente** sea RD$0.00. Puedes retirar un método agregado con la **X** antes de finalizar.
   - En efectivo, registra lo recibido. El sistema calcula el cambio; el cambio sólo se entrega en efectivo.
   - En tarjeta, registra los últimos cuatro dígitos y el código de aprobación del datáfono. Nunca escribas ni guardes el número completo de la tarjeta.
   - En transferencia, registra el banco y la referencia de la operación.
3. Cuando el pendiente llegue a cero, pulsa **Finalizar venta** una sola vez y espera la confirmación. Imprime el recibo o descarga el PDF desde la confirmación. Si se perdió la conexión o la respuesta, consulta primero la sección de problemas antes de volver a cobrar.

## 4. Crédito y contraentrega

- La opción **Crédito / contraentrega** permite entregar la mercancía y dejar el saldo asociado al cliente. La contraentrega equivale a un saldo pendiente que debe cobrarse después; no la uses sin identificar al cliente y confirmar el acuerdo.
- Las ventas a crédito requieren que estén habilitadas por la administración; el crédito también puede exigir vencimiento y aprobación de gerente. Crédito, contraentrega y nota de crédito requieren conexión a internet.
- La contraentrega pide el **PIN de un gerente** cuando supera el monto definido en Ajustes (RD$ 1,000 si no se cambió) o, si las ventas a crédito no están habilitadas, por cualquier monto. Escríbelo en el campo **PIN del gerente para aprobar la venta** antes de pulsar **Finalizar venta**. No pidas el PIN para repartir una contraentrega en varias facturas.
- El cajero no debe marcar ese saldo como pagado. Marcos o Génesis, como administradores, registran luego los pagos o abonos desde **Ventas** y verifican la evidencia de pago. No cierres la caja contando un saldo pendiente como efectivo cobrado.

## Salidas de efectivo (vales y retiros)

En **Caja**, **Movimiento de efectivo** registra entradas y salidas con su motivo. Si las salidas de tu turno superan el monto de Ajustes (RD$ 1,000 si no se cambió), un gerente debe escribir su PIN en **PIN del gerente**. Si el sistema indica que no hay suficiente efectivo, no muestra cifras: revisa la salida con la persona encargada.

## 5. Cerrar e imprimir el cuadre

1. Al terminar tu turno, entra en **Caja** y pulsa **Cerrar y arquear** en tu caja abierta. Antes de cerrar, conecta el equipo y resuelve/sincroniza las ventas pendientes; mientras haya ventas locales sin confirmar, el sistema no permite cerrar.
2. Cuenta el efectivo por denominación y escribe cuántas monedas o billetes tienes en cada fila. Revisa el subtotal. Registra los vales de caja y, si corresponde, los dólares o euros.
3. Escribe lo contado de tarjeta y transferencia (si el campo queda vacío, se toma el monto esperado). Si entregas efectivo a la dueña, registra **Entregado**; revisa **Dejado en caja**. Añade una nota si hay una diferencia o explicación.
4. Pulsa **Cerrar caja e imprimir cuadre**. El cierre se guarda y se abre la impresión con el detalle y las diferencias por método. Conserva el papel y entrégalo junto con el efectivo y los comprobantes según el procedimiento de la tienda.

## 6. Anular una venta por error

No anules la venta desde el usuario de cajero. Avisa a Marcos o Génesis con el número de factura y el motivo. Un administrador puede entrar en **Ventas**, buscar la factura y pulsar **Anular**; debe confirmar el motivo. Si la caja de esa venta ya cerró y se cobró en efectivo, el administrador necesita su propia caja abierta: el reembolso sale de ella y queda como salida con el número de la factura. La factura no se borra: queda registrada como anulada, se revierte el inventario y deja de contar en ventas. La anulación no está disponible si la venta ya tiene devoluciones o abonos registrados; en ese caso, pide al administrador que revise el caso y use el procedimiento correcto.

## Si algo falla

- **No aparece el cliente:** abre el selector del carrito y usa **Nuevo cliente aquí mismo**. El nombre es obligatorio. No cobres a nombre de otra persona para saltar el requisito.
- **No encuentra el producto:** prueba el código/SKU o menos palabras del nombre; confirma la talla o variante. Si sigue sin aparecer, no lo sustituyas por otro artículo: avisa a administración para revisar el catálogo.
- **Stock insuficiente o variante equivocada:** reduce la cantidad o elige la variante correcta. Si el inventario parece incorrecto, detén esa línea y pide que revisen el producto; no fuerces el cobro.
- **Sin conexión antes de cobrar:** las ventas offline están desactivadas normalmente. Espera a que vuelva **En línea** y reintenta sólo cuando el POS indique que no se registró la operación.
- **La respuesta se perdió durante el cobro / venta Pendiente:** no pulses Cobrar de nuevo ni vuelvas a capturar la misma venta. Conéctate, abre **Caja > Ventas guardadas en este dispositivo** y pulsa **Sincronizar**; comprueba el resultado antes de continuar. Una venta offline confirmada puede tener recibo provisional hasta sincronizar.
- **“Requiere revisión”:** no borres datos del navegador, no reinstales la app y no vuelvas a vender esa misma operación. En **Caja**, revisa el detalle; si el sistema solicita asociar un cliente, selecciónalo y luego pulsa **Reintentar**. Si el conflicto sigue, llama a un administrador.
- **No permite cerrar caja:** revisa si hay ventas Pendientes o Requiere revisión y sincronízalas primero. Si no puedes resolverlas, informa al administrador; no cierres otra caja para reemplazarla.

**Regla práctica:** si no estás seguro de si una venta quedó registrada, no la repitas. Comprueba el estado con un administrador para evitar un cobro duplicado.
