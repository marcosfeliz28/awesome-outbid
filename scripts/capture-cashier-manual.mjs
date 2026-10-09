import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1250 } });
const user = {
  id: "qa-cashier",
  name: "Cajera de prueba",
  username: "cajera-prueba",
  email: "qa@example.invalid",
  role: "seller",
  permissions: ["sale:write", "cash:write", "customers:write", "catalog:read"],
  branchId: "main",
};
const active = {
  id: "qa-cash",
  userId: user.id,
  openedAt: "2026-10-09T12:00:00Z",
  closedAt: null,
  countedCash: null,
  registerId: "Equipo de práctica",
  registerName: "Equipo de práctica",
  openingAmount: "500",
  user: { name: user.name },
};
let sessions = [];
const product = {
  id: "qa-product",
  name: "Producto de práctica",
  sku: "QA-001",
  brand: "Ejemplo",
  imageUrl: "",
  taxRate: "0",
  minStock: "0",
  maxStock: "100",
  categoryId: "qa-category",
  category: { name: "Práctica", color: "#6957d5", requiresLot: false },
  variants: [
    {
      id: "qa-variant",
      productId: "qa-product",
      sku: "QA-001",
      barcode: "001",
      price: "1500",
      stock: "20",
      attributes: {},
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
  allowOfflineSales: false,
  allowNegativeStock: false,
  creditApprovalThreshold: 1000,
  cashDifferenceLimit: 100,
  receiptWidth: 80,
};
await page.route("**/api/**", (route) => {
  const p = new URL(route.request().url()).pathname.replace("/api", "");
  let json = [];
  if (p.startsWith("/auth/"))
    json = { user, accessToken: "qa-not-a-real-token" };
  else if (p === "/terminals/register") {
    active.registerId = route.request().postDataJSON().id;
    json = {
      id: active.registerId,
      approved: true,
      approvedAt: "2026-10-09T12:00:00Z",
      active: true,
      name: "Equipo de práctica",
      deviceKey: "qa",
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
      },
    ];
  else if (p === "/sales")
    json = [
      {
        id: "qa-sale",
        number: "QA-000001",
        createdAt: "2026-10-09T12:00:00Z",
        status: "completed",
        total: "1500",
        creditBalance: "0",
        payments: [{ method: "cash", amount: "1500" }],
        items: [],
        customer: { name: "Cliente de práctica" },
      },
    ];
  else if (p === "/cash-sessions/opening-suggestion") json = { amount: null };
  else if (p === "/cash-sessions") json = sessions;
  else if (p === "/health") json = { ok: true };
  return route.fulfill({ json });
});
await mkdir("docs/capturas/manual", { recursive: true });
async function snap(name) {
  await page.screenshot({
    path: "docs/capturas/manual/" + name + ".png",
    fullPage: true,
  });
}
await page.goto("http://localhost:3063/#cash");
await page.getByRole("button", { name: "Abrir mi caja", exact: true }).click();
await expect(page.getByRole("dialog")).toBeVisible();
await snap("01-abrir-caja");
await page.getByRole("button", { name: "Cancelar", exact: true }).click();
sessions = [active];
await page.reload();
await page.getByRole("button", { name: "Movimiento", exact: true }).click();
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
await page.getByRole("button", { name: "Cancelar", exact: true }).click();
await page.goto("http://localhost:3063/#pos");
await expect(
  page.getByText("Producto de práctica", { exact: true }),
).toBeVisible();
await snap("02-vender");
await page.getByText("Producto de práctica", { exact: true }).click();
await page.keyboard.press("F4");
await page.getByText("Cliente de práctica", { exact: true }).click();
await page.getByRole("button", { name: /Cobrar/ }).click();
await expect(
  page.getByRole("button", { name: "Crédito / contraentrega", exact: true }),
).toBeVisible();
await snap("03-cobrar");
await page
  .getByRole("button", { name: "Crédito / contraentrega", exact: true })
  .click();
await page.getByRole("button", { name: "Agregar pago", exact: true }).click();
await expect(
  page.getByText("PIN del gerente para aprobar la venta", { exact: true }),
).toBeVisible();
await snap("03-credito");
await page.goto("http://localhost:3063/#sales");
await expect(
  page.getByRole("heading", { name: "Cada venta tiene una historia" }),
).toBeVisible();
await snap("05-ventas");
await page.goto("http://localhost:3063/#cash");
await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event("offline")));
await expect(
  page.getByRole("button", { name: "Offline", exact: true }),
).toBeVisible();
await snap("08-sin-internet");
console.log(
  "P2: captured actual local React screens with synthetic fixtures; no production data, no business writes",
);
await browser.close();
