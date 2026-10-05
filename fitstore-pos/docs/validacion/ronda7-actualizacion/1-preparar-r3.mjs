// Ronda 7 · paso 1 (igual que en la ronda 6): crea datos con la API REAL de la ronda 3 (commit 30393fc)
// sobre una base separada. Uso: FITSTORE_R3_URL=http://127.0.0.1:3013/api node 1-preparar-r3.mjs
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.env.FITSTORE_R3_URL ?? "http://127.0.0.1:3013/api";
const out = new URL("./datos-r3.json", import.meta.url);
const suffix = "r7-upgrade-" + Date.now().toString(36);
async function req(path, data, token) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.61",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await r.json();
  if (!r.ok)
    throw new Error(path + " " + r.status + " " + JSON.stringify(body));
  return body;
}
const owner = (
  await req("/auth/login", {
    email: "admin@fitstore.demo",
    password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
  })
).accessToken;
const roles = await req("/roles", undefined, owner);
const categories = await req("/categories", undefined, owner);
const warehouse = roles.find((r) => r.name === "warehouse");
const users = [];
for (const name of ["original", "otro"])
  users.push(
    await req(
      "/users",
      {
        name: "Actualización " + name,
        email: suffix + "-" + name + "@example.test",
        password: "FitStore-QA-2026!",
        pin: "456789",
        roleId: warehouse.id,
      },
      owner,
    ),
  );
const login = async (u) =>
  (await req("/auth/login", { email: u.email, password: "FitStore-QA-2026!" }))
    .accessToken;
const original = await login(users[0]);
// Equipo de la ronda 3: sólo id y nombre, sin secreto.
const terminalId = randomUUID();
await req(
  "/terminals/register",
  { id: terminalId, name: "Equipo R3" },
  original,
);
const ownerTerminal = randomUUID();
await req("/terminals/register", { id: ownerTerminal, name: "Caja R3" }, owner);
const product = await req(
  "/products",
  {
    name: suffix,
    sku: suffix,
    categoryId: categories.find((c) => c.name === "Ropa deportiva").id,
    variants: [
      { sku: suffix + "-v", barcode: suffix + "-b", price: 118, costAvg: 10 },
    ],
  },
  owner,
);
const variantId = product.variants[0].id;
const supplier = await req(
  "/suppliers",
  { name: "Proveedor actualización " + suffix },
  owner,
);
// Compra sin orden de 34: 2 × 15 + flete 4.
const entry = await req(
  "/merchandise/operations",
  {
    id: randomUUID(),
    direction: "entry",
    supplierId: supplier.id,
    freight: 4,
    items: [{ variantId, qty: 2, unitCost: 15 }],
  },
  original,
);
// Compra con orden de 50 recibida por la ruta de la orden.
const order = await req(
  "/purchase-orders",
  { supplierId: supplier.id, items: [{ variantId, qty: 2, unitCost: 25 }] },
  owner,
);
await req(
  "/purchase-orders/" + order.id + "/receive",
  { items: [{ itemId: order.items[0].id, qty: 2 }] },
  owner,
);
const data = {
  source: "API y esquema de la ronda 3 (commit 30393fc), base separada",
  users: users.map((u) => ({ id: u.id, email: u.email })),
  terminalId,
  variantId,
  supplierId: supplier.id,
  supplierName: supplier.name,
  entry,
  orderId: order.id,
};
writeFileSync(out, JSON.stringify(data, null, 2));
// La sesión R3 enlazada al equipo se usa en el paso 3; el token no se guarda
// en el repositorio.
writeFileSync(
  join(tmpdir(), "fitstore-r3-session.json"),
  JSON.stringify({ original }),
);
console.log(
  "R3: equipo sin secreto, compra sin orden " +
    entry.total +
    " y orden de 50 recibida.",
);
