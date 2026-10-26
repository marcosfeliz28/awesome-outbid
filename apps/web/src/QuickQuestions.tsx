import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Button, Modal } from "@fitstore/ui";
import { CASHIER_SURVEY, can, formatMoney, isService } from "@fitstore/shared";
import { api, post, useStore, type Product } from "./api";
import { QueryState, toast } from "./helpers";
import { MyIncentives } from "./Incentives";
import { PRODUCT_MODE } from "./productTenancy";

type MySalesBlind = {
  day: string;
  from: string;
  invoices: number;
  units: number;
  hiddenUntilClose: true;
  topProduct: { name: string; units: number } | null;
};
type MySales = Omit<MySalesBlind, "units" | "hiddenUntilClose"> & {
  total: number;
  methods: Record<
    "cash" | "card" | "transfer" | "credit" | "credit_note",
    number
  >;
  hiddenUntilClose: false;
  pendingTransfers: { count: number; amount: number };
  lastSale: { number: string; total: number; createdAt: string } | null;
};
type Ctx = { products: Product[]; session: any | null };
type Question = {
  id: string;
  text: string;
  group: string;
  answer: (ctx: Ctx) => ReactNode;
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);
const HIDDEN = "Se ve al cerrar tu caja (cierre ciego).";

/** Ventas propias del período: el servidor ya filtra por la persona. */
function Sales({
  period,
  show,
  blind = () => <p>{HIDDEN}</p>,
}: {
  period: "today" | "week";
  show: (r: MySales) => ReactNode;
  /** Con caja propia abierta el servidor no manda importes: solo conteos. */
  blind?: (r: MySalesBlind) => ReactNode;
}) {
  const query = useQuery({
    queryKey: ["sales-mine", period],
    queryFn: () => api<MySales>("/sales/mine/" + period),
    staleTime: 0,
  });
  return (
    <QueryState query={query}>
      {query.data && (
        <div className="cart-summary">
          {query.data.hiddenUntilClose
            ? blind(query.data)
            : show(query.data)}
        </div>
      )}
    </QueryState>
  );
}
const topBlind = (none: string) => (r: MySalesBlind) =>
  r.topProduct ? (
    <Row label={r.topProduct.name} value={r.topProduct.units + " unidades"} />
  ) : (
    <p>{none}</p>
  );
const method =
  (key: keyof MySales["methods"], label: string) => (r: MySales) => (
    <Row label={label + " (hoy)"} value={formatMoney(r.methods[key])} />
  );

function Fetch<T>({
  path,
  show,
}: {
  path: string;
  show: (data: T) => ReactNode;
}) {
  const query = useQuery({
    queryKey: ["quick", path],
    queryFn: () => api<T>(path),
    staleTime: 0,
  });
  return (
    <QueryState query={query}>
      {query.data !== undefined && (
        <div className="cart-summary">{show(query.data)}</div>
      )}
    </QueryState>
  );
}

function ProductLookup({ products }: { products: Product[] }) {
  const [q, setQ] = useState("");
  const words = q.trim().toLowerCase();
  const hits = words
    ? products
        .flatMap((p) => p.variants.map((v) => ({ p, v })))
        .filter(
          ({ p, v }) =>
            p.name.toLowerCase().includes(words) ||
            v.sku.toLowerCase() === words ||
            v.barcode === q.trim(),
        )
        .slice(0, 8)
    : [];
  return (
    <div className="cart-summary">
      <input
        aria-label="Producto a consultar"
        placeholder="Nombre o código"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {hits.map(({ p, v }) => (
        <Row
          key={v.id}
          label={
            p.name +
            (Object.values(v.attributes ?? {}).length
              ? " · " + Object.values(v.attributes).join(" ")
              : "")
          }
          value={
            formatMoney(v.price) +
            (isService(p) ? "" : " · " + Number(v.stock) + " en existencia")
          }
        />
      ))}
      {words && !hits.length && <p>No encontré ese producto.</p>}
    </div>
  );
}

const stockList = (
  products: Product[],
  test: (stock: number, p: Product) => boolean,
) => {
  const list = products
    .filter((p) => !isService(p))
    .flatMap((p) => p.variants.map((v) => ({ p, v })))
    .filter(({ p, v }) => test(Number(v.stock), p));
  return (
    <div className="cart-summary">
      {list.length ? (
        list
          .slice(0, 30)
          .map(({ p, v }) => (
            <Row
              key={v.id}
              label={p.name + " · " + v.sku}
              value={Number(v.stock)}
            />
          ))
      ) : (
        <p>Ninguno.</p>
      )}
      {list.length > 30 && <p>Y {list.length - 30} más.</p>}
    </div>
  );
};

const help = (text: string) => () => (
  <div className="cart-summary">
    <p>{text}</p>
  </div>
);

// 30 preguntas de un toque, sin IA: cada respuesta sale de datos que la
// persona ya puede ver. Nunca costos ni el esperado de una caja abierta.
export const QUICK_QUESTIONS: Question[] = [
  {
    id: "hoy",
    group: "Mis ventas",
    text: "¿Cuánto vendí hoy?",
    answer: () => (
      <Sales
        period="today"
        show={(r) => (
          <>
            <Row label="Facturas" value={r.invoices} />
            <Row label="Efectivo" value={formatMoney(r.methods.cash)} />
            <Row label="Tarjeta" value={formatMoney(r.methods.card)} />
            <Row
              label="Transferencia"
              value={formatMoney(r.methods.transfer)}
            />
            <Row label="Crédito" value={formatMoney(r.methods.credit)} />
            <div className="cart-total">
              <span>Total vendido hoy</span>
              <strong>{formatMoney(r.total)}</strong>
            </div>
          </>
        )}
        blind={(r) => (
          <>
            <Row label="Facturas" value={r.invoices} />
            <Row label="Unidades" value={r.units} />
            <p>Los importes: {HIDDEN}</p>
          </>
        )}
      />
    ),
  },
  {
    id: "semana",
    group: "Mis ventas",
    text: "¿Cuánto vendí esta semana?",
    answer: () => (
      <Sales
        period="week"
        show={(r) => (
          <>
            <Row
              label={`Desde el lunes ${r.from}`}
              value={r.invoices + " facturas"}
            />
            <div className="cart-total">
              <span>Total de la semana</span>
              <strong>{formatMoney(r.total)}</strong>
            </div>
          </>
        )}
        blind={(r) => (
          <>
            <Row
              label={`Desde el lunes ${r.from}`}
              value={r.invoices + " facturas"}
            />
            <p>El total: {HIDDEN}</p>
          </>
        )}
      />
    ),
  },
  {
    id: "facturas",
    group: "Mis ventas",
    text: "¿Cuántas facturas llevo hoy?",
    answer: () => (
      <Sales
        period="today"
        show={(r) => <Row label="Facturas de hoy" value={r.invoices} />}
        blind={(r) => <Row label="Facturas de hoy" value={r.invoices} />}
      />
    ),
  },
  {
    id: "promedio",
    group: "Mis ventas",
    text: "¿Cuál es mi venta promedio hoy?",
    answer: () => (
      <Sales
        period="today"
        show={(r) => (
          <Row
            label="Promedio por factura"
            value={formatMoney(r.invoices ? r.total / r.invoices : 0)}
          />
        )}
      />
    ),
  },
  {
    id: "efectivo",
    group: "Mis ventas",
    text: "¿Cuánto llevo en efectivo?",
    answer: () => <Sales period="today" show={method("cash", "Efectivo")} />,
  },
  {
    id: "tarjeta",
    group: "Mis ventas",
    text: "¿Cuánto llevo en tarjeta?",
    answer: () => <Sales period="today" show={method("card", "Tarjeta")} />,
  },
  {
    id: "transferencia",
    group: "Mis ventas",
    text: "¿Cuánto llevo en transferencia?",
    answer: () => (
      <Sales period="today" show={method("transfer", "Transferencia")} />
    ),
  },
  {
    id: "credito",
    group: "Mis ventas",
    text: "¿Cuánto vendí a crédito hoy?",
    answer: () => <Sales period="today" show={method("credit", "Crédito")} />,
  },
  {
    id: "sin-verificar",
    group: "Mis ventas",
    text: "¿Tengo transferencias sin verificar?",
    answer: () => (
      <Sales
        period="today"
        show={(r) => (
          <Row
            label="Sin verificar (hoy)"
            value={
              r.pendingTransfers.count +
              " · " +
              formatMoney(r.pendingTransfers.amount)
            }
          />
        )}
      />
    ),
  },
  {
    id: "ultima",
    group: "Mis ventas",
    text: "¿Cuál fue mi última venta?",
    answer: () => (
      <Sales
        period="today"
        show={(r) =>
          r.lastSale ? (
            <Row
              label={`${r.lastSale.number} · ${new Date(r.lastSale.createdAt).toLocaleTimeString("es-DO", { timeZone: "America/Santo_Domingo", hour: "numeric", minute: "2-digit" })}`}
              value={formatMoney(r.lastSale.total)}
            />
          ) : (
            <p>Hoy todavía no tienes ventas.</p>
          )
        }
      />
    ),
  },
  {
    id: "top-hoy",
    group: "Mis ventas",
    text: "¿Qué producto vendí más hoy?",
    answer: () => (
      <Sales
        period="today"
        show={(r) =>
          r.topProduct ? (
            <Row
              label={r.topProduct.name}
              value={r.topProduct.units + " unidades"}
            />
          ) : (
            <p>Hoy todavía no tienes ventas.</p>
          )
        }
        blind={topBlind("Hoy todavía no tienes ventas.")}
      />
    ),
  },
  {
    id: "top-semana",
    group: "Mis ventas",
    text: "¿Qué producto vendí más esta semana?",
    answer: () => (
      <Sales
        period="week"
        show={(r) =>
          r.topProduct ? (
            <Row
              label={r.topProduct.name}
              value={r.topProduct.units + " unidades"}
            />
          ) : (
            <p>Esta semana todavía no tienes ventas.</p>
          )
        }
        blind={topBlind("Esta semana todavía no tienes ventas.")}
      />
    ),
  },
  {
    id: "fondo",
    group: "Mi caja",
    text: "¿Con qué fondo abrí mi caja?",
    answer: ({ session }) => (
      <div className="cart-summary">
        {session ? (
          <Row
            label="Fondo de apertura"
            value={formatMoney(session.openingAmount)}
          />
        ) : (
          <p>No tienes una caja abierta.</p>
        )}
      </div>
    ),
  },
  {
    id: "abierta",
    group: "Mi caja",
    text: "¿Desde qué hora está abierta mi caja?",
    answer: ({ session }) => (
      <div className="cart-summary">
        {session ? (
          <Row
            label="Abierta desde"
            value={new Date(session.openedAt).toLocaleString("es-DO", {
              timeZone: "America/Santo_Domingo",
              dateStyle: "short",
              timeStyle: "short",
            })}
          />
        ) : (
          <p>No tienes una caja abierta.</p>
        )}
      </div>
    ),
  },
  {
    id: "espera",
    group: "Pendientes",
    text: "¿Cuántas ventas tengo en espera?",
    answer: () => (
      <Fetch<any[]>
        path="/quotes"
        show={(rows) => (
          <Row
            label="En espera"
            value={rows.filter((q) => q.type === "held").length}
          />
        )}
      />
    ),
  },
  {
    id: "cotizaciones",
    group: "Pendientes",
    text: "¿Cuántas cotizaciones tengo abiertas?",
    answer: () => (
      <Fetch<any[]>
        path="/quotes"
        show={(rows) => (
          <Row
            label="Cotizaciones"
            value={rows.filter((q) => q.type === "quote").length}
          />
        )}
      />
    ),
  },
  {
    id: "anulaciones",
    group: "Pendientes",
    text: "¿Tengo anulaciones pendientes?",
    answer: () => (
      <Fetch<any[]>
        path="/void-requests?status=pending"
        show={(rows) =>
          rows.length ? (
            <>
              {rows.map((r) => (
                <Row
                  key={r.id}
                  label={r.sale.number}
                  value="Esperando a gerencia"
                />
              ))}
            </>
          ) : (
            <p>No tienes anulaciones pendientes.</p>
          )
        }
      />
    ),
  },
  {
    id: "incentivo",
    group: "Pendientes",
    text: "¿Cuál es mi incentivo del mes?",
    answer: () => (
      <>
        <MyIncentives />
        <p className="cart-summary">
          Si no aparece un cuadro, tu empresa no usa incentivos o no hay
          conexión.
        </p>
      </>
    ),
  },
  {
    id: "precio",
    group: "Productos",
    text: "¿Precio y existencia de un producto?",
    answer: ({ products }) => <ProductLookup products={products} />,
  },
  {
    id: "agotados",
    group: "Productos",
    text: "¿Qué productos están agotados?",
    answer: ({ products }) => stockList(products, (stock) => stock <= 0),
  },
  {
    id: "por-agotarse",
    group: "Productos",
    text: "¿Qué productos están por agotarse?",
    answer: ({ products }) =>
      stockList(
        products,
        (stock, p) => stock > 0 && stock <= Number(p.minStock || 0),
      ),
  },
  {
    id: "cuantos",
    group: "Productos",
    text: "¿Cuántos productos hay a la venta?",
    answer: ({ products }) => (
      <div className="cart-summary">
        <Row label="Productos" value={products.length} />
      </div>
    ),
  },
  {
    id: "cerrar",
    group: "Cómo se hace",
    text: "¿Cómo cierro la caja?",
    answer: help(
      "Ve a Caja y pulsa cerrar. Cuenta el efectivo sin ver el esperado y escríbelo, igual la tarjeta y la transferencia. Si hay diferencia, explica por qué; si te piden PIN, llama a gerencia. Imprime el cuadre.",
    ),
  },
  {
    id: "devolucion",
    group: "Cómo se hace",
    text: "¿Cómo hago una devolución?",
    answer: help(
      "La hace gerencia: en Ventas busca la factura y pulsa «Devolver», elige el artículo, el motivo y cómo se reembolsa. Si eres cajera, llama a gerencia. Para un error de cobro se pide una anulación.",
    ),
  },
  {
    id: "credito-como",
    group: "Cómo se hace",
    text: "¿Cómo vendo a crédito?",
    answer: help(
      "Elige el cliente (no sirve «Cliente de mostrador»). Al cobrar toca «Crédito». Si el sistema pide aprobación, llama a gerencia para su PIN. El crédito no es dinero cobrado.",
    ),
  },
  {
    id: "anular-como",
    group: "Cómo se hace",
    text: "¿Cómo pido una anulación?",
    answer: help(
      "En Ventas busca la factura y usa «Solicitud de anulación» con el motivo. Gerencia la revisa y la aprueba o la rechaza. No cambies la factura a mano.",
    ),
  },
  {
    id: "espera-como",
    group: "Cómo se hace",
    text: "¿Cómo pongo una venta en espera?",
    answer: help(
      "Con los artículos en el carrito pulsa «En espera» y guárdala. Para seguirla, pulsa otra vez «En espera» y elígela de la lista.",
    ),
  },
  {
    id: "transferencia-como",
    group: "Cómo se hace",
    text: "¿Cómo registro una transferencia?",
    answer: help(
      "Al cobrar toca «Transferencia», escribe el banco y la referencia. Queda «por verificar» hasta que gerencia confirme que el dinero llegó.",
    ),
  },
  {
    id: "mixto-como",
    group: "Cómo se hace",
    text: "¿Cómo cobro con dos formas de pago?",
    answer: help(
      "Elige la primera forma de pago, escribe su monto y pulsa «Agregar pago». Repite con la otra hasta cubrir el total y finaliza una sola vez.",
    ),
  },
  {
    id: "camara-como",
    group: "Cómo se hace",
    text: "¿Cómo escaneo con la cámara?",
    answer: help(
      "Arriba, junto a «En espera», toca el botón de la cámara y apunta al código de barras del producto.",
    ),
  },
];

/** Encuesta de la caja: una respuesta por persona; se puede editar. */
function Survey({ onDone }: { onDone: () => void }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["survey-mine"],
    queryFn: () =>
      api<{ answers: Record<string, unknown> | null }>("/survey/mine"),
  });
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data?.answers) setDraft(query.data.answers);
  }, [query.data]);
  const set = (id: string, value: unknown) =>
    setDraft({ ...draft, [id]: value });
  const save = async () => {
    setBusy(true);
    try {
      await post("/survey/mine", { answers: draft });
      await client.invalidateQueries({ queryKey: ["survey-mine"] });
      toast("¡Gracias! Tu respuesta quedó guardada.");
      onDone();
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <QueryState query={query}>
      {query.data?.answers && (
        <p>Ya respondiste. Puedes cambiar lo que quieras.</p>
      )}
      {CASHIER_SURVEY.map((q, i) => (
        <fieldset key={q.id} className="cart-summary">
          <legend>
            {i + 1}. {q.text}
          </legend>
          {q.kind === "text" ? (
            <textarea
              aria-label={q.text}
              maxLength={500}
              value={String(draft[q.id] ?? "")}
              onChange={(e) => set(q.id, e.target.value)}
            />
          ) : (
            <div className="heading-actions">
              {(q.kind === "yesno"
                ? [true, false]
                : q.kind === "scale"
                  ? [1, 2, 3, 4, 5]
                  : q.options!
              ).map((value) => (
                <Button
                  key={String(value)}
                  variant={draft[q.id] === value ? "primary" : "secondary"}
                  aria-pressed={draft[q.id] === value}
                  onClick={() => set(q.id, value)}
                >
                  {value === true
                    ? "Sí"
                    : value === false
                      ? "No"
                      : String(value)}
                </Button>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button disabled={busy} onClick={save}>
        Guardar respuestas
      </Button>
    </QueryState>
  );
}

export function QuickQuestions({
  products,
  session,
  onClose,
}: Ctx & { onClose: () => void }) {
  const user = useStore((s) => s.user)!;
  const [picked, setPicked] = useState<Question | "survey" | null>(null);
  const groups = [...new Set(QUICK_QUESTIONS.map((q) => q.group))];
  const sells = can(user.permissions, "sale:write");
  return (
    <Modal open onClose={onClose} title="Preguntas rápidas">
      {picked ? (
        <>
          <h3>{picked === "survey" ? "Encuesta de la caja" : picked.text}</h3>
          {picked === "survey" ? (
            <Survey onDone={() => setPicked(null)} />
          ) : (
            picked.answer({ products, session })
          )}
          <Button variant="secondary" onClick={() => setPicked(null)}>
            Otra pregunta
          </Button>
        </>
      ) : (
        <>
          <p>Un toque y listo: no usa la IA ni gasta preguntas.</p>
          {groups.map((group) => (
            <section key={group} aria-label={group}>
              <h3>{group}</h3>
              {QUICK_QUESTIONS.filter((q) => q.group === group).map((q) => (
                <button
                  key={q.id}
                  className="held-row"
                  onClick={() => setPicked(q)}
                >
                  <MessageCircleQuestion size={18} aria-hidden="true" />
                  <span>{q.text}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ))}
            </section>
          ))}
          {sells && (
            <button className="held-row" onClick={() => setPicked("survey")}>
              <MessageCircleQuestion size={18} aria-hidden="true" />
              <span>Encuesta de la caja (30 preguntas rápidas)</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
          {PRODUCT_MODE && (
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                // El asistente normal sí gasta una pregunta de la cuota.
                window.dispatchEvent(new Event("nexora:abrir-asistente"));
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              Preguntarle a la IA (gasta una pregunta)
            </Button>
          )}
        </>
      )}
    </Modal>
  );
}

/** Resumen de la encuesta para la administración (Configuración). */
export function CashierSurveySummary() {
  const query = useQuery({
    queryKey: ["survey-summary"],
    queryFn: () =>
      api<{
        responses: number;
        questions: {
          id: string;
          text: string;
          kind: string;
          answered: number;
          counts: Record<string, number>;
          average: number | null;
          texts: { name: string; text: string }[];
        }[];
      }>("/survey/summary"),
  });
  const label = (k: string) => (k === "true" ? "Sí" : k === "false" ? "No" : k);
  return (
    <section aria-labelledby="survey-summary-title">
      <div className="panel-heading">
        <h3 id="survey-summary-title">Encuesta de la caja</h3>
      </div>
      <QueryState query={query}>
        <p>{query.data?.responses ?? 0} personas respondieron.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PREGUNTA</th>
                <th>RESPUESTAS</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.questions.map((q) => (
                <tr key={q.id}>
                  <td>{q.text}</td>
                  <td>
                    {q.kind === "text"
                      ? q.texts.map((t, i) => (
                          <div key={i}>
                            {t.name}: {t.text}
                          </div>
                        ))
                      : (q.average !== null ? `Promedio ${q.average} · ` : "") +
                        Object.entries(q.counts)
                          .map(([k, n]) => `${label(k)}: ${n}`)
                          .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </section>
  );
}
