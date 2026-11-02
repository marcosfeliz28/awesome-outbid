import type { Columna, Formato, Modelo, Seccion } from "./export";
import type { Guia } from "./guia";

// Exportación de «Reportes de GV» (cursos y citas). Recibe el mismo objeto que
// devuelve la pantalla (GET /gv/reports), así las cifras son idénticas.

// shortcut: textos de GV verificados contra gv.ts y gv-money.ts; lo que no se
// pudo confirmar dice «por confirmar».
export const GUIA_GV: Guia = {
  queEs:
    "Cuánto entró por cursos y citas de GV: pagos verificados por día, método, banco y empleada; lo que falta por cobrar y cómo van los cupos de cada curso.",
  paraQueSirve:
    "Ver cuánto dinero se ha cobrado, a quién le falta pagar y cuántas clientas asistieron.",
  comoSeLee:
    "Los totales de ingresos solo cuentan pagos verificados y no rechazados. Lo que aún no se verifica aparece aparte. Neto = verificado menos reembolsos.",
  columnas: {
    Día: {
      nombreAmigable: "Día",
      significa: "Fecha en que se recibió el pago.",
    },
    Método: {
      nombreAmigable: "Forma de pago",
      significa: "Efectivo, tarjeta u otra forma con la que se pagó.",
    },
    Banco: {
      nombreAmigable: "Banco o cuenta",
      significa: "Cuenta donde entró el pago. «Sin banco» si no tiene.",
    },
    Empleada: {
      nombreAmigable: "Quien registró",
      significa:
        "Empleada que registró el pago. «Gerencia» si lo registró la gerencia.",
    },
    Total: {
      nombreAmigable: "Total verificado",
      significa:
        "Suma en pesos (RD$) de los pagos verificados y no rechazados.",
    },
    Pagos: {
      nombreAmigable: "Cantidad de pagos",
      significa: "Cuántos pagos forman el total.",
    },
    Curso: { nombreAmigable: "Curso", significa: "Nombre del curso." },
    Fecha: {
      nombreAmigable: "Fecha",
      significa: "Fecha del curso, o de la cita.",
    },
    Cupo: { nombreAmigable: "Cupo", significa: "Lugares que tiene el curso." },
    Inscritas: {
      nombreAmigable: "Inscritas",
      significa: "Clientas inscritas en el curso.",
    },
    Asistieron: {
      nombreAmigable: "Asistieron",
      significa: "Clientas marcadas como asistentes.",
    },
    "Sets de cepillos": {
      nombreAmigable: "Sets de cepillos",
      significa: "Sets de cepillos del curso. Por confirmar.",
    },
    Pagado: {
      nombreAmigable: "Pagado",
      significa: "Pagos verificados y no rechazados, en pesos (RD$).",
    },
    Pendiente: {
      nombreAmigable: "Pendiente",
      significa:
        "Precio acordado menos lo pagado y verificado; nunca baja de cero. Las canceladas y reembolsadas no tienen pendiente.",
    },
    "Sin verificar": {
      nombreAmigable: "Sin verificar",
      significa: "Pagos registrados que todavía no se verifican.",
    },
    Cliente: { nombreAmigable: "Clienta", significa: "Nombre de la clienta." },
    Tipo: {
      nombreAmigable: "Tipo",
      significa:
        "«curso» si es inscripción, «cita» si es una cita de servicio.",
    },
    "Curso o cita": {
      nombreAmigable: "Curso o cita",
      significa: "Nombre del curso, o el servicio de la cita.",
    },
  },
};

type Grupo = { key: string; total: string; count: number };
type Fila = Record<string, string | number | null>;
export type RepGv = {
  income: {
    total: string;
    unverified: string;
    refunds: string;
    net: string;
    byDay: Grupo[];
    byMethod: Grupo[];
    byBank: Grupo[];
    byEmployee: Grupo[];
  };
  courses: {
    name: string;
    date: unknown;
    capacity: number;
    enrolled: number;
    attended: number;
    brushSets: number;
    paid: unknown;
    pending: unknown;
    unverified: unknown;
  }[];
  pendingByClient: {
    clientName: string;
    kind: string;
    course: string;
    courseDate: string;
    paid: string;
    unverified: string;
    pending: string;
  }[];
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
};
const col = (clave: string, formato: Formato): Columna => ({
  clave,
  etiqueta: GUIA_GV.columnas[clave]?.nombreAmigable ?? clave,
  formato,
  significa: GUIA_GV.columnas[clave]?.significa,
});
const sumar = (filas: Fila[], clave: string) =>
  Math.round(filas.reduce((t, f) => t + Number(f[clave] ?? 0), 0) * 100) / 100;

function grupo(titulo: string, rotulo: string, grupos: Grupo[]): Seccion {
  const filas: Fila[] = grupos.map((g) => ({
    [rotulo]: g.key,
    Total: n(g.total),
    Pagos: g.count,
  }));
  const columnas = [
    col(rotulo, "texto"),
    col("Total", "moneda"),
    col("Pagos", "entero"),
  ];
  return {
    titulo,
    columnas,
    filas,
    totales: { Total: sumar(filas, "Total"), Pagos: sumar(filas, "Pagos") },
  };
}

// Mismo orden y mismas cifras que la pantalla de GV; sólo cambia la presentación.
export function modeloGv(
  rep: RepGv,
  meta: {
    negocio: string;
    desde: string;
    hasta: string;
    generadoPor: string;
    emitido: string;
  },
): Modelo {
  const i = rep.income;
  const dias = grupo("Ingresos por día", "Día", i.byDay);
  const secciones: Seccion[] = [
    dias,
    grupo("Por forma de pago", "Método", i.byMethod),
    grupo("Por banco o cuenta", "Banco", i.byBank),
    grupo("Por quien registró", "Empleada", i.byEmployee),
  ];
  const cursos: Fila[] = rep.courses.map((c) => ({
    Curso: c.name,
    Fecha: String(c.date ?? ""),
    Cupo: c.capacity,
    Inscritas: c.enrolled,
    Asistieron: c.attended,
    "Sets de cepillos": c.brushSets,
    Pagado: n(c.paid as number),
    Pendiente: n(c.pending as number),
    "Sin verificar": n(c.unverified as number),
  }));
  secciones.push({
    titulo: "Cursos",
    columnas: [
      col("Curso", "texto"),
      col("Fecha", "texto"),
      col("Cupo", "entero"),
      col("Inscritas", "entero"),
      col("Asistieron", "entero"),
      col("Sets de cepillos", "entero"),
      col("Pagado", "moneda"),
      col("Pendiente", "moneda"),
      col("Sin verificar", "moneda"),
    ],
    filas: cursos,
    totales: null,
  });
  const pendientes: Fila[] = rep.pendingByClient.map((p) => ({
    Cliente: p.clientName,
    Tipo: p.kind,
    "Curso o cita": p.course,
    Fecha: p.courseDate,
    Pagado: n(p.paid),
    Pendiente: n(p.pending),
  }));
  secciones.push({
    titulo: "Pendientes por clienta",
    columnas: [
      col("Cliente", "texto"),
      col("Tipo", "texto"),
      col("Curso o cita", "texto"),
      col("Fecha", "texto"),
      col("Pagado", "moneda"),
      col("Pendiente", "moneda"),
    ],
    filas: pendientes,
    totales: { Pendiente: sumar(pendientes, "Pendiente") },
  });
  const cifra = (etiqueta: string, valor: string) => ({
    etiqueta,
    valor: n(valor),
    formato: "moneda" as const,
  });
  return {
    nombre: "gv-reportes",
    titulo: "Reportes de GV: cursos y citas",
    negocio: meta.negocio,
    periodo: `Del ${meta.desde} al ${meta.hasta}`,
    emitido: meta.emitido,
    generadoPor: meta.generadoPor,
    queEs: GUIA_GV.queEs,
    paraQueSirve: GUIA_GV.paraQueSirve,
    comoSeLee: GUIA_GV.comoSeLee,
    cifras: [
      cifra("Total verificado", i.total),
      cifra("Sin verificar", i.unverified),
      cifra("Reembolsos", i.refunds),
      cifra("Neto", i.net),
    ],
    secciones,
    grafica:
      dias.filas.length >= 2
        ? {
            tipo: "barras",
            titulo: "Total verificado por día",
            etiqueta: "Día",
            valor: "Total",
            puntos: dias.filas.slice(0, 15).map((f) => ({
              nombre: String(f.Día),
              valor: Number(f.Total),
            })),
          }
        : null,
  };
}
