// Impresos de la impresora térmica (80 mm o 58 mm): cuadre de caja, los dos
// reportes de usuario y la factura, con el formato de
// docs/tienda/CUADRE_REPORTES_FACTURA.md. Se dibujan fuera de #root y sólo se
// ven al imprimir.
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

const TZ = "America/Santo_Domingo";
// Números como en el impreso: 1,234.50 (sin RD$).
export const num = (value: unknown) =>
  Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const rd = (value: unknown) => "RD$ " + num(value);
export const when = (value: unknown) =>
  value
    ? new Date(value as string).toLocaleString("es-DO", {
        timeZone: TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const day = (value: unknown) =>
  value
    ? new Date(value as string).toLocaleDateString("es-DO", { timeZone: TZ })
    : "—";

// Imprime cuando React ya dibujó el impreso.
export const printSoon = () =>
  setTimeout(() => window.print(), 50) as unknown as void;

export function PrintSheet({
  width,
  children,
}: {
  width?: string | number;
  children: ReactNode;
}) {
  const w = String(width ?? "80") === "58" ? "w58" : "w80";
  return createPortal(
    <div className={"thermal-print " + w}>{children}</div>,
    document.body,
  );
}

// Fila «texto … importe»; el espacio entre los dos queda en el texto.
export function Row({
  label,
  value,
  strong,
}: {
  label: ReactNode;
  value?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={"tp-row" + (strong ? " tp-strong" : "")}>
      <span>{label}</span> <span>{value ?? ""}</span>
    </div>
  );
}

export function BusinessHeader({
  business,
  title,
}: {
  business: any;
  title?: string;
}) {
  const b = business ?? {};
  const phones = [b.phone, b.phone2].filter(Boolean);
  return (
    <header className="tp-header">
      {b.logo && <img className="tp-logo" src={b.logo} alt="" />}
      <h2>Grupo Macgen</h2>
      <p className="tp-branch">Plaza Lope de Vega</p>
      {b.address && <p>{b.address}</p>}
      {b.legalId && <p>RNC: {b.legalId}</p>}
      {!!phones.length && <p>Tel.: {phones.join(" · WhatsApp: ")}</p>}
      {title && <h3>{title}</h3>}
    </header>
  );
}

const COUNT_KEYS = new Set(["tickets", "voidedTickets"]);
/** 1. Cuadre de caja, en el orden del impreso de la tienda. */
export function CuadrePrint({ c }: { c: any }) {
  const eur = !!c.foreign?.eur?.rate;
  const lines = (c.lines ?? []).filter(
    (l: any) => eur || !["eur", "differenceEur"].includes(l.key),
  );
  return (
    <>
      <BusinessHeader business={c.business} title={c.title} />
      <Row label="Fecha inicial" value={when(c.openedAt)} />
      <Row label="Fecha final" value={when(c.closedAt)} />
      <Row label="No. Caja" value={c.register?.number ?? "—"} />
      <Row label="Caja" value={c.register?.name ?? "—"} />
      <Row label="Cajero" value={c.cashier?.name ?? "—"} />
      <h4>Detalles de monedas</h4>
      <div className="tp-row tp-head">
        <span>Moneda × Cantidad</span> <span>= Total</span>
      </div>
      {(c.denominations ?? []).map((m: any) => (
        <Row
          key={m.value}
          label={`${m.value} × ${m.qty}`}
          value={"= " + num(m.total)}
        />
      ))}
      <p className="tp-line">{"Sub-total " + num(c.denominationsSubtotal)}</p>
      <h4>Descripción / Totales</h4>
      {lines.map((l: any) => (
        <div key={l.key}>
          <Row
            label={`${l.line}-${l.label}`}
            value={
              l.value === null || l.value === undefined
                ? ""
                : COUNT_KEYS.has(l.key)
                  ? String(l.value)
                  : num(l.value)
            }
          />
          {l.key === "receipts" && (
            <div className="tp-sub">
              <Row label="Efectivo" value={num(c.receipts?.cash)} />
              <Row label="Tarjeta" value={num(c.receipts?.card)} />
              <Row label="Transferencia" value={num(c.receipts?.transfer)} />
              {!!c.receiptsNote && <p>{c.receiptsNote}</p>}
            </div>
          )}
        </div>
      ))}
      {Number(c.cod?.sold) > 0 || Number(c.cod?.collected?.total) > 0 ? (
        <>
          <h4>Créditos / contraentregas</h4>
          <Row label="Vendidas" value={num(c.cod?.sold)} />
          <Row label="Cobradas efectivo" value={num(c.cod?.collected?.cash)} />
          <Row
            label="Cobradas transferencia"
            value={num(c.cod?.collected?.transfer)}
          />
          {Number(c.cod?.collected?.pendingVerification) > 0 && (
            <Row
              label="Por verificar"
              value={num(c.cod?.collected?.pendingVerification)}
            />
          )}
        </>
      ) : null}
      <h4>Resumen</h4>
      <p>{c.summary?.formula}</p>
      <p className="tp-strong">{c.summary?.text}</p>
      <Row label="Efectivo" value={num(c.denominationsSubtotal)} />
      <Row label="Entregado" value={num(c.delivered?.delivered ?? 0)} />
      <Row
        label="Dejado en caja"
        value={num(c.delivered?.left ?? c.denominationsSubtotal)}
      />
      {c.notes && <p>Notas: {c.notes}</p>}
      <div className="tp-signatures">
        <p>______________________</p>
        <p>Firma cajera</p>
        <p>______________________</p>
        <p>Firma de quien recibe</p>
      </div>
      <p className="tp-center tp-strong">{c.footer || "FIN DEL CUADRE"}</p>
    </>
  );
}

function ReportHeading({ r }: { r: any }) {
  return (
    <>
      <BusinessHeader business={r.business} title={r.title} />
      <Row label="Desde" value={when(r.from)} />
      <Row label="Hasta" value={when(r.to)} />
      <Row label="Impreso" value={when(r.printedAt)} />
      <Row
        label="Usuario"
        value={r.user ? `${r.user.number ?? "—"} · ${r.user.name}` : "Todos"}
      />
      <Row
        label="No. Caja"
        value={
          r.register
            ? `${r.register.number ?? "—"} · ${r.register.name ?? ""}`
            : "Todas"
        }
      />
    </>
  );
}

/** 2. Reporte de la venta diaria de usuario (por producto). */
export function DailyUserReportPrint({ r }: { r: any }) {
  const rows = (r.rows ?? []).filter((x: any) => x.Descripción !== "TOTAL");
  return (
    <>
      <ReportHeading r={{ ...r, title: r.title }} />
      <div className="tp-table tp-daily">
        <div className="tp-th">
          <span>DESCRIPCIÓN</span> <span>CANT</span> <span>ITBIS</span>{" "}
          <span>DESC</span> <span>PRECIO</span>
        </div>
        {rows.map((x: any, i: number) => (
          <div key={i}>
            <span className="tp-desc">{x.Descripción}</span>{" "}
            <span>{x.Cant}</span> <span>{num(x.ITBIS)}</span>{" "}
            <span>{num(x.Desc)}</span> <span>{num(x.Precio)}</span>
          </div>
        ))}
        <div className="tp-th">
          <span>TOTALES</span> <span>{r.totals?.Cant ?? 0}</span>{" "}
          <span>{num(r.totals?.ITBIS)}</span> <span>{num(r.totals?.Desc)}</span>{" "}
          <span>{num(r.totals?.Precio)}</span>
        </div>
      </div>
      <p>{r.note}</p>
      <p className="tp-center">FIN DEL REPORTE</p>
    </>
  );
}

/** 3. Reporte de venta usuario, agrupado por forma de pago. */
export function PaymentMethodReportPrint({ r }: { r: any }) {
  return (
    <>
      <ReportHeading r={r} />
      <div className="tp-table tp-method">
        <div className="tp-th">
          <span>COD.</span> <span>DESCRIPCIÓN</span> <span>CANT.</span>{" "}
          <span>T.VENTA</span>
        </div>
        {(r.groups ?? []).map((g: any) => (
          <div key={g.method} className="tp-group">
            <p className="tp-strong">{g.label}</p>
            {g.rows.map((x: any, i: number) => (
              <div key={i}>
                <span>{x.number}</span>{" "}
                <span>
                  {x.description}
                  {x.status ? " (" + x.status + ")" : ""}
                </span>{" "}
                <span>{x.units}</span> <span>{num(x.amount)}</span>
              </div>
            ))}
            <div className="tp-th">
              <span />
              <span>Sub-Total por Pago</span> <span>{g.subtotal?.units}</span>{" "}
              <span>{num(g.subtotal?.amount)}</span>
            </div>
          </div>
        ))}
        <div className="tp-th">
          <span>{r.byInvoice?.invoices ?? 0}</span>
          <span>Sub-Total por Fact.</span>{" "}
          <span>{r.byInvoice?.units ?? 0}</span>{" "}
          <span>{num(r.byInvoice?.amount)}</span>
        </div>
      </div>
      <Row label="TOTAL" value={num(r.total)} strong />
      <p>{r.note}</p>
      <p className="tp-center">FIN DEL REPORTE</p>
    </>
  );
}

export const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit_note: "Nota de crédito",
  credit: "Crédito / contraentrega",
  cod: "Crédito / contraentrega",
};

/** 4. Factura (ticket de venta). */
export function InvoicePrint({
  sale,
  config,
  customer,
}: {
  sale: any;
  config: any;
  customer?: any;
}) {
  const lines = sale.snapshot ?? [];
  const gross = lines.reduce(
    (a: number, i: any) => a + Number(i.qty) * Number(i.unitPrice),
    0,
  );
  const discount = lines.reduce(
    (a: number, i: any) => a + Number(i.discount ?? 0),
    0,
  );
  const units = lines.reduce((a: number, i: any) => a + Number(i.qty), 0);
  // Lo que entregó el cliente (antes del cambio), como lo anotó la cajera.
  const payments = sale.tendered ?? sale.payments ?? [];
  return (
    <>
      <BusinessHeader business={config} />
      <Row label="NCF:" value={sale.ncf ?? ""} />
      <h3 className="tp-center">FACTURA</h3>
      <Row label="Secuencia No." value={sale.number} />
      <Row label="Fecha" value={when(sale.createdAt ?? new Date())} />
      <Row label="Cajero" value={sale.cashierName ?? ""} />
      <p>
        Vendido a: {customer?.name ?? "Consumidor final"}
        {customer?.legalId ? " · RNC " + customer.legalId : ""}
        {customer?.phone ? " · Tel. " + customer.phone : ""}
        {customer?.address ? " · " + customer.address : ""}
      </p>
      <hr />
      {lines.map((i: any, n: number) => (
        <div key={n} className="tp-item">
          <small>Cod. {i.sku}</small>
          <p>{i.name}</p>
          <Row
            label={`${i.qty} X ${rd(i.unitPrice)}`}
            value={rd(Number(i.qty) * Number(i.unitPrice))}
          />
          {Number(i.discount) > 0 && (
            <Row label="Descuento" value={"−" + rd(i.discount)} />
          )}
        </div>
      ))}
      <hr />
      <Row label="Sub-Total" value={rd(gross)} />
      <Row label="Descuento" value={"−" + rd(discount)} />
      {discount > 0 && (
        <p>
          Motivo: {sale.discountReason ?? "Sin motivo"}
          {sale.discountApprovedName
            ? ` · Autorizó: ${sale.discountApprovedName}${sale.discountApprovedRole ? ` (${sale.discountApprovedRole})` : ""}`
            : ""}
        </p>
      )}
      <Row label="ITBIS" value={rd(sale.taxTotal)} />
      <Row label="Total a pagar" value={rd(sale.total)} strong />
      <hr />
      {payments.map((p: any, n: number) => (
        <Row
          key={n}
          label={METHOD_LABEL[p.method] ?? p.method}
          value={rd(p.tendered ?? p.amount)}
        />
      ))}
      <Row label="Cambio" value={rd(sale.change ?? 0)} />
      {Number(sale.creditBalance) > 0 && (
        <Row label="Pendiente" value={rd(sale.creditBalance)} />
      )}
      {sale.ncfType && (
        <p>Solicitud NCF {sale.ncfType} · pendiente de emisión fiscal</p>
      )}
      {sale.offline && <p>RECIBO PROVISIONAL · PENDIENTE DE SINCRONIZAR</p>}
      <hr />
      <Row label="Cantidad de Productos" value={units} strong />
      <p className="tp-center">¡Gracias por su compra!</p>
    </>
  );
}
