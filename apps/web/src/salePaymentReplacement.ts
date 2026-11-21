export type ReplacementMethod = "cash" | "card" | "transfer";
export type ReplacementCurrency = "DOP" | "USD";

export type ReplacementPaymentDraft = {
  method: ReplacementMethod;
  amount: string;
  currency: ReplacementCurrency;
  amountUsd?: string;
  usdRate?: string;
  cashSessionId?: string;
  bank?: string;
  reference?: string;
  approvalCode?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardType?: "credit" | "debit" | "";
};

export type PaymentReplacementDraft = {
  operationId: string;
  reason: string;
  ownerConfirmed: boolean;
  payments: ReplacementPaymentDraft[];
};

const requiredNumber = (value: string, field: string) => {
  if (!value.trim()) throw new Error(`${field} es obligatorio.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} no es válido.`);
  return parsed;
};

const optionalText = (value: string | undefined) => {
  const text = value?.trim();
  return text ? text : undefined;
};

/**
 * Convierte controles HTML a la forma del endpoint. No suma, convierte moneda,
 * calcula vuelto ni normaliza tasas: esas reglas pertenecen al servidor.
 */
export function serializePaymentReplacement(draft: PaymentReplacementDraft) {
  const reason = draft.reason.trim();
  if (!reason) throw new Error("El motivo es obligatorio.");
  if (!draft.payments.length) throw new Error("Agrega al menos un pago.");

  const payments = draft.payments.map((payment, index) => {
    const row: Record<string, string | number> = {
      method: payment.method,
      amount: requiredNumber(
        payment.amount,
        `Monto aplicado del pago ${index + 1}`,
      ),
      currency: payment.currency,
    };
    const cashSessionId = optionalText(payment.cashSessionId);
    if (cashSessionId) row.cashSessionId = cashSessionId;

    if (payment.currency === "USD") {
      row.amountUsd = requiredNumber(
        payment.amountUsd ?? "",
        `US$ recibidos del pago ${index + 1}`,
      );
      row.usdRate = requiredNumber(
        payment.usdRate ?? "",
        `Tasa del pago ${index + 1}`,
      );
    }

    if (payment.method === "card") {
      const approvalCode = optionalText(payment.approvalCode);
      const reference = optionalText(payment.reference);
      const cardLast4 = optionalText(payment.cardLast4);
      const cardBrand = optionalText(payment.cardBrand);
      if (approvalCode) row.approvalCode = approvalCode;
      if (reference) row.reference = reference;
      if (cardLast4) row.cardLast4 = cardLast4;
      if (cardBrand) row.cardBrand = cardBrand;
      if (payment.cardType) row.cardType = payment.cardType;
    }

    if (payment.method === "transfer") {
      const bank = optionalText(payment.bank);
      const reference = optionalText(payment.reference);
      if (bank) row.bank = bank;
      if (reference) row.reference = reference;
    }

    return row;
  });

  return {
    payments,
    reason,
    ...(draft.ownerConfirmed ? { ownerConfirmed: true } : {}),
    ...(draft.payments.some((payment) => payment.method === "transfer")
      ? { allowTransfer: true }
      : {}),
    operationId: draft.operationId,
  };
}

type CashSnapshot = Record<string, number | string | null | undefined>;
export type PaymentReplacementResult = {
  cashSessions?: {
    id: string;
    before?: CashSnapshot;
    after?: CashSnapshot;
  }[];
  openCashSessions?: {
    id: string;
    expectedCashBefore?: number | string | null;
    expectedCash?: number | string | null;
  }[];
};

export type CashComparisonRow = {
  key: string;
  label: string;
  before: number | string | null;
  after: number | string | null;
  currency: "DOP" | "USD";
};

export type CashSessionComparison = {
  id: string;
  kindLabel: string;
  rows: CashComparisonRow[];
};

const metrics = (english: boolean) =>
  [
    ["expectedCash", english ? "Expected cash" : "Efectivo esperado", "DOP"],
    ["countedCash", english ? "Counted cash" : "Efectivo contado", "DOP"],
    [
      "differenceCash",
      english ? "Cash difference" : "Diferencia de efectivo",
      "DOP",
    ],
    ["expectedCard", english ? "Expected card" : "Tarjeta esperada", "DOP"],
    ["countedCard", english ? "Counted card" : "Tarjeta contada", "DOP"],
    [
      "differenceCard",
      english ? "Card difference" : "Diferencia de tarjeta",
      "DOP",
    ],
    [
      "expectedTransfer",
      english ? "Expected transfers" : "Transferencias esperadas",
      "DOP",
    ],
    [
      "differenceTransfer",
      english ? "Transfer difference" : "Diferencia de transferencia",
      "DOP",
    ],
    ["expectedUsd", english ? "Expected US$" : "US$ esperado", "USD"],
    ["countedUsd", english ? "Counted US$" : "US$ contado", "USD"],
    ["differenceUsd", english ? "US$ difference" : "Diferencia US$", "USD"],
  ] as const;

const value = (snapshot: CashSnapshot | undefined, key: string) =>
  snapshot?.[key] ?? null;

/** Mantiene los valores crudos devueltos por la API y solo les añade etiquetas. */
export function cashSessionComparisons(
  result: PaymentReplacementResult,
  english: boolean,
): CashSessionComparison[] {
  const closed = (result.cashSessions ?? []).map((session) => ({
    id: session.id,
    kindLabel: english ? "Closed register" : "Caja cerrada",
    rows: metrics(english).map(([key, label, currency]) => ({
      key,
      label,
      before: value(session.before, key),
      after: value(session.after, key),
      currency,
    })),
  }));
  const open = (result.openCashSessions ?? []).map((session) => ({
    id: session.id,
    kindLabel: english ? "Open register" : "Caja abierta",
    rows: [
      {
        key: "expectedCash",
        label: english ? "Expected cash" : "Efectivo esperado",
        before: session.expectedCashBefore ?? null,
        after: session.expectedCash ?? null,
        currency: "DOP" as const,
      },
    ],
  }));
  return [...closed, ...open];
}
