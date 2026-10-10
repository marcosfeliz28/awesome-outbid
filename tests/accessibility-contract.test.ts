import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { blockPosShortcutWithModal } from "../apps/web/src/posKeyboard";
import {
  passwordChangeError,
  passwordRules,
  friendlyPasswordChangeError,
} from "../apps/web/src/passwordChange";

const css = readFileSync("apps/web/src/styles.css", "utf8");

describe("U2 · identidad y ayuda de producción", () => {
  const app = readFileSync("apps/web/src/App.tsx", "utf8");
  const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
  it("la bolsa del resumen usa la identidad de Nexora", () => {
    expect(dashboard).toMatch(/n<span>•<\/span>/);
    expect(dashboard).not.toMatch(/f<span>•<\/span>/);
  });
  it("la guía tiene puerta de desarrollo tanto en navegación como en ruta", () => {
    expect(app).toContain("const SHOW_STYLE_GUIDE = import.meta.env.DEV;");
    expect(app).toContain("SHOW_STYLE_GUIDE && (");
    expect(app).toContain(
      "...(SHOW_STYLE_GUIDE ? { styles: <StyleGuide /> } : {})",
    );
    expect(app).toContain('(page === "styles" && SHOW_STYLE_GUIDE)');
  });
  it("la ayuda explica tareas reales sin prometer ventas offline siempre", () => {
    expect(app).toContain("Ayuda para trabajar");
    expect(app).toContain("Si tu tienda permite ventas sin internet");
    expect(app).toContain("Ir al punto de venta");
  });
});
describe("Cambiar mi contraseña (voluntario)", () => {
  it("usa las mismas reglas y habla de la contraseña actual, no de la temporal", () => {
    const good = "ClaveNueva!2026";
    for (const weak of ["1234", "claveconnumero12!", "ClaveSinSimbolo2026"])
      expect(passwordChangeError(weak, weak, "Actual-2026!", "voluntary")).toBe(
        passwordChangeError(weak, weak, "Actual-2026!"),
      );
    expect(passwordChangeError(good, good, "Actual-2026!", "voluntary")).toBe(
      "",
    );
    const same = passwordChangeError(good, good, good, "voluntary");
    expect(same).toContain("actual");
    expect(same).not.toContain("temporal");
    expect(
      friendlyPasswordChangeError(
        new Error("La contraseña actual no es correcta."),
        "voluntary",
      ),
    ).toContain("actual no es correcta");
    expect(
      friendlyPasswordChangeError(new Error("Prisma stack"), "voluntary"),
    ).not.toMatch(/Prisma|temporal/);
  });
  it("está en el menú de la cuenta para cualquier usuario, con contraseña actual", () => {
    const app = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(app).toContain("Cambiar mi contraseña");
    expect(app).toContain('"/auth/password"');
    expect(app).toContain('autoComplete="current-password"');
  });
});
describe("Textos que dicen lo que funciona hoy", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  it("la opción de ventas sin conexión se nombra con su ruta real, no «Ajustes»", () => {
    const management = read("apps/web/src/Management.tsx");
    // La ruta que citan los textos existe en la pantalla.
    expect(management).toContain('["business", "Negocio y reglas"]');
    expect(management).toContain("Editar configuración");
    expect(management).toContain('"Permitir ventas sin conexión');
    const route =
      "Configuración → Negocio y reglas → Editar configuración → «Permitir ventas sin conexión»";
    for (const manual of ["docs/MANUAL-CAJERO.md", "docs/MANUAL.md"]) {
      expect(read(manual)).toContain(route);
      expect(read(manual)).not.toMatch(/Ajustes\s*>\s*Permitir ventas/);
    }
    const pos = read("apps/web/src/POS.tsx");
    expect(pos).toContain(
      "revise «Permitir ventas sin conexión» en Configuración › Negocio y reglas › Editar configuración.",
    );
    expect(pos).not.toContain("revise esta opción en Ajustes");
  });
  it("el manual de caja nombra el indicador «Offline» que muestra la barra", () => {
    const app = read("apps/web/src/App.tsx");
    expect(app).toContain('online ? "En línea" : "Offline"');
    const section = read("docs/MANUAL-CAJERO.md").split("## 8.")[1];
    expect(section).toContain("**Offline**");
    expect(section).toContain("**En línea**");
    expect(section).not.toContain("aparece **Sin conexión**");
  });
  it("Anular explica cuándo sí hace falta la caja propia, como exige la API", () => {
    const sales = read("apps/api/src/sales.ts");
    expect(sales).toContain(
      "La caja de esta venta ya cerró. Abre tu caja para entregar el reembolso en efectivo",
    );
    const management = read("apps/web/src/Management.tsx");
    expect(management).not.toContain("; no necesitas abrir caja.");
    expect(management).toContain(
      "si la caja de esta venta ya cerró y la venta tuvo efectivo, el reembolso sale de tu propia caja, que debe estar abierta y con efectivo suficiente.",
    );
  });
  it("el bloqueo de cuenta ofrece lo que existe: esperar o «Restablecer contraseña»", () => {
    const auth = read("apps/api/src/auth.ts");
    expect(auth).not.toContain(
      "pide a un administrador que te cambie la contraseña",
    );
    expect(
      auth.match(
        /Espera 15 minutos o pide a la administración que use «Restablecer contraseña» en Configuración › Usuarios y permisos\./g,
      ),
    ).toHaveLength(2);
    expect(read("docs/MANUAL.md")).toContain("con tu usuario o correo");
  });
});
describe("P1 · cambio obligatorio de contraseña", () => {
  it("bloquea claves débiles, repetidas, largas y confirmación distinta", () => {
    const good = "ClaveNueva!2026";
    for (const weak of [
      "1234",
      "claveconnumero12!",
      "CLAVECONNUMERO12!",
      "ClaveSinNumeros!",
      "ClaveSinSimbolo2026",
    ])
      expect(passwordChangeError(weak, weak, "temporal")).not.toBe("");
    expect(passwordChangeError(good, good, "temporal")).toBe("");
    expect(passwordChangeError(good, "otra", "temporal")).toContain(
      "no coinciden",
    );
    expect(passwordChangeError(good, good, good)).toContain("diferente");
    const tooLong = "Á".repeat(40) + "a1!";
    expect(passwordChangeError(tooLong, tooLong, "temporal")).toContain(
      "demasiado larga",
    );
    expect(passwordRules(good).filter((rule) => rule.met)).toHaveLength(5);
  });
  it("no muestra detalles técnicos del servidor", () => {
    expect(
      friendlyPasswordChangeError(
        new Error("Prisma: internal object {} stack trace"),
      ),
    ).not.toMatch(/Prisma|stack|\{\}/);
    expect(
      friendlyPasswordChangeError(new TypeError("Failed to fetch")),
    ).toContain("internet");
    expect(friendlyPasswordChangeError(new Error("429"))).toContain("Espera");
  });
  it("expone reglas y fortaleza accesibles antes de enviar", () => {
    const source = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(source).toContain("PasswordChangeFields");
    const component = readFileSync(
      "apps/web/src/PasswordChangeFields.tsx",
      "utf8",
    );
    expect(component).toContain('role="status"');
    expect(component).toContain(
      'aria-describedby="password-rules password-strength"',
    );
    expect(component).toContain('autoCapitalize="none"');
    expect(component).toContain("passwordRules(password)");
    expect(
      passwordRules("")
        .map((rule) => rule.label)
        .join(" "),
    ).toMatch(/Mayúscula.*Minúscula.*Número.*Símbolo/);
    expect(source).toMatch(
      /passwordChangeError\(\s*newPassword,\s*confirmPassword,\s*password,?\s*\)/,
    );
    expect(source).toContain("friendlyPasswordChangeError(e)");
  });
});

function variables(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block =
    new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#(?:[0-9a-f]{6}|[0-9a-f]{3}))\b/gi)].map(
      (match) => [
        match[1],
        match[2].length === 4
          ? "#" +
            match[2]
              .slice(1)
              .split("")
              .map((digit) => digit + digit)
              .join("")
          : match[2],
      ],
    ),
  );
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function meets(
  label: string,
  foreground: string,
  background: string,
  minimum: number,
) {
  expect(
    contrast(foreground, background),
    `${label}: ${foreground} sobre ${background}`,
  ).toBeGreaterThanOrEqual(minimum);
}

describe("P6 · controles accesibles de venta y caja", () => {
  it("los campos tienen foco visible real y las acciones pequeñas área táctil", () => {
    expect(css).toContain(
      "/* P6: foco y objetivos táctiles de venta y caja. */",
    );
    expect(css).toMatch(
      /input:focus-visible,[\s\S]*?outline:\s*3px solid var\(--focus\)/,
    );
    expect(css).toMatch(/\.cart-line-total button,[\s\S]*?min-width:\s*44px/);
    expect(css).toMatch(/\.cash-page button[\s\S]*?min-height:\s*44px/);
  });
  it("los métodos comunican selección y el texto no usa colores libres", () => {
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(pos).toContain("aria-pressed={method === m.id}");
    expect(pos).not.toContain("style={{ color: p.category.color }}");
  });
  it.each(["claro", "oscuro"])("texto y foco visibles en %s", (theme) => {
    const light = variables(":root");
    const palette =
      theme === "claro"
        ? light
        : { ...light, ...variables(':root[data-theme="dark"]') };
    for (const name of ["--text", "--muted", "--primary", "--focus"])
      meets(name, palette[name], palette["--surface"], 4.5);
  });
});

describe("G10 · contrato de contraste WCAG AA", () => {
  const light = variables(":root");
  const dark = { ...light, ...variables(':root[data-theme="dark"]') };

  it.each([
    ["claro", light],
    ["oscuro", dark],
  ] as const)("valida variables semánticas en tema %s", (theme, palette) => {
    meets(`${theme} botón cobrar`, "#ffffff", palette["--success-strong"], 4.5);
    meets(
      `${theme} peligro`,
      palette["--danger-text"],
      palette["--surface"],
      4.5,
    );
    meets(
      `${theme} positivo`,
      palette["--positive-text"],
      palette["--surface"],
      4.5,
    );
    meets(
      `${theme} texto atenuado`,
      palette["--muted"],
      palette["--surface"],
      4.5,
    );
    meets(
      `${theme} texto atenuado fondo`,
      palette["--muted"],
      palette["--bg"],
      4.5,
    );
    meets(
      `${theme} atenuado sobre violeta`,
      palette["--muted-on-soft"],
      palette["--primary-soft"],
      4.5,
    );
    meets(`${theme} foco`, palette["--focus"], palette["--surface"], 3);
    meets(
      `${theme} borde campo`,
      palette["--input-border"],
      palette["--surface"],
      3,
    );
    meets(
      `${theme} borde campo suave`,
      palette["--input-border"],
      palette["--surface-soft"],
      3,
    );
    expect(
      palette["--alert-counter-bg"],
      `${theme} fondo semántico del contador de alertas`,
    ).toMatch(/^#[0-9a-f]{6}$/i);
    meets(
      `${theme} contador de alertas`,
      palette["--warning-text"],
      palette["--alert-counter-bg"],
      4.5,
    );
  });

  it("valida todos los pares literales señalados por la auditoría", () => {
    meets("advertencia clara", light["--warning-text"], "#fff5e6", 4.5);
    meets("advertencia oscura", dark["--warning-text"], "#402b17", 4.5);
    meets("mercancía pendiente clara", light["--warning-text"], "#fffaf0", 4.5);
    meets("mercancía pendiente oscura", dark["--warning-text"], "#2b2111", 4.5);
    meets("modo activo claro", "#ffffff", light["--primary"], 4.5);
    meets("modo activo oscuro", "#0b0f19", dark["--primary"], 4.5);
    meets("modo salida", "#ffffff", "#be185d", 4.5);
    meets("quitar línea claro", "#8a93a6", light["--surface"], 3);
    meets("quitar línea oscuro", "#8a93a6", dark["--surface"], 3);
    meets("bienvenida clara", "#6b5b7d", "#fdf1f7", 4.5);
    meets("bienvenida oscura", "#b9a4c9", "#321c33", 4.5);
    for (const end of ["#7c3aed", "#9455dc"])
      meets("caja sobre degradado", "#ffffff", end, 4.5);
    for (const end of ["#7c3aed", "#6d28d9", "#9e3fa9"])
      meets("login sobre degradado", "#ffffff", end, 4.5);
    expect(css).not.toContain("color: #cab5ee");
    expect(css).not.toContain("background: var(--green, #059669)");
    expect(css).toMatch(/\.cart-security\s*\{[^}]*color:\s*var\(--muted\)/s);
  });
});

describe("G11 · listener de teclado con modal", () => {
  it.each(["F4", "F8", "F12"])(
    "%s se consume y no ejecuta la acción detrás del diálogo",
    (key) => {
      const target = new EventTarget();
      const action = vi.fn();
      const root = { querySelector: () => ({ role: "dialog" }) } as any;
      target.addEventListener("keydown", (raw) => {
        const event = raw as Event & { key: string };
        if (blockPosShortcutWithModal(event as any, root)) return;
        action();
      });
      const event = new Event("keydown", { cancelable: true }) as Event & {
        key: string;
      };
      Object.defineProperty(event, "key", { value: key });

      target.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("F2 sigue llegando al buscador aunque exista un diálogo", () => {
    const preventDefault = vi.fn();
    expect(
      blockPosShortcutWithModal({ key: "F2", preventDefault }, {
        querySelector: () => ({ role: "dialog" }),
      } as any),
    ).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
