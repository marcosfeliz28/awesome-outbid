// Solo práctica local: sobrescribe las capturas; actualizar source y etiqueta al cambiar de UI.
/* global URL, document, indexedDB, console, navigator, Event */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
const require = createRequire(resolve("package.json"));
const { chromium, expect } = require("@playwright/test");
const base = "http://127.0.0.1:4264";
const root = resolve("apps/web/dist");
const out = resolve("docs/capturas/manual");
const manifest = [];
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, base).pathname;
    const path = resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!path.startsWith(root + "/") && !path.startsWith(root + "\\"))
      throw Error("boundary");
    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(4264, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true });
const product = {
  id: "qa-product",
  name: "Producto de práctica",
  sku: "QA-001",
  brand: "Ejemplo",
  imageUrl: "",
  taxRate: "18",
  minStock: "0",
  maxStock: "100",
  categoryId: "qa-category",
  category: {
    id: "qa-category",
    name: "Práctica",
    color: "#6957d5",
    requiresLot: false,
  },
  variants: [
    {
      id: "qa-variant",
      productId: "qa-product",
      sku: "QA-001",
      barcode: "001",
      price: "1500",
      stock: "20",
      attributes: { Talla: "M" },
      lots: [],
    },
  ],
};
const settings = {
  name: "Negocio de práctica",
  branchName: "Sucursal de práctica",
  address: "Dirección ficticia",
  phone: "",
  legalId: "",
  taxIncluded: true,
  allowCreditSales: true,
  allowOfflineSales: true,
  allowNegativeStock: false,
  creditApprovalThreshold: 1000,
  cashDifferenceLimit: 100,
  receiptWidth: 80,
  cashMovementApprovalLimit: 1000,
  sessionIdleMinutes: 15,
};
async function setup(width, role = "seller") {
  const user = {
    id: "qa-" + role,
    name:
      role === "seller"
        ? "Cajera de práctica"
        : role === "manager"
          ? "Gerente de práctica"
          : "Administración de práctica",
    username: "practica-" + role,
    email: role + "@example.invalid",
    role,
    permissions:
      role === "admin"
        ? ["*"]
        : [
            "sale:write",
            "cash:write",
            "customers:write",
            "catalog:read",
            ...(role === "manager" ? ["sale:manage"] : []),
          ],
    branchId: "main",
  };
  const active = {
    id: "qa-cash",
    userId: user.id,
    openedAt: new Date().toISOString(),
    closedAt: null,
    countedCash: null,
    registerId: "Equipo de práctica",
    registerName: "Equipo de práctica",
    openingAmount: "500",
    user: { name: user.name },
  };
  let sessions = [];
  const sale = {
    id: "qa-sale",
    number: "PRÁCTICA-000001",
    createdAt: new Date().toISOString(),
    status: "completed",
    total: "1500",
    discountTotal: "0",
    creditBalance: "0",
    payments: [
      {
        id: "qa-payment",
        method: "cash",
        amount: "1500",
        tendered: "1500",
        change: "0",
      },
    ],
    items: [
      {
        id: "qa-item",
        qty: "1",
        returnedQty: "0",
        price: "1500",
        discountPercent: "0",
        subtotal: "1500",
        variant: { ...product.variants[0], product },
      },
    ],
    returns: [],
    customer: { id: "qa-customer", name: "Cliente de práctica" },
  };
  const context = await browser.newContext({
    viewport: { width, height: width === 1024 ? 1450 : 1050 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const p = url.pathname.replace("/api", "");
    let json = [];
    if (p.startsWith("/auth/"))
      json = { user, accessToken: "fixture-" + randomUUID() };
    else if (p === "/terminals/register") {
      active.registerId = route.request().postDataJSON().id;
      json = {
        id: active.registerId,
        approved: true,
        approvedAt: new Date().toISOString(),
        active: true,
        name: "Equipo de práctica",
        deviceKey: "fixture-" + randomUUID(),
      };
    } else if (p === "/settings") json = settings;
    else if (p === "/products") json = { items: [product], total: 1 };
    else if (p === "/categories") json = [product.category];
    else if (p === "/customers")
      json = [
        {
          id: "qa-customer",
          name: "Cliente de práctica",
          phone: "",
          legalId: "",
          email: "",
          creditLimit: "10000",
          active: true,
        },
      ];
    else if (p === "/sales") json = [sale];
    else if (p === "/cash-sessions/opening-suggestion") json = { amount: null };
    else if (p === "/cash-sessions") json = sessions;
    else if (p === "/health") json = { ok: true, status: "ok" };
    else if (p === "/sales/sync") json = { results: [] };
    return route.fulfill({ json });
  });
  const badge = () =>
    page.evaluate(() => {
      if (document.querySelector("#qa-identification")) return;
      const tag = document.createElement("div");
      tag.id = "qa-identification";
      tag.textContent = "DATOS FICTICIOS · PRÁCTICA LOCAL · wave3 92853bb";
      Object.assign(tag.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        zIndex: "2147483647",
        background: "#fff4bd",
        color: "#292016",
        padding: "6px",
        textAlign: "center",
        font: "bold 11px Arial",
      });
      document.body.append(tag);
    });
  const snap = async (name) => {
    await badge();
    await page.screenshot({
      path: resolve(out, `${name}-${width}.png`),
      fullPage: true,
    });
    manifest.push({
      file: `${name}-${width}.png`,
      role,
      width,
      hashRoute: new URL(page.url()).hash,
      source: "92853bb31870e9769cab13f1d22ac1fcf68d146d",
      api: "synthetic fixtures; external requests blocked",
    });
    console.log("CAPTURE", name, width, role);
  };
  return {
    page,
    context,
    active,
    sale,
    user,
    snap,
    setSessions: (value) => (sessions = value),
  };
}
try {
  await mkdir(out, { recursive: true });
  for (const width of [1024, 390]) {
    const f = await setup(width);
    const { page, snap } = f;
    await page.goto(base + "/#cash");
    await page
      .getByRole("button", { name: "Abrir mi caja", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await snap("01-abrir-caja");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    f.setSessions([f.active]);
    await page.reload();
    await page.getByRole("button", { name: "Movimiento", exact: true }).click();
    await page.getByLabel("Tipo", { exact: false }).selectOption("out");
    await page.getByLabel("Monto", { exact: false }).fill("1200");
    await page
      .getByLabel("Motivo", { exact: false })
      .fill("Retiro de práctica autorizado");
    await snap("04-retiro");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page
      .getByRole("button", { name: "Cerrar y arquear", exact: true })
      .click();
    await expect(
      page.getByText("Confirmo que conté efectivo, tarjeta y transferencia.", {
        exact: false,
      }),
    ).toBeVisible();
    await snap("07-cierre-ciego");
    await page
      .getByText("Confirmo que conté efectivo, tarjeta y transferencia.", {
        exact: false,
      })
      .scrollIntoViewIfNeeded();
    await snap("07-confirmacion-cierre");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.goto(base + "/#pos");
    await page.getByText("Producto de práctica", { exact: true }).click();
    await page.keyboard.press("F4");
    await page.getByText("Cliente de práctica", { exact: true }).click();
    await snap("02-vender");
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await snap("03-cobrar");
    await page
      .getByRole("button", { name: "Crédito / contraentrega", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Agregar pago", exact: true })
      .click();
    await expect(
      page.getByText("PIN del gerente para aprobar la venta", { exact: true }),
    ).toBeVisible();
    await snap("03-credito");
    await page.goto(base + "/#sales");
    await expect(
      page.getByRole("heading", { name: "Cada venta tiene una historia" }),
    ).toBeVisible();
    await snap("05-ventas-cajera");
    await page.goto(base + "/#cash");
    await page.context().setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await page.evaluate(
      async ({ user, active }) => {
        const db = await new Promise((done, fail) => {
          const req = indexedDB.open("fitstore-pos-v1");
          req.onsuccess = () => done(req.result);
          req.onerror = () => fail(req.error);
        });
        await new Promise((done, fail) => {
          const tx = db.transaction("sales", "readwrite");
          for (const [id, status, message] of [
            ["qa-pending", "pending", ""],
            ["qa-conflict", "conflict", "No hay existencias suficientes."],
          ])
            tx.objectStore("sales").put({
              id,
              userId: user.id,
              userName: user.name,
              branchId: "main",
              status,
              message,
              createdAt: Date.now(),
              input: {
                offlineUuid: id,
                customerId: "qa-customer",
                cashSessionId: active.id,
                items: [{ variantId: "qa-variant", qty: 1 }],
                payments: [{ method: "cash", amount: 1500 }],
              },
              receipt: {
                number:
                  id === "qa-pending"
                    ? "PRÁCTICA-PENDIENTE"
                    : "PRÁCTICA-REVISIÓN",
                total: 1500,
              },
            });
          tx.oncomplete = done;
          tx.onerror = () => fail(tx.error);
        });
        db.close();
      },
      { user: f.user, active: f.active },
    );
    await page.evaluate(() => globalThis.dispatchEvent(new Event("offline")));
    await expect(
      page.getByText("Ventas guardadas en este dispositivo", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await snap("08-sin-internet");
    await f.context.close();
    for (const role of ["manager", "admin"]) {
      const g = await setup(width, role);
      g.setSessions([g.active]);
      await g.page.goto(base + "/#sales");
      await g.page
        .getByRole("button", {
          name: role === "manager" ? "Devolver" : "Anular",
          exact: true,
        })
        .click();
      await expect(g.page.getByRole("dialog")).toBeVisible();
      if (role === "manager") {
        await g.page
          .getByLabel("Artículo a devolver", { exact: false })
          .selectOption("qa-item");
        await g.page
          .getByLabel("Motivo", { exact: false })
          .fill("Devolución de práctica; no se ejecuta");
      } else
        await g.page
          .getByLabel("Motivo obligatorio", { exact: false })
          .fill("Corrección de práctica; no se ejecuta");
      await g.snap(
        role === "manager" ? "05-devolucion-gerente" : "06-anulacion-admin",
      );
      await g.context.close();
    }
  }
} finally {
  await writeFile(
    resolve(out, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  await browser.close();
  server.close();
}
