import type { Browser } from "@playwright/test";
import { test, expect } from "./apoyo";
// W8 · el fondo sugerido al abrir es lo que la propia persona dejó en su
// último cierre, sin importar quién cerró antes en la misma computadora.
const owner = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const temporary = "482917";
const password = "736204";

// Las usuarias de prueba se desactivan al terminar (ver caja-por-usuario.spec).
const made: string[] = [];
test.afterEach(async ({ request }) => {
  const auth = await (
    await request.post("/api/auth/login", { data: owner })
  ).json();
  for (const id of made.splice(0))
    await request.patch("/api/users/" + id, {
      headers: { Authorization: "Bearer " + auth.accessToken },
      data: { active: false },
    });
});

test("W8: «Abrir mi caja» sugiere lo que dejó esa persona, no la otra del equipo", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const auth = await (
    await request.post("/api/auth/login", { data: owner })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const branch = auth.user.branchId;
  const call = async (path: string, data?: unknown, as = headers) => {
    const r =
      data === undefined
        ? await request.get("/api" + path, { headers: as })
        : await request.post("/api" + path, { headers: as, data });
    expect(r.ok(), path + " " + (await r.text())).toBe(true);
    return r.json();
  };
  const tag = Date.now().toString(36);
  const roles = await call("/roles");
  const T = {
    id: crypto.randomUUID(),
    name: "E2E fondo " + tag,
    secret: "e2e-w8-secreto-" + crypto.randomUUID(),
  };
  async function person(label: string) {
    const email = `e2e-w8-${label}-${tag}@example.test`;
    const user = await call("/users", {
      name: "E2E " + label + " " + tag,
      email,
      password: temporary,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    made.push(user.id);
    const changed = await request.post("/api/auth/change-password", {
      data: {
        login: email,
        currentPassword: temporary,
        newPassword: password,
        confirmPassword: password,
      },
    });
    expect(changed.ok()).toBe(true);
    const token = (await changed.json()).accessToken;
    const as = { Authorization: "Bearer " + token };
    const t = await call("/terminals/register", T, as);
    if (t.status === "pending")
      await call("/terminals/" + T.id + "/approve", {});
    return { email, as };
  }
  const ana = await person("ana");
  const bea = await person("bea");
  // Ana deja 600 (abre 1000 y entrega 400); después Bea deja 900.
  const a = await call("/cash-sessions/open", { openingAmount: 1000 }, ana.as);
  await call(
    "/cash-sessions/" + a.id + "/close",
    { countedCash: 1000, countedCard: 0, countedTransfer: 0, delivered: 400 },
    ana.as,
  );
  const b = await call("/cash-sessions/open", { openingAmount: 900 }, bea.as);
  await call(
    "/cash-sessions/" + b.id + "/close",
    { countedCash: 900, countedCard: 0, countedTransfer: 0 },
    bea.as,
  );

  const context = await (browser as Browser).newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    ["fitstore-equipment:" + branch, JSON.stringify(T)] as const,
  );
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Usuario").fill(ana.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await expect(page.getByLabel("Efectivo inicial")).toHaveValue("600");
  await expect(
    page.getByText("Sugerido: lo que dejaste en tu último cierre."),
  ).toBeVisible();
  await context.close();
});
