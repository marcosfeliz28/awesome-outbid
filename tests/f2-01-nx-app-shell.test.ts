import { expect, it } from "vitest";
import { regionesApp } from "../packages/ui/src/nx-app-shell";

it("regionesApp define banner, navegación y principal con etiquetas en español", () => {
  const r = regionesApp();
  expect(r.banner).toEqual({ role: "banner", "aria-label": "Encabezado" });
  expect(r.navegacion).toEqual({
    role: "navigation",
    "aria-label": "Navegación principal",
  });
  expect(r.principal).toEqual({
    role: "main",
    "aria-label": "Contenido principal",
    id: "contenido",
  });
  expect(r.saltar).toEqual({
    href: "#contenido",
    texto: "Saltar al contenido",
  });
});
