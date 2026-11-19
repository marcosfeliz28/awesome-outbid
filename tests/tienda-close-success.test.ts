import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeCashClose } from "../apps/web/src/cashCloseFlow";

const tienda = readFileSync(
  new URL("../apps/web/src/Tienda.tsx", import.meta.url),
  "utf8",
);

describe("P8 · cierre confirmado aunque falle el cuadre", () => {
  it("separa el POST exitoso del intento posterior de cargar el impreso", () => {
    const close = tienda.slice(
      tienda.indexOf("const result = await completeCashClose("),
      tienda.indexOf("const money =", tienda.indexOf("export function CloseCashModal")),
    );
    expect(close).toContain("Caja cerrada correctamente");
    expect(close).toContain("Historial de cajas");
    expect(close).toContain("completeCashClose(");
    expect(close).toContain('result.status === "ready"');
    expect(close).toContain("onClose();");
  });

  it("confirma el cierre una sola vez aunque no cargue el cuadre", async () => {
    let closeCalls = 0;
    let cuadreCalls = 0;
    const result = await completeCashClose(
      async () => {
        closeCalls += 1;
      },
      async () => {
        cuadreCalls += 1;
        throw new Error("cuadre no disponible");
      },
    );
    expect(result.status).toBe("closed_without_cuadre");
    expect(closeCalls).toBe(1);
    expect(cuadreCalls).toBe(1);
  });

  it("no solicita el cuadre cuando el cierre realmente falla", async () => {
    let cuadreCalls = 0;
    await expect(
      completeCashClose(
        async () => {
          throw new Error("cierre rechazado");
        },
        async () => {
          cuadreCalls += 1;
          return {};
        },
      ),
    ).rejects.toThrow("cierre rechazado");
    expect(cuadreCalls).toBe(0);
  });

  it("conserva el cuadre cuando ambas operaciones funcionan", async () => {
    await expect(
      completeCashClose(
        async () => {},
        async () => ({ number: "C-1" }),
      ),
    ).resolves.toEqual({ status: "ready", cuadre: { number: "C-1" } });
  });
});
