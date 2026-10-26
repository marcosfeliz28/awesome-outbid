// Obsidian Lumina · fase 3: criterios de aceptación de las cinco pantallas de
// administración (Productos, Inventario, Clientes, Reportes, Configuración) en
// 1366×768 y 390×844, con tema claro y oscuro. Y la caja (vendedor) intacta.
//
// Regla de áreas táctiles del código (styles.css): 44 px en celular (min-height
// 44 en botones y campos) y 40 px en escritorio (`.heading-actions .button`,
// `.heading-actions select`). Aquí: celular >= 44x44, escritorio >= 40x40.
// Contraste: `@axe-core/playwright` no está instalado; se calcula con los
// colores reales (getComputedStyle + lienzo para normalizar). Límite conocido:
// el fondo se compone con los fondos sólidos/translúcidos de los ancestros e
// ignora degradados e imágenes.
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

// --- Ayudas comunes ---------------------------------------------------------
const PANTALLAS = [
  { id: "products", nombre: "Productos" },
  { id: "inventory", nombre: "Inventario" },
  { id: "customers", nombre: "Clientes" },
  { id: "reports", nombre: "Reportes" },
  { id: "settings", nombre: "Configuración" },
] as const;
const VISTAS = [
  { nombre: "escritorio 1366×768", width: 1366, height: 768, movil: false },
  { nombre: "celular 390×844", width: 390, height: 844, movil: true },
] as const;
const TEMAS = ["light", "dark"] as const;
const ESLOGAN = "TU NEGOCIO, CON CLARIDAD";

async function entrar(page: Page, email = "admin@fitstore.demo") {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  // Espera el armazón de la app; si el login falla, lo dice claro (no un timeout lejano).
  const armazon = page.locator(".app-shell");
  const fallo = page.locator(".login-page [role=alert]");
  await expect(armazon.or(fallo).first()).toBeVisible({ timeout: 20000 });
  if (await fallo.count())
    throw new Error(
      `Falló el inicio de sesión de ${email} (¿bloqueo o contraseña cambiada?): ${await fallo.first().innerText()}`,
    );
  await expect(armazon).toBeVisible();
}
/** Pantallas con tabla: sin filas reales la prueba debe FALLAR, no omitirse. */
const CON_TABLA = ["products", "inventory", "customers", "reports"];
/** Contenido real esperado por pantalla (el esqueleto no cuenta). */
const DATOS: Record<string, string> = {
  products: ".main-content td",
  inventory: ".main-content td",
  customers: ".main-content td",
  reports: ".main-content td",
  settings: ".main-content .cfg-tabs button",
  pos: ".product-card",
};
async function fuentesListas(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}
async function abrir(page: Page, id: string) {
  await page.evaluate((hash) => (location.hash = hash), id);
  await expect(page.locator(".main-content h1").first()).toBeVisible({
    timeout: 15000,
  });
  // `TableSkeleton` no es `.loading`: se espera a que no quede ninguno.
  await expect(page.locator(".main-content .loading")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator(".main-content .table-skeleton")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect
    .poll(() => page.locator(DATOS[id]).count(), {
      message: `${id}: sin datos reales tras la carga`,
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await fuentesListas(page);
}
/** El tema real: el botón de la barra superior (guarda en localStorage). */
async function ponerTema(page: Page, tema: "light" | "dark") {
  const actual = () =>
    page.evaluate(() => document.documentElement.dataset.theme || "light");
  if ((await actual()) === tema) return;
  await page
    .getByRole("button", { name: /Activar modo (oscuro|claro)/ })
    .first()
    .click();
  await expect.poll(actual).toBe(tema);
}
/** Prepara la pantalla y repite `comprobar` en claro y oscuro. */
async function enTemas(
  page: Page,
  v: (typeof VISTAS)[number],
  id: string,
  comprobar: (tema: string) => Promise<void>,
) {
  await page.setViewportSize({ width: v.width, height: v.height });
  await entrar(page);
  await abrir(page, id);
  for (const tema of TEMAS) {
    await ponerTema(page, tema);
    await fuentesListas(page);
    await comprobar(tema);
  }
}

// --- Contraste (se serializa y corre dentro de la página) -------------------
const CONTRASTE = () => {
  const lienzo = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  })!;
  lienzo.canvas.width = lienzo.canvas.height = 1;
  /** Cualquier color CSS -> [r,g,b,a]. */
  const rgba = (css: string): number[] => {
    lienzo.clearRect(0, 0, 1, 1);
    lienzo.fillStyle = "#000";
    lienzo.fillStyle = css;
    lienzo.fillRect(0, 0, 1, 1);
    const d = lienzo.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const sobre = (f: number[], b: number[]) =>
    [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const fondo = (el: Element): number[] => {
    const capas: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) capas.push(c);
      if (c[3] === 1) break;
    }
    let base = [255, 255, 255, 1];
    for (const c of capas.reverse()) base = sobre(c, base);
    return base;
  };
  const lum = (c: number[]) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const razon = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const visible = (e: Element) => {
    const r = e.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      (e as HTMLElement).checkVisibility?.({
        visibilityProperty: true,
      } as never) !== false
    );
  };
  return { rgba, sobre, fondo, razon, visible };
};

/** Peor contraste del texto propio de los elementos que cumplen `selector`. */
function peorTexto(page: Page, selector: string) {
  return page.evaluate(
    ([sel, src]) => {
      const { rgba, sobre, fondo, razon, visible } = new Function(
        "return (" + src + ")()",
      )();
      let n = 0;
      let peor = { razon: 99, texto: "", color: "", fondo: "" };
      for (const el of document.querySelectorAll(sel)) {
        const propio = [...el.childNodes].some(
          (c) => c.nodeType === 3 && c.textContent!.trim(),
        );
        if (!propio || !visible(el) || getComputedStyle(el).opacity === "0")
          continue;
        const f = fondo(el);
        const col = sobre(rgba(getComputedStyle(el).color), f);
        const r = razon(col, f);
        n++;
        if (r < peor.razon)
          peor = {
            razon: Math.round(r * 100) / 100,
            texto: (el.textContent || "").trim().slice(0, 40),
            color: getComputedStyle(el).color,
            fondo: "rgb(" + f.slice(0, 3).map(Math.round).join(",") + ")",
          };
      }
      return { n, ...peor };
    },
    [selector, CONTRASTE.toString()] as const,
  );
}
/** Peor contraste del borde de los controles que tienen borde visible. */
function peorBorde(page: Page) {
  return page.evaluate((src) => {
    const { rgba, sobre, fondo, razon, visible } = new Function(
      "return (" + src + ")()",
    )();
    let n = 0;
    let peor = { razon: 99, control: "", borde: "" };
    const sel =
      ".main-content button.secondary, .main-content select, .main-content input:not([type=checkbox]):not([type=radio]):not([type=hidden]), .main-content textarea";
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (
        !visible(el) ||
        parseFloat(cs.borderTopWidth) < 1 ||
        cs.borderTopStyle === "none"
      )
        continue;
      const f = fondo(el.parentElement || el);
      const r = razon(sobre(rgba(cs.borderTopColor), f), f);
      n++;
      if (r < peor.razon)
        peor = {
          razon: Math.round(r * 100) / 100,
          control: el.outerHTML.replace(/\s+/g, " ").slice(0, 70),
          borde: cs.borderTopColor,
        };
    }
    return { n, ...peor };
  }, CONTRASTE.toString());
}

// --- 1 a 8, por pantalla y por tamaño --------------------------------------
for (const p of PANTALLAS) {
  for (const v of VISTAS) {
    const en = `${p.nombre} · ${v.nombre}`;

    test(`1. ${en}: h1 «${p.nombre}» y sin eslogan en mayúsculas`, async ({
      page,
    }) => {
      await enTemas(page, v, p.id, async () => {
        const h1 = page.locator(".main-content h1");
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(p.nombre);
        await expect(page.locator(".main-content")).not.toContainText(ESLOGAN);
        await expect(page.locator(".main-content .eyebrow")).toHaveCount(0);
      });
    });

    test(`2. ${en}: sin desplazamiento horizontal de la página`, async ({
      page,
    }) => {
      await enTemas(page, v, p.id, async (tema) => {
        const ancho = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          ventana: innerWidth,
        }));
        expect(ancho.scroll, `tema ${tema}`).toBeLessThanOrEqual(ancho.ventana);
      });
    });

    test(`3. ${en}: controles con área táctil mínima (${v.movil ? 44 : 40} px)`, async ({
      page,
    }) => {
      const minimo = v.movil ? 44 : 40;
      await enTemas(page, v, p.id, async (tema) => {
        const chicos = await page.evaluate((min) => {
          const sel =
            ".main-content button, .main-content a[href], .main-content select, .main-content textarea, .main-content input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file])";
          return (
            [...document.querySelectorAll<HTMLElement>(sel)]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return (
                  r.width > 0 &&
                  r.height > 0 &&
                  getComputedStyle(e).visibility !== "hidden" &&
                  !e.closest("[inert], [aria-hidden=true]")
                );
              })
              .map((e) => ({ e, r: e.getBoundingClientRect() }))
              // ±1 px: la caja de layout varía 1 px con las fuentes de reemplazo de Linux.
              .filter(({ r }) => r.width < min - 1 || r.height < min - 1)
              .map(
                ({ e, r }) =>
                  `${Math.round(r.width)}x${Math.round(r.height)} ${e.outerHTML
                    .replace(/\s+/g, " ")
                    .slice(0, 80)}`,
              )
          );
        }, minimo);
        expect(chicos, `tema ${tema}`).toEqual([]);
      });
    });

    test(`4a. ${en}: una sola acción principal en la cabecera`, async ({
      page,
    }) => {
      await enTemas(page, v, p.id, async (tema) => {
        const cabeceras = await page
          .locator(".main-content .heading-actions")
          .evaluateAll((l) =>
            l.map((h) => h.querySelectorAll(".button.primary").length),
          );
        expect(cabeceras.length, "sin .heading-actions").toBeGreaterThan(0);
        for (const n of cabeceras)
          expect(n, `tema ${tema}`).toBeLessThanOrEqual(1);
      });
    });

    // Criterio 4b acotado (decisión documentada en OBSIDIAN_LUMINA_F3_PRUEBAS.md):
    // «Más» solo existe donde la cabecera tiene acciones secundarias (Productos y
    // Reportes). En Inventario, Clientes y Configuración un «Más» vacío sería mala
    // UX, así que ahí se exige una sola acción principal y NINGÚN «Más».
    const CON_MAS = ["products", "reports"].includes(p.id);
    test(`4b. ${en}: ${
      CON_MAS
        ? "«Más» se abre con Enter/Espacio y se cierra con Escape"
        : "sin acciones secundarias: sin «Más» vacío y máx. una acción principal"
    }`, async ({ page }) => {
      await page.setViewportSize({ width: v.width, height: v.height });
      await entrar(page);
      await abrir(page, p.id);
      const cabecera = page.locator(".main-content .heading-actions");
      const mas = cabecera.getByRole("button", { name: "Más", exact: true });
      if (!CON_MAS) {
        await expect(mas, "«Más» vacío en la cabecera").toHaveCount(0);
        expect(
          await cabecera.locator(".button.primary").count(),
        ).toBeLessThanOrEqual(1);
        return;
      }
      await expect(mas, "falta el botón «Más» en la cabecera").toHaveCount(1);
      await mas.focus();
      for (const tecla of ["Enter", "Space"]) {
        await expect(mas).toHaveAttribute("aria-expanded", "false");
        await page.keyboard.press(tecla);
        await expect(mas).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(mas).toHaveAttribute("aria-expanded", "false");
        await expect(mas).toBeFocused();
      }
    });

    test(`5. ${en}: anillo de foco visible con Tab`, async ({ page }) => {
      await enTemas(page, v, p.id, async (tema) => {
        await page.locator(".main-content h1").first().click();
        const sin: string[] = [];
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          const anillo = await page.evaluate(() => {
            const e = document.activeElement as HTMLElement;
            if (!e || e === document.body) return null;
            const cs = getComputedStyle(e);
            const contorno =
              cs.outlineStyle !== "none" &&
              parseFloat(cs.outlineWidth) > 0 &&
              !/rgba\(.*,\s*0\)$/.test(cs.outlineColor);
            const sombra = cs.boxShadow !== "none" && cs.boxShadow !== "";
            return {
              ok: contorno || sombra,
              el: e.outerHTML.replace(/\s+/g, " ").slice(0, 70),
            };
          });
          if (anillo && !anillo.ok) sin.push(anillo.el);
        }
        expect(sin, `tema ${tema}`).toEqual([]);
      });
    });

    test(`6. ${en}: contraste de texto (4.5:1) y de bordes de controles (3:1)`, async ({
      page,
    }) => {
      await enTemas(page, v, p.id, async (tema) => {
        const grupos: Record<string, string> = {
          encabezados: ".main-content :is(h1,h2,h3,h4)",
          "texto de cuerpo": ".main-content :is(p,label,span,li,small,dd,dt)",
          "celdas de tabla": ".main-content td",
          "encabezados de tabla": ".main-content th",
        };
        for (const [nombre, sel] of Object.entries(grupos)) {
          const r = await peorTexto(page, sel);
          // Solo Configuración no tiene tabla; en las demás `abrir` ya exigió filas.
          if (
            r.n === 0 &&
            nombre.includes("tabla") &&
            !CON_TABLA.includes(p.id)
          )
            continue;
          expect(r.n, `${nombre}: sin muestras`).toBeGreaterThan(0);
          expect(
            r.razon,
            `${tema} ${nombre}: «${r.texto}» ${r.color} sobre ${r.fondo}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        const b = await peorBorde(page);
        if (b.n > 0)
          expect(
            b.razon,
            `${tema} borde ${b.borde} en ${b.control}`,
          ).toBeGreaterThanOrEqual(3);
      });
    });

    if (["products", "inventory", "reports"].includes(p.id))
      test(`7. ${en}: cifras de tabla con tabular-nums`, async ({ page }) => {
        await enTemas(page, v, p.id, async (tema) => {
          const medir = () =>
            page.evaluate(() => {
              // Celdas que son una cantidad: dígitos con moneda, %, separadores.
              const cant = /^[^A-Za-zÁ-ú]*\d[\d.,\s%]*[^A-Za-zÁ-ú]*$/;
              const celdas = [
                ...document.querySelectorAll<HTMLElement>(".main-content td"),
              ].filter((c) =>
                cant.test(
                  (c.textContent || "").replace(/RD$|US$|USD|DOP/g, "").trim(),
                ),
              );
              return {
                total: celdas.length,
                muestra: [...document.querySelectorAll(".main-content td")]
                  .slice(0, 8)
                  .map((c) => (c.textContent || "").trim().slice(0, 20)),
                mal: celdas
                  .filter(
                    (c) =>
                      !getComputedStyle(c).fontVariantNumeric.includes(
                        "tabular-nums",
                      ),
                  )
                  .map((c) => (c.textContent || "").trim())
                  .slice(0, 5),
              };
            });
          await expect
            .poll(async () => (await medir()).total, { timeout: 15000 })
            .toBeGreaterThan(0);
          const r = await medir();
          expect(
            r.total,
            `tema ${tema}: sin celdas numéricas; muestra ${r.muestra}`,
          ).toBeGreaterThan(0);
          expect(r.mal, `tema ${tema}: sin tabular-nums`).toEqual([]);
        });
      });

    if (!v.movil)
      test(`8. ${en}: con movimiento reducido el esqueleto no se anima`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width: v.width, height: v.height });
        await entrar(page);
        await abrir(page, p.id);
        // El esqueleto real dura milisegundos: se inserta uno y se lee su regla CSS.
        const anim = await page.evaluate(() => {
          const s = document.createElement("span");
          s.className = "skeleton";
          document.querySelector(".main-content")!.append(s);
          const cs = getComputedStyle(s);
          const r = {
            nombre: cs.animationName,
            duracion: parseFloat(cs.animationDuration) || 0,
          };
          s.remove();
          return r;
        });
        expect(
          anim.nombre === "none" || anim.duracion < 0.01,
          `animación ${anim.nombre} ${anim.duracion}s`,
        ).toBe(true);
      });
  }
}

// --- 9. La caja del vendedor no cambia -------------------------------------
test("9. Caja (vendedor): Vender conserva su estructura y no recibe «Más» ni admin-ui", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await entrar(page, "vendedor@fitstore.demo");
  await abrir(page, "pos");
  for (const sel of [
    ".product-card",
    ".cart-items",
    ".connection",
    ".main-content",
  ])
    await expect(page.locator(sel).first(), sel).toBeVisible({
      timeout: 15000,
    });
  await expect(
    page.locator(".more-menu, .more-menu-trigger, .table-skeleton"),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".main-content")
      .getByRole("button", { name: "Más", exact: true }),
  ).toHaveCount(0);
});
