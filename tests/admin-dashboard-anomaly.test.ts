import { describe, expect, it } from "vitest";
import {
  navigableAuditFacts,
  summarizeAuditFacts,
} from "../apps/web/src/admin-dashboard/AnomalyScanner";

describe("tablero administrativo · movimientos para revisar", () => {
  it("resume hechos sin acusar a nadie y omite acciones ajenas", () => {
    const rows = [
      {
        id: "1",
        action: "payment_method_corrected",
        entity: "sale",
        entityId: "sale-1",
        saleId: "sale-1",
        createdAt: "2026-10-25T10:00:00.000Z",
      },
      {
        id: "2",
        action: "payment_method_corrected",
        entity: "sale",
        entityId: "sale-2",
        saleId: "sale-2",
        createdAt: "2026-10-25T10:01:00.000Z",
      },
      {
        id: "3",
        action: "close_difference",
        entity: "cash",
        entityId: "cash-1",
        createdAt: "2026-10-25T10:02:00.000Z",
      },
      {
        id: "4",
        action: "login",
        entity: "user",
        entityId: "user-1",
        createdAt: "2026-10-25T10:03:00.000Z",
      },
    ];

    expect(summarizeAuditFacts(rows)).toEqual([
      {
        action: "sale:payment_method_corrected",
        count: 2,
        label: "2 cambios de método de pago",
      },
      {
        action: "cash:close_difference",
        count: 1,
        label: "1 cierre con diferencia",
      },
    ]);
    expect(JSON.stringify(summarizeAuditFacts(rows))).not.toMatch(
      /fraude|culpable|sospech/i,
    );
  });

  it("resume únicamente filas que pueden abrir una venta", () => {
    const rows = [
      {
        id: "1",
        action: "close_difference",
        entity: "cash",
        entityId: "cash-1",
        createdAt: "2026-10-25T10:00:00.000Z",
      },
      {
        id: "2",
        action: "void",
        entity: "sale",
        entityId: "sale-2",
        saleId: "sale-2",
        createdAt: "2026-10-25T10:01:00.000Z",
      },
    ];

    expect(summarizeAuditFacts(navigableAuditFacts(rows))).toEqual([
      { action: "sale:void", count: 1, label: "1 anulación" },
    ]);
  });

  it("cuenta todo el día aunque el detalle visual se limite a ocho filas", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      action: "void",
      entity: "sale",
      entityId: `sale-${index}`,
      saleId: `sale-${index}`,
      createdAt: "2026-10-25T10:01:00.000Z",
    }));

    expect(summarizeAuditFacts(navigableAuditFacts(rows))).toEqual([
      { action: "sale:void", count: 10, label: "10 anulaciones" },
    ]);
  });
});
