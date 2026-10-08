import * as Sentry from "@sentry/react";

const SENTRY_DSN =
  "https://59ec5514af9c8ddaf210a2d48863716b@o4512218489683968.ingest.us.sentry.io/4512218505871360";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.headers;
    }
    if (event.user) {
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }
    return event;
  },
});

// Activador temporal para verificar la conexión con Sentry en producción.
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get("sentry-test") === "1") {
  Sentry.captureException(new Error("Nexora Sentry verification"));
}
