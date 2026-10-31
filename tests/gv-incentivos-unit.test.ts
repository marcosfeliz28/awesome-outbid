import { describe, expect, it } from "vitest";
import {
  GV_INCENTIVO_POR_TIPO,
  gvIncentiveFor,
} from "../apps/api/src/gv-incentives";

// Orden 103: incentivo FIJO por inscripción, sólo con inscripción pagada
// completa y pagos verificados. Montos: Automaquillaje 50, Perfeccionamiento
// (tipo personalizado) 500. Otros tipos: sin incentivo.
const pago = (amount: string, date: string, verified = true, extra = {}) => ({
  amount,
  date: new Date(date + "T00:00:00Z"),
  verified,
  rejectedAt: null,
  ...extra,
});

describe("GV · incentivo fijo por inscripción (orden 103)", () => {
  it("tarifas iniciales exactas: sólo las tres dichas por la dueña", () => {
    expect(GV_INCENTIVO_POR_TIPO).toEqual({
      automaquillaje: 50,
      personalizado: 500,
      maquilladora_profesional: 1000,
    });
  });

  it("maquilladora profesional: RD$ 1,000 si existiera el tipo (aún no hay tipo en la base)", () => {
    expect(
      gvIncentiveFor({
        courseType: "maquilladora_profesional",
        status: "activa",
        agreedPrice: "55000",
        payments: [pago("55000", "2026-11-04")],
      }),
    ).toEqual({ amount: "1000.00", period: "2026-11" });
  });

  it("brazilian touch (curso 8 del catálogo) no da incentivo a quien registra", () => {
    expect(
      gvIncentiveFor({
        courseType: "brazilian",
        status: "activa",
        agreedPrice: "18000",
        payments: [pago("18000", "2026-11-04")],
      }),
    ).toBeNull();
  });

  it("automaquillaje pagado completo y verificado: RD$ 50 en el mes del pago que completó", () => {
    expect(
      gvIncentiveFor({
        courseType: "automaquillaje",
        status: "activa",
        agreedPrice: "4500.00",
        payments: [
          pago("1000.00", "2026-10-03"),
          pago("3500.00", "2026-11-02"),
        ],
      }),
    ).toEqual({ amount: "50.00", period: "2026-11" });
  });

  it("perfeccionamiento (personalizado): RD$ 500", () => {
    expect(
      gvIncentiveFor({
        courseType: "personalizado",
        status: "activa",
        agreedPrice: "2000",
        payments: [pago("2000", "2026-10-15")],
      }),
    ).toEqual({ amount: "500.00", period: "2026-10" });
  });

  it("sin pagar completo no devenga", () => {
    expect(
      gvIncentiveFor({
        courseType: "automaquillaje",
        status: "activa",
        agreedPrice: "4500",
        payments: [pago("4000", "2026-10-03")],
      }),
    ).toBeNull();
  });

  it("pagos por verificar no cuentan", () => {
    expect(
      gvIncentiveFor({
        courseType: "automaquillaje",
        status: "activa",
        agreedPrice: "4500",
        payments: [pago("4500", "2026-10-03", false)],
      }),
    ).toBeNull();
  });

  it("anular (rechazar) el pago verificado quita el devengo", () => {
    expect(
      gvIncentiveFor({
        courseType: "automaquillaje",
        status: "activa",
        agreedPrice: "4500",
        payments: [
          pago("4500", "2026-10-03", true, {
            rejectedAt: new Date(),
          }),
        ],
      }),
    ).toBeNull();
  });

  it("inscripción cancelada o reembolsada no devenga", () => {
    for (const status of ["cancelada", "reembolsada"])
      expect(
        gvIncentiveFor({
          courseType: "automaquillaje",
          status,
          agreedPrice: "4500",
          payments: [pago("4500", "2026-10-03")],
        }),
      ).toBeNull();
  });

  it("tipos sin tarifa (brazilian, otro, maquilladora) no inventan monto", () => {
    for (const courseType of ["brazilian", "otro"])
      expect(
        gvIncentiveFor({
          courseType,
          status: "activa",
          agreedPrice: "4500",
          payments: [pago("4500", "2026-10-03")],
        }),
      ).toBeNull();
  });

  it("precio 0 sin pagos verificados no devenga", () => {
    expect(
      gvIncentiveFor({
        courseType: "automaquillaje",
        status: "activa",
        agreedPrice: "0",
        payments: [],
      }),
    ).toBeNull();
  });
});
