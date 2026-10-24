import { expect, it } from "vitest";
import { desktopConfig } from "../scripts/product-desktop-config.mjs";

it("PC-16: el empaquetado limita la ventana y el IPC al origen HTTPS exacto", () => {
  const { overlay, capability } = desktopConfig("https://pos.example.invalid");
  expect(overlay.app.windows[0].url).toBe("https://pos.example.invalid");
  expect(capability.remote.urls).toEqual(["https://pos.example.invalid/*"]);
  expect(capability.permissions).toEqual(["core:default"]);
  for (const address of ["http://pos.example.invalid", "https://pos.example.invalid/ruta", "https://user@pos.example.invalid"])
    expect(() => desktopConfig(address)).toThrow();
});
