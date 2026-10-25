import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  approvalDeckGestureIntent,
  buildApprovalDeckQueue,
  validApprovalRejectReason,
  type ApprovalDeckProps,
} from "../apps/web/src/admin-dashboard/ApprovalDeck";

const props: ApprovalDeckProps = {
  voidRequests: [
    {
      id: "void-1",
      invoice: "FS-0000042",
      requestedAt: "2026-10-25T13:00:00.000Z",
      requestedBy: "Ana",
      reason: "Venta duplicada",
      requiresPin: true,
    },
  ],
  pendingTransfers: [
    {
      id: "pay-1",
      invoice: "FS-0000043",
      createdAt: "2026-10-25T14:00:00.000Z",
      customer: "Cliente mostrador",
      amount: "1250.00",
      bank: "BHD",
      reference: "827647262",
    },
  ],
  onOpenDetail: () => undefined,
  onApproveVoid: async () => undefined,
  onRejectVoid: async () => undefined,
  onVerifyTransfer: async () => undefined,
  onRejectTransfer: async () => undefined,
};

describe("ApprovalDeck", () => {
  it("junta anulaciones y transferencias pendientes, más reciente primero", () => {
    expect(buildApprovalDeckQueue(props)).toMatchObject([
      { id: "pay-1", kind: "transfer", invoice: "FS-0000043" },
      { id: "void-1", kind: "void", invoice: "FS-0000042" },
    ]);
  });

  it("trata clic, teclado y deslizamiento únicamente como apertura de detalle", () => {
    expect(approvalDeckGestureIntent("click")).toBe("open-detail");
    expect(approvalDeckGestureIntent("keyboard")).toBe("open-detail");
    expect(approvalDeckGestureIntent("swipe-left")).toBe("open-detail");
    expect(approvalDeckGestureIntent("swipe-right")).toBe("open-detail");
  });

  it("exige un motivo útil antes de rechazar", () => {
    expect(validApprovalRejectReason("no")).toBe(false);
    expect(validApprovalRejectReason("   ")).toBe(false);
    expect(validApprovalRejectReason("Referencia no coincide")).toBe(true);
  });

  it("expone botones reales y explica que abrir una tarjeta no decide dinero", () => {
    const source = readFileSync(
      "apps/web/src/admin-dashboard/ApprovalDeck.tsx",
      "utf8",
    );
    const styles = readFileSync(
      "apps/web/src/admin-dashboard/ApprovalDeck.css",
      "utf8",
    );

    expect(source).toContain("Aprobaciones pendientes");
    expect(source).toContain("Abrir detalle");
    expect(source).toContain("Aprobar anulación");
    expect(source).toContain("Verificar transferencia");
    expect(source).toContain("Rechazar");
    expect(source).toContain("no aprueba ni rechaza");
    expect(source.match(/<button/g)?.length).toBeGreaterThanOrEqual(4);
    expect(styles).toContain("@media (max-width: 390px)");
    expect(styles).toContain("min-height: 44px");
    expect(styles).toContain("overflow: hidden");
  });
});
