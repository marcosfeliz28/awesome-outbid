import { describe, expect, it } from "vitest";
import {
  assertGvBank,
  cardDetails,
  committed,
  gvDay,
  gvMoney,
  gvTotals,
  transferDetails,
} from "../apps/api/src/gv-money";

// Casos borde de apps/api/src/gv-money.ts (pieza 20 de la cola permanente).
// Solo pruebas: no cambia código de producción.

const ctx = () => {
  const issues: { path: (string | number)[]; message: string }[] = [];
  return {
    issues,
    addIssue: (i: { path: (string | number)[]; message: string }) =>
      issues.push(i),
  } as any;
};

describe("GV · fechas (gvDay)", () => {
  it("acepta AAAA-MM-DD válida y rechaza formato o fecha imposible", () => {
    expect(gvDay.safeParse("2026-10-31").success).toBe(true);
    expect(gvDay.safeParse("2026-2-3").success).toBe(false);
    expect(gvDay.safeParse("2026-02-30").success).toBe(false);
    expect(gvDay.safeParse("2026-13-01").success).toBe(false);
    expect(gvDay.safeParse("2026-10-31T00:00:00Z").success).toBe(false);
  });

  it("rechaza años fuera del rango 1900 en adelante", () => {
    expect(gvDay.safeParse("1899-12-31").success).toBe(false);
    expect(gvDay.safeParse("1900-01-01").success).toBe(true);
  });
});

describe("GV · importes (gvMoney)", () => {
  it("cero solo se acepta con allowZero", () => {
    expect(gvMoney().safeParse(0).success).toBe(false);
    expect(gvMoney(true).safeParse(0).success).toBe(true);
  });

  it("máximo 2 decimales, sin tolerancia (0.1 + 0.2 se revisa como número exacto)", () => {
    expect(gvMoney().safeParse(0.3).success).toBe(true);
    expect(gvMoney().safeParse(10.01).success).toBe(true);
    expect(gvMoney().safeParse(10.001).success).toBe(false);
    expect(gvMoney().safeParse(0.1 + 0.2).success).toBe(false);
  });

  it("tope de 10 000 000 y negativos fuera", () => {
    expect(gvMoney().safeParse(10000000).success).toBe(true);
    expect(gvMoney().safeParse(10000000.01).success).toBe(false);
    expect(gvMoney(true).safeParse(-5).success).toBe(false);
  });
});

describe("GV · pagado, por verificar y pendiente (gvTotals)", () => {
  it("un pago rechazado no cuenta en nada", () => {
    const t = gvTotals(1000, [
      { amount: 400, verified: true, rejectedAt: new Date() },
      { amount: 100, verified: false, rejectedAt: null },
    ]);
    expect(t.paid).toBe("0.00");
    expect(t.unverified).toBe("100.00");
    expect(t.pending).toBe("1000.00");
  });

  it("sobrepago: el pendiente nunca es negativo", () => {
    const t = gvTotals(500, [{ amount: 800, verified: true }]);
    expect(t.paid).toBe("800.00");
    expect(t.pending).toBe("0.00");
  });

  it("cancelada o reembolsada: pendiente 0 aunque falte dinero", () => {
    const pagos = [{ amount: 100, verified: true }];
    expect(gvTotals(1000, pagos, { status: "cancelada" }).pending).toBe("0.00");
    expect(gvTotals(1000, pagos, { status: "reembolsada" }).pending).toBe(
      "0.00",
    );
    expect(gvTotals(1000, pagos, { status: "activa" }).pending).toBe("900.00");
  });

  it("el reembolso se cuenta aparte y sin importe queda en 0.00", () => {
    expect(gvTotals(1000, [], { refundAmount: 250 }).refunded).toBe("250.00");
    expect(gvTotals(1000, []).refunded).toBe("0.00");
  });

  it("sin pagos: todo pendiente y valores con 2 decimales", () => {
    expect(gvTotals(99.9, [])).toEqual({
      paid: "0.00",
      unverified: "0.00",
      refunded: "0.00",
      pending: "99.90",
    });
  });
});

describe("GV · pagos vigentes (committed)", () => {
  it("cuenta verificados y por verificar, no los rechazados", () => {
    const total = committed([
      { amount: 100, verified: true },
      { amount: 50, verified: false },
      { amount: 999, verified: true, rejectedAt: new Date() },
    ]);
    expect(total.toFixed(2)).toBe("150.00");
  });
});

describe("GV · reglas de pago (transferencia y tarjeta)", () => {
  it("transferencia exige banco y referencia", () => {
    const c = ctx();
    transferDetails({ method: "transferencia", bank: null, reference: null }, c);
    expect(c.issues.map((i: any) => i.path[0])).toEqual(["bank", "reference"]);
  });

  it("efectivo no exige nada", () => {
    const c = ctx();
    transferDetails({ method: "efectivo", bank: null, reference: null }, c);
    cardDetails({ method: "efectivo", reference: null }, c);
    expect(c.issues).toEqual([]);
  });

  it("tarjeta sin referencia no pasa; con referencia sí", () => {
    const sin = ctx();
    cardDetails({ method: "tarjeta", reference: null }, sin);
    expect(sin.issues).toHaveLength(1);
    const con = ctx();
    cardDetails({ method: "tarjeta", reference: "LOTE-7" }, con);
    expect(con.issues).toEqual([]);
  });
});

describe("GV · banco de la lista (assertGvBank)", () => {
  const bancos = { genesis: ["Banco Genesis"], macgen: ["BHD"] };

  it("con lista, un banco fuera de la lista se rechaza", () => {
    expect(() => assertGvBank(bancos, "Banco Inventado")).toThrow();
    expect(() => assertGvBank(bancos, null)).toThrow();
  });

  it("con lista, un banco de la lista pasa", () => {
    expect(() => assertGvBank(bancos, "BHD")).not.toThrow();
  });

  it("sin lista no exige banco", () => {
    expect(() =>
      assertGvBank({ genesis: [], macgen: [] }, null),
    ).not.toThrow();
  });
});

describe("GV · importes sin redondeo oculto", () => {
  it("un pago de 0.005 no se acepta como 0.01", () => {
    expect(gvMoney().safeParse(0.005).success).toBe(false);
  });
});
