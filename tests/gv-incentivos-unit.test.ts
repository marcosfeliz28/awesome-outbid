import { describe, expect, it } from "vitest";
import { GV_CATALOGO, gvDevengoMes } from "../apps/api/src/gv-incentives";
import {
  gvPaymentInput,
  gvTotals,
  valorEnMoneda,
} from "../apps/api/src/gv-money";

// Orden 103 (decisiones de la dueña vía N1): incentivo fijo del curso ×
// porcentaje pagado del precio, devengado en el mes en que se paga. Solo pagos
// verificados. Anular o reembolsar resta su parte. Cursos en US$ no devengan
// (los pagos no registran moneda: DUDA). Brazilian touch: 0.
const pago = (amount: string, date: string, extra = {}) => ({
  amount,
  date: new Date(date + "T00:00:00Z"),
  verified: true,
  rejectedAt: null,
  ...extra,
});
const pagoUsd = (amount: string, rate: number, date: string, extra = {}) =>
  pago(amount, date, {
    currency: "USD",
    rate: String(rate),
    amountDop: String((Number(amount) * rate).toFixed(2)),
    ...extra,
  });
const alumna = (
  courseName: string,
  agreedPrice: string,
  payments: any[],
  extra = {},
) => ({
  courseName,
  agreedPrice,
  payments,
  ...extra,
});
const AUTO = "Curso de automaquillaje básico grupal"; // RD$ 4,500 · 50
const PERF = "Perfeccionamiento para maquilladores: piel glow + ojos social"; // RD$ 15,000 · 500
const MAQ = "Curso de maquilladora profesional personalizado"; // RD$ 70,000 · 1,000
const BRAZ = "Perfeccionamiento para maquilladores grupal Brazilian touch"; // 0
const USD = "Curso de automaquillaje básico personalizado"; // US$ 200 · 50

describe("GV · catálogo de cursos (orden 103, Génesis)", () => {
  it("son 10 cursos con nombre, precio, moneda e incentivo", () => {
    expect(GV_CATALOGO).toHaveLength(10);
    const byName = Object.fromEntries(GV_CATALOGO.map((c) => [c.nombre, c]));
    expect(byName[MAQ]).toMatchObject({
      precio: 70000,
      moneda: "RD$",
      incentivo: 1000,
    });
    expect(byName[AUTO]).toMatchObject({
      precio: 4500,
      moneda: "RD$",
      incentivo: 50,
    });
    expect(byName[PERF]).toMatchObject({
      precio: 15000,
      moneda: "RD$",
      incentivo: 500,
    });
    expect(byName[BRAZ]).toMatchObject({
      precio: 18000,
      moneda: "RD$",
      incentivo: 0,
    });
    expect(byName[USD]).toMatchObject({
      precio: 200,
      moneda: "US$",
      incentivo: 50,
    });
  });
});

describe("GV · devengo por porcentaje pagado", () => {
  it("pagó la mitad en el mes: recibe la mitad del incentivo en ese mes", () => {
    const e = alumna(AUTO, "4500", [pago("2250", "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "25.00",
      period: "2026-10",
    });
    expect(gvDevengoMes(e, "2026-11")).toBeNull();
  });

  it("completa el pago el mes siguiente: el resto se devenga entonces", () => {
    const e = alumna(PERF, "15000", [
      pago("7500", "2026-10-03"),
      pago("7500", "2026-11-05"),
    ]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "250.00",
      period: "2026-10",
    });
    expect(gvDevengoMes(e, "2026-11")).toEqual({
      amount: "250.00",
      period: "2026-11",
    });
  });

  it("nunca pasa del 100 %: pagar de más no devenga más", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03"),
      pago("900", "2026-11-03"),
    ]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "50.00",
      period: "2026-10",
    });
    expect(gvDevengoMes(e, "2026-11")).toBeNull();
  });

  it("pago anulado: resta su parte en el mes de la anulación", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", {
        rejectedAt: new Date("2026-11-10T12:00:00Z"),
      }),
    ]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "50.00",
      period: "2026-10",
    });
    expect(gvDevengoMes(e, "2026-11")).toEqual({
      amount: "-50.00",
      period: "2026-11",
    });
  });

  it("reembolso: resta su parte en el mes del reembolso", () => {
    const e = alumna(AUTO, "4500", [pago("4500", "2026-10-03")], {
      status: "reembolsada",
      refundAmount: "4500",
      refundDate: new Date("2026-11-02T00:00:00Z"),
    });
    expect(gvDevengoMes(e, "2026-11")).toEqual({
      amount: "-50.00",
      period: "2026-11",
    });
  });

  it("sólo pagos verificados: los por verificar no devengan", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", { verified: false }),
    ]);
    expect(gvDevengoMes(e, "2026-10")).toBeNull();
  });
});

describe("GV · casos que no devengan", () => {
  it("curso en dólares con pago en pesos sin tasa: no devenga (DUDA)", () => {
    const e = alumna(USD, "200", [pago("200", "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toBeNull();
  });

  it("curso en dólares pagado en US$: devenga con el monto en dólares", () => {
    const e = alumna(USD, "200", [pagoUsd("100", 60, "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "25.00",
      period: "2026-10",
    });
  });

  it("curso en RD$ pagado en US$: usa el equivalente en pesos con la tasa", () => {
    const e = alumna(AUTO, "4500", [pagoUsd("75", 60, "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "50.00",
      period: "2026-10",
    });
  });

  it("Brazilian touch: incentivo 0 para quien registra", () => {
    const e = alumna(BRAZ, "18000", [pago("18000", "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toBeNull();
  });

  it("curso que no está en el catálogo no devenga", () => {
    const e = alumna("Curso inventado", "4500", [pago("4500", "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toBeNull();
  });

  it("maquilladora profesional sí devenga RD$ 1,000 en proporción", () => {
    const e = alumna(MAQ, "70000", [pago("35000", "2026-10-03")]);
    expect(gvDevengoMes(e, "2026-10")).toEqual({
      amount: "500.00",
      period: "2026-10",
    });
  });
});

describe("GV · moneda del pago (decisiones de la dueña, 31-oct)", () => {
  it("valor del pago en la moneda del curso", () => {
    // RD$ curso: pesos (equivalente); US$ curso: dólares; pesos sin tasa en US$: no cuenta.
    expect(
      valorEnMoneda(
        { amount: "75", currency: "USD", amountDop: "4500" },
        "RD$",
      )?.toFixed(2),
    ).toBe("4500.00");
    expect(
      valorEnMoneda(
        { amount: "100", currency: "USD", amountDop: "6000" },
        "US$",
      )?.toFixed(2),
    ).toBe("100.00");
    expect(
      valorEnMoneda({ amount: "4500", currency: "DOP" }, "RD$")?.toFixed(2),
    ).toBe("4500.00");
    expect(
      valorEnMoneda({ amount: "4500", currency: "DOP" }, "US$"),
    ).toBeNull();
  });

  it("pagado (totales) de una inscripción en RD$ con pago en US$ suma el equivalente en pesos", () => {
    const t = gvTotals(
      "4500",
      [{ amount: "75", verified: true, currency: "USD", amountDop: "4500" }],
      {},
      "RD$",
    );
    expect(t.paid).toBe("4500.00");
    expect(t.pending).toBe("0.00");
  });

  it("H-01 en GV: US$ sólo en efectivo (transferencia o tarjeta se rechazan)", () => {
    const base = {
      date: "2026-10-03",
      amount: 100,
      concept: "separo",
      currency: "USD",
      rate: 60,
      bank: "Banco Popular",
      reference: "REF-1",
    };
    for (const method of ["transferencia", "tarjeta"]) {
      const r = gvPaymentInput({}).safeParse({ ...base, method });
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error?.issues)).toMatch(/efectivo/);
    }
    const ok = gvPaymentInput({}).safeParse({ ...base, method: "efectivo" });
    expect(ok.success).toBe(true);
  });

  it("USD exige tasa; DOP no la necesita", () => {
    const usdSinTasa = gvPaymentInput({}).safeParse({
      date: "2026-10-03",
      amount: 100,
      concept: "separo",
      method: "efectivo",
      currency: "USD",
    });
    expect(usdSinTasa.success).toBe(false);
    const usdConTasa = gvPaymentInput({}).safeParse({
      date: "2026-10-03",
      amount: 100,
      concept: "separo",
      method: "efectivo",
      currency: "USD",
      rate: 60,
    });
    expect(usdConTasa.success).toBe(true);
    const dop = gvPaymentInput({}).safeParse({
      date: "2026-10-03",
      amount: 4500,
      concept: "separo",
      method: "efectivo",
    });
    expect(dop.success).toBe(true);
  });
});
