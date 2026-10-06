import {
  test,
  expect,
  ensureStock,
  ownerHeaders,
  sellableStock,
  SCREENSHOTS_ENV,
} from "./apoyo";
// Revisión local de la ronda 9 · la suite E2E se puede repetir sobre la misma
// base y en cualquier máquina. Este archivo corre antes que store.spec.ts.

// TS-1 · La semilla trae 13 unidades de la proteína y del shaker (27 del
// legging) y cada corrida vendía una de cada: desde la corrida 14 sobre la
// misma base, las ventas fallaban con «No hay suficiente stock».
// Al refrescar las capturas de docs/ la semilla conserva sus existencias.
const keepSeedStock = () =>
  test.skip(
    process.env[SCREENSHOTS_ENV] === "1",
    SCREENSHOTS_ENV + "=1: no se tocan las existencias de la semilla.",
  );
async function sellOut(request: any, headers: any, sku: string) {
  const { product, variant, lots, stock } = await sellableStock(
    request,
    headers,
    sku,
  );
  const adjust = async (data: any) => {
    const response = await request.post("/api/inventory/adjustments", {
      headers,
      data: {
        variantId: variant.id,
        reason: "E2E: agotar existencias de la semilla",
        ...data,
      },
    });
    expect(response.ok(), sku + ": " + (await response.text())).toBe(true);
  };
  let tracked = 0;
  for (const lot of lots) {
    await adjust({ qty: -Number(lot.qty), lotId: lot.id });
    tracked += Number(lot.qty);
  }
  if (stock > tracked && !product.category.requiresLot)
    await adjust({ qty: tracked - stock });
  expect((await sellableStock(request, headers, sku)).sellable).toBe(0);
}
test("TS-1: ensureStock repone sólo lo que falta, con lote y vencimiento donde la categoría lo exige", async ({
  request,
}) => {
  keepSeedStock();
  const headers = await ownerHeaders(request);
  // Proteína: lote y vencimiento obligatorios. Shaker: sin lote.
  for (const sku of ["FIT-0001-1", "FIT-0037-1"]) {
    await sellOut(request, headers, sku);
    await ensureStock(request, { [sku]: 2 });
    const stocked = await sellableStock(request, headers, sku);
    expect(stocked.sellable).toBe(2);
    expect(stocked.stock).toBe(2);
    // Con lo que hay alcanza: no se repone otra vez.
    await ensureStock(request, { [sku]: 1 });
    await ensureStock(request, { [sku]: 2 });
    expect((await sellableStock(request, headers, sku)).stock).toBe(2);
  }
});
test("TS-1: las ventas de store.spec.ts no cuentan con las existencias de la semilla (aquí se agotan antes de que corran)", async ({
  request,
}) => {
  keepSeedStock();
  const headers = await ownerHeaders(request);
  // Lo que venden «venta completa…» y «venta offline…» en store.spec.ts.
  for (const sku of ["FIT-0001-1", "FIT-0013-3", "FIT-0037-1"])
    await sellOut(request, headers, sku);
});
