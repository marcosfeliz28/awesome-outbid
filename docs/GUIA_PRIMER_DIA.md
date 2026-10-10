# Guía del primer día — Nexora POS (versión web)

Para la dueña y las cajeras. Dirección del sistema: **https://nexora-pos-web.onrender.com**

Escribe a mano antes de empezar:

- **Soporte técnico (nombre y teléfono):** ……………………………………
- **Gerente de turno:** ……………………………………

**Quién hace qué.** _Administradora_ (la dueña): todo, incluido anular ventas, cambiar tarifas y cerrar el mes. _Gerente_: aprueba con su PIN, hace devoluciones, ve cierres, reportes e incentivos. _Cajera_ (en la pantalla dice «Vendedora»): abre su caja, vende y cierra su caja. Cada venta queda a nombre de quien entró al sistema; de ahí sale su incentivo. **Nadie vende con el usuario de otra.**

---

## 1. Antes de abrir la tienda (lista de la dueña)

- [ ] **Tu contraseña de administradora.** La pantalla no tiene un botón para cambiarla. Pide a soporte técnico que marque tu cuenta para cambio de contraseña. Cuando vuelvas a entrar verás **«Actualiza tu contraseña.»**: en **Contraseña temporal** escribe la que usas hoy, luego **Nueva contraseña** y **Confirma la nueva contraseña**, y pulsa **Guardar contraseña y entrar**.
- [ ] **Cada computadora aprobada.** Si una computadora muestra **«Este equipo necesita aprobación»**, una gerente escribe su PIN ahí mismo y pulsa **Aprobar este equipo**, o lo aprueba en **Configuración** → **Equipos**.
- [ ] **Ticket de 80 mm.** **Configuración** → **Negocio y reglas** → **Editar configuración**: revisa que **Ancho de ticket** diga **80 mm** y que el nombre, la dirección y el teléfono estén bien (salen en el ticket). Pulsa **Guardar**.
- [ ] **Cerrar las 2 cajas de prueba.** **Caja** → sección **Historial de cajas** → en cada fila con estado **Abierta**, pulsa **Cerrar y arquear**. Cuenta el efectivo que hay de verdad en esa gaveta y escribe cuántos billetes y monedas hay de cada valor. En **Tarjeta declarada** y **Transferencia declarada** pon lo real (0 si no hubo). Marca **«Confirmo que conté efectivo, tarjeta y transferencia…»** y pulsa **Cerrar caja e imprimir cuadre**. Si te pide una nota, escribe «Caja de prueba». Al final las dos filas deben decir **Cerrada**. Este cierre imprime el cuadre: es tu **ticket de prueba** en la térmica. En la ventana de imprimir del navegador escoge la impresora térmica, no «Guardar como PDF». El texto debe salir completo, sin cortarse por los lados.
- [ ] **Contraseñas de las cajeras.** Cada cajera entra con su **Usuario** y la contraseña temporal que le diste. El sistema le pide crear la suya: 12 o más caracteres, con mayúscula, minúscula, número y un símbolo (como ! o #). Que la escoja ella, que no la comparta y que no la pegue en un papel en la caja.
- [ ] **El lector de códigos, con una venta de prueba.** Una cajera abre su caja (sección 2). En **Punto de venta** escanea un producto: debe aparecer «_nombre_ agregado.» y entrar al carrito. Para probar todo el camino: cobra un artículo barato en efectivo, pulsa **Imprimir recibo**, y después la administradora la anula en **Ventas** → **Anular** (motivo: «Venta de prueba») → **Sí, anular venta**. Si no quieres esa venta en el historial, pulsa **Limpiar** en vez de cobrar.
- [ ] **Tarifas de incentivo.** **Configuración** → **Negocio y reglas** → **Incentivos por categoría**. Si nadie las cambió, vienen así: Suplementos RD$ 50, Fajas RD$ 50, Maquillaje RD$ 25 por unidad y las demás RD$ 0. Cambia lo que haga falta y pulsa **Guardar tarifas**. Un cambio no toca lo que ya se ganó.
- [ ] **Clientes.** Cada venta necesita un cliente. Si quieres uno para ventas de mostrador, créalo en **Clientes** → **Nuevo cliente** (por ejemplo, «Consumidor final»).

## 2. Rutina diaria de la cajera

**Abrir caja**

1. Entra con tu usuario y tu contraseña.
2. Ve a **Caja** → **Abrir caja**. Cuenta el fondo, escríbelo en **Efectivo inicial** y pulsa **Guardar**. Si es menos que el sugerido, explica en la nota y pide el PIN de la gerente.
3. En la pantalla debe decir **Caja abierta**.

**Vender**

- **Con el lector:** escanea y el producto entra solo. Si no entra, pulsa **F2** (pone el cursor en el buscador) y escanea otra vez.
- **Buscando:** escribe el código o unas palabras en **«Código o nombre del producto»** y pulsa Enter, o toca la tarjeta del producto. Si tiene tallas, tonos o sabores, escoge el correcto.
- **Cliente:** pulsa **Selecciona el cliente** (o **F4**). Si no existe: **Nuevo cliente aquí mismo** → nombre → **Guardar y usar cliente**.
- **Descuentos:** se ponen en cada línea (% o RD$) o en **Descuento global**. Todo descuento pide **Motivo del descuento**. Si pasa de tu límite (10 % si la dueña no lo cambió), la gerente escribe su PIN.
- **Cobrar:** pulsa **Cobrar** (**F12**) → escoge **Efectivo**, **Tarjeta** o **Transferencia** → monto → **Agregar pago**. Con tarjeta van los últimos 4 dígitos y la aprobación; con transferencia, banco y referencia.
- **Pago mixto:** agrega un pago por cada forma hasta que **Pendiente** diga RD$ 0.00. Pulsa **Finalizar venta** **una sola vez**.
- **Crédito / contraentrega:** necesita cliente e internet. Si aparece **«PIN del gerente para aprobar la venta»**, la gerente lo escribe ella misma; tú no lo sabes ni lo anotas. Si la dueña no cambió la configuración, lo pide en toda contraentrega de una cajera. Los abonos los cobra después la administración.
- **«Venta al por mayor»** (botón debajo del cliente): actívalo solo en ventas al por mayor. Tu incentivo de esa venta será **la mitad**; el precio y el total no cambian. Se apaga solo al terminar la venta. La gerencia ve cuántas marcas.
- **Sacar efectivo:** **Caja** → **Movimiento** → **Salida de efectivo**, monto y motivo → **Guardar**. Si en el turno pasas de RD$ 1,000 (o el límite que puso la dueña), pide el PIN de la gerente.

**Devoluciones y anulaciones:** tú no las haces. Busca la venta en **Ventas** y llama a la gerente: ella pulsa **Devolver** (con su propia caja abierta). **Anular** solo lo puede hacer la administradora.

**Cierre ciego de caja** (tú cuentas sin ver lo que el sistema espera)

1. Con internet y sin ventas pendientes, ve a **Caja** → **Cerrar y arquear**.
2. Cuenta billetes y monedas y escribe **cuántos** hay de cada valor.
3. Llena **Tarjeta declarada** y **Transferencia declarada** con tus comprobantes (0 si no hubo). Anota **Vale de caja** y lo **Entregado** a la dueña; revisa **Dejado en caja** (será el fondo de mañana).
4. Marca **«Confirmo que conté…»** y pulsa **Cerrar caja e imprimir cuadre** una sola vez.
5. Si sale **«Para cerrar con estos conteos, agrega una nota que explique la situación.»**, tu conteo no cuadra. Cuenta otra vez. Si el conteo está bien, explica lo que pasó en **Notas del cierre**, sin inventar cifras. **Nunca** cambies números para que cuadre.

En **Caja** ves **Mis incentivos** con lo tuyo del mes.

## 3. Rutina de la gerente y de la dueña

- **Aprobar con PIN:** escribe tu PIN tú misma en la pantalla de la cajera; nunca lo dictes. Te lo piden en descuentos por encima del límite, contraentrega, apertura con menos fondo, salidas de efectivo grandes, trasladar una caja y aprobar un equipo.
- **Cierres y diferencias:** **Caja** → **Historial de cajas** muestra **Efectivo esperado**, **Contado** y **Diferencias por método**; **Cuadre** lo vuelve a imprimir. Si una cajera dejó su caja abierta, usa **Cerrar y arquear** en su fila. Las diferencias grandes llegan a **Alertas** (la campana).
- **Reportes:** menú **Reportes** → escoge el reporte (**Ventas por vendedor**, **Ventas por método de pago**, **Cierres y diferencias**, **Devoluciones y descuentos**…) → **Desde** / **Hasta** → **Excel** o **PDF**. En **Caja** también tienes **Venta diaria del día** y **Por forma de pago del día**.
- **Incentivos** (menú **Incentivos**): escoge el **Mes**. **Exportar Excel** baja el cuadre y el detalle. **Recibo PDF** sale por cajera con líneas para firmar (dice «PRELIMINAR» mientras el mes esté abierto). La administradora pulsa **Cerrar mes** → **Cerrar el mes** cuando esté conforme: el cuadre queda guardado y ya no cambia. Revisa la columna **Al por mayor** (sale «Revisar» si una cajera la marcó en la mitad o más de sus ventas) y **Por cobrar** (incentivo de ventas aún sin cobrar).
- **Productos:** **Productos** → **Nuevo producto**, o **Plantilla** + **Importar Excel** para muchos de una vez.
- **Recibir mercancía:** **Mercancía** → **ENTRADA** → proveedor (si aplica) → escanea o busca cada producto y pon la cantidad → **Confirmar entrada** y confirma. Para sacar mercancía dañada o perdida usa **SALIDA**.

## 4. Si algo falla

**Se fue el internet**

- Arriba, donde decía **En línea**, ahora dice **Sin conexión**. El número que sale al lado son las ventas que esperan en esa computadora.
- Al principio el sistema **no deja cobrar sin internet** (sale «Las ventas sin conexión están desactivadas…»). Espera a que vuelva **En línea**.
- Si la dueña activó **«Permitir ventas sin conexión»**, solo se puede cobrar en efectivo, tarjeta o transferencia, sin PIN ni crédito. El recibo sale como **LOCAL-…** y dice «Guardada en este dispositivo · Pendiente de sincronizar».
- Cuando vuelve el internet, esas ventas se suben solas. También puedes ir a **Caja** → **Ventas guardadas en este dispositivo** → **Sincronizar**. Si alguna dice **Requiere revisión**, la fila dice qué hacer: si falta inventario, la gerente lo ajusta y la cajera pulsa **Reintentar**; si no se puede reintentar, la gerente la descarta con su PIN (**Descartar con PIN de gerente**) y queda en la bitácora. Mientras quede alguna, el cierre de caja de esa computadora avisa y no deja cerrar.
- Mientras no haya internet: no borres los datos del navegador, no cambies de computadora y no cierres sesión (sin internet no se puede volver a entrar).

**Pulsaste «Finalizar venta» y no hubo respuesta:** **no cobres otra vez.** El sistema guarda la venta con el mismo código y la confirma sola cuando vuelve la conexión, sin duplicarla.

**Venta duplicada:** si sale «El cobro anterior sí quedó registrado…», revisa en **Ventas** antes de cobrar. Si de verdad quedaron dos ventas, avisa a la administradora: ella anula la repetida en **Ventas** → **Anular**, con el motivo.

**La impresora no imprime:** chequea que esté encendida, con papel y conectada. En la ventana de imprimir escoge la impresora térmica. Para repetir, pulsa **Imprimir recibo** antes de **Nueva venta**. Si ya cerraste esa ventana, en **Ventas** puedes bajar el PDF del recibo (sale en hoja grande, no de 80 mm).

**El lector no escanea:** cierra cualquier ventana abierta encima (cobro, cliente…) y pulsa **F2** o toca el buscador; escanea otra vez. Si dice «Código no encontrado», escribe el código a mano o busca por nombre y avisa a la gerente. Si el lector no escribe nada en ningún lado, revisa el cable o el USB.

**«Cuenta bloqueada temporalmente…»:** pasa después de **5 contraseñas malas**. Espera **15 minutos**. Para desbloquearla antes, la administradora va a **Configuración** → **Usuarios y permisos** y pulsa **Desactivar** y después **Activar** en esa cajera. Si alguien se equivoca **5 veces con el PIN**, el PIN queda bloqueado 15 minutos.

**Contraseña olvidada:** la pantalla no tiene una opción para poner una contraseña nueva. Avisa a soporte técnico: le pone una temporal y la cajera crea la suya al entrar.

**La página no carga:** espera 1 o 2 minutos y recarga (F5). Chequea si hay internet abriendo otra página. Abre **https://nexora-pos-web.onrender.com/api/health**: si dice `"status":"ok"`, el sistema está bien. Si sigue sin cargar, llama a soporte técnico y anota la hora.

**«Tu caja está abierta en "…"»:** tu caja quedó abierta en otra computadora. Ve a esa computadora, o pulsa **Trasladar caja aquí** → PIN de la gerente → **Trasladar caja**. Nunca abras una caja nueva para salir del paso.

**«¿Sigues ahí?»:** pulsa **Seguir conectado**. Si nadie toca nada, la sesión se cierra a los 30 minutos (o el tiempo que haya puesto la dueña). Con artículos en el carrito o ventas sin internet por subir no se cierra, y si se recarga la página el carrito vuelve a aparecer.

## 5. Avisos por Telegram (lo hace la dueña o soporte, una sola vez)

Cada factura, anulación, devolución, abono y cierre de caja llega a un grupo privado. Los avisos no llevan la cédula, el teléfono ni la dirección del cliente.

1. En Telegram, busca **@BotFather**, envía `/newbot` y sigue los pasos. Al final te da el **token** del bot. Guárdalo en un lugar seguro. **Nunca lo pegues en chats, WhatsApp ni correo, ni le tomes foto a la pantalla.**
2. Crea un grupo privado para la administración y agrega el bot. En el grupo escribe un mensaje que empiece con «/», por ejemplo `/hola`.
3. En la computadora abre `https://api.telegram.org/bot<TOKEN>/getUpdates`, poniendo tu token en lugar de `<TOKEN>`. Busca `"chat":{"id":` seguido de un número negativo (por ejemplo `-100…`): ese número, **con el signo menos**, es el **chat**. Cierra esa pestaña, porque la dirección lleva el token.
4. En Render, abre el servicio **nexora-pos-api** → **Environment**. Agrega `TELEGRAM_BOT_TOKEN` (el token) y `TELEGRAM_CHAT_ID` (el chat). Guarda y vuelve a desplegar el servicio.
5. En Nexora: **Configuración** → **Negocio y reglas** → **Avisos de facturas por Telegram** debe decir **Activados**. Pulsa **Enviar mensaje de prueba** y chequea que llegue al grupo. Si dice **Desactivados**, falta una variable o falta volver a desplegar.

Si el token se filtra, envía `/revoke` en @BotFather y cambia la variable en Render.

## 6. Lo que este sistema NO es

- **No es facturación fiscal.** Cada ticket dice **«DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL»**. El sistema no emite NCF ni e-CF. Si un cliente necesita comprobante fiscal, usa el procedimiento que la tienda tiene hoy.
- No guarda el PIN de nadie ni lo pide por chat. Si alguien te pide tu contraseña o tu PIN, no se lo des, aunque diga que es de soporte.
