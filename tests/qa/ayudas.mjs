// Ayudas del recorrido QA (26-oct): sesión, navegación, cajas y revisiones.
// Solo cliente de la copia local; no toca código de la aplicación.
import { chromium } from "../../node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
import { CLAVE, ESTADO, ROLES, WEB, API } from "./comun.mjs";

export const terminal = () => JSON.parse(readFileSync(ESTADO, "utf8")).terminal;
export const lanzar = () => chromium.launch();

/** Contexto nuevo con el equipo aprobado de la prueba ya guardado. */
export async function contexto(browser, ancho) {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: ancho > 500 ? 768 : 844 },
    // Un cliente distinto por contexto evita el límite de intentos por IP.
    extraHTTPHeaders: undefined,
  });
  await ctx.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* sin almacenamiento */
      }
    },
    ["fitstore-equipment:main", JSON.stringify(terminal())],
  );
  return ctx;
}

export async function entrar(page, rol) {
  await page.goto(WEB + "/", { waitUntil: "load" });
  await page.getByLabel("Usuario").fill(ROLES[rol]);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await page.waitForSelector(".app-shell", { timeout: 20000 });
  await page.waitForTimeout(800);
}

/** Pasa a tema oscuro con el botón real del encabezado. */
export async function temaOscuro(page) {
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
    null,
    { timeout: 5000 },
  );
}

export async function ir(page, id) {
  await page.evaluate((h) => (location.hash = h), id);
  await page.waitForTimeout(400);
  try {
    await page.waitForFunction(
      () => !document.querySelector(".main-content .loading"),
      null,
      { timeout: 10000 },
    );
  } catch {
    /* sigue cargando: queda anotado en la revisión */
  }
  await page.waitForTimeout(700);
}

export async function abrirCaja(page, monto = "2000") {
  await ir(page, "cash");
  const boton = page.getByRole("button", { name: "Abrir mi caja" });
  if (!(await boton.isVisible().catch(() => false))) return false;
  await boton.click();
  await page.getByLabel("Efectivo inicial").fill(monto);
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForTimeout(2000);
  return true;
}

/** Arma el carrito: Bandas Resistance (Lila) y cliente Adriana Torres. */
export async function armarCarrito(page) {
  await ir(page, "pos");
  await page.getByText("Bandas Resistance").first().click();
  await page.getByRole("button", { name: /Lila/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Cobrar/ }).first().click();
  await page.getByRole("button", { name: /Adriana Torres/ }).click();
  await page.waitForTimeout(700);
}
export async function limpiarCarrito(page) {
  const l = page.getByRole("button", { name: /Limpiar/ }).first();
  if (await l.isVisible().catch(() => false)) await l.click();
  await page.waitForTimeout(300);
}
/** Una venta en efectivo al contado (deja datos en «Mis ventas de hoy»). */
export async function ventaEfectivo(page) {
  await armarCarrito(page);
  await page.getByRole("button", { name: /^Cobrar/ }).first().click();
  await page.getByRole("button", { name: "Exacto" }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
}

// --- Revisiones en la página --------------------------------------------
export const revisarDesborde = (page) =>
  page.evaluate(() => {
    const de = document.documentElement;
    const W = de.clientWidth;
    const dentroDeScroll = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(o)) return true;
      }
      return false;
    };
    const fuera = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > W + 1 && !dentroDeScroll(el)) {
        const css = getComputedStyle(el);
        if (css.position === "fixed" || css.visibility === "hidden") continue;
        fuera.push(
          el.tagName.toLowerCase() +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "") +
            " right=" + Math.round(r.right),
        );
      }
    }
    return {
      scrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth),
      clientWidth: W,
      desborda: Math.max(de.scrollWidth, document.body.scrollWidth) > W + 1,
      elementos: fuera.slice(0, 6),
    };
  });

/** Controles sin nombre accesible (complementa a axe). */
export const revisarNombres = (page) =>
  page.evaluate(() => {
    const visible = (el) => el.checkVisibility?.({ visibilityProperty: true }) !== false;
    const nombre = (el) => {
      const a = el.getAttribute("aria-label");
      if (a && a.trim()) return a.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const t = by.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? "").join(" ").trim();
        if (t) return t;
      }
      if (el.id) {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l?.textContent.trim()) return l.textContent.trim();
      }
      if (el.closest("label")?.textContent.trim()) return "label";
      if ((el.textContent || "").trim()) return el.textContent.trim();
      if (el.getAttribute("title")) return el.getAttribute("title");
      if (el.querySelector("img[alt]:not([alt=''])")) return "img";
      return "";
    };
    const malos = [];
    for (const el of document.querySelectorAll(
      "button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab]",
    )) {
      if (!visible(el) || el.closest("[aria-hidden=true]")) continue;
      if (!nombre(el))
        malos.push(el.outerHTML.replace(/\s+/g, " ").slice(0, 140));
    }
    return malos.slice(0, 8);
  });

/** Foco visible: recorre con Tab y anota los controles sin indicador. */
export async function revisarFoco(page) {
  const sin = [];
  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const c = getComputedStyle(el);
      const anillo =
        (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) ||
        (c.boxShadow && c.boxShadow !== "none");
      return {
        anillo: !!anillo,
        el: el.tagName.toLowerCase() + (el.getAttribute("aria-label") ? "[" + el.getAttribute("aria-label") + "]" : ""),
      };
    });
    if (r && !r.anillo) sin.push(r.el);
  }
  return sin;
}

export async function axe(page, ruta) {
  if (!(await page.evaluate(() => typeof window.axe)).includes("object")) {
    await page.addScriptTag({ path: ruta });
  }
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      resultTypes: ["violations"],
    });
    return r.violations.map((v) => ({
      id: v.id,
      impacto: v.impact,
      ayuda: v.help,
      nodos: v.nodes.length,
      ejemplo: v.nodes[0]?.target?.join(" ") + " :: " + (v.nodes[0]?.failureSummary || "").split("\n").slice(1, 2).join(" ").slice(0, 160),
    }));
  });
}

export async function token(rol) {
  const r = await fetch(API + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: ROLES[rol], password: CLAVE }),
  });
  if (!r.ok) throw new Error("login API " + rol + " " + r.status);
  return (await r.json()).accessToken;
}
export async function get(path, tk) {
  const r = await fetch(API + path, { headers: { authorization: "Bearer " + tk } });
  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {
    /* no JSON */
  }
  return { estado: r.status, cuerpo };
}
