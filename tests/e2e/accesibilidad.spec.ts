// G12 · Accesibilidad de las pantallas principales.
//
// `@axe-core/playwright` no está en el repositorio. Esta prueba trae su propio
// verificador (roles ARIA, hijos y padres obligatorios, atributos permitidos,
// nombres accesibles, foco dentro de aria-hidden o fuera de la pantalla y
// subida de archivos con teclado). Con NEXORA_AXE_SCRIPT=/ruta/axe.min.js
// además corre axe-core (WCAG 2.1 A/AA) y exige 0 violaciones graves o
// críticas.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const AXE_SCRIPT = process.env.NEXORA_AXE_SCRIPT;

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function open(page: Page, id: string) {
  await page.evaluate((hash) => (location.hash = hash), id);
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await expect(page.locator(".main-content h1").first()).toBeVisible();
}

type Violation = { rule: string; impact: string; node: string };
/** Reglas de roles y nombres accesibles, evaluadas en la página. */
async function audit(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const out: { rule: string; impact: string; node: string }[] = [];
    const report = (rule: string, impact: string, el: Element) =>
      out.push({
        rule,
        impact,
        node: el.outerHTML.replace(/\s+/g, " ").slice(0, 160),
      });
    const ROLES = new Set(
      (
        "alert alertdialog application article banner blockquote button caption cell checkbox " +
        "code columnheader combobox complementary contentinfo definition deletion dialog " +
        "directory document emphasis feed figure form generic grid gridcell group heading img " +
        "insertion link list listbox listitem log main marquee math menu menubar menuitem " +
        "menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation " +
        "progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox " +
        "separator slider spinbutton status strong subscript superscript switch tab table tablist " +
        "tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem"
      ).split(" "),
    );
    const rendered = (el: Element) =>
      (el as HTMLElement).checkVisibility?.({
        visibilityProperty: true,
      } as any) !== false && !el.closest("[inert]");
    const hiddenText = (e: Element) => {
      if (e.getAttribute("aria-hidden") === "true") return true;
      if ((e as HTMLElement).hidden) return true;
      const cs = getComputedStyle(e);
      return cs.display === "none" || cs.visibility === "hidden";
    };
    const text = (n: Node): string => {
      if (n.nodeType === 3) return n.textContent || "";
      if (n.nodeType !== 1) return "";
      const e = n as Element;
      if (hiddenText(e)) return "";
      if (e.tagName === "IMG") return e.getAttribute("alt") || "";
      const label = e.getAttribute("aria-label");
      if (label) return label;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName)) return "";
      return [...e.childNodes].map(text).join(" ");
    };
    const nameOf = (el: Element) => {
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter((x): x is HTMLElement => !!x)
          .map(text)
          .join(" ")
          .trim();
        if (t) return t;
      }
      const label = el.getAttribute("aria-label")?.trim();
      if (label) return label;
      const labels = (el as HTMLInputElement).labels;
      if (labels?.length) {
        const t = [...labels].map(text).join(" ").trim();
        if (t) return t;
      }
      const input = el as HTMLInputElement;
      if (
        el.tagName === "INPUT" &&
        ["submit", "button", "reset"].includes(input.type)
      )
        return input.value;
      if (
        ["BUTTON", "A", "SUMMARY"].includes(el.tagName) ||
        el.getAttribute("role") === "button"
      ) {
        const t = text(el).trim();
        if (t) return t;
      }
      return el.getAttribute("title")?.trim() || "";
    };
    const roleOf = (el: Element) =>
      (el.getAttribute("role") || "").trim().split(/\s+/)[0];
    const generic = (el: Element) =>
      ["none", "presentation", "generic"].includes(roleOf(el)) ||
      (!roleOf(el) && ["DIV", "SPAN"].includes(el.tagName));
    // Con un diálogo abierto, lo de afuera queda oculto al lector y fuera del
    // alcance de Tab (trampa de foco): sólo se revisa el diálogo.
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const scope = dialogs.length
      ? dialogs.flatMap((d) => [d, ...d.querySelectorAll("*")])
      : [...document.querySelectorAll("body *")];
    const restore = document.activeElement as HTMLElement | null;
    for (const el of scope) {
      if (!rendered(el)) continue;
      const role = roleOf(el);
      if (el.hasAttribute("role") && !role)
        report("aria-roles", "critical", el);
      if (role && !ROLES.has(role)) report("aria-roles", "critical", el);
      // Hijos obligatorios de una lista de opciones.
      // Hijos obligatorios de una lista de opciones y de una tabla ARIA.
      const owned: Record<string, string[]> = {
        listbox: ["option", "group"],
        table: ["row", "rowgroup", "caption"],
        grid: ["row", "rowgroup", "caption"],
      };
      if (owned[role]) {
        const bad = (parent: Element): boolean =>
          [...parent.children].some((child) =>
            generic(child) ? bad(child) : !owned[role].includes(roleOf(child)),
          );
        if (bad(el)) report("aria-required-children", "critical", el);
      }
      // Padre obligatorio de una opción.
      if (role === "option") {
        let parent = el.parentElement;
        while (parent && generic(parent)) parent = parent.parentElement;
        if (!parent || !["listbox", "group"].includes(roleOf(parent)))
          report("aria-required-parent", "critical", el);
      }
      const SELECTED = [
        "option",
        "tab",
        "gridcell",
        "row",
        "columnheader",
        "rowheader",
        "treeitem",
      ];
      if (el.hasAttribute("aria-selected") && !SELECTED.includes(role))
        report("aria-allowed-attr", "critical", el);
      // Nombres accesibles.
      const tag = el.tagName;
      const input = el as HTMLInputElement;
      if (
        (tag === "BUTTON" || role === "button") &&
        !nameOf(el) &&
        !el.closest("[aria-hidden=true]")
      )
        report("button-name", "critical", el);
      if (tag === "A" && el.hasAttribute("href") && !nameOf(el))
        report("link-name", "serious", el);
      if (
        (tag === "INPUT" &&
          !["hidden", "submit", "button", "reset"].includes(input.type)) ||
        tag === "TEXTAREA"
      )
        if (!nameOf(el)) report("label", "critical", el);
      if (tag === "SELECT" && !nameOf(el))
        report("select-name", "critical", el);
      if (tag === "IMG" && !el.hasAttribute("alt"))
        report("image-alt", "critical", el);
      // Controles anidados.
      if (
        (tag === "BUTTON" || (tag === "A" && el.hasAttribute("href"))) &&
        el.parentElement?.closest("button, a[href]")
      )
        report("nested-interactive", "serious", el);
      // Lo que recibe foco con Tab.
      const focusable =
        (el as HTMLElement).tabIndex >= 0 &&
        !(el as HTMLButtonElement).disabled &&
        (el.matches(
          "a[href], button, input, select, textarea, summary, [tabindex]",
        ) ||
          (el as HTMLElement).isContentEditable);
      if (focusable && !(tag === "INPUT" && input.type === "hidden")) {
        if (el.closest("[aria-hidden=true]"))
          report("aria-hidden-focus", "serious", el);
        // Un enlace o botón movido fuera de la pantalla (el menú lateral
        // cerrado en celular) sigue recibiendo foco. Un enlace «saltar a»
        // que aparece al recibir el foco no cuenta.
        const offscreen = () => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.right <= 0;
        };
        if (offscreen()) {
          (el as HTMLElement).focus({ preventScroll: true });
          if (offscreen()) report("focus-offscreen", "serious", el);
        }
      }
    }
    restore?.focus?.({ preventScroll: true });
    // Una zona con desplazamiento propio y nada enfocable adentro no se
    // puede recorrer con el teclado.
    const FOCUSABLE =
      "a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])";
    for (const el of scope) {
      if (!rendered(el) || el === document.body) continue;
      const cs = getComputedStyle(el);
      const scrolls =
        (/(auto|scroll)/.test(cs.overflowX) &&
          el.scrollWidth > el.clientWidth + 1) ||
        (/(auto|scroll)/.test(cs.overflowY) &&
          el.scrollHeight > el.clientHeight + 1);
      if (
        scrolls &&
        (el as HTMLElement).tabIndex < 0 &&
        !el.querySelector(FOCUSABLE)
      )
        report("scrollable-region-focusable", "serious", el);
    }
    // Subir archivos sólo con ratón: la etiqueta abre un input que no recibe
    // foco (atributo hidden o display:none) y ella misma tampoco lo recibe.
    for (const label of scope.filter((e) => e.tagName === "LABEL")) {
      const file = label.querySelector<HTMLInputElement>('input[type="file"]');
      if (!file || !rendered(label)) continue;
      const reachable =
        file.checkVisibility() && file.tabIndex >= 0 && !file.disabled;
      if (!reachable && label.tabIndex < 0)
        report("file-input-keyboard", "serious", label);
    }
    // Identificadores repetidos a los que apunta un atributo ARIA o un for.
    const refs = new Set<string>();
    for (const el of document.querySelectorAll(
      "[aria-labelledby],[aria-describedby],[aria-controls],label[for]",
    ))
      for (const attr of [
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "for",
      ])
        el.getAttribute(attr)
          ?.split(/\s+/)
          .forEach((id) => id && refs.add(id));
    for (const id of refs)
      if (document.querySelectorAll("#" + CSS.escape(id)).length > 1)
        report(
          "duplicate-id-aria",
          "critical",
          document.getElementById(id) as Element,
        );
    return out;
  });
}
/** axe-core (si se indicó su script): violaciones graves o críticas. */
async function axe(page: Page): Promise<Violation[]> {
  if (!AXE_SCRIPT) return [];
  if (!(await page.evaluate(() => "axe" in window)))
    await page.addScriptTag({ content: readFileSync(AXE_SCRIPT, "utf8") });
  return page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations
      .filter((v: any) => ["serious", "critical"].includes(v.impact))
      .flatMap((v: any) =>
        v.nodes.map((n: any) => ({
          rule: "axe:" + v.id,
          impact: v.impact,
          node: String(n.html).slice(0, 160),
        })),
      );
  });
}
async function check(page: Page, where: string) {
  const found = [...(await audit(page)), ...(await axe(page))];
  return found.map((v) => ({ where, ...v }));
}

const SCREENS = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "inventory",
  "purchases",
  "cash",
  "expenses",
  "customers",
  "promotions",
  "reports",
  "alerts",
  "merchandise",
  "settings",
];
for (const width of [390, 1280])
  for (const theme of ["light", "dark"])
    test(`G12: pantallas principales sin violaciones graves a ${width} px (${theme === "light" ? "claro" : "oscuro"})`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
      await page.addInitScript(
        (t) => localStorage.setItem("fitstore-theme", t),
        theme,
      );
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Entrar a mi tienda" }),
      ).toBeVisible();
      const found = await check(page, "inicio de sesión");
      await login(page);
      for (const id of SCREENS) {
        await open(page, id);
        found.push(...(await check(page, id)));
      }
      // Resultados del buscador de Mercancía y el buscador de pantallas.
      await open(page, "merchandise");
      await page.getByLabel("Buscar producto", { exact: true }).fill("a");
      await expect(page.locator(".goods-results li").first()).toBeVisible();
      found.push(...(await check(page, "mercancía con resultados")));
      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog")).toBeVisible();
      found.push(...(await check(page, "buscador Ctrl+K")));
      expect(found).toEqual([]);
    });

test("G12: subir el logo y el Excel de productos se puede con el teclado", async ({
  page,
}) => {
  await login(page);
  await open(page, "settings");
  const logo = page.getByLabel("Subir logo (hasta 200 KB)");
  await logo.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(logo).toBeFocused();
  // La etiqueta, que es lo que se ve, muestra el foco.
  await expect(
    page.locator("label", { hasText: "Subir logo (hasta 200 KB)" }),
  ).toHaveCSS("outline-style", "solid");
  await open(page, "products");
  const excel = page.getByLabel("Importar Excel");
  await excel.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(excel).toBeFocused();
});

test("G12: Ctrl+K (también con Mayús) abre el buscador con nombre accesible", async ({
  page,
}) => {
  await login(page);
  await page.keyboard.press("Control+Shift+K");
  const search = page.getByRole("textbox", { name: "Buscar pantalla" });
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();
});

test("G12: en celular el menú cerrado no recibe foco y al abrirlo el foco entra", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const aside = page.locator("aside.sidebar");
  await expect(aside).toHaveAttribute("inert", "");
  await expect(aside).toHaveAttribute("aria-hidden", "true");
  // Con Tab desde el principio nunca se llega a un enlace del menú cerrado.
  await page.locator("body").focus();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest("aside.sidebar"),
      ),
    ).toBe(false);
  }
  const opener = page.getByRole("button", { name: "Abrir menú" });
  await opener.click();
  await expect(aside).not.toHaveAttribute("inert", "");
  await expect(aside.locator(".nav-item").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(aside).toHaveAttribute("inert", "");
  await expect(opener).toBeFocused();
});

test("G12: un aviso de error dura más de 8 s y no se cierra con el ratón encima", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  await open(page, "settings");
  // Un logo de más de 200 KB da un aviso de error.
  await page.getByLabel("Subir logo (hasta 200 KB)").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(210 * 1024),
  });
  const error = page.getByRole("alert").filter({ hasText: "200 KB" });
  await expect(error).toBeVisible();
  await page.clock.runFor(8000);
  await expect(error).toBeVisible();
  // Con el ratón encima no se cierra.
  await error.hover();
  await page.clock.runFor(30000);
  await expect(error).toBeVisible();
  await page.mouse.move(5, 5);
  await page.clock.runFor(11000);
  await expect(error).toHaveCount(0);
  // Un aviso informativo sigue cerrándose solo.
  await page.keyboard.press("F7");
  const info = page.getByRole("status").filter({ hasText: "etiquetas" });
  await expect(info).toBeVisible();
  await page.clock.runFor(6500);
  await expect(info).toHaveCount(0);
});

test("G12: aviso 60 s antes del cierre por inactividad con «Seguir conectado»", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  const warning = page.getByRole("dialog", { name: "¿Sigues ahí?" });
  await page.clock.fastForward("28:00");
  await expect(warning).toHaveCount(0);
  await page.clock.fastForward("01:10");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("la sesión se cerrará en");
  await warning.getByRole("button", { name: "Seguir conectado" }).click();
  await expect(warning).toHaveCount(0);
  // Seguir conectado reinicia el plazo completo.
  await page.clock.fastForward("29:10");
  await expect(warning).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Hola,/, includeHidden: true }),
  ).toBeAttached();
  // Sin respuesta, la sesión se cierra como antes.
  await page.clock.fastForward("01:00");
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
  await expect(page.getByText("Sesión cerrada por inactividad.")).toBeVisible();
});
