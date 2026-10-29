import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
// G14: la versión que muestra «Acerca de» (la misma de instalador/VERSION;
// lo comprueba tests/licencias.test.ts). Sale de package.json porque la
// imagen web de Render sólo copia apps/web.
const appVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;
const appCommit = (process.env.RENDER_GIT_COMMIT || "").slice(0, 7);
const sentryRelease = process.env.RENDER_GIT_COMMIT
  ? `nexora-pos@${process.env.RENDER_GIT_COMMIT}`
  : process.env.VITE_SENTRY_RELEASE || "";
export default defineConfig({
  define: {
    __NEXORA_SENTRY_RELEASE__: JSON.stringify(sentryRelease),
    __NEXORA_VERSION__: JSON.stringify(
      appVersion + (appCommit ? " · " + appCommit : ""),
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/recharts/") ||
            id.includes("/victory-vendor/") ||
            id.includes("/d3-")
          )
            return "charts";
          if (
            id.includes("/src/IncomeByDay.tsx") ||
            id.includes("/src/FormalReports.tsx") ||
            /\/(?:exceljs|xlsx|jspdf|pdfmake)\//.test(id)
          )
            return "document-export";
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // M7: con "autoUpdate" la versión nueva recargaba la página sin
      // preguntar, también en mitad de una venta. Con "prompt" queda en
      // espera y src/pwaUpdate.ts la aplica con el carrito vacío (aviso
      // «hay versión nueva», botón o caja sin usar) y revisa cada hora.
      registerType: "prompt",
      // El logo del negocio se obtiene de sus propios Ajustes; nunca
      // precachear el logo de otra empresa en el producto multiempresa.
      includeAssets: ["icon.svg", "products/*.svg"],
      manifest: {
        name: "Norexos",
        short_name: "Norexos",
        lang: "es",
        description: "Caja e inventario para tu tienda",
        theme_color: "#7C3AED",
        background_color: "#F8FAFC",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,webp}"],
        navigateFallback: "/index.html",
        // Con "prompt", la primera instalación también controla la página
        // abierta (como antes con autoUpdate) para que funcione sin conexión
        // sin recargar. Una versión nueva sigue en espera hasta aplicarla.
        clientsClaim: true,
        // Abrir /api/... o /healthz directamente en el navegador debe llegar
        // al servidor (JSON, 204/503), no a la app servida desde la caché.
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/healthz(?:\/|$)/],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.FITSTORE_API_PROXY || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api": {
        target: process.env.FITSTORE_API_PROXY || "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
