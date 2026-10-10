import type { Browser } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test, expect, selectNamedCustomer } from "./apoyo";
// INC: la administración pone la tarifa de una categoría en Configuración, la
// cajera marca «Venta al por mayor», cobra y ve su acumulado a la mitad en
// Caja; la administración ve el cuadre en «Incentivos» y cierra el mes.
const owner = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const temporary = "FitStore-QA-2026!";
const password = "FitStore-QA-2026-Definitiva!";
const month = new Date()
  .toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
  .slice(0, 7);

// Los cierres que hace la prueba se deshacen al terminar (sólo en la base de
// pruebas), para que la suite se pueda repetir y las demás pruebas vendan en
// un mes abierto.
function testDb() {
  const requireApi = createRequire(
    resolve(__dirname, "../../apps/api/package.json"),
  );
  requireApi("dotenv").config({
    path: resolve(__dirname, "../../.env"),
    quiet: true,
  });
  const { PrismaClient } = requireApi("@prisma/client");
  return new PrismaClient();
}
async function reopen(db: any, branchId: string, period = month) {
  await db.incentiveSettlement.deleteMany({
    where: { branchId, period },
  });
  await db.incentivePeriodClose.deleteMany({
    where: { branchId, period },
  });
}
// Un mes pasado propio de cada corrida (no choca con tests/incentives-api).
const n = Date.now();
const past = `${1981 + (n % 20)}-${String((Math.floor(n / 20) % 12) + 1).padStart(2, "0")}`;

test("Incentivos: tarifa en Configuración, venta al por mayor a la mitad y cierre del mes", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const db = testDb();
  const auth = await (
    await request.post("/api/auth/login", { data: owner })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const branch = auth.user.branchId;
  const api = async (path: string, data?: unknown, as = headers) => {
    const r =
      data === undefined
        ? await request.get("/api" + path, { headers: as })
        : await request.post("/api" + path, { headers: as, data });
    expect(r.ok(), path + " " + (await r.text())).toBe(true);
    return r.json();
  };
  await reopen(db, branch);
  const tag = Date.now().toString(36);
  const category = await api("/categories", { name: "E2E Incentivos " + tag });
  const product = await api("/products", {
    name: "E2E Incentivo " + tag,
    sku: "E2E-INC-" + tag,
    categoryId: category.id,
    taxRate: 0,
    variants: [
      {
        sku: "E2E-INCV-" + tag,
        barcode: "E2E-INCB-" + tag,
        price: 300,
        costAvg: 100,
      },
    ],
  });
  const roles = await api("/roles");

  // Una pantalla con su usuaria y su equipo aprobado.
  async function station(email: string, secretLogin?: string) {
    const ownerTerminal = crypto.randomUUID();
    const identity = {
      id: ownerTerminal,
      name: "E2E incentivos " + tag,
      secret: "e2e-incentivos-" + crypto.randomUUID(),
    };
    const token = secretLogin ?? auth.accessToken;
    const t = await api("/terminals/register", identity, {
      Authorization: "Bearer " + token,
    });
    if (t.status === "pending")
      await api("/terminals/" + identity.id + "/approve", {});
    const context = await (browser as Browser).newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ["fitstore-equipment:" + branch, JSON.stringify(identity)] as const,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByLabel("Usuario").fill(email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(secretLogin ? password : owner.password);
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar a mi tienda" }),
    ).toHaveCount(0);
    return { page, context, errors };
  }

  try {
    // 1. La administración pone RD$ 80 por unidad a la categoría nueva.
    const admin = await station(owner.email);
    await admin.page
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    const rate = admin.page.getByLabel(
      "Incentivo por unidad de E2E Incentivos " + tag,
    );
    await expect(rate).toHaveValue("0");
    await rate.fill("80");
    await admin.page.getByRole("button", { name: "Guardar tarifas" }).click();
    await expect(
      admin.page.getByText("Tarifas de incentivos guardadas."),
    ).toBeVisible();
    const rates = await api("/incentives/rates");
    expect(rates.find((r: any) => r.categoryId === category.id)).toMatchObject({
      amount: 80,
      isDefault: false,
    });

    // 2. La cajera vende al por mayor: el total no cambia, el incentivo sí.
    const email = `e2e-incentivos-${tag}@example.test`;
    const name = "E2E Cajera Incentivos " + tag;
    await api("/users", {
      name,
      email,
      password: temporary,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    const changed = await request.post("/api/auth/change-password", {
      data: {
        login: email,
        currentPassword: temporary,
        newPassword: password,
        confirmPassword: password,
      },
    });
    expect(changed.ok(), "cambio de contraseña inicial").toBe(true);
    await api("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 3,
      reason: "E2E incentivos",
    });
    const cajera = await station(email, (await changed.json()).accessToken);
    const page = cajera.page;
    // La cajera no tiene la pantalla de gerencia.
    await expect(
      page.getByRole("button", { name: "Incentivos", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
    await page.getByLabel("Efectivo inicial").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
    await expect(page.getByTestId("mis-incentivos-neto")).toHaveText(
      "RD$ 0.00",
    );
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    await page.getByLabel("Buscar productos").fill(product.name);
    await page
      .locator(".product-card")
      .filter({ hasText: product.name })
      .click();
    await selectNamedCustomer(page);
    const wholesale = page.getByRole("button", { name: "Venta al por mayor" });
    await expect(wholesale).toHaveAttribute("aria-pressed", "false");
    await wholesale.click();
    await expect(wholesale).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("Activa: el incentivo de esta venta será la mitad."),
    ).toBeVisible();
    // Precios y total no cambian.
    await expect(page.locator(".cart-total strong")).toHaveText("RD$ 300.00");
    await page
      .getByRole("button", { name: /Cobrar/ })
      .first()
      .click();
    await expect(
      page.getByText("Venta al por mayor · incentivo a la mitad"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Venta al por mayor · incentivo a la mitad"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    // La marca se reinicia para la venta siguiente.
    await expect(wholesale).toHaveAttribute("aria-pressed", "false");
    // Su acumulado del mes: 1 × RD$ 80 × 0.5.
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await expect(page.getByTestId("mis-incentivos-neto")).toHaveText(
      "RD$ 40.00",
    );
    await expect(page.locator(".incentive-mine")).toContainText(
      "1 al por mayor",
    );

    // 3. La administración ve el cuadre y cierra el mes.
    await admin.page
      .getByRole("button", { name: "Incentivos", exact: true })
      .click();
    const row = admin.page.locator(".incentive-table tbody tr").filter({
      hasText: name,
    });
    await expect(row).toContainText("RD$ 40.00");
    await expect(row.locator("td").nth(5)).toContainText("1");
    await expect(
      admin.page.getByText("Mes abierto · cifras preliminares"),
    ).toBeVisible();
    const excel = admin.page.waitForEvent("download");
    await admin.page.getByRole("button", { name: "Exportar Excel" }).click();
    expect((await excel).suggestedFilename()).toBe(`incentivos-${month}.xlsx`);
    // B-3 (auditoría 01): el mes en curso no se cierra; se avisa cuándo.
    await expect(
      admin.page.getByRole("button", { name: "Cerrar mes" }),
    ).toHaveCount(0);
    await expect(
      admin.page.getByText("El mes en curso se cierra cuando termine"),
    ).toBeVisible();
    // Un mes ya terminado sí: la venta de la cajera se lleva a un mes pasado
    // propio de esta corrida (sólo en la base de pruebas).
    const cajeraId = (await db.user.findFirstOrThrow({ where: { email } })).id;
    await db.incentiveEntry.updateMany({
      where: { userId: cajeraId },
      data: { period: past, originPeriod: past },
    });
    await admin.page.getByLabel("Mes", { exact: true }).fill(past);
    await expect(row).toContainText("RD$ 40.00");
    await admin.page.getByRole("button", { name: "Cerrar mes" }).click();
    await admin.page.getByRole("button", { name: "Cerrar el mes" }).click();
    await expect(admin.page.getByText(/^Mes cerrado ·/)).toBeVisible();
    await expect(
      admin.page.getByRole("button", { name: "Cerrar mes" }),
    ).toHaveCount(0);
    await expect(row).toContainText("RD$ 40.00");
    const closed = await api("/incentives?month=" + past);
    expect(closed.closed).toBeTruthy();
    expect(closed.rows.find((r: any) => r.name === name).net).toBe(40);

    for (const s of [admin, cajera]) {
      expect(s.errors).toEqual([]);
      await s.context.close();
    }
  } finally {
    await reopen(db, branch);
    await reopen(db, branch, past);
    await db.$disconnect();
    await request.patch("/api/products/" + product.id, {
      headers,
      data: { active: false },
    });
  }
});
