import { describe, expect, it } from "vitest";
import { GV_CATALOGO, gvIncentivosMes } from "../apps/api/src/gv-incentives";
import {
  catalogoOpciones,
  checkGvOwnerEdit,
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
  createdBy: "C",
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

// Por pago: incentivo del curso × valor del pago ÷ precio, acreditado a quien
// cobró ese pago, en el mes del pago. Tope 100 %. Anulado resta en su mes.
// Reembolso: reversa proporcional a quienes cobraron, en el mes del reembolso.
const mapa = (
  rows: { personId: string; amount: string; period: string; kind: string }[],
  period: string,
) =>
  rows
    .filter((r) => r.period === period)
    .map((r) => ({ personId: r.personId, amount: r.amount, kind: r.kind }));

describe("GV · incentivo por pago (cobrador)", () => {
  it("pagó la mitad: el cobrador recibe la mitad del incentivo en ese mes", () => {
    const e = alumna(AUTO, "4500", [
      pago("2250", "2026-10-03", { createdBy: "A" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "25.00", kind: "pago" },
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([]);
  });

  it("completa el pago el mes siguiente: cada cobrador recibe en el mes de su pago", () => {
    const e = alumna(PERF, "15000", [
      pago("7500", "2026-10-03", { createdBy: "A" }),
      pago("7500", "2026-11-05", { createdBy: "B" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "250.00", kind: "pago" },
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([
      { personId: "B", amount: "250.00", kind: "pago" },
    ]);
  });

  it("dos cobradores el mismo mes: cada uno recibe lo que cobró", () => {
    const e = alumna(AUTO, "4500", [
      pago("4000", "2026-10-03", { createdBy: "A" }),
      pago("500", "2026-10-04", { createdBy: "B" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "44.44", kind: "pago" },
      { personId: "B", amount: "5.56", kind: "pago" },
    ]);
  });

  it("tope 100 %: el pago que excede el precio no devenga", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", { createdBy: "A" }),
      pago("900", "2026-11-03", { createdBy: "B" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "50.00", kind: "pago" },
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([]);
  });

  it("pago anulado: el cobrador pierde lo que recibió, en el mes de la anulación", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", {
        createdBy: "A",
        rejectedAt: new Date("2026-11-10T12:00:00Z"),
      }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "50.00", kind: "pago" },
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([
      { personId: "A", amount: "-50.00", kind: "anulado" },
    ]);
  });

  it("reembolso: la reversa es proporcional a quienes cobraron, en el mes del reembolso", () => {
    const e = alumna(
      AUTO,
      "4500",
      [
        pago("4000", "2026-10-03", { createdBy: "A" }),
        pago("500", "2026-10-04", { createdBy: "B" }),
      ],
      {
        status: "reembolsada",
        refundAmount: "4500",
        refundDate: new Date("2026-11-02T00:00:00Z"),
      },
    );
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([
      { personId: "A", amount: "-44.44", kind: "reembolso" },
      { personId: "B", amount: "-5.56", kind: "reembolso" },
    ]);
  });

  it("sólo pagos verificados: los por verificar no devengan", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", { verified: false }),
    ]);
    expect(gvIncentivosMes(e)).toEqual([]);
  });
});

describe("GV · casos de moneda y catálogo", () => {
  it("curso en dólares con pago en pesos sin tasa: no devenga", () => {
    const e = alumna(USD, "200", [
      pago("200", "2026-10-03", { createdBy: "A" }),
    ]);
    expect(gvIncentivosMes(e)).toEqual([]);
  });

  it("curso en dólares con pago en pesos y tasa: convierte con la tasa del pago", () => {
    // RD$ 4,500 a 60 = US$ 75 de US$ 200 → 37.5 % de 50 = 18.75
    const e = alumna(USD, "200", [
      pago("4500", "2026-10-03", { rate: "60", createdBy: "A" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "18.75", kind: "pago" },
    ]);
  });

  it("curso en dólares pagado en US$: devenga con el monto en dólares", () => {
    const e = alumna(USD, "200", [
      pagoUsd("100", 60, "2026-10-03", { createdBy: "A" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "25.00", kind: "pago" },
    ]);
  });

  it("curso en RD$ pagado en US$: usa el equivalente en pesos con la tasa", () => {
    const e = alumna(AUTO, "4500", [
      pagoUsd("75", 60, "2026-10-03", { createdBy: "A" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "50.00", kind: "pago" },
    ]);
  });

  it("Brazilian touch: incentivo 0 para quien cobra", () => {
    const e = alumna(BRAZ, "18000", [
      pago("18000", "2026-10-03", { createdBy: "A" }),
    ]);
    expect(gvIncentivosMes(e)).toEqual([]);
  });

  it("curso que no está en el catálogo no devenga", () => {
    const e = alumna("Curso inventado", "4500", [
      pago("4500", "2026-10-03", { createdBy: "A" }),
    ]);
    expect(gvIncentivosMes(e)).toEqual([]);
  });

  it("maquilladora profesional: RD$ 1,000 en proporción al pago", () => {
    const e = alumna(MAQ, "70000", [
      pago("35000", "2026-10-03", { createdBy: "A" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "500.00", kind: "pago" },
    ]);
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
    expect(
      valorEnMoneda(
        { amount: "4500", currency: "DOP", rate: "60" },
        "US$",
      )?.toFixed(2),
    ).toBe("75.00");
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

describe("GV · catálogo como opciones del formulario de curso (N1, 1-nov)", () => {
  it("cada curso tiene su tipo: automaquillaje 3–7, brazilian 8, personalizado 1, 2, 9, 10", () => {
    const tipos = GV_CATALOGO.map((c) => c.tipo);
    expect(tipos).toEqual([
      "personalizado",
      "personalizado",
      "automaquillaje",
      "automaquillaje",
      "automaquillaje",
      "automaquillaje",
      "automaquillaje",
      "brazilian",
      "personalizado",
      "personalizado",
    ]);
  });

  it("la lista de opciones sale sin incentivo y con precio y moneda del catálogo", () => {
    const opciones = catalogoOpciones();
    expect(opciones).toHaveLength(10);
    expect(opciones[3]).toEqual({
      nombre: "Curso de automaquillaje básico personalizado",
      precio: 200,
      moneda: "US$",
      tipo: "automaquillaje",
    });
    expect(opciones.every((o) => !("incentivo" in o))).toBe(true);
  });
});

describe("GV · incentivo: pago anulado no consume el tope (revisión, A)", () => {
  it("A cobra 4,500 y lo anula; B cobra 4,500 después: B recibe el incentivo completo y A neto 0 en octubre", () => {
    const e = alumna(AUTO, "4500", [
      pago("4500", "2026-10-03", {
        createdBy: "A",
        rejectedAt: new Date("2026-10-10T12:00:00Z"),
      }),
      pago("4500", "2026-10-10", { createdBy: "B" }),
    ]);
    expect(mapa(gvIncentivosMes(e), "2026-10")).toEqual([
      { personId: "A", amount: "50.00", kind: "pago" },
      { personId: "A", amount: "-50.00", kind: "anulado" },
      { personId: "B", amount: "50.00", kind: "pago" },
    ]);
  });
});

describe("GV · reembolso siempre en RD$ (orden 106, revisión B)", () => {
  const USD_PAGADO = () =>
    alumna(USD, "200", [pagoUsd("200", 60, "2026-10-03", { createdBy: "A" })]);

  it("curso US$ pagado en RD$ 12,000: reembolso total en RD$ se acepta", () => {
    const before = { status: "activa", course: { name: USD }, ...USD_PAGADO() };
    expect(() =>
      checkGvOwnerEdit("enrollment", before, {
        status: "reembolsada",
        refundAmount: 12000,
        refundDate: "2026-11-02",
      }),
    ).not.toThrow();
  });

  it("reembolso por encima de lo pagado en RD$ se rechaza con mensaje en RD$", () => {
    const before = { status: "activa", course: { name: USD }, ...USD_PAGADO() };
    expect(() =>
      checkGvOwnerEdit("enrollment", before, {
        status: "reembolsada",
        refundAmount: 12001,
        refundDate: "2026-11-02",
      }),
    ).toThrow(/RD\$ 12000\.00/);
  });

  it("reversa en proporción de RD$: RD$ 150 de RD$ 12,000 quita 150/12000 del incentivo", () => {
    const e = alumna(USD, "200", [pagoUsd("200", 60, "2026-10-03", { createdBy: "A" })], {
      status: "reembolsada",
      refundAmount: "150",
      refundDate: new Date("2026-11-02T00:00:00Z"),
    });
    // 50 × 150 / 12000 = 0.625 → 0.63 (no 37.50, que sería 150/200 en US$)
    expect(mapa(gvIncentivosMes(e), "2026-11")).toEqual([
      { personId: "A", amount: "-0.63", kind: "reembolso" },
    ]);
  });
});
