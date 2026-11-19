export function shouldShowWarehouseRow(
  warehouseView: string,
  selectedWarehouseKind: string | undefined,
  stock: unknown,
) {
  if (warehouseView === "all" || selectedWarehouseKind === "store") {
    return true;
  }
  return Number(stock) !== 0;
}
