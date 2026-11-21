export const OWNER_CASH_REFERENCE = "Recibido por la dueña";

export type CashSessionMovePayment = {
  method?: string | null;
  cashSessionId?: string | null;
  entryType?: string | null;
  status?: string | null;
  reference?: string | null;
  ownerConfirmed?: boolean | null;
};

export type CashSessionDestination = {
  id: string;
  closedAt?: string | null;
};

export type CashSessionMoveKind = "registered" | "owner-cash";

export function cashSessionMoveKind(
  payment: CashSessionMovePayment,
): CashSessionMoveKind | null {
  if (payment.status === "rejected") return null;
  if (payment.cashSessionId) return "registered";
  const ownerCash =
    payment.method === "cash" &&
    payment.entryType === "installment" &&
    (payment.ownerConfirmed === true ||
      payment.reference?.startsWith(OWNER_CASH_REFERENCE) === true);
  return ownerCash ? "owner-cash" : null;
}

export const openMoveDestinations = <T extends CashSessionDestination>(
  sessions: T[],
) => sessions.filter((session) => !session.closedAt);
