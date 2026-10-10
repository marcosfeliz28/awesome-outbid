import type { Browser } from "@playwright/test";
import { test, expect } from "./apoyo";
// W6 · una caja es de una persona. Marcos (gerencia) abre su caja en la
// computadora T1; Lisbeth (cajera) inicia sesión en esa misma computadora (la
// misma identidad de equipo), ve «sin caja», abre la suya, y gerencia ve las
// dos cajas con su dueño. Nada de fechas fijas: todo sale de un sufijo único.
const owner = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const temporary = "FitStore-QA-2026!";
const password = "FitStore-QA-2026-Definitiva!";

test("W6: Lisbeth no ve la caja de Marcos en la misma computadora y abre la suya", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
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
  const tag = Date.now().toString(36);
  const roles = await api("/roles");
  const T1 = {
    id: crypto.randomUUID(),
    name: "E2E T1 " + tag,
    secret: "e2e-w6-secreto-" + crypto.randomUUID(),
  };
  const names: Record<string, string> = {};
  async function person(label: string, role: string) {
    const email = `e2e-w6-${label}-${tag}@example.test`;
    names[label] = "E2E " + label + " " + tag;
    await api("/users", {
      name: names[label],
      email,
      password: temporary,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    const changed = await request.post("/api/auth/change-password", {
      data: {
        login: email,
        currentPassword: temporary,
        newPassword: password,
        confirmPassword: password,
      },
    });
    expect(changed.ok()).toBe(true);
    const login = await changed.json();
    const t = await api("/terminals/register", T1, {
      Authorization: "Bearer " + login.accessToken,
    });
    if (t.status === "pending")
      await api("/terminals/" + T1.id + "/approve", {});
    return email;
  }
  async function enter(email: string) {
    const context = await (browser as Browser).newContext({
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ["fitstore-equipment:" + branch, JSON.stringify(T1)] as const,
    );
    const page = await context.newPage();
    await page.goto("/");
    await page.getByLabel("Usuario").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar a mi tienda" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    return { page, context };
  }
  const marcosEmail = await person("marcos", "manager");
  const lisbethEmail = await person("lisbeth", "seller");

  const marcos = await enter(marcosEmail);
  await marcos.page
    .getByRole("button", { name: "Abrir caja", exact: true })
    .click();
  await marcos.page.getByLabel("Efectivo inicial").fill("1000");
  await marcos.page
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await expect(
    marcos.page.getByText("Caja abierta", { exact: true }),
  ).toBeVisible();

  // Lisbeth, en la misma computadora: sin caja, sin avisos de otro equipo.
  const lisbeth = await enter(lisbethEmail);
  await expect(
    lisbeth.page.getByText("Tu día empieza con una caja abierta"),
  ).toBeVisible();
  await expect(
    lisbeth.page.getByText("Caja abierta", { exact: true }),
  ).toHaveCount(0);
  await expect(lisbeth.page.getByText(/Tu caja está abierta en/)).toHaveCount(
    0,
  );
  await expect(lisbeth.page.getByText(names.marcos)).toHaveCount(0);
  await lisbeth.page
    .getByRole("button", { name: "Abrir caja", exact: true })
    .first()
    .click();
  await lisbeth.page.getByLabel("Efectivo inicial").fill("500");
  await lisbeth.page
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await expect(
    lisbeth.page.getByText("Caja abierta", { exact: true }),
  ).toBeVisible();
  await expect(lisbeth.page.getByText(names.marcos)).toHaveCount(0);

  // Gerencia ve las dos cajas, con su dueño.
  await marcos.page.reload();
  await marcos.page.getByRole("button", { name: "Caja", exact: true }).click();
  const history = marcos.page.locator("table").last();
  await expect(history).toContainText(names.marcos);
  await expect(history).toContainText(names.lisbeth);

  await marcos.context.close();
  await lisbeth.context.close();
});
