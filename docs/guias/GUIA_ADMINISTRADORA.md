# Guía rápida de la administradora

## Apertura y equipo

- Entra con tu usuario. En **Configuración** → **Usuarios y permisos** puedes localizar una cuenta y usar **Restablecer contraseña**. Entrega la temporal en persona y pide a la persona que cree una contraseña propia; nunca la compartas por chat.
- En **Configuración** → **Equipos**, revisa y aprueba solo computadoras y celulares de la tienda.
- Cada persona trabaja con su propia caja. Para abrir una, entra a **Caja** → **Abrir caja** y registra el fondo que realmente se contó.

## Operación de la tienda

- **Cerrar una caja ajena en una emergencia:** en **Caja** → **Historial de cajas**, usa **Cerrar y arquear** en la fila correcta y revisa quién es la dueña de esa caja. Confirma el conteo real y deja la explicación del cierre. **(Implementado en el código; la disponibilidad depende del despliegue. Confirma que la versión publicada lo incluya antes de usarlo.)**
- **Créditos pendientes y cobros mixtos:** revisa el cliente, la factura y el saldo antes de aceptar un pago parcial. Registra cada forma de pago por su importe real y verifica que no exceda el pendiente. **(Implementado en el código; la disponibilidad depende del despliegue. Confirma que la versión publicada lo incluya antes de usarlo.)**
- **Entrada de mercancía:** **Mercancía** → **ENTRADA**; selecciona proveedor si corresponde, agrega cada artículo y cantidad, revisa el resumen y confirma una sola vez. Para mercancía dañada o perdida, usa **SALIDA** y registra el motivo correcto.
- **Importar inventario:** cuando la dueña/Claude confirme que la pantalla está desplegada, en **Productos** usa **Importar inventario** (no **Importar Excel**, que es otra carga). Selecciona el `.xlsx`, revisa la vista previa y verifica cantidades, precios y opciones. Solo entonces confirma **Cargar**. Hazlo con la tienda cerrada o sin ventas; si aparece un conflicto o una vista previa caducada, detente y vuelve a revisar. Los artículos ausentes del archivo no se borran.
- **Incentivos:** abre **Incentivos**, selecciona el período y revisa los importes antes de exportar o cerrar el mes. No cierres un período con ventas, devoluciones o cobros pendientes de revisar.
- **Anulaciones y devoluciones:** localiza la venta en **Ventas**, confirma número, cliente, artículos y motivo. Anular es una acción administrativa; devolver mercancía no equivale a borrar la venta. Si la venta ya tiene una devolución o abonos, el sistema no permite anularla; detente y consulta a gerencia para seguir el flujo correspondiente. Si su caja original ya cerró y hubo efectivo, abre tu propia caja y confirma que tenga efectivo suficiente para entregar el reembolso.

## Antes de cerrar

1. Revisa **Caja** → **Historial de cajas**, los cierres y las diferencias; verifica la persona y el equipo de cada registro.
2. Revisa créditos pendientes y movimientos de mercancía que requieran seguimiento.
3. En **Configuración** → **Negocio y reglas** → **Respaldo diario a Google Drive**, comprueba el estado y la fecha de **Último respaldo bueno**. Si no aparece un respaldo exitoso, avisa a soporte; no des por hecho que existe una copia.
4. Mantén el RNC, datos personales y credenciales fuera de capturas y chats. No compartas PIN de gerente.

> Los pasos marcados **implementado en el código** y la importación describen funciones cuyo despliegue no está verificado en esta guía. Confirma que la versión publicada las incluya antes de usarlas.
