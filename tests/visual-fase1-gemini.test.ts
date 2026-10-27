import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("F1-02 · acciones móviles sin colisiones", () => {
  it("conserva la navegación móvil y reserva espacio para barra y asistente", () => {
    const app = read("apps/web/src/App.tsx");
    const styles = read("apps/web/src/styles.css");
    const assistant = read("apps/web/src/Assistant.css");
    expect(app).toContain('className="goods-mobile-bar"');
    expect(styles).toContain(".app-shell:has(.goods-mobile-bar) .main-content");
    expect(styles).toMatch(
      /padding-bottom:\s*calc\(176px \+ env\(safe-area-inset-bottom\)\)/,
    );
    expect(styles).toContain(
      ".main-shell:has(> .assistant-launcher) .main-content",
    );
    expect(styles).toMatch(
      /padding-bottom:\s*calc\(176px \+ env\(safe-area-inset-bottom\)\)/,
    );
    expect(assistant).toMatch(
      /body:has\(\.pos-mobile-bar, \.goods-mobile-bar,[^)]*\)[\s\S]*bottom:\s*calc\(88px/,
    );
  });
});

describe.skip("F1-03 · marca, acción primaria y moneda", () => {
  it("usa la N transparente en el marco y formatea dinero de reportes", async () => {
    const app = read("apps/web/src/App.tsx");
    const styles = read("apps/web/src/styles.css");
    const management = read("apps/web/src/Management.tsx");
    expect(app).toContain('src="/nexora-prisma-transparent.webp"');
    expect(styles.toLowerCase()).not.toContain("#1ed794");
    expect(management).toContain("formatReportCell(key, row[key])");
    expect(management).toContain(
      'className={money ? "report-number report-money"',
    );
    const { formatReportCell, isReportMoneyColumn } =
      await import("../apps/web/src/report-format");
    expect(isReportMoneyColumn("TOTAL")).toBe(true);
    expect(formatReportCell("TOTAL", 18400)).toBe("RD$ 18,400.00");
    expect(formatReportCell("ventas", 12)).toBe("12");
  });
});

describe.skip("F1-04 · portada limpia", () => {
  it("deja un solo grupo comercial, icono de contraseña y activo 840 con alfa", () => {
    const app = read("apps/web/src/App.tsx");
    const styles = read("apps/web/src/styles.css");
    expect(app.match(/className="login-stats"/g)).toHaveLength(1);
    expect(app).toContain('className="password-toggle"');
    expect(app).toContain(
      'showPassword ? "Ocultar contraseña" : "Mostrar contraseña"',
    );
    expect(styles).toContain("scrollbar-width: thin");
    expect(styles).toMatch(/\.login-page a\s*\{[^}]*text-decoration:\s*none/s);
    const file = "apps/web/public/nexora-prisma-transparent.webp";
    expect(statSync(file).size).toBeLessThanOrEqual(65 * 1024);
    const image = readFileSync(file);
    expect(image.subarray(0, 4).toString()).toBe("RIFF");
    expect(image.subarray(8, 12).toString()).toBe("WEBP");
    const vp8x = image.indexOf(Buffer.from("VP8X"));
    expect(vp8x).toBeGreaterThan(0);
    expect(image[vp8x + 8] & 0x10).toBe(0x10);
    const dimension = (offset: number) =>
      1 + image.readUIntLE(vp8x + offset, 3);
    expect(dimension(12)).toBe(840);
    expect(dimension(15)).toBe(840);
  });
});

describe.skip("F1-05 · controles terminados", () => {
  it("presenta dropzone en español, textarea simple y sugerencias tipo chip", () => {
    const warehouses = read("apps/web/src/WarehousesPanel.tsx");
    const assistantView = read("apps/web/src/Assistant.tsx");
    const assistantCss = read("apps/web/src/Assistant.css");
    expect(warehouses).toContain('className="nx-file-dropzone"');
    expect(warehouses).toContain("Arrastra tu archivo Excel aquí");
    expect(warehouses).toContain('className="sr-only"');
    expect(assistantView).toContain('className="assistant-chip"');
    expect(assistantCss).toMatch(
      /\.assistant-body textarea\s*\{[^}]*border:\s*0;/s,
    );
    expect(assistantCss).toMatch(
      /\.assistant-body textarea\s*\{[^}]*resize:\s*none;/s,
    );
  });
});
