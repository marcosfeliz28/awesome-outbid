// Extractos operativos de docs/MANUAL.md y docs/MANUAL-CAJERO.md, empaquetados
// con la API: la imagen de Render no copia docs/. Revisar al cambiar manuales.
export const assistantManual: Record<string, string> = {
  caja: "Fuente: MANUAL-CAJERO.md §§1,7. En Caja, abrir la caja propia, contar el fondo y guardar. Al cerrar, contar efectivo sin ver antes el esperado, justificar diferencias y solicitar PIN de gerencia si se pide. Imprimir el cuadre; no alteres ventas para cuadrar.",
  venta: "Fuente: MANUAL-CAJERO.md §§2,3. En Punto de venta busca o escanea, confirma variante y cantidad, selecciona cliente, cobra con las formas de pago reales y finaliza una sola vez. Transferencia requiere banco y referencia y queda por verificar; el crédito no es efectivo cobrado.",
  anulacion: "Fuente: MANUAL-CAJERO.md §6. Localiza la venta y usa Solicitud de anulación. La cajera puede pedirla con motivo; gerencia revisa y aprueba o rechaza. Una devolución se procesa por su flujo, no creando una venta negativa. No alteres la factura manualmente.",
  inventario: "Fuente: MANUAL.md §§Inventario, Mercancía desde el celular. En Mercancía registra entrada o salida, revisa cantidad, costo y lote; confirma y comprueba el kardex. El código desconocido permite crear producto rápido para revisión de gerencia. Los productos vencidos no se reciben.",
  credito: "Fuente: MANUAL.md §§Créditos pendientes, Controles de crédito. En Caja, administración consulta Créditos pendientes y registra cada abono por forma de pago. El efectivo entra a su propia caja. Una transferencia solo reduce la deuda al verificarse; no se duplica un cobro al reintentar la misma operación.",
  conexion: "Fuente: MANUAL-CAJERO.md §8 y MANUAL.md §Trabajar sin conexión. Una venta offline queda en cola; al volver la conexión se sincroniza con el mismo UUID. Si aparece conflicto, revisa la operación antes de repetirla. No borres el almacenamiento del navegador con operaciones pendientes.",
};
