// Incentivo fijo por inscripción GV (orden 103). Se calcula al leer, no se
// guarda: si un pago verificado se anula, el devengo desaparece solo.
// Devengo (propuesta de N2, NO confirmada por la dueña): sólo con la inscripción
// pagada completa con pagos verificados; el mes es el del pago que la completó.
import { d } from "@fitstore/shared";
import { GV_CLOSED } from "./gv-money";

// Monto fijo en RD$ por alumna, sin importar la moneda del precio del curso.
// shortcut: tarifas en código, no en base; cambiarlas exige un despliegue.
// DUDA: asignación por curso según la lectura de N1 del catálogo de Génesis
// (cursos 3–7 automaquillaje; 9 y 10 perfeccionamiento; 1 y 2 maquilladora).
// DUDA: «personalizado» es también el nombre de cursos de automaquillaje
// (4, 5, 7); y la maquilladora (1 y 2) aún no tiene tipo: hoy registrada como
// «personalizado» cobraría RD$ 500 en vez de RD$ 1,000.
// Brazilian touch (curso 8) NO da incentivo: tipo `brazilian`, sin tarifa.
export const GV_INCENTIVO_POR_TIPO: Record<string, number> = {
  automaquillaje: 50,
  personalizado: 500,
  maquilladora_profesional: 1000,
};

type PagoGv = {
  amount: unknown;
  date: Date;
  verified: boolean;
  rejectedAt?: Date | string | null;
};

export function gvIncentiveFor(input: {
  courseType: string;
  status: string;
  agreedPrice: unknown;
  payments: PagoGv[];
}): { amount: string; period: string } | null {
  const rate = GV_INCENTIVO_POR_TIPO[input.courseType];
  if (rate === undefined || GV_CLOSED.has(input.status)) return null;
  const total = d(input.agreedPrice as any);
  const verified = input.payments
    .filter((p) => p.verified && !p.rejectedAt)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  let acumulado = d(0);
  for (const p of verified) {
    acumulado = acumulado.plus(d(p.amount as any));
    if (acumulado.gte(total))
      return {
        amount: rate.toFixed(2),
        period: p.date.toISOString().slice(0, 7),
      };
  }
  return null;
}
