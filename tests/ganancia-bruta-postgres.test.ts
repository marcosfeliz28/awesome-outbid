import { afterAll, beforeAll, expect, it } from "vitest";
import { margin } from "../packages/shared/src/index";
import { startProductApp, TENANT } from "./setup/product-pg-app";

// Regla de la dueña: ganancia = ventas (con ITBIS) - costo, la misma base del
// margen. La ganancia bruta del resumen restaba el ITBIS de la venta.
const SELLER = "30000000-0000-4000-8000-000000000002";
let t: Awaited<ReturnType<typeof startProductApp>>;
beforeAll(async () => {
  t = await startProductApp("nexora_ganancia_bruta");
  await t.q(
    `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt") VALUES ('80000000-0000-4000-8000-000000000001',$1::uuid,'GB-1','80000000-0000-4000-8000-000000000001',$2::uuid,'completed',100,0,18,118,50,now())`,
    TENANT,
    SELLER,
  );
}, 180_000);
afterAll(async () => {
  await t?.stop();
});

it("grossProfit = ventas con ITBIS - costo y cuadra con el margen", async () => {
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const r = await t.get(`/dashboard/summary?from=${day}&to=${day}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body.revenue).toBe(118);
  expect(r.body.grossProfit).toBe(68); // antes 100 - 50 = 50
  expect((r.body.grossProfit / r.body.revenue) * 100).toBeCloseTo(
    margin(r.body.revenue, r.body.costTotal),
    1,
  );
});
