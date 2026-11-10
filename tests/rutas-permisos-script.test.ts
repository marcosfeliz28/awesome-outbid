import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sin tipos
import { extraerRutas } from "../scripts/rutas-permisos.mjs";

type Fila = { ruta: string; metodo: string; permiso: string };
const filas: Fila[] = extraerRutas();
const permiso = (metodo: string, ruta: string) =>
  filas.find((f) => f.metodo === metodo && f.ruta === ruta)?.permiso;

describe("scripts/rutas-permisos.mjs", () => {
  it("atribuye el @Permit que va DESPUÉS de la ruta, no el del método anterior", () => {
    expect(permiso("POST", "/api/categories")).toBe("catalog:write");
    expect(permiso("POST", "/api/brands")).toBe("catalog:write");
    expect(permiso("GET", "/api/categories")).toBe("catalog:read");
  });
  it("reconoce @Get con arreglo de rutas", () => {
    expect(permiso("GET", "/api/health")).toMatch(/@Public/);
    expect(permiso("GET", "/api/health/ready")).toMatch(/@Public/);
  });
  it("resuelve constantes de @Permit a su valor real", () => {
    expect(permiso("POST", "/api/inventory-import/apply")).toBe(
      "inventory:import",
    );
    expect(filas.some((f) => /^[A-Z_]+$/.test(f.permiso))).toBe(false);
  });
});
