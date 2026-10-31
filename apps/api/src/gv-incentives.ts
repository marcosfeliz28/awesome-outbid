// Incentivo por inscripción GV (orden 103, decisiones de la dueña vía N1).
// Lo gana quien registra la inscripción, según el curso del catálogo de Génesis
// (GV_CATALOGO en gv-money.ts). Se calcula al leer, no se guarda:
// incentivo del curso × porcentaje pagado (verificado, en la moneda del curso),
// devengado en el mes del pago. Un reembolso resta su parte en su mes.
import { d } from "@fitstore/shared";
import { GV_CATALOGO, valorEnMoneda } from "./gv-money";

export { GV_CATALOGO } from "./gv-money";

type Pago = {
  amount: unknown;
  date: Date;
  verified: boolean;
  rejectedAt?: Date | null;
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

const mes = (f: Date) => f.toISOString().slice(0, 7);
const mesAnterior = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

// Lo que va devengado hasta el final del mes M (redondeado a centavos). El
// devengo de un mes es la diferencia con el anterior: el total nunca pasa del
// 100 % ni queda por debajo de lo pagado neto.
function acumulado(
  curso: (typeof GV_CATALOGO)[number],
  e: Inscripcion,
  M: string,
) {
  const precio = d(e.agreedPrice as any);
  let neto = d(0);
  for (const p of e.payments) {
    if (!p.verified || mes(p.date) > M) continue;
    if (p.rejectedAt && mes(p.rejectedAt) <= M) continue;
    // DUDA: un pago que no se puede convertir a la moneda del curso no devenga.
    const valor = valorEnMoneda(p as any, curso.moneda);
    if (valor) neto = neto.plus(valor);
  }
  if (e.refundAmount && e.refundDate && mes(e.refundDate) <= M)
    neto = neto.minus(d(e.refundAmount as any));
  if (neto.lte(0)) return d(0);
  const parte = neto.gte(precio) ? d(1) : neto.div(precio);
  return d(curso.incentivo).times(parte).toDecimalPlaces(2);
}

/** Devengo de la inscripción en el mes `period` (AAAA-MM); puede ser negativo. */
export function gvDevengoMes(
  e: Inscripcion,
  period: string,
): { amount: string; period: string } | null {
  const curso = GV_CATALOGO.find((c) => c.nombre === e.courseName);
  if (!curso || curso.incentivo === 0) return null;
  if (d(e.agreedPrice as any).lte(0)) return null;
  const diff = acumulado(curso, e, period).minus(
    acumulado(curso, e, mesAnterior(period)),
  );
  if (diff.isZero()) return null;
  return { amount: diff.toFixed(2), period };
}
