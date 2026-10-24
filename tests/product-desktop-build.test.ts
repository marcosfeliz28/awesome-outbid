import { expect, it } from "vitest";
import { desktopConfig } from "../scripts/product-desktop-config.mjs";
import { readFileSync } from "node:fs";

it("PC-16: el empaquetado limita la ventana y el IPC al origen HTTPS exacto", () => {
  const { overlay, capability } = desktopConfig("https://pos.example.invalid");
  expect(overlay.app.windows[0].url).toBe("https://pos.example.invalid");
  expect(overlay.app.withGlobalTauri).toBe(false);
  expect(capability.remote.urls).toEqual(["https://pos.example.invalid/*"]);
  expect(capability.permissions).toEqual([
    "core:default",
    "allow-list-printers",
    "allow-print-thermal",
    "allow-open-cash-drawer",
  ]);
  for (const address of ["http://pos.example.invalid", "https://pos.example.invalid/ruta", "https://user@pos.example.invalid"])
    expect(() => desktopConfig(address)).toThrow();
  const build = readFileSync("apps/web/src-tauri/build.rs", "utf8");
  const rust = readFileSync("apps/web/src-tauri/src/main.rs", "utf8");
  expect(build).toContain('"open_cash_drawer"');
  expect(build).toContain("AppManifest::new().commands");
  expect(rust).toContain("/api/cash-sessions/drawer-open");
  expect(rust).toContain("bearer_auth(access_token)");
});
