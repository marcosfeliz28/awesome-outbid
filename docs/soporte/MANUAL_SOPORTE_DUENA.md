# Manual de soporte para la dueña de Nexora POS

Esta guía sirve para atender problemas cotidianos sin pedir contraseñas, PIN, números completos de tarjeta ni datos reales de clientes. Primero identifica a la persona, el equipo, la hora aproximada y el texto exacto que aparece en pantalla. No repitas un cobro para “probar” y no borres los datos del navegador cuando haya ventas pendientes.

Las soluciones siguientes usan únicamente funciones presentes en Nexora POS. Si el sistema no ofrece la acción indicada para la cuenta que está atendiendo, no intentes saltar el permiso: escala el caso a administración.

## 1. No puedo entrar o la página no termina de cargar

- **Qué preguntarle:** si otras páginas abren, qué mensaje muestra Nexora, desde qué equipo intenta entrar y si arriba aparece **Sin conexión**.
- **Qué revisar:** conexión del equipo, que esté usando la dirección habitual de Nexora y si el problema afecta a una sola persona o a todos los equipos.
- **Cómo resolverlo:** recupera la conexión y recarga una vez. Si Nexora abre pero pide credenciales, continúa con los casos 2 a 4. Si ningún equipo puede cargarla, anota la hora y escala a soporte técnico; no reinstales ni borres el navegador.

## 2. Olvidé la contraseña o la contraseña temporal venció

- **Qué preguntarle:** nombre de su usuario, si olvidó la contraseña o si la pantalla dice que la temporal venció; nunca preguntes cuál era la contraseña.
- **Qué revisar:** en **Configuración → Usuarios y permisos**, confirma que sea la cuenta correcta y que siga activa.
- **Cómo resolverlo:** administración pulsa **Restablecer contraseña**. Puede dejar que el sistema genere una temporal o escribir una válida; se muestra una sola vez. Entrégala de forma privada. Al entrar, la persona debe crear su propia contraseña y sus otras sesiones quedan cerradas.

## 3. La cuenta está bloqueada por intentos fallidos

- **Qué preguntarle:** texto exacto del bloqueo, hace cuánto ocurrió y si está en un equipo aprobado de la tienda.
- **Qué revisar:** que no sea una contraseña olvidada y que nadie siga intentando repetidamente; Nexora distingue bloqueos del equipo, de la dirección de conexión y de la cuenta.
- **Cómo resolverlo:** espera el plazo que indica la pantalla —el bloqueo habitual es de 15 minutos— o usa **Configuración → Usuarios y permisos → Restablecer contraseña**. Restablecerla revoca sesiones, quita el bloqueo y obliga a cambiar la temporal al entrar.

## 4. El equipo necesita aprobación o fue revocado

- **Qué preguntarle:** nombre del equipo y si el aviso dice **Este equipo necesita aprobación** o **Este equipo fue revocado**.
- **Qué revisar:** en **Configuración → Equipos**, identifica el dispositivo correcto; no apruebes teléfonos o computadoras que la dueña no reconoce.
- **Cómo resolverlo:** una persona autorizada aprueba el equipo desde esa pantalla o, cuando la interfaz lo permita, con su PIN en el propio dispositivo. Si fue revocado, usa **Registrar como equipo nuevo** y vuelve a aprobarlo. No compartas el PIN con quien pidió ayuda.

## 5. “Tu caja está abierta en otro equipo”

- **Qué preguntarle:** en qué equipo abrió la caja, si ese equipo todavía funciona y si hay ventas locales pendientes allí.
- **Qué revisar:** en **Caja**, confirma el nombre del equipo al que está asignada la caja y que pertenece a la misma persona.
- **Cómo resolverlo:** cierra la caja en el equipo original o usa **Trasladar caja a este equipo**. Una vendedora necesita que gerencia escriba su PIN; el traslado queda en la bitácora. No abras otra caja para evitar el aviso.

## 6. No puedo abrir la caja

- **Qué preguntarle:** monto del fondo contado, mensaje exacto, si ya existe una caja abierta y si está usando su propio usuario.
- **Qué revisar:** estado de la caja, equipo asignado y comparación entre el efectivo inicial escrito y el fondo sugerido.
- **Cómo resolverlo:** si ya está abierta, continúa con esa caja o resuelve el traslado del caso 5. Si el fondo real es menor que el sugerido, escribe una explicación y pide que gerencia introduzca su PIN cuando Nexora lo solicite. Nunca cambies el conteo para evitar la aprobación.

## 7. El lector no escanea

- **Qué preguntarle:** si el lector escribe números en otro campo, si aparece **Código no encontrado** y si hay una ventana de cobro o cliente abierta.
- **Qué revisar:** cable o conexión del lector, foco del buscador y código de barras asignado a la variante correcta.
- **Cómo resolverlo:** cierra la ventana superpuesta, toca el buscador o pulsa **F2** y escanea otra vez. Si el lector escribe pero el código no existe, busca el producto por nombre y pide a administración corregir su código; si no escribe nada, reconecta el lector. No vendas otra variante como sustituto.

## 8. El producto no aparece al buscarlo

- **Qué preguntarle:** nombre, código o código de barras, variante esperada y si alguna parte del nombre sí aparece.
- **Qué revisar:** busca con menos palabras y luego por código; confirma en **Productos** que el producto y la variante estén activos y tengan el identificador correcto.
- **Cómo resolverlo:** selecciona la variante real si existe. Si está inactiva o mal identificada, administración corrige el catálogo antes de vender. No crees un producto duplicado ni uses otro artículo para poder cobrar.

## 9. El sistema dice que no hay existencia o exige un lote

- **Qué preguntarle:** producto, variante, cantidad, almacén y mensaje exacto; si usa lotes, pide el número y vencimiento impresos en el empaque, no datos inventados.
- **Qué revisar:** existencia vendible, existencias por almacén, lotes, vencimientos y movimientos en **Productos → Variantes / Lotes / Kardex**. Un lote vencido no cuenta como vendible.
- **Cómo resolverlo:** corrige mediante una entrada, salida, ajuste o traspaso autorizado según lo que ocurrió físicamente. Para categorías con lote obligatorio, registra el lote real; no desactives el control solo para completar la venta.

## 10. No puedo confirmar una entrada de mercancía

- **Qué preguntarle:** proveedor, referencia del documento, producto, cantidad, costo, lote y vencimiento; pregunta también si la operación estaba pendiente sin conexión.
- **Qué revisar:** en **Mercancía → ENTRADA**, confirma que cada línea tenga producto, cantidad y los datos obligatorios de lote/vencimiento. Revisa **Pendientes de este equipo** antes de repetir la entrada.
- **Cómo resolverlo:** completa los datos reales y pulsa **Confirmar entrada** una sola vez. Si quedó pendiente, reconecta y usa **Reintentar**. Si la factura se importó desde Excel, revisa la vista previa: el archivo no sustituye la captura manual de lote y vencimiento cuando la pantalla los exige.

## 11. El precio cambió o el carrito muestra información vieja

- **Qué preguntarle:** precio que vio, precio actual, producto y si el carrito se preparó antes de perder la conexión.
- **Qué revisar:** precio vigente de la variante, promoción aplicable y aviso mostrado al intentar cobrar o sincronizar.
- **Cómo resolverlo:** vuelve a cargar el catálogo o usa **Actualizar precios y reintentar** cuando esa acción aparezca en una venta local. Revisa el nuevo total con el cliente antes de finalizar. No fuerces el precio antiguo ni conviertas la diferencia en un descuento sin autorización.

## 12. El descuento pide motivo o PIN y no deja cobrar

- **Qué preguntarle:** porcentaje o monto del descuento, quién lo autorizó y texto exacto del aviso.
- **Qué revisar:** motivo escrito, límite de descuento de la cuenta y si la venta necesita aprobación de gerencia.
- **Cómo resolverlo:** escribe un motivo real de al menos tres caracteres. Si supera el límite, una persona con permiso introduce su propio PIN en la pantalla. Si el PIN se bloqueó, espera el plazo indicado; no dividas la venta ni cambies el precio para saltar el control.

## 13. El pago combinado no llega a cero

- **Qué preguntarle:** total de la venta y monto real recibido por efectivo, tarjeta, transferencia u otra forma permitida.
- **Qué revisar:** cada línea de pago y los valores **Pendiente** y **Cambio**. **Finalizar venta** permanece deshabilitado mientras falte dinero o no haya pagos.
- **Cómo resolverlo:** agrega una línea por cada forma con el monto real, corrige o quita la línea equivocada y confirma que **Pendiente** sea RD$ 0.00. En efectivo puede existir cambio; no aumentes una tarjeta o transferencia para cuadrar artificialmente.

## 14. La tarjeta no se puede registrar

- **Qué preguntarle:** monto, últimos cuatro dígitos, número de aprobación, marca y terminal usado; nunca pidas el número completo ni el código de seguridad.
- **Qué revisar:** que los últimos cuatro sean cuatro dígitos, que exista número de aprobación y, si hay terminales configurados, que se haya elegido el correcto.
- **Cómo resolverlo:** copia esos datos del comprobante real del verifón y vuelve a agregar el pago. Si el verifón rechazó la operación, no la registres como pagada: usa otra forma realmente recibida o cancela el cobro.

## 15. Falta el lote o cierre del verifón

- **Qué preguntarle:** si cerraron el lote de hoy, qué total imprimió el verifón y si contiene operaciones de otros días o personas.
- **Qué revisar:** comprobantes físicos y total del lote del verifón antes de cerrar la caja. Nexora registra pagos por tarjeta, pero no descarga ni reconstruye el lote del aparato.
- **Cómo resolverlo:** cierra el lote en el verifón y escribe su total real en **Tarjeta declarada**; escribe cero solo si no hubo tarjetas. Si falta el comprobante o mezcla períodos, no inventes el monto: deja la justificación del descuadre y pásalo a administración para comparar ventas y comprobantes.

## 16. Una transferencia está pendiente, rechazada o tiene banco/referencia incorrectos

- **Qué preguntarle:** número de venta, monto, cuenta donde debía caer y referencia visible; no pidas credenciales bancarias.
- **Qué revisar:** en **Ventas** o **Conciliar transferencias**, confirma que figure **Pendiente de verificar**, el banco, la referencia y que el dinero realmente aparezca en la cuenta.
- **Cómo resolverlo:** administración usa **Verificar** solo si el depósito llegó, o **Rechazar** con motivo si no llegó. Si fue un error de captura, usa **Corregir banco y referencia** con motivo; no cambies monto ni método por esa acción.

## 17. No deja vender a crédito o contraentrega

- **Qué preguntarle:** cliente seleccionado, saldo que quedará pendiente, conexión y mensaje de aprobación o límite.
- **Qué revisar:** que crédito esté habilitado, que exista un cliente identificado, que el equipo esté en línea y que la persona tenga la autorización o el PIN requerido.
- **Cómo resolverlo:** selecciona el cliente correcto y pide a gerencia aprobar cuando corresponda. Registra como **Crédito** o **Contraentrega** solo si la mercancía sale sin cobrar esa parte. Después, el saldo se atiende en **Caja → Créditos pendientes**; no lo registres como efectivo recibido.

## 18. Pulsé “Finalizar venta” y no sé si se guardó o quedó duplicada

- **Qué preguntarle:** hora, cliente, total, equipo y si vio número de venta, **Venta registrada**, **Pendiente de sincronizar** o un error.
- **Qué revisar:** primero **Ventas** por número/fecha y después **Caja → Ventas guardadas en este dispositivo**. Conserva el carrito y el mismo equipo mientras se confirma.
- **Cómo resolverlo:** si ya está en **Ventas**, no cobres de nuevo. Si está local, deja que sincronice o usa **Sincronizar/Reintentar** según el estado. Nexora reutiliza el identificador del mismo cobro para evitar duplicarlo; si existen dos ventas reales, administración anula la repetida con motivo.

## 19. “Se borró” o no aparece una venta

- **Qué preguntarle:** número, fecha, cajera, monto, equipo y si se hizo sin conexión o se solicitó/anuló después.
- **Qué revisar:** en **Ventas**, limpia la búsqueda, elige la fecha correcta y busca el número. Revisa el estado **Completada** o **Anulada** y la cola local del equipo si aún no se sincronizó.
- **Cómo resolverlo:** si está anulada, abre su detalle: Nexora conserva la venta y su historia; no la vuelve a completar. Si está local, resuelve la sincronización. Si no figura en ninguno, anota los datos y escala a soporte para revisar la bitácora; no crees una copia hasta confirmar si existió.

## 20. La solicitud de anulación no avanza

- **Qué preguntarle:** número de venta, solicitante, motivo y estado mostrado: pendiente, aprobada, rechazada o cancelada.
- **Qué revisar:** que la venta pertenezca a quien solicita, siga completada y no tenga otra solicitud pendiente. Administración revisa **Solicitudes de anulación** o la tarjeta correspondiente del inicio.
- **Cómo resolverlo:** la vendedora crea **Solicitar anulación** con tipo y explicación; administración usa **Aprobar y anular** o **Rechazar** con nota. Una solicitud no cambia stock ni caja hasta ser aprobada. Si la venta ya tiene devolución o abonos, no fuerces la anulación: usa el procedimiento que corresponda a esos movimientos.

## 21. No deja hacer una devolución

- **Qué preguntarle:** número de venta, artículo, cantidad, estado de la mercancía, motivo y forma de reembolso.
- **Qué revisar:** que la venta esté completada, que la cantidad no supere lo vendido menos lo ya devuelto y que la persona con permiso tenga su caja abierta. Revisa si hay deuda pendiente o un lote vencido.
- **Cómo resolverlo:** gerencia abre **Ventas → Devolver**, selecciona las unidades reales y completa estado, motivo y reembolso. La deuda pendiente se reduce antes de entregar dinero. Un artículo no vendible no vuelve al stock disponible; si el lote ya venció, regístralo como merma según el aviso.

## 22. La impresora no imprime o el recibo salió mal

- **Qué preguntarle:** si usa navegador o aplicación de escritorio, qué documento intentó imprimir, ancho del papel y si Windows ve la impresora.
- **Qué revisar:** encendido, papel, cable, impresora elegida y ancho configurado. En escritorio, abre **Impresora térmica · este equipo**; en navegador, revisa la impresora en el diálogo del sistema.
- **Cómo resolverlo:** conecta o instala la térmica, elige la impresora y repite la impresión del recibo, no la venta. Tras una venta en línea también puedes descargar **Recibo PDF** desde **Ventas**. Si el contenido se corta, corrige el ancho de ticket antes de reimprimir.

## 23. No deja vender sin internet

- **Qué preguntarle:** qué indica la barra superior, forma de pago, si administración habilitó ventas sin conexión y si la venta requiere crédito o PIN.
- **Qué revisar:** **Configuración → Negocio y reglas → Permitir ventas sin conexión**, estado del equipo y cola local. Crédito y operaciones con aprobación no se completan sin conexión.
- **Cómo resolverlo:** si la opción está desactivada, espera a recuperar internet. Si está activa y la venta cumple las reglas, finalízala una sola vez: aparecerá **Guardada en este dispositivo · Pendiente de sincronizar**. No borres datos, cambies de equipo ni cierres sesión mientras haya pendientes.

## 24. Una venta sin conexión dice “Requiere revisión”

- **Qué preguntarle:** mensaje completo, hora del cobro, producto, importe cobrado y si cambió el precio, el stock o la caja desde entonces.
- **Qué revisar:** en **Caja → Ventas guardadas en este dispositivo**, lee la causa. Las acciones disponibles incluyen **Reintentar**, **Actualizar precios y reintentar** y **Descartar con PIN de gerente**.
- **Cómo resolverlo:** corrige primero la causa real y reintenta. Si ya no puede registrarse —por antigüedad, horario, configuración o inventario— gerencia la descarta con motivo y PIN; queda en bitácora. Si el dinero quedó en la gaveta, el cierre puede mostrarlo como sobrante: no inventes una venta para ocultarlo.

## 25. La caja no cierra o el cuadre tiene diferencia

- **Qué preguntarle:** efectivo contado por denominación, total real del verifón, vales, efectivo entregado y si quedan ventas locales pendientes.
- **Qué revisar:** sincroniza primero la cola del equipo; vuelve a contar dinero y comprobantes. Cierra el lote del verifón y escribe en **Tarjeta declarada** su total real. Las transferencias las calcula Nexora. Revisa cualquier vale y salida de efectivo registrada.
- **Cómo resolverlo:** corrige solo errores de conteo comprobados. Si la diferencia es real, escribe la **Justificación del descuadre** con qué pasó y quién lo conoce; pide la aprobación requerida y pulsa **Cerrar caja e imprimir cuadre** una sola vez. No alteres números para que coincidan. Administración puede revisar después el cierre, sus diferencias y la bitácora.

## Trazabilidad de las funciones comprobadas

Este manual se contrastó con la versión de `origin/producto-nexora` disponible al redactarlo, principalmente en:

- `apps/web/src/App.tsx` y `apps/api/src/auth.ts`: acceso, cambio y bloqueo de contraseña.
- `apps/web/src/realtime.tsx`: aprobación de equipos y traslado de caja.
- `apps/web/src/POS.tsx` y `apps/api/src/sales.ts`: búsqueda, cobro, pagos, crédito, descuentos, impresión y ventas.
- `apps/web/src/Management.tsx`, `apps/web/src/VoidRequests.tsx` y `apps/web/src/TransferReconciliation.tsx`: historial, anulaciones, devoluciones y transferencias.
- `apps/web/src/Tienda.tsx`, `apps/api/src/cash.ts` y `apps/web/src/pendingSales.ts`: apertura, cierre, verifón, descuadres y cola local.
- `apps/web/src/Merchandise.tsx`, `apps/web/src/InventoryImport.tsx`, `apps/api/src/inventory.ts` y `apps/api/src/inventory-import.ts`: mercancía, existencia, lotes e importación.
- `apps/web/src/DesktopPrinterControls.tsx` y `apps/web/src/Prints.tsx`: impresión térmica.

## Autoauditoría

- Conteo: **25 problemas**, numerados del 1 al 25; cada uno contiene exactamente **Qué preguntarle**, **Qué revisar** y **Cómo resolverlo**.
- Casos obligatorios cubiertos: entrada al sistema (1–4), descuadre (25), lote del verifón (15), venta aparentemente borrada (19), impresora (22) y venta sin internet (23–24).
- Límites expresos: no se afirma que Nexora lea el verifón; no se promete recuperar datos borrando o reinstalando; no se permite repetir cobros, saltar permisos, inventar stock/lotes ni compartir credenciales.
- Datos: no contiene secretos, contraseñas, PIN, clientes, cuentas bancarias ni cifras reales de un negocio.
