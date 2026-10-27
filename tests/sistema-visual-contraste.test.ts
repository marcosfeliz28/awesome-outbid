import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("apps/web/src/styles.css", "utf8");
const doc = readFileSync("docs/diseno/SISTEMA_VISUAL_NEXORA.md", "utf8");
const light = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const dark = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

function color(block: string, name: string): string {
  const value = block.match(new RegExp(`--${name}:\\s*(#[\\da-fA-F]{3,6})\\s*;`))?.[1];
  if (!value) throw new Error(`Falta --${name}`);
  return value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join("")}` : value;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

describe("Sistema visual · contraste sobre colores sólidos", () => {
  it.each([
    ["claro texto", light, "text", "surface"],
    ["claro secundario", light, "muted", "surface"],
    ["claro acción", light, "on-action", "action"],
    ["claro hover", light, "on-action", "action-hover"],
    ["claro éxito", light, "positive-text", "surface"],
    ["claro error", light, "danger-text", "surface"],
    ["claro aviso", light, "warning-text", "surface"],
    ["oscuro texto", dark, "text", "surface"],
    ["oscuro secundario", dark, "muted", "surface"],
    ["oscuro acento", dark, "primary", "surface"],
    ["oscuro éxito", dark, "positive-text", "surface"],
    ["oscuro error", dark, "danger-text", "surface"],
    ["oscuro aviso", dark, "warning-text", "surface"],
  ])("%s alcanza 4,5:1", (_label, block, fg, bg) => {
    const values = [luminance(color(block, fg)), luminance(color(block, bg))].sort((a, b) => b - a);
    expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("documenta los límites de los pares, fuentes y movimiento reducido", () => {
    expect(doc).toContain("degradados, transparencias y fondos con imágenes requieren medición aparte");
    expect(doc).toContain("222.804 bytes");
    expect(doc).toContain("prefers-reduced-motion");
  });
});
