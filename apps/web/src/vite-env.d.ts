/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __NEXORA_SENTRY_RELEASE__: string;

interface Window {
  __NEXORA_SENTRY_RELEASE__?: string;
}

interface ImportMetaEnv {
  /** DSN de Sentry para la web; sin él no se envía nada a Sentry (G8). */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_RELEASE?: string;
}
