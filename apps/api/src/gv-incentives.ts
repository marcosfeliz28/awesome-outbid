// Incentivo por inscripción GV (orden 103, decisiones de la dueña vía N1).
// Lo gana quien registra la inscripción, según el curso del catálogo de Génesis
// (GV_CATALOGO en gv-money.ts). Se calcula al leer, no se guarda:
// incentivo del curso × porcentaje pagado (verificado, en la moneda del curso),
// devengado en el mes del pago. Un reembolso se resta a quien cobró cada pago.
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
  createdBy?: string;
};
type Inscripcion = {
  courseName: string;
  agreedPrice: unknown;
  refundAmount?: unknown;
  refundDate?: Date | null;
  payments: Pago[];
};
type Curso = (typeof GV_CATALOGO)[number];

const mes = (f: Date) => f.toISOString().slice(0, 7);
const mesAnterior = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

// Lo devengado hasta el final del mes M (redondeado a centavos). El devengo de
// un mes es la diferencia con el anterior: el total nunca pasa del 100 %.
// conReembolso=false da lo que se devengó por pagos, sin restar reembolsos.
function acumulado(
  curso: Curso,
  e: Inscripcion,
  M: string,
  conReembolso = true,
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
  if (conReembolso && e.refundAmount && e.refundDate && mes(e.refundDate) <= M)
    neto = neto.minus(d(e.refundAmount as any));
  if (neto.lte(0)) return d(0);
  const parte = neto.gte(precio) ? d(1) : neto.div(precio);
  return d(curso.incentivo).times(parte).toDecimalPlaces(2);
}

const cursoDe = (e: Inscripcion) => {
  const curso = GV_CATALOGO.find((c) => c.nombre === e.courseName);
  if (!curso || curso.incentivo === 0) return null;
  if (d(e.agreedPrice as any).lte(0)) return null;
  return curso;
};

/** Devengo de quien registró la inscripción en el mes `period`; sin reembolsos. */
export function gvDevengoMes(
  e: Inscripcion,
  period: string,
): { amount: string; period: string } | null {
  const curso = cursoDe(e);
  if (!curso) return null;
  const diff = acumulado(curso, e, period, false).minus(
    acumulado(curso, e, mesAnterior(period), false),
  );
  if (diff.isZero()) return null;
  return { amount: diff.toFixed(2), period };
}

/**
 * Reversa por reembolso en el mes `period`, a quien cobró cada pago (en
 * proporción a lo que cobró de lo verificado). Valores negativos.
 */
export function gvReembolsoMes(
  e: Inscripcion,
  period: string,
): { createdBy: string; amount: string }[] {
  const curso = cursoDe(e);
  if (!curso) return [];
  // Cuánto quitó el reembolso hasta cada mes (≥ 0).
  const quitado = (M: string) =>
    acumulado(curso, e, M, false).minus(acumulado(curso, e, M, true));
  const delta = quitado(period).minus(quitado(mesAnterior(period)));
  if (delta.lte(0)) return [];
  // Reparto entre cobradores según lo verificado que cobró cada uno.
  const cobrado = new Map<string, ReturnType<typeof d>>();
  for (const p of e.payments) {
    if (!p.verified || p.rejectedAt) continue;
    const valor = valorEnMoneda(p as any, curso.moneda);
    if (!valor || !p.createdBy) continue;
    cobrado.set(p.createdBy, (cobrado.get(p.createdBy) ?? d(0)).plus(valor));
  }
  const total = [...cobrado.values()].reduce((s, v) => s.plus(v), d(0));
  if (total.lte(0)) return [];
  const out: { createdBy: string; amount: string }[] = [];
  let resto = delta.negated();
  const entradas = [...cobrado.entries()];
  entradas.forEach(([createdBy, valor], i) => {
    // El último absorbe el redondeo para que la suma sea exacta.
    const monto =
      i === entradas.length - 1
        ? resto
        : delta.negated().times(valor).div(total).toDecimalPlaces(2);
    resto = resto.minus(monto);
    out.push({ createdBy, amount: monto.toFixed(2) });
  });
  return out;
}
