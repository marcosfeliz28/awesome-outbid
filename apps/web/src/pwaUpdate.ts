// M7 (auditoría de infraestructura): la PWA ya no se recarga sola al
// publicar una versión nueva (antes `registerType: "autoUpdate"`). El service
// worker nuevo queda en espera, se muestra un aviso y se aplica:
//   - cuando la persona pulsa «Actualizar ahora» (sólo con el carrito vacío), o
//   - sola, con el carrito vacío y la caja sin usar (ver pwaUpdatePolicy.ts).
// Nunca recarga con una venta en curso. Además pregunta cada hora si hay
// versión nueva, para las cajas que pasan el día con la pestaña abierta.
// Es un aviso en DOM propio para no tocar App.tsx ni POS.tsx.
import { registerSW } from "virtual:pwa-register";
import { useStore } from "./api";
import {
  canApplyPwaUpdate,
  PWA_UPDATE_CHECK_MS,
  pwaUpdateMessage,
} from "./pwaUpdatePolicy";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "input",
  "wheel",
  "touchstart",
] as const;

export function startPwaUpdates() {
  let lastActivity = Date.now();
  let waiting = false;
  let applying = false;
  let dismissed = false;
  let banner: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const cartItems = () => useStore.getState().cart.length;

  const apply = () => {
    if (applying || cartItems() > 0) return;
    applying = true;
    if (timer) clearInterval(timer);
    // Recarga cuando el service worker nuevo tome el control. workbox-window
    // no recarga si la versión la encontró una revisión posterior a la carga
    // (la de cada hora la marca como «externa»), así que se escucha aquí.
    let reloading = false;
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    // Activa el service worker en espera (mensaje SKIP_WAITING).
    void updateSW(true);
  };

  const render = () => {
    if (!waiting || applying || dismissed) {
      banner?.remove();
      banner = null;
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "nexora-pwa-update";
      banner.setAttribute("role", "status");
      banner.setAttribute("aria-live", "polite");
      Object.assign(banner.style, {
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483000",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 12px",
        maxWidth: "calc(100vw - 32px)",
        boxSizing: "border-box",
        padding: "10px 14px",
        borderRadius: "12px",
        background: "#1E1B4B",
        color: "#FFFFFF",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.35)",
        font: "inherit",
        fontSize: "14px",
        lineHeight: "1.4",
      });
      document.body.appendChild(banner);
    }
    const items = cartItems();
    const text = document.createElement("span");
    text.textContent = pwaUpdateMessage(items);
    const buttons: HTMLButtonElement[] = [];
    const button = (label: string, primary: boolean, onClick: () => void) => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      Object.assign(element.style, {
        minHeight: "44px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: primary ? "0" : "1px solid rgba(255, 255, 255, 0.6)",
        background: primary ? "#FFFFFF" : "transparent",
        color: primary ? "#4C1D95" : "#FFFFFF",
        font: "inherit",
        fontWeight: "600",
        cursor: "pointer",
      });
      element.addEventListener("click", onClick);
      buttons.push(element);
    };
    if (items === 0) button("Actualizar ahora", true, apply);
    button("Ocultar", false, () => {
      dismissed = true;
      render();
    });
    banner.replaceChildren(text, ...buttons);
  };

  const check = () => {
    if (!waiting || applying) return;
    if (
      canApplyPwaUpdate({
        cartItems: cartItems(),
        idleMs: Date.now() - lastActivity,
        hidden: document.visibilityState === "hidden",
      })
    )
      apply();
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (waiting) return;
      waiting = true;
      render();
      timer = setInterval(check, 15_000);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine && !waiting) void registration.update();
      }, PWA_UPDATE_CHECK_MS);
    },
  });

  for (const type of ACTIVITY_EVENTS)
    window.addEventListener(
      type,
      () => {
        lastActivity = Date.now();
      },
      { capture: true, passive: true },
    );
  document.addEventListener("visibilitychange", check);
  // El aviso cambia (con o sin botón) cuando se vacía o se llena el carrito.
  useStore.subscribe((state, previous) => {
    if (state.cart.length !== previous.cart.length) {
      if (state.cart.length === 0) dismissed = false;
      render();
    }
  });
}
