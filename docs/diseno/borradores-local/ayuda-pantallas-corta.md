Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/PANTALLAS.md`. Tarea N40. Una entrada por pantalla de la tabla del menú, en el mismo orden. Donde la entrada no dice qué pasa después, se escribe [FALTA DATO].

# Ayuda corta por pantalla

| # | Pantalla | Qué hace y qué pasa después | Cita |
|---|---|---|---|
| 1 | **Mercancía** | Registra la ENTRADA y la SALIDA de mercancía con revisión antes de confirmar; al pulsar «Confirmar entrada» o «Confirmar salida» queda en el historial. Sin internet queda en cola en «Pendientes de este equipo». | `apps/web/src/Merchandise.tsx:632-657`, `:1297-1310`, `:1311-1400` |
| 2 | **Resumen** | Muestra las ventas del periodo y los avisos del negocio; la «Ganancia neta» solo la ve quien puede ver utilidades. [FALTA DATO]: qué pasa después. | `apps/web/src/Dashboard.tsx:176`, `:663-681` |
| 3 | **Punto de venta** | Es la caja registradora: catálogo, carrito «Venta actual» y botón «Cobrar». Después de «Finalizar venta» sale el recibo para imprimir. | `apps/web/src/POS.tsx:193`; entrada, «Flujo corto» |
| 4 | **Ventas** | Historial de ventas; desde cada fila se ve el recibo, se solicita una anulación o se hace una devolución. [FALTA DATO]: qué pasa después con cada acción, ver sus ventanas. | `apps/web/src/Management.tsx:3135`, `:3188-3237` |
| 5 | **Solicitudes de anulación** | Lista las solicitudes de anulación; la administración pulsa «Aprobar y anular» o «Rechazar». La cajera solo puede cancelar la suya. | `apps/web/src/VoidRequests.tsx:123-155` |
| 6 | **Conciliar transferencias** | Solo administración: compara las transferencias con el banco; al pulsar «Verificar seleccionadas» las marca como verificadas. | `apps/web/src/TransferReconciliation.tsx:54`, `:388-425` |
| 7 | **Envíos del mensajero** | Solo administración: lista los envíos pendientes de pago; al pulsar «Marcar como pagado» pasan al «Historial de pagados». | `apps/web/src/CourierPayouts.tsx:175`, `:219-230` |
| 8 | **Productos** | Catálogo con variantes, precios y códigos de barras; permite «Plantilla» e «Importar Excel». [FALTA DATO]: qué pasa después. | `apps/web/src/Management.tsx:311-340` |
| 9 | **Inventario** | Muestra el stock por almacén y permite «Ajustar» y «Contar»; un conteo queda pendiente hasta que un gerente pulsa «Aprobar ajuste». | `apps/web/src/Management.tsx:858-870`, `:945-962`, `:1007` |
| 10 | **Compras** | Maneja órdenes de compra, proveedores y recepciones; al recibir una orden queda registrada en «Recepciones». | `apps/web/src/Management.tsx:1185-1215`; `apps/web/src/Purchases.tsx:181`, `:338` |
| 11 | **Caja** | Abre y cierra la caja del día: «Abrir caja», «Movimiento» de efectivo y «Cerrar y arquear»; al cerrar se imprime el cuadre. | `apps/web/src/Management.tsx:1674-1693`; entrada, «Flujo corto» |
| 12 | **Gastos** | Registra gastos con «Registrar gasto» y permite un presupuesto mensual por categoría. [FALTA DATO]: qué pasa después. | `apps/web/src/Management.tsx:1400-1430` |
| 13 | **Clientes** | Lista y crea clientes con «Nuevo cliente»; teléfono, cédula y correo completos solo los ve quien tiene permiso. [FALTA DATO]: qué pasa después. | `apps/web/src/Management.tsx:2304`; `apps/api/src/common.ts:276-281` |
| 14 | **Promociones** | Crea promociones que la caja aplica sola; tiene las pestañas «Candidatos a liquidación» y «Mis promociones». | `apps/web/src/Management.tsx:2475-2485` |
| 15 | **Reportes** | Permite elegir un reporte, un rango «Desde»/«Hasta» y bajarlo en «Excel» o «PDF». | `apps/web/src/Management.tsx:2930-2945` |
| 16 | **Alertas** | Muestra avisos importantes en las pestañas «Nuevas», «Vistas», «Resueltas» y «Todas», como transferencias sin verificar o descuadres de caja. | `apps/web/src/Management.tsx:3037-3043` |
| 17 | **Incentivos** | Muestra el reporte mensual por cajera; la administración cierra el mes. | `apps/web/src/Incentives.tsx:306-318` |
| 18 | **GV Makeup Studio** | Lleva los cursos, citas, interesadas y pagos de GV, con las pestañas «Cursos», «Citas», «Interesadas», «Por verificar» y «Reportes». | `apps/web/src/Gv.tsx:129-174` |

## Qué NO comprobé
Resumen de la entrada; no se contrastó con las pantallas ni con el código. La entrada no describe el resultado posterior de varias acciones (marcadas [FALTA DATO]).
