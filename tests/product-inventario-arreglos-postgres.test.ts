import { createServer } from "node:http";
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
