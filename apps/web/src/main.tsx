import "./polyfills";
import "./monitoring";
import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { startPwaUpdates } from "./pwaUpdate";
import { keepCartDraft, flushEmptyDraftBeforeReload } from "./cartDraft";
import "./styles.css";
import "../../../packages/ui/src/tokens.css";
import "../../../packages/ui/src/nx-primitivos.css";
import "./impacto.css";
import { readVisual } from "./impacto";
import { applyTheme, followSystemTheme, initialTheme } from "./theme";
import { useStore } from "./api";
// Modo visual por equipo: estándar salvo que el administrador encienda Impacto.
document.documentElement.dataset.visual = readVisual();
// MOD-08: el tema se pinta antes del primer dibujo y sigue al equipo si la
// persona no eligió uno.
applyTheme(initialTheme());
followSystemTheme((theme) => {
  applyTheme(theme);
  useStore.setState({ theme });
});
// M7: la versión nueva de la PWA no recarga con una venta en curso.
startPwaUpdates(flushEmptyDraftBeforeReload);
// 05-A3/M1: el carrito en curso sobrevive a F5 y a la recarga de una versión
// nueva aplicada con el carrito vacío.
keepCartDraft();
// Panel de la operadora de la plataforma: aparte de la interfaz de las empresas.
const PlatformPanel = lazy(() =>
  import("./PlatformPanel").then((m) => ({ default: m.PlatformPanel })),
);
const platformRoute = /^\/plataforma\/?$/.test(window.location.pathname);
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {platformRoute ? (
        <Suspense fallback={null}>
          <PlatformPanel />
        </Suspense>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);
