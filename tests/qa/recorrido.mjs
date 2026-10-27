// Recorrido QA de Nexora (26-oct) con Playwright, SOLO contra la copia local.
//   node tests/qa/recorrido.mjs [rol,rol] [--axe=/ruta/axe.min.js]
// Por rol × ancho (1366, 390) × tema (claro, oscuro) recorre cada pantalla que el
// rol ve en el menú, más las ventanas de Cobrar, Preguntas, Cerrar caja y las
// pestañas de GV. Anota errores de consola/red, desborde horizontal, axe, nombres
// accesibles y foco, y guarda la captura en docs/qa/recorrido-26oct/<rol>/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { raiz, ROLES } from "./comun.mjs";
import {
  lanzar, contexto, entrar, temaOscuro, ir, abrirCaja, armarCarrito,
  limpiarCarrito, revisarDesborde, revisarNombres, revisarFoco, axe,
} from "./ayudas.mjs";

const args = process.argv.slice(2);
const roles = (args.find((a) => !a.startsWith("--")) || "admin,gerente,cajera,gv").split(",");
const AXE = (args.find((a) => a.startsWith("--axe=")) || "").slice(6);
const SALIDA = join(raiz, "docs", "qa", "recorrido-26oct");
const ANCHOS = [1366, 390];
const TEMAS = ["claro", "oscuro"];

// Menú (App.tsx `navigation`) → id de la ruta (#hash).
const MENU = {
  "Mercancía": "merchandise", "Resumen": "dashboard", "Punto de venta": "pos",
  "Ventas": "sales", "Solicitudes de anulación": "void-requests",
  "Conciliar transferencias": "transfer-reconciliation",
  "Envíos del mensajero": "courier-payouts", "Productos": "products",
  "Inventario": "inventory", "Compras": "purchases", "Caja": "cash",
  "Gastos": "expenses", "Clientes": "customers", "Promociones": "promotions",
  "Reportes": "reports", "Alertas": "alerts", "Incentivos": "incentives",
  "GV Makeup Studio": "gv", "Configuración": "settings",
};
const TODAS = Object.values(MENU);
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const sensibles = /(^|\.)(cost|costAvg|unitCost|costTotal|wasteCostTotal|damagedCost|margin\w*|profit\w*|expected\w*)$/i;
function claves(obj, ruta = "", out = [], d = 0) {
  if (d > 6 || obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const r = ruta ? ruta + "." + k : k;
    if (sensibles.test(r) && v !== null && v !== undefined) out.push(r + "=" + JSON.stringify(v).slice(0, 40));
    claves(Array.isArray(v) ? v.slice(0, 3) : v, Array.isArray(obj) ? ruta : r, out, d + 1);
  }
  return out;
}

const browser = await lanzar();
for (const rol of roles) {
  const filas = [];
  const dir = join(SALIDA, rol);
  mkdirSync(dir, { recursive: true });
  for (const ancho of ANCHOS) for (const tema of TEMAS) {
    const ctx = await contexto(browser, ancho);
    const page = await ctx.newPage();
    let actual = "inicio";
    const buf = {};
    const nota = (tipo, texto) => ((buf[actual] ??= []).push({ tipo, texto: String(texto).slice(0, 300) }));
    page.on("console", (m) => m.type() === "error" && nota("consola", m.text() + " @" + (m.location().url || "").replace(/^https?:\/\/[^/]+/, "")));
    page.on("pageerror", (e) => nota("excepcion", e.message));
    page.on("requestfailed", (r) => nota("red", "FALLÓ " + r.method() + " " + r.url().replace(/^https?:\/\/[^/]+/, "") + " " + (r.failure()?.errorText || "")));
    page.on("response", async (r) => {
      const u = r.url().replace(/^https?:\/\/[^/]+/, "");
      if (r.status() >= 400) nota("red", r.status() + " " + r.request().method() + " " + u);
      if (rol === "cajera" && r.ok() && u.startsWith("/api/") && (r.headers()["content-type"] || "").includes("json")) {
        try {
          const k = claves(await r.json());
          if (k.length) nota("sensible", u + " -> " + k.slice(0, 6).join(", "));
        } catch { /* sin cuerpo */ }
      }
    });
    await entrar(page, rol);
    if (tema === "oscuro") await temaOscuro(page);
    const etiquetas = (await page.locator(".sidebar .nav-item").allTextContents()).map((t) => t.trim());
    const permitidas = etiquetas.map((e) => MENU[e]).filter(Boolean);
    const dest = permitidas.map((id) => [id, id]);
    // Pestañas de GV: se abren con clic (Gv.tsx).
    const extra = [];
    if (permitidas.includes("gv")) extra.push(["gv", "gv-cursos"], ["gv-detalle-curso", "gv-curso-detalle"], ["gv-citas", "gv-citas"], ["gv-interesadas", "gv-interesadas"], ["gv-por-verificar", "gv-por-verificar"], ["gv-reportes", "gv-reportes"]);
    if (permitidas.includes("pos")) extra.push(["pos-cobrar", "pos-cobrar"], ["pos-preguntas", "pos-preguntas"], ["pos-mis-ventas-hoy", "pos-mis-ventas-hoy"]);
    if (permitidas.includes("cash")) extra.push(["cash-cerrar", "cash-cerrar"]);
    if (ancho < 500) extra.push(["menu", "menu-movil"]);
    const lista = [...dest.map(([id]) => ({ id })), ...extra.filter(([, n]) => n !== "gv-cursos").map(([, n]) => ({ id: n }))];
    const prohibidas = TODAS.filter((id) => !permitidas.includes(id) && !(id === "settings" && etiquetas.includes("Configuración")));

    async function revisar(nombre, abrir) {
      actual = nombre;
      const fila = { rol, pantalla: nombre, ancho, tema, consola: [], red: [], sensibles: [], excepciones: [] };
      try {
        await abrir();
      } catch (e) {
        fila.fallaAbrir = String(e.message).split("\n")[0].slice(0, 200);
      }
      await page.waitForTimeout(500);
      const dibujado = await page.evaluate(() => document.documentElement.dataset.theme);
      fila.temaAplicado = dibujado;
      fila.titulo = (await page.locator(".main-content h1").first().textContent({ timeout: 1500 }).catch(() => "")) || "";
      fila.hashFinal = await page.evaluate(() => location.hash);
      fila.desborde = await revisarDesborde(page);
      fila.nombresSinAccesible = await revisarNombres(page);
      fila.focoSinIndicador = await revisarFoco(page);
      if (AXE) fila.axe = await axe(page, AXE).catch((e) => [{ id: "axe-error", impacto: "n/a", ayuda: String(e.message).slice(0, 120), nodos: 0 }]);
      fila.texto = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 4000);
      const archivo = `${slug(nombre)}-${ancho}-${tema}.png`;
      await page.screenshot({ path: join(dir, archivo) });
      fila.captura = `docs/qa/recorrido-26oct/${rol}/${archivo}`;
      await page.waitForTimeout(250);
      for (const n of buf[nombre] ?? []) {
        if (n.tipo === "consola") fila.consola.push(n.texto);
        else if (n.tipo === "red") fila.red.push(n.texto);
        else if (n.tipo === "sensible") fila.sensibles.push(n.texto);
        else fila.excepciones.push(n.texto);
      }
      filas.push(fila);
      console.log(`${rol} ${ancho} ${tema} ${nombre}: desborde=${fila.desborde.desborda} axe=${fila.axe?.length ?? "-"} red=${fila.red.length} consola=${fila.consola.length}`);
      // Cierra cualquier ventana que haya quedado abierta.
      await page.keyboard.press("Escape").catch(() => {});
    }

    for (const p of lista) {
      const id = p.id;
      if (id === "cash") {
        // Estado «caja cerrada» y luego caja abierta.
        await revisar("cash-cerrada", () => ir(page, "cash"));
        if (await abrirCaja(page)) console.log(rol, "abrió caja");
        await revisar("cash", () => ir(page, "cash"));
      } else if (id === "pos-cobrar") {
        await revisar(id, async () => {
          await armarCarrito(page);
          await page.getByRole("button", { name: /^Cobrar/ }).first().click();
          await page.waitForTimeout(900);
        });
        await page.keyboard.press("Escape").catch(() => {});
        await limpiarCarrito(page);
      } else if (id === "pos-preguntas") {
        await revisar(id, async () => {
          await ir(page, "pos");
          await page.getByRole("button", { name: /Preguntas/ }).first().click();
          await page.waitForTimeout(700);
        });
      } else if (id === "pos-mis-ventas-hoy") {
        await revisar(id, async () => {
          await ir(page, "pos");
          await page.getByRole("button", { name: /Preguntas/ }).first().click();
          await page.getByText("¿Cuánto vendí hoy?").first().click();
          await page.waitForTimeout(1500);
        });
      } else if (id === "cash-cerrar") {
        await revisar(id, async () => {
          await ir(page, "cash");
          const b = page.getByRole("button", { name: /Cerrar y arquear/ }).first();
          await b.click();
          await page.waitForTimeout(900);
        });
      } else if (id === "menu-movil") {
        await revisar(id, async () => {
          await ir(page, permitidas[0]);
          await page.getByRole("button", { name: "Abrir menú" }).click();
          await page.waitForTimeout(700);
        });
        await page.keyboard.press("Escape").catch(() => {});
      } else if (id.startsWith("gv-")) {
        const pestana = { "gv-curso-detalle": null, "gv-citas": "Citas", "gv-interesadas": "Interesadas", "gv-por-verificar": "Por verificar", "gv-reportes": "Reportes" }[id];
        await revisar(id, async () => {
          await ir(page, "gv");
          if (pestana) await page.getByRole("tab", { name: pestana, exact: true }).click();
          else await page.getByText(/Automaquillaje octubre/).first().click();
          await page.waitForTimeout(1200);
        });
      } else if (id === "gv") {
        await revisar("gv-cursos", () => ir(page, "gv"));
      } else {
        await revisar(id, () => ir(page, id));
      }
    }
    // Rutas que el rol no debe ver: la aplicación debe sacarlo de ahí.
    for (const id of prohibidas) {
      actual = "prohibida-" + id;
      await ir(page, id);
      await page.waitForTimeout(600);
      const hash = await page.evaluate(() => location.hash);
      const h1 = (await page.locator(".main-content h1").first().textContent({ timeout: 1000 }).catch(() => "")) || "";
      filas.push({ rol, pantalla: "prohibida-" + id, ancho, tema, hashFinal: hash, titulo: h1, rechazada: hash.slice(1) !== id, red: (buf[actual] ?? []).filter((n) => n.tipo === "red").map((n) => n.texto) });
    }
    await ctx.close();
  }
  writeFileSync(join(dir, "resultados.json"), JSON.stringify(filas, null, 1));
  console.log("== listo", rol, filas.length, "filas");
}
await browser.close();
