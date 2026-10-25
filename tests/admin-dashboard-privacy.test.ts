import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  PRIVACY_MODE_CLASS,
  PRIVACY_STORAGE_KEY,
  PrivacyToggle,
  applyPrivacyMode,
  readPrivacyPreference,
  writePrivacyPreference,
} from "../apps/web/src/admin-dashboard/PrivacyToggle";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const memoryStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PRIVACY_STORAGE_KEY, initial);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe("PrivacyToggle", () => {
  it("recuerda por equipo una preferencia explicita y falla de forma segura", () => {
    const storage = memoryStorage("on");
    expect(readPrivacyPreference(storage)).toBe(true);

    writePrivacyPreference(false, storage);
    expect(storage.setItem).toHaveBeenCalledWith(PRIVACY_STORAGE_KEY, "off");

    const unavailable = {
      getItem: () => {
        throw new Error("almacenamiento bloqueado");
      },
      setItem: () => {
        throw new Error("almacenamiento bloqueado");
      },
    };
    expect(readPrivacyPreference(unavailable)).toBe(false);
    expect(() => writePrivacyPreference(true, unavailable)).not.toThrow();
  });

  it("aplica una clase solamente visual y expone el estado al lector", () => {
    const toggle = vi.fn();
    applyPrivacyMode(true, { classList: { toggle } });
    expect(toggle).toHaveBeenCalledWith(PRIVACY_MODE_CLASS, true);

    vi.stubGlobal("localStorage", memoryStorage("on"));
    const html = renderToStaticMarkup(createElement(PrivacyToggle));
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Mostrar cifras");
    expect(html).toContain("Las cifras están ocultas en esta pantalla");
    vi.unstubAllGlobals();
  });

  it("mantiene un objetivo tactil de 44 px y oculta solo cifras marcadas", () => {
    const css = readFileSync(
      "apps/web/src/admin-dashboard/PrivacyToggle.css",
      "utf8",
    );
    expect(css).toMatch(
      /\.privacy-toggle__button[\s\S]*min-(?:block-)?size:\s*44px/,
    );
    expect(css).toContain(`.${PRIVACY_MODE_CLASS} [data-private-value]`);
    expect(css).toMatch(/filter:\s*blur\(/);
    expect(css).not.toMatch(
      new RegExp(
        `\\.${PRIVACY_MODE_CLASS} \\[data-private-value\\][^{]*\\{[^}]*display:\\s*none`,
        "s",
      ),
    );
  });
});
