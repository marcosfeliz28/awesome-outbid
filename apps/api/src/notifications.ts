// Avisos de facturas por Telegram.
//
// La dueña recibe en un grupo privado cada factura (efectivo, tarjeta,
// transferencia, crédito, contraentrega), cada anulación, devolución, cobro de
// contraentrega o abono y cada cierre de caja. Se activa sólo con las
// variables TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID; sin ellas no se guarda ni
// se envía nada.
//
// Diseño: la venta nunca espera a Telegram. Después del commit se renderiza el
// texto (sin cédula/RNC, teléfono, correo ni dirección: Ley 172-13) y se guarda
// en la cola durable NotificationOutbox, idempotente por (eventType, refId). Un
// trabajador lo envía en segundo plano, con candado entre instancias (FOR
// UPDATE SKIP LOCKED), reintentos con espera creciente, respeto de los 429 y
// un mensaje por segundo como máximo. El token nunca se guarda ni se registra.
import {
  Controller,
  Get,
  Inject,
  Injectable,
  Post,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { formatMoney } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit } from "./common";
import { saleIncentive } from "./incentives";

// ---------------------------------------------------------------------------
// Configuración

export type TelegramSettings = {
  enabled: boolean;
  token: string;
  chatId: string;
  apiBase: string;
};

export function telegramSettings(
  env: NodeJS.ProcessEnv = process.env,
): TelegramSettings {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? "";
  // TELEGRAM_API_BASE existe sólo para las pruebas (servidor falso local).
  const apiBase = (
    env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org"
  ).replace(/\/+$/, "");
  return { enabled: !!token && !!chatId, token, chatId, apiBase };
}

/** Intervalo del trabajador. */
export const POLL_MS = 5000;
/** Separación mínima entre mensajes (~1 por segundo). */
export const SEND_SPACING_MS = 1000;
/** Tiempo de espera de cada petición a Telegram. */
export const REQUEST_TIMEOUT_MS = 8000;
/** Intentos antes de marcar el aviso como fallido. */
export const MAX_ATTEMPTS = 12;
/** Mientras un trabajador envía un aviso, nadie más lo toma. */
const LEASE_SECONDS = 120;
/** Los avisos enviados se purgan a los 30 días. */
const PURGE_DAYS = 30;
const BACKOFF_SECONDS = [30, 60, 120, 300, 900, 1800, 3600];

/** Espera antes del siguiente intento tras `attempts` intentos fallidos. */
export const backoffSeconds = (attempts: number) =>
  BACKOFF_SECONDS[Math.min(Math.max(attempts, 1), BACKOFF_SECONDS.length) - 1]!;

/** Quita el token, URLs y credenciales de un mensaje de error. */
export function sanitizeError(
  message: unknown,
  token = telegramSettings().token,
): string {
  let text = String(message ?? "");
  if (token) text = text.split(token).join("***");
  return text
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***")
    .replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g, "***")
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// ---------------------------------------------------------------------------
// Renderizado (funciones puras)

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Texto libre (nombres, motivos): oculta correos y secuencias de 7 dígitos o
 * más (cédula, RNC, teléfono) que alguien haya escrito ahí, recorta y escapa.
 */
export function cleanText(value: unknown, max = 60) {
  const text = String(value ?? "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[oculto]")
    .replace(/\+?\d(?:[\s.-]?\d){6,}/g, "[oculto]")
    .replace(/\s+/g, " ")
    .trim();
  return escapeHtml(text.length > max ? text.slice(0, max - 1) + "…" : text);
}

const dateFormat = new Intl.DateTimeFormat("es-DO", {
  timeZone: "America/Santo_Domingo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
// Espacios normales: ICU separa «p. m.» con espacios finos no separables.
export const formatDate = (value: Date | string) =>
  dateFormat.format(new Date(value)).replace(",", "").replace(/\s+/g, " ");

const amount = (value: unknown) => escapeHtml(formatMoney(Number(value ?? 0)));
const qtyLabel = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));

export const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit_note: "Nota de crédito",
  credit: "Crédito",
  cod: "Contraentrega",
};
const methodLabel = (method: string, status?: string) =>
  (METHOD_LABEL[method] ?? escapeHtml(method)) +
  (method === "transfer" && status === "pending_verification"
    ? " (por verificar)"
    : "");

export type PaymentView = { method: string; amount: number; status?: string };
export type ItemView = { name: string; qty: number };
export type SaleView = {
  number: string;
  createdAt: Date | string;
  register: string;
  cashier: string;
  customer?: string | null;
  payments: PaymentView[];
  items: ItemView[];
  total: number;
  taxTotal: number;
  taxIncluded: boolean;
  creditBalance: number;
  // Incentivos (INC): el grupo es de la administración, no de las cajeras.
  wholesale?: boolean;
  incentive?: number | null;
};

function itemsLine(label: string, items: ItemView[]) {
  const count = items.reduce((sum, i) => sum + Number(i.qty || 0), 0);
  const names = items.slice(0, 3).map((i) => cleanText(i.name, 40));
  const more = items.length > 3 ? ` +${items.length - 3} más` : "";
  return `${label} (${qtyLabel(count)}): ${names.join(", ")}${more}`;
}
const paymentsLine = (payments: PaymentView[]) =>
  payments.length
    ? payments
        .map((p) => `${methodLabel(p.method, p.status)} ${amount(p.amount)}`)
        .join(" · ")
    : "—";
const placeLine = (register: string, cashier: string, who = "Cajera") =>
  `Caja: ${cleanText(register, 40)} · ${who}: ${cleanText(cashier, 40)}`;
const customerLine = (customer?: string | null) =>
  customer ? [`Cliente: ${cleanText(customer)}`] : [];
const taxLine = (taxTotal: number, included?: boolean) =>
  Number(taxTotal) > 0
    ? [
        `ITBIS${included === undefined ? "" : included ? " (incluido)" : " (adicional)"}: ${amount(taxTotal)}`,
      ]
    : [];

export function renderSale(sale: SaleView) {
  const cod = sale.payments.some((p) => p.method === "cod");
  const credit = sale.payments.some((p) => p.method === "credit");
  const title = cod
    ? "📦 <b>CONTRAENTREGA — POR COBRAR</b>"
    : credit
      ? "📝 <b>Venta A CRÉDITO</b>"
      : "🧾 <b>Venta cobrada</b>";
  return [
    `${title} · Factura ${escapeHtml(sale.number)}`,
    `Fecha: ${formatDate(sale.createdAt)}`,
    placeLine(sale.register, sale.cashier),
    ...customerLine(sale.customer),
    itemsLine("Artículos", sale.items),
    `Pago: ${paymentsLine(sale.payments)}`,
    ...(Number(sale.creditBalance) > 0
      ? [`Por cobrar: ${amount(sale.creditBalance)}`]
      : []),
    ...taxLine(sale.taxTotal, sale.taxIncluded),
    `<b>Total: ${amount(sale.total)}</b>`,
    ...(sale.wholesale ? ["Venta al por mayor (incentivo a la mitad)"] : []),
    ...(sale.incentive ? [`Incentivo: ${amount(sale.incentive)}`] : []),
  ].join("\n");
}

export function renderVoid(
  sale: SaleView & {
    voidedAt: Date | string;
    voidedBy: string;
    reason: string;
  },
) {
  return [
    `❌ <b>Venta ANULADA</b> · Factura ${escapeHtml(sale.number)}`,
    `Anulada: ${formatDate(sale.voidedAt)} · por: ${cleanText(sale.voidedBy, 40)}`,
    `Motivo: ${cleanText(sale.reason, 200)}`,
    `Venta original: ${formatDate(sale.createdAt)}`,
    placeLine(sale.register, sale.cashier),
    ...customerLine(sale.customer),
    itemsLine("Artículos", sale.items),
    `Pago original: ${paymentsLine(sale.payments)}`,
    `<b>Total anulado: ${amount(sale.total)}</b>`,
  ].join("\n");
}

export type ReturnView = {
  number: string;
  saleNumber: string;
  createdAt: Date | string;
  register: string;
  attendedBy: string;
  customer?: string | null;
  reason: string;
  refundMethod: string;
  refundAmount: number;
  total: number;
  taxTotal: number;
  items: ItemView[];
};

export function renderReturn(r: ReturnView) {
  return [
    `↩️ <b>Devolución</b> ${escapeHtml(r.number)} · Factura ${escapeHtml(r.saleNumber)}`,
    `Fecha: ${formatDate(r.createdAt)}`,
    placeLine(r.register, r.attendedBy, "Atendió"),
    ...customerLine(r.customer),
    itemsLine("Artículos devueltos", r.items),
    `Motivo: ${cleanText(r.reason, 200)}`,
    `Reembolso: ${methodLabel(r.refundMethod)} ${amount(r.refundAmount)}`,
    ...taxLine(r.taxTotal),
    `<b>Total devuelto: ${amount(r.total)}</b>`,
  ].join("\n");
}

export type CollectionView = {
  kind: "cod" | "credit" | "other";
  saleNumber: string;
  createdAt: Date | string;
  register: string;
  cashier: string;
  customer?: string | null;
  method: string;
  amount: number;
  status?: string;
  balance: number;
  saleTotal: number;
};

export function renderCollection(c: CollectionView) {
  const title =
    c.kind === "cod"
      ? "💵 <b>Cobro de contraentrega</b>"
      : c.kind === "credit"
        ? "💵 <b>Abono a crédito</b>"
        : "💵 <b>Abono</b>";
  return [
    `${title} · Factura ${escapeHtml(c.saleNumber)}`,
    `Fecha: ${formatDate(c.createdAt)}`,
    placeLine(c.register, c.cashier),
    ...customerLine(c.customer),
    `Forma de pago: ${methodLabel(c.method, c.status)} ${amount(c.amount)}`,
    `Saldo pendiente: ${amount(c.balance)}`,
    `Total de la factura: ${amount(c.saleTotal)}`,
    `<b>Cobrado: ${amount(c.amount)}</b>`,
  ].join("\n");
}

export type CashCloseView = {
  register: string;
  cashier: string;
  openedAt: Date | string;
  closedAt: Date | string;
  salesCount: number;
  salesTotal: number;
  lines: {
    label: string;
    expected: number;
    counted: number;
    difference: number;
  }[];
  difference: number;
};

const differenceLabel = (value: number) =>
  amount(value) +
  (value > 0 ? " (sobrante)" : value < 0 ? " (faltante)" : " (cuadrada)");

export function renderCashClose(c: CashCloseView) {
  return [
    `🔒 <b>Cierre de caja</b> · ${cleanText(c.register, 40)}`,
    `Cajera: ${cleanText(c.cashier, 40)}`,
    `Turno: ${formatDate(c.openedAt)} → ${formatDate(c.closedAt)}`,
    `Ventas del turno: ${c.salesCount} · ${amount(c.salesTotal)}`,
    ...c.lines.map(
      (l) =>
        `${escapeHtml(l.label)}: esperado ${amount(l.expected)} · contado ${amount(l.counted)} · diferencia ${amount(l.difference)}`,
    ),
    `<b>Diferencia total: ${differenceLabel(Number(c.difference))}</b>`,
  ].join("\n");
}

export function renderTest(at: Date, by: string) {
  return [
    "✅ <b>Prueba de Nexora</b>",
    "Los avisos de facturas llegarán a este grupo.",
    `Enviado: ${formatDate(at)} · por: ${cleanText(by, 40)}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Lectura de datos: sólo los campos que se muestran (nunca cédula, teléfono,
// correo ni dirección del cliente).

type Db = Database;

async function userName(db: Db, id?: string | null) {
  if (!id) return "—";
  const user = await db.user.findUnique({
    where: { id },
    select: { name: true },
  });
  return user?.name ?? "—";
}
async function customerName(db: Db, id?: string | null) {
  if (!id) return null;
  const customer = await db.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return customer?.name ?? null;
}
async function registerName(db: Db, registerId?: string | null) {
  if (!registerId) return "—";
  const terminal = /^[0-9a-f-]{36}$/i.test(registerId)
    ? await db.terminal.findUnique({
        where: { id: registerId },
        select: { name: true, registerName: true, registerNumber: true },
      })
    : null;
  if (!terminal) return registerId;
  const name = terminal.registerName || terminal.name;
  return terminal.registerNumber
    ? `${terminal.registerNumber} · ${name}`
    : name;
}
async function sessionRegister(db: Db, cashSessionId?: string | null) {
  if (!cashSessionId) return { register: "—", userId: null as string | null };
  const session = await db.cashSession.findUnique({
    where: { id: cashSessionId },
    select: { registerId: true, userId: true },
  });
  return {
    register: await registerName(db, session?.registerId),
    userId: session?.userId ?? null,
  };
}

async function saleView(db: Db, id: string) {
  const sale = await db.sale.findUnique({
    where: { id },
    select: {
      number: true,
      status: true,
      createdAt: true,
      sellerId: true,
      customerId: true,
      cashSessionId: true,
      total: true,
      taxTotal: true,
      taxIncluded: true,
      creditBalance: true,
      wholesale: true,
      voidedReason: true,
      voidedBy: true,
      updatedAt: true,
      branchId: true,
      items: {
        select: {
          qty: true,
          variant: { select: { product: { select: { name: true } } } },
        },
      },
      payments: {
        where: { entryType: "sale" },
        orderBy: { createdAt: "asc" },
        select: { method: true, amount: true, status: true },
      },
    },
  });
  if (!sale) return null;
  const [cashier, customer, place, incentive] = await Promise.all([
    userName(db, sale.sellerId),
    customerName(db, sale.customerId),
    sessionRegister(db, sale.cashSessionId),
    saleIncentive(db, id),
  ]);
  const view: SaleView = {
    number: sale.number,
    createdAt: sale.createdAt,
    register: place.register,
    cashier,
    customer,
    payments: sale.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
    })),
    items: sale.items.map((i) => ({
      name: i.variant.product.name,
      qty: Number(i.qty),
    })),
    total: Number(sale.total),
    taxTotal: Number(sale.taxTotal),
    taxIncluded: sale.taxIncluded,
    creditBalance: Number(sale.creditBalance),
    wholesale: sale.wholesale,
    incentive,
  };
  return { sale, view };
}

export type EventType =
  | "sale"
  | "sale_voided"
  | "return"
  | "collection"
  | "cash_close"
  | "test"
  // Aviso del respaldo diario a Google Drive (drive-backup.ts).
  | "backup_alert"
  // Cupo de intentos de una cuenta agotado (auth.ts, N-01).
  | "security_alert";

/** Texto del aviso y sucursal, o null si el registro ya no existe. */
export async function renderEvent(
  db: Db,
  event: Exclude<EventType, "test" | "backup_alert" | "security_alert">,
  refId: string,
): Promise<{ text: string; branchId: string } | null> {
  if (event === "sale" || event === "sale_voided") {
    const found = await saleView(db, refId);
    if (!found) return null;
    const { sale, view } = found;
    if (event === "sale")
      return { text: renderSale(view), branchId: sale.branchId };
    if (sale.status !== "voided") return null;
    return {
      branchId: sale.branchId,
      text: renderVoid({
        ...view,
        voidedAt: sale.updatedAt,
        voidedBy: await userName(db, sale.voidedBy),
        reason: sale.voidedReason ?? "",
      }),
    };
  }
  if (event === "return") {
    const row = await db.saleReturn.findUnique({ where: { id: refId } });
    if (!row) return null;
    const sale = await db.sale.findUnique({
      where: { id: row.saleId },
      select: { number: true, customerId: true },
    });
    const lines = (Array.isArray(row.items) ? row.items : []) as any[];
    const saleItems = await db.saleItem.findMany({
      where: { id: { in: lines.map((l) => String(l?.saleItemId ?? "")) } },
      select: {
        id: true,
        variant: { select: { product: { select: { name: true } } } },
      },
    });
    const [attendedBy, customer, place] = await Promise.all([
      userName(db, row.userId),
      customerName(db, sale?.customerId),
      sessionRegister(db, row.cashSessionId),
    ]);
    return {
      branchId: row.branchId,
      text: renderReturn({
        number: row.number,
        saleNumber: sale?.number ?? "—",
        createdAt: row.createdAt,
        register: place.register,
        attendedBy,
        customer,
        reason: row.reason,
        refundMethod: row.refundMethod,
        refundAmount: Number(row.refundAmount),
        total: Number(row.total),
        taxTotal: Number(row.taxTotal),
        items: lines.map((l) => ({
          name:
            saleItems.find((s) => s.id === l?.saleItemId)?.variant.product
              .name ?? "Artículo",
          qty: Number(l?.qty ?? 0),
        })),
      }),
    };
  }
  if (event === "collection") {
    const payment = await db.payment.findUnique({
      where: { id: refId },
      select: {
        saleId: true,
        method: true,
        amount: true,
        status: true,
        createdAt: true,
        cashSessionId: true,
      },
    });
    if (!payment) return null;
    const sale = await db.sale.findUnique({
      where: { id: payment.saleId },
      select: {
        number: true,
        total: true,
        creditBalance: true,
        customerId: true,
        branchId: true,
        payments: {
          where: { entryType: "sale", method: { in: ["cod", "credit"] } },
          select: { method: true },
        },
      },
    });
    if (!sale) return null;
    const place = await sessionRegister(db, payment.cashSessionId);
    const [cashier, customer] = await Promise.all([
      userName(db, place.userId),
      customerName(db, sale.customerId),
    ]);
    return {
      branchId: sale.branchId,
      text: renderCollection({
        kind: sale.payments.some((p) => p.method === "cod")
          ? "cod"
          : sale.payments.length
            ? "credit"
            : "other",
        saleNumber: sale.number,
        createdAt: payment.createdAt,
        register: place.register,
        cashier,
        customer,
        method: payment.method,
        amount: Number(payment.amount),
        status: payment.status,
        balance: Number(sale.creditBalance),
        saleTotal: Number(sale.total),
      }),
    };
  }
  const session = await db.cashSession.findUnique({ where: { id: refId } });
  if (!session?.closedAt) return null;
  const [cashier, register, sales] = await Promise.all([
    userName(db, session.userId),
    registerName(db, session.registerId),
    db.sale.aggregate({
      where: { cashSessionId: session.id, status: "completed" },
      _count: true,
      _sum: { total: true },
    }),
  ]);
  const vouchers = Number((session.closeDetails as any)?.vouchers ?? 0);
  return {
    branchId: session.branchId,
    text: renderCashClose({
      register,
      cashier,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      salesCount: sales._count,
      salesTotal: Number(sales._sum.total ?? 0),
      lines: [
        {
          label: "Efectivo" + (vouchers > 0 ? " (con vales)" : ""),
          expected: Number(session.expectedCash ?? 0),
          counted: Number(session.countedCash ?? 0) + vouchers,
          difference: Number(session.differenceCash ?? 0),
        },
        {
          label: "Tarjeta",
          expected: Number(session.expectedCard ?? 0),
          counted: Number(session.countedCard ?? 0),
          difference: Number(session.differenceCard ?? 0),
        },
        {
          label: "Transferencia",
          expected: Number(session.expectedTransfer ?? 0),
          counted: Number(session.countedTransfer ?? 0),
          difference: Number(session.differenceTransfer ?? 0),
        },
      ],
      difference: Number(session.difference ?? 0),
    }),
  };
}

// ---------------------------------------------------------------------------
// Cola

/** Guarda el aviso; un segundo intento del mismo evento no hace nada. */
export async function enqueue(
  db: Db,
  event: EventType,
  refId: string,
  branchId: string,
  text: string,
) {
  return db.$executeRaw`
    INSERT INTO "NotificationOutbox"
      ("id", "eventType", "refId", "payload", "status", "attempts",
       "nextAttemptAt", "createdAt", "branchId")
    VALUES (${randomUUID()}::uuid, ${event}, ${refId},
      ${JSON.stringify({ text })}::jsonb, 'pending', 0,
      timezone('UTC', now()), timezone('UTC', now()), ${branchId})
    ON CONFLICT ("eventType", "refId") DO NOTHING`;
}

/**
 * Punto de enganche de ventas y caja: se llama después del commit, no espera
 * nada y jamás lanza. Sin las variables de Telegram no hace nada.
 */
export function notify(
  db: Db,
  event: Exclude<EventType, "test" | "backup_alert" | "security_alert">,
  refId: string,
): void {
  try {
    if (!telegramSettings().enabled) return;
    void (async () => {
      const rendered = await renderEvent(db, event, refId);
      if (!rendered) return;
      await enqueue(db, event, refId, rendered.branchId, rendered.text);
      wakeWorkers();
    })().catch((error) =>
      console.warn(
        `[avisos] No se pudo encolar el aviso ${event}: ` +
          sanitizeError(error?.message ?? error),
      ),
    );
  } catch (error: any) {
    console.warn("[avisos] " + sanitizeError(error?.message ?? error));
  }
}

// ---------------------------------------------------------------------------
// Envío

export type SendResult =
  | { ok: true }
  | { ok: false; status?: number; retryAfter?: number; error: string };

export async function sendTelegram(
  settings: TelegramSettings,
  text: string,
): Promise<SendResult> {
  try {
    const response = await fetch(
      `${settings.apiBase}/bot${settings.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const body: any = await response.json().catch(() => null);
    if (response.ok && body?.ok !== false) return { ok: true };
    const retryAfter = Number(body?.parameters?.retry_after);
    return {
      ok: false,
      status: response.status,
      ...(response.status === 429 && retryAfter > 0 ? { retryAfter } : {}),
      error: sanitizeError(
        `HTTP ${response.status}: ${body?.description ?? response.statusText}`,
        settings.token,
      ),
    };
  } catch (error: any) {
    const timeout =
      error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      error: timeout
        ? `Telegram no respondió en ${REQUEST_TIMEOUT_MS / 1000} s.`
        : sanitizeError(
            [error?.message, error?.cause?.code ?? error?.cause?.message]
              .filter(Boolean)
              .join(": "),
            settings.token,
          ),
    };
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Trabajadores activos de este proceso: al encolar se les avisa para enviar
// ya, sin esperar al siguiente intervalo.
const wakers = new Set<() => void>();
const wakeWorkers = () => wakers.forEach((wake) => wake());

@Injectable()
export class NotificationWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private stopped = false;
  private again = false;
  private pausedUntil = 0;
  private lastSentAt = 0;
  private lastPurge = 0;
  private readonly waker = () => this.wake();
  constructor(@Inject(Database) private readonly db: Database) {}

  onApplicationBootstrap() {
    if (!telegramSettings().enabled) return;
    wakers.add(this.waker);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    // Al reiniciar retoma lo pendiente sin esperar al primer intervalo.
    this.wake();
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    wakers.delete(this.waker);
  }
  /** Revisa la cola ya (p. ej. justo después de encolar). */
  wake() {
    if (this.running) this.again = true;
    else setImmediate(() => void this.tick());
  }

  async tick() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      do {
        this.again = false;
        await this.purge();
        // Hasta 20 avisos por vuelta; el resto, en la siguiente.
        for (let i = 0; i < 20 && !this.stopped; i++) {
          if (Date.now() < this.pausedUntil) break;
          const row = await this.claim();
          if (!row) break;
          await this.deliver(row);
        }
      } while (this.again && !this.stopped && Date.now() >= this.pausedUntil);
    } catch (error: any) {
      console.warn(
        "[avisos] Error del trabajador: " +
          sanitizeError(error?.message ?? error),
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Toma un aviso pendiente. SKIP LOCKED evita que dos instancias tomen el
   * mismo, y el arriendo (nextAttemptAt + 2 min) impide que otra lo tome
   * mientras éste lo envía; si la API muere, se retoma al vencer.
   */
  private async claim() {
    const rows = await this.db.$queryRaw<
      { id: string; payload: any; attempts: number }[]
    >`
      UPDATE "NotificationOutbox" o
      SET "attempts" = o."attempts" + 1,
          "nextAttemptAt" = timezone('UTC', now()) + make_interval(secs => ${LEASE_SECONDS})
      WHERE o.id = (
        SELECT id FROM "NotificationOutbox"
        WHERE status = 'pending' AND "nextAttemptAt" <= timezone('UTC', now())
        ORDER BY "nextAttemptAt", "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING o.id::text AS id, o.payload, o."attempts"`;
    return rows[0] ?? null;
  }

  private async deliver(row: { id: string; payload: any; attempts: number }) {
    const settings = telegramSettings();
    const text = String(row.payload?.text ?? "");
    const wait = this.lastSentAt + SEND_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    const result = text
      ? await sendTelegram(settings, text)
      : ({ ok: false, error: "Aviso sin texto." } as SendResult);
    this.lastSentAt = Date.now();
    if (result.ok) {
      await this.db.$executeRaw`
        UPDATE "NotificationOutbox"
        SET status = 'sent', "sentAt" = timezone('UTC', now()), "lastError" = NULL
        WHERE id = ${row.id}::uuid`;
      return;
    }
    if (result.retryAfter) {
      // 429: Telegram pide esperar. Se pausa todo el envío y este intento no
      // cuenta para el límite.
      this.pausedUntil = Date.now() + result.retryAfter * 1000;
      await this.db.$executeRaw`
        UPDATE "NotificationOutbox"
        SET "attempts" = GREATEST("attempts" - 1, 0),
            "nextAttemptAt" = timezone('UTC', now()) + make_interval(secs => ${result.retryAfter}),
            "lastError" = ${result.error}
        WHERE id = ${row.id}::uuid`;
      return;
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.db.$executeRaw`
        UPDATE "NotificationOutbox"
        SET status = 'failed', "lastError" = ${result.error}
        WHERE id = ${row.id}::uuid`;
      console.warn(
        `[avisos] Aviso descartado tras ${row.attempts} intentos: ${result.error}`,
      );
      return;
    }
    await this.db.$executeRaw`
      UPDATE "NotificationOutbox"
      SET "nextAttemptAt" = timezone('UTC', now()) + make_interval(secs => ${backoffSeconds(row.attempts)}),
          "lastError" = ${result.error}
      WHERE id = ${row.id}::uuid`;
  }

  private async purge() {
    if (Date.now() - this.lastPurge < 3600000) return;
    this.lastPurge = Date.now();
    await this.db.$executeRaw`
      DELETE FROM "NotificationOutbox"
      WHERE status = 'sent'
        AND "sentAt" < timezone('UTC', now()) - make_interval(days => ${PURGE_DAYS}::int)`;
  }
}

// ---------------------------------------------------------------------------
// Administración

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(Database) private readonly db: Database) {}

  /** Encola «Prueba de Nexora». Nunca devuelve el token ni el chat. */
  @Post("telegram/test")
  @Permit("*")
  async test(@CurrentUser() actor: Actor) {
    if (!telegramSettings().enabled)
      return {
        enabled: false,
        queued: false,
        message:
          "Los avisos por Telegram no están activados: faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el servidor.",
      };
    await enqueue(
      this.db,
      "test",
      randomUUID(),
      actor.branchId,
      renderTest(new Date(), actor.name),
    );
    wakeWorkers();
    return {
      enabled: true,
      queued: true,
      message: "Mensaje de prueba en cola: llegará al grupo en unos segundos.",
    };
  }

  @Get("status")
  @Permit("*")
  async status() {
    const [groups, last] = await Promise.all([
      this.db.notificationOutbox.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.db.notificationOutbox.findFirst({
        where: { lastError: { not: null } },
        orderBy: { nextAttemptAt: "desc" },
        select: { lastError: true, eventType: true },
      }),
    ]);
    const count = (status: string) =>
      groups.find((g) => g.status === status)?._count._all ?? 0;
    return {
      enabled: telegramSettings().enabled,
      pending: count("pending"),
      sent: count("sent"),
      failed: count("failed"),
      lastError: last
        ? {
            message: sanitizeError(last.lastError),
            eventType: last.eventType,
          }
        : null,
    };
  }
}
