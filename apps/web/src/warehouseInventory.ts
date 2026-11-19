type Warehouse = { id: string; kind: string };
type WarehouseStock = { warehouseId: string; qty: string | number };

export function warehouseIncludesVariant(
  variant: { warehouseStocks?: WarehouseStock[] | null },
  warehouse?: Warehouse,
): boolean {
  // La existencia de Tienda viene en variant.stock para todo el catálogo.
  // Para otros almacenes importa tener un registro local, no que su saldo sea positivo.
  if (!warehouse || warehouse.kind === "store") return true;
  return (
    variant.warehouseStocks?.some(
      (stock) => stock.warehouseId === warehouse.id,
    ) ?? false
  );
}
