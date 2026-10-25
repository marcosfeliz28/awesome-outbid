import { describe, expect, it } from "vitest";
import { summarizeAuditFacts } from "../apps/web/src/admin-dashboard/AnomalyScanner";

describe("tablero administrativo · movimientos para revisar", () => {
  it("resume hechos sin acusar a nadie y omite acciones ajenas", () => {
    const rows = [
      {
        id: "1",
        action: "payment_method_corrected",
        entityId: "sale-1",
        createdAt: "2026-10-25T10:00:00.000Z",
      },
      {
        id: "2",
        action: "payment_method_corrected",
        entityId: "sale-2",
        createdAt: "2026-10-25T10:01:00.000Z",
      },
      {
        id: "3",
        action: "close_difference",
        entityId: "cash-1",
        createdAt: "2026-10-25T10:02:00.000Z",
      },
      {
        id: "4",
        action: "login",
        entityId: "user-1",
        createdAt: "2026-10-25T10:03:00.000Z",
      },
    ];

    expect(summarizeAuditFacts(rows)).toEqual([
      {
        action: "payment_method_corrected",
        count: 2,
        label: "2 cambios de método de pago",
      },
      {
        action: "close_difference",
        count: 1,
        label: "1 cierre con diferencia",
      },
    ]);
    expect(JSON.stringify(summarizeAuditFacts(rows))).not.toMatch(
      /fraude|culpable|sospech/i,
    );
  });
});
