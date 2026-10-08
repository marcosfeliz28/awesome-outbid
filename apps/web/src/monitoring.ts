import * as Sentry from "@sentry/react";

const SENTRY_DSN =
  "https://59ec5514af9c8ddaf210a2d48863716b@o4512218489683968.ingest.us.sentry.io/4512218505871360";

function sanitizeUrl(value: string): string {
  return value
    .split(/[?#]/, 1)[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
}

function sanitizeRequest<T extends { request?: { url?: string } }>(event: T): T {
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
  if (verb === "POST" && route === "/sales/sync") return "pos.offline_sales.sync";
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

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.MODE,
  release:
    window.__NEXORA_SENTRY_RELEASE__ ||
    __NEXORA_SENTRY_RELEASE__ ||
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
    for (const breadcrumb of event.breadcrumbs ?? []) {
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
