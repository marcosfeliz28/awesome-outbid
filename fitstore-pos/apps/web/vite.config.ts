import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
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
      registerType: "prompt",
      includeAssets: ["icon.svg", "products/*.svg"],
      manifest: {
        name: "FitStore POS",
        short_name: "FitStore",
        lang: "es",
        description: "Facturación e inventario para tu tienda",
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
