import { formatMoney } from "@fitstore/shared";

export function paymentReminderDraft(input: {
  name: string;
  balance: number;
  numbers: string[];
}): string | null {
  if (!Number.isFinite(input.balance) || input.balance <= 0) return null;
  const numbers = [...new Set(input.numbers.filter(Boolean))].slice(0, 10);
  return [
    `Hola, ${input.name.trim()}. Le escribimos para recordarle que registra un saldo pendiente de ${formatMoney(input.balance)}${numbers.length ? ` en ${numbers.join(", ")}` : ""}.`,
    "Le podemos compartir su estado de cuenta en PDF para que lo revise.",
    "Si ya realizó el pago, por favor avísenos para verificarlo. Gracias.",
  ].join("\n\n");
}
