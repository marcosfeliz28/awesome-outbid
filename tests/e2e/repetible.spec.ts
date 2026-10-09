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

// TS-2 · La API deja pasar 60 peticiones por minuto a /api/auth/* desde una
// misma dirección. Todas las pruebas llegaban como 127.0.0.1 (el proxy de la
// vista previa no dice de quién es cada petición): al repetir la suite o en una
// máquina rápida, el límite de una prueba hacía fallar el inicio de sesión de
// las siguientes. Cada prueba es un equipo con su propia dirección; el límite
// sigue activo para cada una.
test.describe("TS-2: cada prueba llega a la API con su propia dirección", () => {
  const credentials = {
    email: "admin@fitstore.demo",
    password: "FitStore-Demo-2026!",
  };
  async function signIn(page: any) {
    await page.goto("/");
    await page.getByLabel("Usuario").fill(credentials.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(credentials.password);
    const response = page.waitForResponse(
      (r: any) =>
        r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    return response;
  }
  test("una prueba que agota el límite de autenticación sólo se bloquea a sí misma, en la API y en la página", async ({
    page,
    request,
  }) => {
    // El límite de autenticación es por dirección y por identificador de
    // cuenta (REQUEST_RATE_LIMITS.authAccount = 60 por minuto), y se aplica a
    // los inicios de sesión; /api/auth/me ya no cuenta. Se usa la cuenta con
    // contraseña correcta para no activar el bloqueo por contraseñas fallidas.
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++)
      statuses.push(
        (await request.post("/api/auth/login", { data: credentials })).status(),
      );
    // Nadie más usó la dirección de esta prueba: pasan justo 60 y la 61 se
    // rechaza.
    expect(statuses.indexOf(429)).toBe(60);
    expect(new Set(statuses.slice(0, 60))).toEqual(new Set([201]));
    // La página de esta prueba es el mismo equipo: también queda bloqueada.
    expect((await signIn(page)).status()).toBe(429);
    await expect(page.getByRole("alert")).toContainText("Demasiados intentos");
  });
  test("la prueba siguiente inicia sesión, en la API y en la página, aunque la anterior acaba de agotar el límite", async ({
    page,
    request,
  }) => {
    const login = await request.post("/api/auth/login", { data: credentials });
    expect(login.ok()).toBe(true);
    expect((await signIn(page)).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  });
});
