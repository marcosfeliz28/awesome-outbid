import { describe, expect, it } from "vitest";

import {
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

  it("exige un motivo útil antes de rechazar", () => {
    expect(validApprovalRejectReason("no")).toBe(false);
    expect(validApprovalRejectReason("   ")).toBe(false);
    expect(validApprovalRejectReason("1234567")).toBe(false);
    expect(validApprovalRejectReason("12345678")).toBe(true);
    expect(validApprovalRejectReason("Referencia no coincide")).toBe(true);
  });
});
