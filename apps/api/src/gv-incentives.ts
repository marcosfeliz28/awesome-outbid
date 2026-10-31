// Incentivo por inscripción GV (orden 103, decisiones de la dueña vía N1).
// Lo gana quien registra la inscripción, según el curso del catálogo de Génesis
// (docs/operacion/GV_CATALOGO_CURSOS.md). Se calcula al leer, no se guarda:
// incentivo del curso × porcentaje pagado en verificado, devengado en el mes
// del pago. Anular un pago o reembolsar resta su parte en ese mes.
import { d } from "@fitstore/shared";

export type CursoGv = {
  nombre: string;
  precio: number;
  moneda: "RD$" | "US$";
  // Monto fijo en RD$ por alumna, sin importar la moneda del precio.
  incentivo: number;
};

// DUDA: la asignación del incentivo por curso es lectura de N1 del catálogo.
// DUDA: «Maquilladora profesional» (1 y 2) y «Perfeccionamiento» (9 y 10) no
// tienen tipo propio en la base: el curso se empata por nombre exacto.
// shortcut: catálogo en código, no en base; cambiarlo exige un despliegue.
export const GV_CATALOGO: CursoGv[] = [
  {
    nombre: "Curso de maquilladora profesional personalizado",
    precio: 70000,
    moneda: "RD$",
    incentivo: 1000,
  },
  {
    nombre: "Curso maquilladora profesional personalizado",
    precio: 55000,
    moneda: "RD$",
    incentivo: 1000,
  },
  {
    nombre: "Curso de automaquillaje básico grupal",
    precio: 4500,
    moneda: "RD$",
    incentivo: 50,
  },
  {
    nombre: "Curso de automaquillaje básico personalizado",
    precio: 200,
    moneda: "US$",
    incentivo: 50,
  },
  {
    nombre: "Curso de automaquillaje básico personalizado avanzado",
    precio: 270,
    moneda: "US$",
    incentivo: 50,
  },
  {
    nombre: "Curso automaquillaje básico modalidad 2 clases",
    precio: 350,
    moneda: "US$",
    incentivo: 50,
  },
  {
    nombre: "Curso de automaquillaje básico personalizado 3 clases",
    precio: 450,
    moneda: "US$",
    incentivo: 50,
  },
  // Brazilian touch: lo lleva Yaisa aparte; quien registra no gana nada.
  {
    nombre: "Perfeccionamiento para maquilladores grupal Brazilian touch",
    precio: 18000,
    moneda: "RD$",
    incentivo: 0,
  },
  {
    nombre:
      "Perfeccionamiento para maquilladores VIP personalizado: piel blindada + ojos social con delineado o novias",
    precio: 18000,
    moneda: "RD$",
    incentivo: 500,
  },
  {
    nombre: "Perfeccionamiento para maquilladores: piel glow + ojos social",
    precio: 15000,
    moneda: "RD$",
    incentivo: 500,
  },
];

type Pago = {
  amount: unknown;
  date: Date;
  verified: boolean;
  rejectedAt?: Date | null;
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

// Lo que va devengado hasta el final del mes M (acumulado redondeado a
// centavos). El devengo de un mes es la diferencia con el mes anterior, así el
// total nunca pasa del 100 % ni queda por debajo de lo pagado neto.
function acumulado(curso: CursoGv, e: Inscripcion, M: string) {
  const precio = d(e.agreedPrice as any);
  let neto = d(0);
  for (const p of e.payments) {
    if (!p.verified || mes(p.date) > M) continue;
    if (p.rejectedAt && mes(p.rejectedAt) <= M) continue;
    neto = neto.plus(d(p.amount as any));
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
  // DUDA: los pagos no registran moneda; sin ella no se devenga en US$.
  if (curso.moneda !== "RD$") return null;
  if (d(e.agreedPrice as any).lte(0)) return null;
  const diff = acumulado(curso, e, period).minus(
    acumulado(curso, e, mesAnterior(period)),
  );
  if (diff.isZero()) return null;
  return { amount: diff.toFixed(2), period };
}
