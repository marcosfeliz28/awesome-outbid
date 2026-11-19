> **Borrador verificado por script (orden 88).** Términos y citas salen de docs/sistema/GLOSARIO.md 1–60 de origin/nexora-cloud @ 9b98add0; la columna de significado la redactó el modelo local (frase por script, 5 por lote). Sin verificar el significado.

| Término | Qué significa para la cajera | Cita |
|---|---|---|
| Abono | Abono: Pago posterior a una venta con saldo. | apps/api/src/sales.ts:4414 |
| Aprobar con PIN / PIN de gerente | Aprobar con PIN: Código de 6 dígitos para autorizar operaciones de riesgo. | apps/api/src/security.ts:81-136 |
| Arqueo / «Cerrar y arquear» | Arqueo: Contar el dinero de la caja y compararlo con el sistema. | apps/web/src/Management.tsx:1693 |
| B01 / B02 | B01/B02: Tipos de comprobante fiscal que se pueden solicitar. | apps/web/src/POS.tsx:2580-2608 |
| Caja | Caja: Pantalla para abrir/cerrar turno y sesión de caja de una persona. | apps/api/prisma/schema.prisma:673 |
| Caja ciega / arqueo ciego / conteo ciego | La cajera no ve los montos esperados mientras la caja está abierta. | apps/web/src/managementMessages.ts:37-44 |
| Casa | Almacén de mercancía no vendible, controlado por la dueña. | apps/api/prisma/migrations/202610240401_warehouses/migration.sql:56 |
| Cierre de emergencia | Un gerente cierra la caja de otra persona por emergencia. | apps/web/src/Tienda.tsx:321-328 |
| Conciliar | Comparar transferencias del sistema con el estado del banco. | apps/web/src/TransferReconciliation.tsx:182-190 |
| Conteo | Contar físicamente la existencia y aprobar ajustes por un gerente. | apps/web/src/Management.tsx:951 |
| Consumidor final | Cliente genérico para ventas sin datos, sale primero al elegir cliente. | apps/web/src/POS.tsx:360-377 |
| Contraentrega (`cod`) | Venta con mercancía que se cobra cuando el mensajero trae el dinero. | apps/web/src/POS.tsx:2542-2548 |
| Costo promedio (`costAvg`) | Costo de una variante recalculado en cada entrada, usado para calcular el margen. | apps/api/prisma/schema.prisma:120-135 |
| Crédito | Venta a cuenta del cliente, mercancía sale ahora, se cobra después. | apps/web/src/Tienda.tsx:602 |
| Cuadre | Resultado del cierre de caja, compara lo contado contra lo esperado por método. | apps/web/src/Management.tsx:2102-2112 |
| Datáfono / verifón / lote del verifón | Terminal de tarjeta para procesar pagos con tarjeta. | apps/web/src/Tienda.tsx:329-332 |
| Descuento | Rebaja en el precio de un producto o en la venta total. | apps/web/src/POS.tsx:340-353 |
| Dueña | Usuario con permisos de administrador del sistema. | docs/proyecto/PLAN_MAESTRO_NOREXOS.md:2 |
| Entregado / Dejado en caja | Efectivo entregado a la dueña y el fondo sugerido para la próxima apertura. | apps/web/src/Tienda.tsx:413-424 |
| Envío / mensajero | Cobro separado del total por el servicio de envío, pagado al mensajero. | apps/web/src/POS.tsx:2857-2902 |
| Equipo / terminal | Un equipo nuevo necesita aprobación de un gerente. | apps/web/src/realtime.tsx:513-516 |
| En espera | Carrito guardado para seguir después, o guardado como cotización. | apps/web/src/POS.tsx:456-488 |
| Factura (venta) | Factura es el número de venta al cliente, no es factura fiscal. | apps/api/src/sales.ts:1114 |
| FEFO | Venta descuenta primero del lote que vence antes. | apps/api/src/inventory.ts:571 |
| Fondo / «Efectivo inicial» | Dinero con el que se abre la caja. | apps/web/src/Management.tsx:2022 |
| Génesis / Macgen | Génesis y Macgen son nombres de empresas/grupos de cuentas bancarias en GV. | apps/api/src/gv-money.ts:62-74 |
| Grupo MacGen | Grupo MacGen es la empresa dueña de tiendas de suplementos, ropa deportiva y accesorios. | apps/web/src/App.tsx:284-312 |
| GV / GV Makeup Studio | GV y GV Makeup Studio son empresas hermanas de cursos y servicios de maquillaje. | NO ENCONTRADO |
