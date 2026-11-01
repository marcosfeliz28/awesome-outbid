import { describe, expect, it } from "vitest";
import { margen } from "../apps/api/src/reportes/margen";
import { inventario } from "../apps/api/src/reportes/inventario";
import { ventas } from "../apps/api/src/reportes/ventas";
import { clientes } from "../apps/api/src/reportes/clientes";
import { dinero } from "../apps/api/src/reportes/dinero";
import { incomeOptions } from "../apps/api/src/income-report";
import {
  GV_APPOINTMENT_STATUS,
  GV_ARTISTS,
  GV_SERVICES,
} from "../apps/api/src/gv-citas";

// Pieza 22 de la cola permanente (continuación): pruebas directas de módulos
// de apps/api sin base de datos. Solo pruebas; no cambia código de producción.

describe("reportes · definiciones", () => {
  const modulos = { margen, inventario, ventas, clientes, dinero };
  for (const [nombre, reportes] of Object.entries(modulos)) {
    it(`${nombre}.ts: cada reporte tiene clave en kebab-case, título, grupo y consulta`, () => {
      const claves = Object.keys(reportes);
      expect(claves.length).toBeGreaterThan(0);
      for (const clave of claves) {
        const def = reportes[clave];
        expect(clave).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(def.title.length).toBeGreaterThan(0);
        expect(def.group.length).toBeGreaterThan(0);
        expect(typeof def.run).toBe("function");
      }
    });
  }
});

describe("income-report · rango y alcance", () => {
  it("un mes completo con alcance «todas las cajas» es válido", () => {
    const o = incomeOptions({ from: "2026-10-01", to: "2026-10-31" });
    expect(o.scope).toBe("all");
    expect(o.scopeId).toBe("");
  });

  it("rechaza un rango de más de 366 días y uno con inicio después del fin", () => {
    expect(() =>
      incomeOptions({ from: "2025-01-01", to: "2026-10-31" }),
    ).toThrow(/366 días/);
    expect(() =>
      incomeOptions({ from: "2026-10-31", to: "2026-10-01" }),
    ).toThrow(/366 días/);
  });

  it("alcance por caja o usuario exige identificador; alcance desconocido se rechaza", () => {
    expect(() =>
      incomeOptions({ from: "2026-10-01", to: "2026-10-31", scope: "session" }),
    ).toThrow(/Selecciona/);
    expect(() =>
      incomeOptions({ from: "2026-10-01", to: "2026-10-31", scope: "otro" }),
    ).toThrow(/Alcance inválido/);
  });

  it("el día pedido debe caer dentro del rango", () => {
    expect(() =>
      incomeOptions({
        from: "2026-10-01",
        to: "2026-10-31",
        day: "2026-11-02",
      }),
    ).toThrow(/fuera del rango/);
  });
});

describe("gv-citas · catálogos cerrados", () => {
  it("servicios, artistas y estados de cita tienen los valores de la lista", () => {
    expect(GV_SERVICES).toHaveLength(8);
    expect(GV_SERVICES).toContain("novia");
    expect(GV_ARTISTS).toEqual(["Génesis", "Maryori", "Camila", "Evelin"]);
    expect(GV_APPOINTMENT_STATUS).toEqual([
      "agendada",
      "realizada",
      "cancelada",
      "reembolsada",
    ]);
  });
});
