## 8. Sin internet o respuesta perdida

1. Si antes del cobro el indicador de la barra superior dice **Sin conexión** (en vez de **En línea**; en el celular solo se ve el ícono de wifi tachado), espera a que vuelva a decir **En línea**. Si tu tienda lo permite, puedes vender en efectivo sin internet: la venta queda guardada en el equipo y el indicador dice **Sin conexión · 1** (el número son las ventas por enviar). Las ventas offline están desactivadas por defecto; solo administración puede habilitarlas en **Configuración → Negocio y reglas → Editar configuración → «Permitir ventas sin conexión»** y asumir revisión posterior.
2. Si ya pulsaste Finalizar y no llegó respuesta, **no vuelvas a cobrar**: la operación puede estar registrada.
3. Al volver internet las ventas se envían solas. Revisa **Caja > Ventas guardadas en este dispositivo** (también se ve sin internet): **Pendiente** espera conexión; pulsa **Sincronizar** si quieres enviarlas ya.
4. Si dice **Requiere revisión**, la fila explica qué pasó y qué hacer. Conserva el dispositivo y sus datos: no borres el navegador ni reinstales la app.
   - **Falta inventario:** gerencia ajusta el inventario y tú pulsas **Reintentar**.
   - **Cambió un precio:** pulsa **Actualizar precios y reintentar**.
   - **No se puede reintentar** (pasaron 48 horas, se desactivaron las ventas sin conexión o no hay unidades): pulsa **Descartar con PIN de gerente**; gerencia escribe el motivo y su PIN en tu equipo. También puede entrar con su usuario en ese equipo y pulsar **Descartar**. Queda en la bitácora con lo que cobraste, y una alerta avisa a gerencia: si el dinero quedó en la gaveta, el cuadre lo mostrará como sobrante.
5. No tramites crédito ni autorizaciones con PIN sin conexión. No cierres caja con operaciones locales por resolver: la ventana de cierre avisa cuántas quedan y qué hacer.
6. Con artículos en el carrito o ventas por enviar, la sesión no se cierra por inactividad mientras alguien toque la pantalla y, si nadie la toca, hasta 2 horas; sin internet y con ventas por enviar no se cierra nunca. Pasado el tope la pantalla pide la contraseña, pero el carrito se conserva y vuelve al entrar (un carrito de más de 12 horas se descarta). Si recargas la página, el carrito vuelve a aparecer; una venta ya cobrada no vuelve.

![Caja sin conexión](capturas/manual/08-sin-internet.png)

**Regla de oro:** si no sabes si se registró una venta, consúltala; nunca la cobres otra vez por intuición.

La revisión de código de las reglas de dinero y permisos está en [VERIFICACION_MANUAL.md](VERIFICACION_MANUAL.md), con su base y alcance. Las nuevas capturas son una revisión visual local con fixtures: no sustituyen pruebas de autorización del servidor ni certifican el despliegue. Los nombres de botones y atajos son orientación de interfaz.
