import * as Sentry from "@sentry/node";

export type ApiErrorArea = "api" | "sales" | "cash" | "startup";

/**
 * Server-side error reporting is opt-in. No DSN means no SDK client and no
 * outbound telemetry, keeping local development and self-hosted installs
 * unchanged until an operator configures SENTRY_DSN.
 */
export function initializeApiMonitoring(env: NodeJS.ProcessEnv = process.env) {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return false;

  const commit = env.RENDER_GIT_COMMIT?.trim();
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "production",
    release:
      env.SENTRY_RELEASE?.trim() ||
      (commit ? `nexora-api@${commit}` : undefined),
    // This SDK version does not expose the browser's sendDefaultPii option;
    // the beforeSend sanitizer below removes all request/user/free-text data.
    tracesSampleRate: 0,
    beforeSend: sanitizeApiEvent,
  });
  return true;
}

/**
 * The API reports only sanitized internal failures. Do not pass request,
 * response, actor, sale, payment, customer, or Prisma query data to Sentry.
 */
export function captureApiException(error: unknown, area: ApiErrorArea) {
  if (!Sentry.getClient()) return;
  Sentry.withScope((scope) => {
    scope.setTag("service", "nexora-api");
    scope.setTag("area", area);
    Sentry.captureException(error);
  });
}

/** Exported for tests: aggressively remove request/user data and free text. */
export function sanitizeApiEvent<T extends Sentry.Event>(event: T): T {
  delete event.request;
  delete event.user;
  delete event.extra;
  delete event.contexts;
  delete event.breadcrumbs;
  delete event.logentry;
  delete event.fingerprint;
  event.transaction = "api.internal_error";
  event.message = "Unhandled API exception";
  event.tags = {
    service: "nexora-api",
    area: ["api", "sales", "cash", "startup"].includes(String(event.tags?.area))
      ? String(event.tags?.area)
      : "api",
  };
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => {
      const sanitized = { ...value, value: "Unhandled API exception" };
      if (sanitized.mechanism) {
        const { data: _discarded, ...mechanism } = sanitized.mechanism;
        sanitized.mechanism = mechanism;
      }
      if (sanitized.stacktrace?.frames) {
        sanitized.stacktrace = {
          ...sanitized.stacktrace,
          frames: sanitized.stacktrace.frames.map((frame) => {
            const {
              vars: _vars,
              context_line: _context,
              pre_context: _before,
              post_context: _after,
              ...location
            } = frame;
            return location;
          }),
        };
      }
      return sanitized;
    });
  }
  return event;
}
