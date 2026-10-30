Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/FLUJO_CAJA_POS.md` (rama principal de producción). Tarea N34. Cada paso copia la etiqueta del botón y la cita del archivo de entrada; nada se añadió por fuera.

# Guía de la cajera, una página

1. Entra con «Tu usuario o correo» y «Tu contraseña», y pulsa **«Entrar a mi tienda»**. (`apps/web/src/App.tsx:468`, `:512`)
2. Si sale «Este equipo necesita aprobación», un gerente lo aprueba con su PIN; sin equipo aprobado no se vende. (`apps/web/src/realtime.tsx:513-516`)
3. Abre el menú lateral **Caja** y pulsa **«Abrir caja»** (o **«Abrir mi caja»**). (`apps/web/src/App.tsx:250`; `apps/web/src/Management.tsx:1670-1677`, `:1740-1744`)
4. En la ventana «Abrir mi caja» escribe el **«Efectivo inicial»**; si es menor que lo sugerido, la nota es obligatoria. (`apps/web/src/Management.tsx:2017`, `:2022`, `:2029-2039`)
5. Abre el menú **Punto de venta** y comprueba que diga **«Caja abierta»**. (`apps/web/src/App.tsx:209`; `apps/web/src/POS.tsx:1024-1028`)
6. Elige el cliente con **«Selecciona el cliente»** (F4); si no existe, usa **«Nuevo cliente aquí mismo»** y **«Guardar y usar cliente»**. (`apps/web/src/POS.tsx:1033-1051`, `:1474-1477`, `:1354-1409`)
7. Agrega productos pulsando la tarjeta del producto o escribiendo en **«Código o nombre del producto»** (F2) y Enter. (`apps/web/src/POS.tsx:1543`, `:904-919`, `:714-731`)
8. Ajusta el carrito con **+**, **−** y **×** en cada línea. (`apps/web/src/POS.tsx:1086-1106`, `:1163-1168`)
9. Si hay descuento, escribe el motivo en **«Motivo del descuento»**; si pasa del límite de la cajera, un gerente pone su PIN. (`apps/web/src/POS.tsx:2908-2921`, `:1866-1884`)
10. Pulsa **«Cobrar»** (F12). (`apps/web/src/POS.tsx:1224-1234`)
11. Elige el método de pago (Efectivo, Dólares (US$), Tarjeta, Transferencia, Nota de crédito, Contraentrega o Crédito), escribe el monto y pulsa **«Agregar pago»**. (`apps/web/src/POS.tsx:2535-2574`, `:2663-2685`, `:2817-2824`)
12. Con **Tarjeta** pide «Últimos 4 dígitos» y «Número de aprobación»; con **Transferencia**, «Cuenta donde cayó» y «Referencia». (`apps/web/src/POS.tsx:2705-2775`, `:2776-2816`)
13. Cuando ya no quede «Pendiente», pulsa **«Finalizar venta»**. (`apps/web/src/POS.tsx:2927-2941`)
14. Entrega el recibo con **«Imprimir recibo»**, **«Recibo PDF»**, **«WhatsApp»** o **«Correo»**, y pulsa **«Nueva venta»**. (`apps/web/src/POS.tsx:2381-2384`, `:2385-2398`, `:2399-2426`, `:2428-2430`)
15. Para cerrar el día, primero cierra el lote del verifón (datáfono). (`apps/web/src/Tienda.tsx:329-332`)
16. En Caja pulsa **«Cerrar y arquear»**, cuenta a ciegas y llena «Detalles de monedas», «Tarjeta declarada» y «Número de lote del verifón». (`apps/web/src/Management.tsx:1693`; `apps/web/src/Tienda.tsx:314`, `:334-453`; `apps/api/src/cash.ts:1196-1210`)
17. Pulsa **«Cerrar caja e imprimir cuadre»**. (`apps/web/src/Tienda.tsx:464-467`)

Reglas de bolsillo: sin cliente o sin caja abierta no se cobra; todo descuento lleva motivo; transferencia = banco + referencia; tarjeta = últimos 4 + aprobación. (`docs/sistema/FLUJO_CAJA_POS.md`, sección 11)

## Qué NO comprobé
Los botones y citas no se verificaron contra el código de la app; se copiaron de la entrada. No se probó en pantalla.
