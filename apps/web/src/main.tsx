import "./polyfills";
import "./monitoring";
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { keepCartDraft } from "./cartDraft";
import "./styles.css";
registerSW({ immediate: true });
// 05-A3/M1: el carrito en curso sobrevive a F5 y a la recarga automática.
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
