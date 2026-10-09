import * as Sentry from "@sentry/react";

// G8: sin DSN fijo. Sentry sólo se activa si la compilación recibe
// VITE_SENTRY_DSN; sin ella no se inicia y no sale ninguna petición hacia
// Sentry (startSpan sin cliente no hace nada).
export function sentryDsn(
  env: Record<string, unknown> = import.meta.env,
): string | undefined {
  const value = env.VITE_SENTRY_DSN;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeUrl(value: string): string {
  return value
    .split(/[?#]/, 1)[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Texto libre de un error (mensaje, miga) sin datos personales ni secretos:
 * rutas sin consulta y con ids como `:id`, tokens, correos y números de 7 o
 * más dígitos (cédulas, RNC, teléfonos, tarjetas). Montos y fechas quedan.
 */
export function scrubText(text: string): string {
  return text
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url))
    .replace(
      /(^|[\s"'(=:])(\/api\/[^\s"'<>)]*)/g,
      (_, lead, path) => lead + sanitizeUrl(path),
    )
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [token]")
    .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]*/g, "[token]")
    .replace(UUID, "[id]")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[correo]")
    .replace(/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{20,}\b/g, "[token]")
    .replace(/\+?\d[\d\s().-]{5,}\d/g, (match) =>
      ISO_DATE.test(match) || match.replace(/\D/g, "").length < 7
        ? match
        : "[número]",
    );
}

function sanitizeRequest<T extends { request?: { url?: string } }>(
  event: T,
): T {
  if (event.request) {
    event.request.url = event.request.url
      ? sanitizeUrl(event.request.url)
      : undefined;
    delete (event.request as Record<string, unknown>).cookies;
    delete (event.request as Record<string, unknown>).data;
    delete (event.request as Record<string, unknown>).headers;
  }
  return event;
}

/**
 * Trace only the operational milestones needed to diagnose POS reliability.
 * Names are fixed and intentionally exclude IDs, user/customer/product data,
 * amounts, payment details, and request/response bodies.
 */
export function traceBusinessOperation<T>(
  name: string | null,
  action: () => Promise<T>,
): Promise<T> {
  if (!name) return action();

  return Sentry.startSpan({ name, op: "pos.workflow" }, async (span) => {
    try {
      const result = await action();
      span.setAttribute("pos.outcome", "success");
      return result;
    } catch (error) {
      span.setAttribute("pos.outcome", "error");
      throw error;
    }
  });
}

export function businessOperationName(path: string, method = "GET") {
  const route = path.split(/[?#]/, 1)[0].replace(/^\/api/, "");
  const verb = method.toUpperCase();
  if (verb === "POST" && route === "/sales") return "pos.sale.submit";
  if (verb === "POST" && route === "/sales/sync")
    return "pos.offline_sales.sync";
  if (verb === "POST" && route === "/cash-sessions/open") return "cash.open";
  if (verb === "POST" && /^\/cash-sessions\/[^/]+\/close$/.test(route))
    return "cash.close";
  if (verb === "POST" && /^\/cash-sessions\/[^/]+\/movements$/.test(route))
    return "cash.movement";
  if (verb === "GET" && /^\/sales\/[^/]+\/receipt\.pdf$/.test(route))
    return "invoice.receipt_pdf";
  if (verb === "POST" && /^\/sales\/[^/]+\/installments$/.test(route))
    return "payment.credit_collection";
  if (verb === "POST" && /^\/sales\/[^/]+\/cod-collections$/.test(route))
    return "payment.cod_collection";
  return null;
}

export function initMonitoring(dsn = sentryDsn()): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release:
      window.__NEXORA_SENTRY_RELEASE__ ||
      (typeof __NEXORA_SENTRY_RELEASE__ === "string"
        ? __NEXORA_SENTRY_RELEASE__
        : "") ||
      import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        networkCaptureBodies: false,
        networkDetailDenyUrls: [/.*/],
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.05 : 0,
    beforeSend(event) {
      sanitizeRequest(event);
      delete event.user;
      delete event.extra;
      if (event.message) event.message = scrubText(event.message);
      for (const exception of event.exception?.values ?? [])
        if (exception.value) exception.value = scrubText(exception.value);
      for (const breadcrumb of event.breadcrumbs ?? []) {
        if (breadcrumb.message)
          breadcrumb.message = scrubText(breadcrumb.message);
        const url = breadcrumb.data?.url;
        if (typeof url === "string") breadcrumb.data!.url = sanitizeUrl(url);
      }
      return event;
    },
    beforeSendTransaction(event) {
      sanitizeRequest(event);
      if (event.transaction) event.transaction = sanitizeUrl(event.transaction);
      for (const span of event.spans ?? []) {
        if (span.description) span.description = sanitizeUrl(span.description);
        const url = span.data?.url;
        if (typeof url === "string") span.data!.url = sanitizeUrl(url);
      }
      return event;
    },
  });
  return true;
}

initMonitoring();
