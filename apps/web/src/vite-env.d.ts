/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __NEXORA_SENTRY_RELEASE__: string;
declare const __NEXORA_VERSION__: string;

interface Window {
  __NEXORA_SENTRY_RELEASE__?: string;
}

interface ImportMetaEnv {
  /** DSN de Sentry para la web; sin él no se envía nada a Sentry (G8). */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  /** Exige código de empresa en el acceso de la web SaaS. */
  readonly VITE_PRODUCT_TENANCY?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  /** Habilita la comprobación de licencia antes de ventas offline locales. */
  readonly VITE_PRODUCT_LOCAL_LICENSE?: string;
}
