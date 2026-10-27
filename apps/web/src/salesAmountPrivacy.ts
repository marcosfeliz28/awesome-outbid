import { can } from "@fitstore/shared";

export const HIDDEN_SALE_AMOUNT = "Importe oculto";
export const HIDDEN_PAYMENT_METHOD = "Forma de pago oculta";

/**
 * Replica la frontera de `canViewCashExpected` de la API. Mientras no se haya
 * confirmado el estado de caja, la cajera se trata como caja abierta para
 * evitar que una respuesta lenta revele importes durante unos milisegundos.
 */
export function shouldHideSaleAmounts(
  permissions: string[],
  cashSessionsLoaded: boolean,
  hasOwnOpenCashSession: boolean,
) {
  const canSeeCashExpected =
    can(permissions, "profit:read") || can(permissions, "sale:manage");
  return !canSeeCashExpected && (!cashSessionsLoaded || hasOwnOpenCashSession);
}

export const saleAmountText = (formatted: string, hidden: boolean) =>
  hidden ? HIDDEN_SALE_AMOUNT : formatted;

export const salePaymentText = (label: string, hidden: boolean) =>
  hidden ? HIDDEN_PAYMENT_METHOD : label;

/**
 * La marca de la API manda sobre el estado local. Así, una respuesta ya
 * redactada nunca intenta formatear campos que deliberadamente no recibió.
 */
export const saleRowAmountsHidden = (
  screenHidden: boolean,
  sale: { hiddenUntilClose?: boolean } | null | undefined,
) => screenHidden || sale?.hiddenUntilClose === true;

export function saleAmountValue<T>(
  value: T,
  hidden: boolean,
  formatter: (value: T) => string,
) {
  return hidden ? HIDDEN_SALE_AMOUNT : formatter(value);
}

export function salePaymentValue<T>(
  payments: T[] | undefined,
  hidden: boolean,
  formatter: (payments: T[]) => string,
) {
  return hidden ? HIDDEN_PAYMENT_METHOD : formatter(payments ?? []);
}
