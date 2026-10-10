import "./polyfills";
import "./monitoring";
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { startPwaUpdates } from "./pwaUpdate";
import { keepCartDraft } from "./cartDraft";
import "./styles.css";
// M7: la versión nueva de la PWA no recarga con una venta en curso.
startPwaUpdates();
// 05-A3/M1: el carrito en curso sobrevive a F5 y a la recarga de una versión
// nueva aplicada con el carrito vacío.
keepCartDraft();
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
