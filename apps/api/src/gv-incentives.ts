// Incentivo por inscripción GV (decisión de la dueña, 1-nov): se paga POR PAGO,
// a quien cobró cada pago (payment.createdBy), no a quien registró la inscripción.
// Se calcula al leer, no se guarda.
//  - Cada pago verificado: incentivo del curso × valor del pago ÷ precio, en el
//    mes del pago. El acumulado de la inscripción no pasa del 100 %.
//  - Pago anulado: el cobrador pierde lo que recibió, en el mes de la anulación.
//  - Reembolso: reversa proporcional a lo que cobró cada uno, en el mes del
//    reembolso.
import { businessDate, d } from "@fitstore/shared";
import { GV_CATALOGO, valorEnMoneda } from "./gv-money";

export { GV_CATALOGO } from "./gv-money";

type Pago = {
  id?: string;
  amount: unknown;
  date: Date;
  verified: boolean;
  rejectedAt?: Date | null;
  createdBy: string;
  currency?: string | null;
  amountDop?: unknown;
  rate?: unknown;
};
type Inscripcion = {
  courseName: string;
  agreedPrice: unknown;
  refundAmount?: unknown;
  refundDate?: Date | null;
  payments: Pago[];
};
export type EventoIncentivo = {
  personId: string;
  kind: "pago" | "anulado" | "reembolso";
  amount: string;
  period: string;
};

// Fechas civiles de GV (pago, reembolso) se guardan a medianoche UTC del día:
// su mes es el UTC. Anulación = instante real: su mes es el de negocio (RD).
const mes = (f: Date) => f.toISOString().slice(0, 7);
const mesNegocio = (f: Date) => businessDate(f).slice(0, 7);

/** Eventos del incentivo de una inscripción, cada uno con su cobrador y mes. */
export function gvIncentivosEventos(e: Inscripcion): EventoIncentivo[] {
  const curso = GV_CATALOGO.find((c) => c.nombre === e.courseName);
  if (!curso || curso.incentivo === 0) return [];
  const precio = d(e.agreedPrice as any);
  if (precio.lte(0)) return [];

  // Pagos verificados en orden de fecha, con su valor en la moneda del curso.
  const ordenados = e.payments
    .filter((p) => p.verified)
    .map((p) => ({ p, valor: valorEnMoneda(p as any, curso.moneda) }))
    .filter((x) => x.valor !== null)
    .sort(
      (a, b) =>
        a.p.date.getTime() - b.p.date.getTime() ||
        (a.p.id ?? "").localeCompare(b.p.id ?? ""),
    );

  const eventos: EventoIncentivo[] = [];
  const porCobrador = new Map<string, ReturnType<typeof d>>();
  let cum = d(0);
  // Incentivo ya acreditado, redondeado sobre el acumulado: la suma de los
  // créditos siempre es el incentivo del acumulado redondeado, sin centavos perdidos.
  let acreditado = d(0);
  let aceptadoDop = d(0);
  for (const { p, valor } of ordenados) {
    // Tope 100 % sobre pagos vigentes: el que excede el precio se recorta.
    const restante = precio.minus(cum);
    const aceptado = restante.lte(0)
      ? d(0)
      : (valor as any).gt(restante)
        ? restante
        : (valor as any);
    const conEste = cum.plus(aceptado);
    const meta = d(curso.incentivo)
      .times(conEste)
      .div(precio)
      .toDecimalPlaces(2);
    const credito = meta.minus(acreditado);
    // Un pago anulado no consume el tope: sólo los vigentes suman al acumulado.
    if (!p.rejectedAt) {
      cum = conEste;
      acreditado = meta;
    }
    // Lo aceptado en pesos (el reembolso es en RD$, orden 106).
    const dop = valorEnMoneda(p as any, "RD$");
    if (!p.rejectedAt && dop && (valor as any).gt(0))
      aceptadoDop = aceptadoDop.plus(dop.times(aceptado).div(valor as any));
    if (credito.lte(0)) continue;
    eventos.push({
      personId: p.createdBy,
      kind: "pago",
      amount: credito.toFixed(2),
      period: mes(p.date),
    });
    if (p.rejectedAt) {
      eventos.push({
        personId: p.createdBy,
        kind: "anulado",
        amount: credito.negated().toFixed(2),
        period: mesNegocio(p.rejectedAt),
      });
    } else {
      porCobrador.set(
        p.createdBy,
        (porCobrador.get(p.createdBy) ?? d(0)).plus(credito),
      );
    }
  }

  // Reembolso (siempre en RD$): se reversa en proporción de pesos cobrados.
  if (e.refundAmount && e.refundDate && aceptadoDop.gt(0)) {
    const R = d(e.refundAmount as any);
    const factor = R.gte(aceptadoDop) ? d(1) : R.div(aceptadoDop);
    for (const [personId, credito] of porCobrador) {
      const quitado = credito.times(factor).toDecimalPlaces(2);
      if (quitado.lte(0)) continue;
      eventos.push({
        personId,
        kind: "reembolso",
        amount: quitado.negated().toFixed(2),
        period: mes(e.refundDate),
      });
    }
  }
  return eventos;
}

/** Eventos del incentivo que caen en el mes `period` (AAAA-MM). */
export function gvIncentivosMes(
  e: Inscripcion,
  period?: string,
): EventoIncentivo[] {
  const todos = gvIncentivosEventos(e);
  return period ? todos.filter((x) => x.period === period) : todos;
}
