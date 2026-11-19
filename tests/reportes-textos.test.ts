import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  auditActionName,
  auditDetail,
  incomeKindName,
  kardexTypeName,
  methodName,
} from "../apps/api/src/reportes/textos";
import {
  cashReconciliation,
  groupIncomeDays,
} from "../apps/api/src/income-day";
import { sellerLabels } from "../apps/api/src/reports";

// Auditoría de pantallas y de dinero (19-nov-2026), área de reportes.
const web = (file: string) =>
  readFileSync(new URL(`../apps/web/src/${file}`, import.meta.url), "utf8");

describe("P6 y textos del servidor: códigos internos en español", () => {
  it("métodos, tipos de ingreso y de kardex", () => {
    expect(
      ["cash", "card", "transfer", "credit", "cod"].map(methodName),
    ).toEqual([
      "Efectivo",
      "Tarjeta",
      "Transferencia",
      "Crédito",
      "Contraentrega",
    ]);
    expect(incomeKindName("collection_transfer")).toBe(
      "Cobro de crédito por transferencia",
    );
    expect(kardexTypeName("transfer_out")).toBe("Traspaso enviado");
    expect(kardexTypeName("codigo_nuevo")).toBe("codigo_nuevo");
  });

  it("Devoluciones y descuentos: frase legible, sin JSON ni costos", () => {
    expect(auditActionName("discount_approved")).toBe("Descuento aprobado");
    const discount = auditDetail("discount_approved", {
      actor: { id: "u1", name: "Wendy" },
      authorizer: { id: "u1", name: "Wendy" },
      reason: "Clienta frecuente",
      discount: "1500",
    });
    expect(discount).toBe(
      "Descuento RD$ 1,500.00 · Motivo: Clienta frecuente · Autorizó: Wendy (la misma persona que vendió)",
    );
    const ret = auditDetail("return", {
      number: "DEV-0001",
      total: "250.5",
      costTotal: "100",
      refundAmount: "250.5",
      refundMethod: "cash",
      reason: "Talla",
    });
    expect(ret).toBe(
      "Devolución DEV-0001 · Devuelto RD$ 250.50 · Reembolso RD$ 250.50 en Efectivo · Motivo: Talla",
    );
    expect(ret).not.toMatch(/100|costTotal|\{/);
    expect(
      auditDetail("void", { reason: "Error de cobro", afterCashClose: true }),
    ).toBe("Motivo: Error de cobro · después del cierre de caja");
  });

  it("Ingresos por día en pantalla: método traducido", () => {
    const src = web("IncomeByDay.tsx");
    expect(src).not.toContain("<td>{item.method}</td>");
    expect(src).toMatch(/methodName\[item\.method\]/);
  });
});

describe("P5/P19: filtro de caja con nombre y fecha de RD", () => {
  it("muestra registerName y userName, no el código interno", () => {
    const src = web("IncomeByDay.tsx");
    expect(src).not.toContain("${item.registerId} ·");
    expect(src).toMatch(/item\.registerName/);
    expect(src).toMatch(/item\.userName/);
    expect(src).toMatch(
      /toLocaleDateString\(en \? "en-US" : "es-DO", \{\s*timeZone: "America\/Santo_Domingo"/,
    );
  });
});

describe("P7: nota de «Vendido neto» en Ingresos por día", () => {
  it("explica por qué no coincide con el Resumen", () => {
    const src = web("IncomeByDay.tsx");
    expect(src).toContain("resta cada devolución el día en que se hizo");
    expect(web("reportSecondaryCopy.ts")).toContain(
      "subtracts each return on the day it was made",
    );
  });
});

describe("D15: conciliación de Ingresos por día con dólares", () => {
  it("un pago en US$ no marca «no cuadra» si el cierre cuadró", () => {
    // Venta de RD$ 5,900 pagada con US$ 100 (RD$ 6,000), vuelto RD$ 100 en
    // pesos, y otra venta de RD$ 1,000 en pesos. La caja espera 1,000 − 100.
    const [row] = groupIncomeDays([
      { day: "2026-11-18", kind: "sale_cash", amount: "6900" },
      { day: "2026-11-18", kind: "sold", amount: "6900" },
    ]);
    const expected = { cash: 900, card: 0, transfer: 0 };
    // Fórmula anterior: report.cash = 6,900 → diferencia 6,000.
    expect(row.cash + row.collectionCash - expected.cash).toBe(6000);
    const r = cashReconciliation(row, expected, { amount: 5900, change: 100 });
    expect(r.report.cash).toBe(900);
    expect(r.difference).toEqual({ cash: 0, card: 0, transfer: 0 });
    expect(r.matches).toBe(true);
  });

  it("sin dólares la cifra no cambia", () => {
    const [row] = groupIncomeDays([
      { day: "2026-11-18", kind: "sale_cash", amount: "1000.10" },
      { day: "2026-11-18", kind: "collection_card", amount: "50" },
    ]);
    const r = cashReconciliation(row, { cash: 1000, card: 50, transfer: 0 });
    expect(r.difference).toEqual({ cash: 0.1, card: 0, transfer: 0 });
    expect(r.matches).toBe(false);
  });
});

describe("P22: vendedoras con el mismo nombre", () => {
  it("salen separadas, la segunda con (2)", () => {
    const names = new Map([
      ["a", "Ana Pérez"],
      ["b", "Ana Pérez"],
      ["c", "Luisa"],
    ]);
    expect([...sellerLabels(names, ["a", "c", "b"]).values()]).toEqual([
      "Ana Pérez",
      "Luisa",
      "Ana Pérez (2)",
    ]);
  });
});
