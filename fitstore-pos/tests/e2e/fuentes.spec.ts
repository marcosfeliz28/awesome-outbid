import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
// Ronda 9 · Windows: las fuentes viajan con la aplicación. Antes se pedían a
// Google Fonts al abrir: sin internet (la tienda sin conexión, un entorno
// aislado) la interfaz caía en la fuente genérica del sistema, y con internet
// Inter es más ancha que esa fuente genérica y la barra superior no cabía en
// 320 px. Estas pruebas miden siempre con las fuentes reales cargadas.
const GOOGLE_FONTS = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//;
const PANTALLAS = [
  "Resumen",
  "Punto de venta",
  "Ventas",
  "Productos",
  "Inventario",
  "Compras",
  "Caja",
  "Gastos",
  "Clientes",
  "Promociones",
  "Reportes",
  "Alertas",
  "Mercancía",
  "Configuración",
];
const PESTANAS = [
  "Negocio y reglas",
  "Usuarios y permisos",
  "Bitácora",
  "Equipos",
];
const PESOS = {
  Inter: [400, 450, 500, 550, 600, 650, 700, 750, 800],
  "Plus Jakarta Sans": [500, 550, 600, 650, 700, 750, 800],
};
// Cada contexto representa un equipo nuevo: cerrar la caja del escenario anterior.
test.beforeEach(async ({ request }) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
  });
  const { accessToken, user } = await login.json();
  const headers = { Authorization: "Bearer " + accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E fuentes", secret: "e2e-fuentes-" + id },
  });
  expect(registered.ok()).toBe(true);
  const sessions = await (
    await request.get("/api/cash-sessions", { headers })
  ).json();
  for (const s of sessions.filter(
    (s: any) => s.userId === user.id && !s.closedAt,
  )) {
    const response = await request.post(
      "/api/cash-sessions/" + s.id + "/close",
      {
        headers,
        data: {
          countedCash: Math.max(0, s.expected.cash),
          countedCard: Math.max(0, s.expected.card),
          countedTransfer: Math.max(0, s.expected.transfer),
          notes: "Cierre entre escenarios E2E",
        },
      },
    );
    expect(response.ok()).toBe(true);
  }
});
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
// Abre una pantalla desde el menú, como lo hace quien usa la aplicación; en
// celular el menú lateral está detrás del botón «Abrir menú».
async function abrir(page: any, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menú" });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true })
    .click();
  await expect(page.locator(".breadcrumb strong")).toHaveText(label);
  await listo(page);
}
async function listo(page: any) {
  await expect(page.locator(".main-content h1").first()).toBeVisible();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await expect(page.locator(".error-panel")).toHaveCount(0);
}
// Familias con al menos una cara cargada (descargada y lista para pintar).
async function familiasCargadas(page: any) {
  return await page.evaluate(async () => {
    await document.fonts.ready;
    const limpio = (s: string) => s.replace(/^["']|["']$/g, "");
    const primera = (el: Element | null) =>
      limpio(getComputedStyle(el!).fontFamily.split(",")[0].trim());
    return {
      texto: primera(document.body),
      titulo: primera(document.querySelector("h1")),
      caras: [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => ({
          familia: limpio(f.family),
          peso: f.weight,
          estilo: f.style,
          display: f.display,
        })),
    };
  });
}
// Desbordes horizontales de la pantalla actual, medidos con Inter ya cargada.
async function desbordes(page: any, pantalla: string) {
  const m = await page.evaluate(async () => {
    await document.fonts.ready;
    const barra = document.querySelector("header.topbar")!;
    const ruta = barra.querySelector(".breadcrumb")!;
    return {
      inter: [...document.fonts].some(
        (f) => f.status === "loaded" && /Inter/.test(f.family),
      ),
      pagina: document.documentElement.scrollWidth - window.innerWidth,
      barra: barra.scrollWidth - barra.clientWidth,
      // Ruta recortada con puntos suspensivos: la pantalla actual no se leería.
      ruta: ruta.scrollWidth - ruta.clientWidth,
      fuera: [barra, ...barra.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1)
          );
        })
        .map((el) => el.getAttribute("class") || el.tagName),
    };
  });
  expect(m.inter, "Inter cargada en " + pantalla).toBe(true);
  const problemas: string[] = [];
  if (m.pagina > 1)
    problemas.push(`${pantalla}: la página desborda ${m.pagina} px`);
  if (m.barra > 1)
    problemas.push(`${pantalla}: la barra desborda ${m.barra} px`);
  if (m.ruta > 1)
    problemas.push(`${pantalla}: la ruta se recorta ${m.ruta} px`);
  if (m.fuera.length)
    problemas.push(`${pantalla}: fuera de la vista ${m.fuera}`);
  return problemas;
}
function cubre(caras: any[], familia: string, pesos: number[]) {
  return caras.some((c) => {
    const [desde, hasta = desde] = String(c.peso).split(" ").map(Number);
    return (
      c.familia === familia &&
      c.estilo === "normal" &&
      desde <= Math.min(...pesos) &&
      hasta >= Math.max(...pesos)
    );
  });
}

test("sin Google Fonts: ninguna petición sale a fonts.googleapis.com ni a fonts.gstatic.com", async ({
  page,
  context,
}) => {
  // Las del service worker (precarga) sólo se ven desde el contexto.
  const peticiones: { url: string; tipo: string }[] = [];
  context.on("request", (r) =>
    peticiones.push({ url: r.url(), tipo: r.resourceType() }),
  );
  await login(page);
  for (const label of PANTALLAS) await abrir(page, label);
  for (const label of PESTANAS) {
    await page.locator(".tabs.outside button", { hasText: label }).click();
    await listo(page);
  }
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await navigator.serviceWorker.ready;
  });
  expect(
    peticiones.filter((p) => GOOGLE_FONTS.test(p.url)).map((p) => p.url),
  ).toEqual([]);
  // Las fuentes sí se piden, y sólo a la propia aplicación.
  const origen = new URL(page.url()).origin;
  const fuentes = peticiones.filter((p) => p.tipo === "font");
  expect(fuentes.length).toBeGreaterThan(0);
  expect(
    fuentes.filter((p) => new URL(p.url).origin !== origen).map((p) => p.url),
  ).toEqual([]);
});

test("fuentes disponibles sin red externa: Inter y Plus Jakarta Sans cargan con todos sus pesos", async ({
  page,
  context,
}) => {
  await context.route(GOOGLE_FONTS, (route) => route.abort());
  await login(page);
  const estado = await familiasCargadas(page);
  expect(estado.texto).toBe("Inter");
  expect(estado.titulo).toBe("Plus Jakarta Sans");
  // Una cara variable por familia cubre los pesos intermedios (450, 550, 650
  // y 750) que usa la hoja de estilos.
  for (const [familia, pesos] of Object.entries(PESOS))
    expect(
      cubre(estado.caras, familia, pesos),
      familia + " · caras cargadas: " + JSON.stringify(estado.caras),
    ).toBe(true);
  expect(estado.caras.map((c: any) => c.display)).toEqual(
    estado.caras.map(() => "swap"),
  );
  // Lo que Chromium usó de verdad para pintar las letras: la fuente descargada
  // y no una del sistema (que sólo puede aparecer para símbolos como «✦»).
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  for (const [selector, familia] of [
    [".breadcrumb strong", "Inter"],
    [".main-content h1", "Plus Jakarta Sans"],
  ]) {
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    const descargadas = fonts.filter((f) => f.isCustomFont);
    expect(
      descargadas.map((f) => f.familyName),
      selector + ": " + JSON.stringify(fonts),
    ).toEqual([familia]);
    for (const f of fonts)
      expect(
        descargadas[0].glyphCount,
        selector + ": " + JSON.stringify(fonts),
      ).toBeGreaterThanOrEqual(f.glyphCount);
  }
  // Pesos variables de verdad: cada peso es más ancho que el anterior. Con
  // caras fijas, 450 se pintaría igual que 400 o que 500.
  for (const [familia, pesos] of Object.entries(PESOS)) {
    const anchos = await page.evaluate(
      async ([familia, pesos]: [string, number[]]) => {
        const anchos: number[] = [];
        for (const peso of pesos) {
          const fuente = `${peso} 64px "${familia}"`;
          await document.fonts.load(fuente);
          const span = document.createElement("span");
          span.textContent = "Facturación 0123456789";
          span.style.cssText =
            "position:absolute;visibility:hidden;white-space:nowrap;font:" +
            fuente;
          document.body.append(span);
          anchos.push(span.getBoundingClientRect().width);
          span.remove();
        }
        return anchos;
      },
      [familia, pesos] as [string, number[]],
    );
    for (let i = 1; i < anchos.length; i++)
      expect(
        anchos[i],
        `${familia} ${pesos[i]} frente a ${pesos[i - 1]}: ${anchos}`,
      ).toBeGreaterThan(anchos[i - 1]);
  }
});

test("las fuentes quedan en la precarga del service worker y se ven sin conexión", async ({
  page,
  context,
}) => {
  const fuentes = new Set<string>();
  page.on("request", (r) => {
    if (r.resourceType() === "font") fuentes.add(r.url());
  });
  await login(page);
  await familiasCargadas(page);
  expect(fuentes.size).toBeGreaterThan(0);
  const sinPrecarga = await page.evaluate(
    async (urls: string[]) => {
      // Con el service worker activo, la precarga ya terminó.
      await navigator.serviceWorker.ready;
      const faltan: string[] = [];
      for (const url of urls)
        if (!(await caches.match(url, { ignoreSearch: true })))
          faltan.push(url);
      return faltan;
    },
    [...fuentes],
  );
  expect(sinPrecarga).toEqual([]);
  // La primera instalación empieza a controlar la página en la próxima navegación.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    true,
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1").first()).toBeVisible();
  const estado = await familiasCargadas(page);
  for (const [familia, pesos] of Object.entries(PESOS))
    expect(
      cubre(estado.caras, familia, pesos),
      familia + " sin conexión · caras: " + JSON.stringify(estado.caras),
    ).toBe(true);
  await context.setOffline(false);
});

test("el contenedor de escritorio sólo admite fuentes y estilos propios, y con esa política la aplicación carga sus fuentes", async ({
  page,
}) => {
  const conf = JSON.parse(
    readFileSync(
      path.join(
        path.dirname(test.info().config.configFile!),
        "apps/web/src-tauri/tauri.conf.json",
      ),
      "utf8",
    ),
  );
  const csp: string = conf.app.security.csp;
  const directiva = (nombre: string) =>
    csp
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .find((d) => d[0] === nombre)
      ?.slice(1);
  expect(directiva("font-src")).toEqual(["'self'"]);
  expect(directiva("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  // La misma política, puesta a la PWA compilada: nada queda bloqueado.
  await page.addInitScript(() => {
    (window as any).__bloqueos = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as any).__bloqueos.push(
        e.effectiveDirective + " " + e.blockedURI,
      ),
    );
  });
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), "content-security-policy": csp },
      });
    },
  );
  await login(page);
  const estado = await familiasCargadas(page);
  for (const [familia, pesos] of Object.entries(PESOS))
    expect(
      cubre(estado.caras, familia, pesos),
      familia + " · caras cargadas: " + JSON.stringify(estado.caras),
    ).toBe(true);
  expect(await page.evaluate(() => (window as any).__bloqueos)).toEqual([]);
});

// La barra superior (menú, ruta, conexión, tema y cuenta) entra completa en un
// celular angosto, y ninguna pantalla del menú se desplaza hacia los lados.
for (const ancho of [320, 390])
  for (const tema of ["claro", "oscuro"])
    test(`la barra superior cabe a ${ancho} px con las fuentes cargadas (tema ${tema})`, async ({
      page,
    }) => {
      await login(page);
      if (tema === "oscuro") {
        await page.getByRole("button", { name: "Activar modo oscuro" }).click();
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          "dark",
        );
      }
      await page.setViewportSize({ width: ancho, height: 800 });
      const problemas: string[] = [];
      for (const label of PANTALLAS) {
        await abrir(page, label);
        problemas.push(...(await desbordes(page, label)));
      }
      for (const label of PESTANAS) {
        await page.locator(".tabs.outside button", { hasText: label }).click();
        await listo(page);
        problemas.push(...(await desbordes(page, "Configuración › " + label)));
      }
      expect(problemas).toEqual([]);
    });
