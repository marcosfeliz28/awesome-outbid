import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { blockPosShortcutWithModal } from "../apps/web/src/posKeyboard";

const css = readFileSync("apps/web/src/styles.css", "utf8");

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
