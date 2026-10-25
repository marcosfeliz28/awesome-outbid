import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp } from "./setup/product-pg-app";

// Auditoría en vivo de inventario (25-oct-2026), con PostgreSQL real.
let t: Awaited<ReturnType<typeof startProductApp>>;
beforeAll(async () => { t = await startProductApp("nexora_inventario_arreglos"); }, 180_000);
afterAll(async () => { await t?.stop(); });

let seq = 0;
async function category(name: string, extra: Record<string, unknown> = {}) {
  const r = await t.post("/categories", { name, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}
async function product(categoryId: string, extra: Record<string, unknown> = {}, variant: Record<string, unknown> = {}) {
  seq++;
  const r = await t.post("/products", {
    name: `Producto ${seq}`, sku: `P-${seq}`, categoryId, confirmLowMargin: true,
    variants: [{ sku: `V-${seq}`, barcode: `B-${seq}`, costAvg: 10, price: 20, ...variant }],
    ...extra,
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}

describe("1 · factura de proveedor sin bucket", () => {
  it("CSV y foto IA se guardan en PostgreSQL cuando no hay almacenamiento de objetos", async () => {
    const cat = await category("Facturas sin bucket");
    const p = await product(cat.id);
    const mapping = JSON.stringify({ code: "codigo", description: "descripcion", qty: "cantidad", unitCost: "costo" });
    const csv = Buffer.from(`codigo,descripcion,cantidad,costo\n${p.variants[0].sku},Producto,2,10\n`);
    // Una IA falsa local: cuenta las llamadas y responde una factura válida.
    let aiCalls = 0;
    const ai = createServer((req, res) => {
      aiCalls++;
      req.resume();
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({
          id: "msg_test", type: "message", role: "assistant", model: "test", stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: "text", text: JSON.stringify({ total: 20, lines: [{ code: p.variants[0].sku,
            description: "Producto", qty: 2, unitCost: 10, lotNumber: "", expiryDate: "" }] }) }],
        }));
      });
    });
    await new Promise<void>((done) => ai.listen(0, "127.0.0.1", done));
    const env = { ...process.env };
    try {
      process.env.NODE_ENV = "production"; // fuera de pruebas: sin carpeta local
      delete process.env.PRODUCT_OBJECT_BUCKET;
      delete process.env.PRODUCT_OBJECT_REGION;
      process.env.ANTHROPIC_API_KEY = "sk-ant-solo-prueba";
      process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(ai.address() as any).port}`;
      const imported = await t.as("post", "/merchandise/import").field("mapping", mapping).attach("file", csv, "factura.csv");
      expect(imported.status, JSON.stringify(imported.body)).toBe(201);
      const photo = await t.as("post", "/merchandise/import")
        .attach("file", Buffer.from("\x89PNG\r\n\x1a\nfalsa"), { filename: "factura.png", contentType: "image/png" });
      expect(photo.status, JSON.stringify(photo.body)).toBe(201);
      expect(aiCalls).toBe(1);
      for (const body of [imported.body, photo.body]) {
        const [row] = await t.q(`SELECT data IS NOT NULL AS "hasData","objectKey" FROM "InvoiceAttachment" WHERE id=$1::uuid`, body.attachmentId);
        expect(row).toEqual({ hasData: true, objectKey: null });
      }
      const back = await t.get(`/merchandise/attachments/${imported.body.attachmentId}`);
      expect(back.status).toBe(200);
      expect(back.text).toBe(csv.toString("utf8"));
    } finally {
      process.env.NODE_ENV = env.NODE_ENV;
      for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"]) env[k] === undefined ? delete process.env[k] : (process.env[k] = env[k]);
      ai.close();
    }
  });
});

describe("2 · combos", () => {
  it("no convierte en combo un producto con existencia o que es pieza de otro, ni anida; se deshace si no se movió", async () => {
    const cat = await category("Combos QA");
    const piece = await product(cat.id);
    const stocked = await product(cat.id);
    const combo = await product(cat.id);
    const other = await product(cat.id);
    const pid = (p: any) => p.variants[0].id;
    expect((await t.post("/inventory/adjustments", { variantId: pid(stocked), qty: 3, reason: "Inventario inicial" })).status).toBe(201);
    const withStock = await t.post("/kits", { kitVariantId: pid(stocked), components: [{ componentVariantId: pid(piece), qty: 1 }] });
    expect(withStock.status).toBe(400);
    expect(withStock.body.message).toContain("tiene existencia");
    const ok = await t.post("/kits", { kitVariantId: pid(combo), components: [{ componentVariantId: pid(piece), qty: 2 }] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    // La pieza de un combo no puede volverse combo (anidado), ni un combo ser pieza.
    const pieceAsKit = await t.post("/kits", { kitVariantId: pid(piece), components: [{ componentVariantId: pid(other), qty: 1 }] });
    expect(pieceAsKit.status).toBe(400);
    expect(pieceAsKit.body.message).toContain("pieza de otro combo");
    const nested = await t.post("/kits", { kitVariantId: pid(other), components: [{ componentVariantId: pid(combo), qty: 1 }] });
    expect(nested.status).toBe(400);
    // Deshacer: sin movimientos se puede; vuelve a ser un producto normal.
    const undo = await t.del(`/kits/${combo.id}`);
    expect(undo.status, JSON.stringify(undo.body)).toBe(200);
    const [row] = await t.q(`SELECT "isKit" FROM "Product" WHERE id=$1::uuid`, combo.id);
    expect(row.isKit).toBe(false);
    expect(await t.q(`SELECT 1 FROM "KitComponent" WHERE "kitVariantId"=$1::uuid`, pid(combo))).toHaveLength(0);
    // Con un movimiento ya no se deshace.
    expect((await t.post("/kits", { kitVariantId: pid(combo), components: [{ componentVariantId: pid(piece), qty: 1 }] })).status).toBe(201);
    await t.q(`INSERT INTO "InventoryMovement" (id,"tenantId","variantId",type,qty,"unitCost","balanceAfter",reason,"userId","branchId")
      VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000000001',$1::uuid,'sale',0,0,0,'QA','x','main')`, pid(combo));
    const blocked = await t.del(`/kits/${combo.id}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toContain("movimientos");
  });
});

describe("3 · se vende por unidad", () => {
  it("rechaza decimales en venta, ajuste, orden, traspaso, conteo, mercancía y cotización; kg los admite", async () => {
    const cat = await category("Fajas QA");
    const faja = await product(cat.id);
    const granel = await product(cat.id, { unit: "kg" });
    const [row] = await t.q(`SELECT "soldByUnit" FROM "Product" WHERE id=$1::uuid`, faja.id);
    expect(row.soldByUnit).toBe(true);
    const [kg] = await t.q(`SELECT "soldByUnit" FROM "Product" WHERE id=$1::uuid`, granel.id);
    expect(kg.soldByUnit).toBe(false);
    const v = faja.variants[0].id;
    expect((await t.post("/inventory/adjustments", { variantId: v, qty: 5, reason: "Inventario inicial" })).status).toBe(201);
    const supplier = await t.post("/suppliers", { name: "Proveedor fajas" });
    const warehouses = (await t.get("/inventory/warehouses")).body;
    const store = warehouses.find((w: any) => w.sellable), home = warehouses.find((w: any) => !w.sellable);
    const attempts: [string, unknown][] = [
      ["/inventory/adjustments", { variantId: v, qty: 1.5, reason: "Ajuste QA" }],
      ["/sales", { offlineUuid: randomUUID(), cashSessionId: randomUUID(), items: [{ variantId: v, qty: 0.5 }],
        payments: [{ method: "cash", amount: 10 }] }],
      ["/purchase-orders", { supplierId: supplier.body.id, items: [{ variantId: v, qty: 2.5, unitCost: 10 }] }],
      ["/inventory/transfers", { operationId: randomUUID(), fromId: store.id, toId: home.id, reason: "Traspaso QA",
        lines: [{ variantId: v, qty: 0.5 }] }],
      ["/inventory/counts", { items: [{ variantId: v, counted: 4.5 }] }],
      ["/merchandise/operations", { id: randomUUID(), direction: "entry", items: [{ variantId: v, qty: 1.5, unitCost: 10 }] }],
      ["/quotes", { items: [{ variantId: v, qty: 1.5 }] }],
    ];
    for (const [path, body] of attempts) {
      const r = await t.post(path, body);
      expect(r.status, path + " " + JSON.stringify(r.body)).toBe(400);
      expect(r.body.message, path).toContain("se vende por unidad");
    }
    const [stock] = await t.q(`SELECT stock::text FROM "Variant" WHERE id=$1::uuid`, v);
    expect(stock.stock).toBe("5.000");
    const ok = await t.post("/inventory/adjustments", { variantId: granel.variants[0].id, qty: 1.5, reason: "Granel QA" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
  });

  it("la migración deja con decimales a los productos que ya los tenían", async () => {
    const cat = await category("Migración unidad");
    const a = await product(cat.id), b = await product(cat.id);
    await t.q(`UPDATE "Variant" SET stock = 2.5 WHERE id=$1::uuid`, a.variants[0].id);
    await t.q(`UPDATE "Variant" SET stock = 3 WHERE id=$1::uuid`, b.variants[0].id);
    const sql = readFileSync("apps/api/prisma/migrations/202610290001_sold_by_unit/migration.sql", "utf8");
    for (const statement of sql.split(/;\s*\n/).map((x) => x.replace(/^--.*$/gm, "").trim()).filter(Boolean))
      await t.db.$executeRawUnsafe(statement);
    const rows = await t.q(`SELECT id::text, "soldByUnit" FROM "Product" WHERE id IN ($1::uuid,$2::uuid)`, a.id, b.id);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.soldByUnit]))).toEqual({ [a.id]: false, [b.id]: true });
  });
});
