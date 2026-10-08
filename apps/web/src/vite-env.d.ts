/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __NEXORA_SENTRY_RELEASE__: string;

interface Window {
  __NEXORA_SENTRY_RELEASE__?: string;
}
