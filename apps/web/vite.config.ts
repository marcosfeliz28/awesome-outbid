import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
const sentryRelease = process.env.RENDER_GIT_COMMIT
  ? `nexora-pos@${process.env.RENDER_GIT_COMMIT}`
  : process.env.VITE_SENTRY_RELEASE || "";
export default defineConfig({
  define: {
    __NEXORA_SENTRY_RELEASE__: JSON.stringify(sentryRelease),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Las cajas no deben quedarse usando una versión anterior después de
      // publicar un cambio. La actualización se instala y toma control sola.
      registerType: "autoUpdate",
      // El logo predeterminado del ticket (Prints.tsx) también debe estar sin
      // conexión: printSoon imprime a los 50 ms y no espera a la red.
      includeAssets: ["icon.svg", "products/*.svg", "logo-grupo-macgen.png"],
      manifest: {
        name: "Nexora POS",
        short_name: "Nexora",
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
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
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
