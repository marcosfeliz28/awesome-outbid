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
  canApplyScheduledPwaUpdate,
  canApplyPwaUpdate,
  canSchedulePwaUpdate,
  clearPwaUpdateSchedule,
  PWA_UPDATE_CHECK_MS,
  PWA_UPDATE_FORM_MS,
  pwaUpdateMessage,
  readPwaUpdateSchedule,
  savePwaUpdateSchedule,
} from "./pwaUpdatePolicy";
import { loadPwaReleaseNotes, type PwaReleaseNotes } from "./pwaReleaseNotes";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "input",
  "wheel",
  "touchstart",
] as const;

export function startPwaUpdates() {
  let lastActivity = Date.now();
  // 05-N9: la última vez que se escribió en un campo (formularios a medias).
  let lastInput = -Infinity;
  // 05-N7: otra pestaña aplicó la versión nueva: ésta se recarga en cuanto
  // pueda. Sin esto quedaba con JS viejo bajo un service worker cuyo
  // precaché ya no tiene sus archivos.
  let reloading = false;
  let reloadWanted = false;
  const hadController = !!navigator.serviceWorker?.controller;
  let waiting = false;
  let applying = false;
  let dismissed = false;
  let banner: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  // Dueña (21-oct): al abrir y al cerrar caja se busca la versión nueva y se
  // instala en cuanto el carrito y las ventanas estén libres, sin esperar a
  // que la caja quede sin usar (la caja abierta todo el día seguía vieja).
  let eager = false;
  let registrationRef: ServiceWorkerRegistration | undefined;
  let releaseNotes: PwaReleaseNotes | null = null;
  let scheduleError = "";
  let scheduleDraft = "";
  let waitingSince = 0;
  // El identificador de sucursal es exclusivo de una empresa y no expone datos.
  const scheduleScope = () => useStore.getState().user?.branchId ?? "";
  let loadedScope = scheduleScope();
  let scheduledAt = readPwaUpdateSchedule(localStorage, loadedScope);

  const cartItems = () => useStore.getState().cart.length;

  const apply = () => {
    if (applying || cartItems() > 0) return;
    if (dialogOpen() || Date.now() - lastInput < PWA_UPDATE_FORM_MS) {
      scheduleError = "Termina primero la ventana o el formulario abierto.";
      render();
      return;
    }
    applying = true;
    clearPwaUpdateSchedule(localStorage, scheduleScope());
    scheduledAt = null;
    if (timer) clearInterval(timer);
    // Recarga cuando el service worker nuevo tome el control. workbox-window
    // no recarga si la versión la encontró una revisión posterior a la carga
    // (la de cada hora la marca como «externa»), así que se escucha aquí.
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    // Activa el service worker en espera (mensaje SKIP_WAITING).
    void updateSW(true);
  };

  const dialogOpen = () => !!document.querySelector('[role="dialog"]');
  const reloadIfFree = () => {
    if (
      !reloadWanted ||
      reloading ||
      cartItems() > 0 ||
      dialogOpen() ||
      Date.now() - lastInput < PWA_UPDATE_FORM_MS
    )
      return;
    reloading = true;
    window.location.reload();
  };
  // Sólo si la página ya la controlaba un service worker: la primera
  // instalación también cambia de controlador y no debe recargar.
  if (hadController)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      reloadWanted = true;
      reloadIfFree();
      setInterval(reloadIfFree, 15_000);
    });

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
        // 05-N6: abajo y no arriba, para no tapar la búsqueda ni el estado de
        // conexión; en el celular, sobre la barra del carrito.
        bottom: window.matchMedia("(max-width: 720px)").matches
          ? "88px"
          : "12px",
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
    const content = document.createElement("div");
    content.appendChild(text);
    if (releaseNotes) {
      const notes = document.createElement("small");
      notes.style.display = "block";
      notes.textContent = `Versión ${releaseNotes.version}: ${releaseNotes.notes.join(" · ")}`;
      content.appendChild(notes);
    }
    if (scheduledAt !== null) {
      const schedule = document.createElement("small");
      schedule.style.display = "block";
      schedule.textContent = `Actualización programada: ${new Date(scheduledAt).toLocaleString("es-DO")}. Se instalará sólo con la caja libre.`;
      content.appendChild(schedule);
    }
    if (scheduleError) {
      const error = document.createElement("small");
      error.style.display = "block";
      error.setAttribute("role", "alert");
      error.textContent = scheduleError;
      content.appendChild(error);
    }
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
    if (canSchedulePwaUpdate(useStore.getState().user?.permissions ?? [])) {
      if (scheduledAt === null) {
        const label = document.createElement("label");
        label.textContent = "Programar fuera de caja ";
        const dateInput = document.createElement("input");
        dateInput.type = "datetime-local";
        dateInput.value = scheduleDraft;
        dateInput.addEventListener("input", () => {
          scheduleDraft = dateInput.value;
        });
        dateInput.setAttribute(
          "aria-label",
          "Fecha y hora para actualizar Nexora",
        );
        dateInput.style.color = "#1E1B4B";
        label.appendChild(dateInput);
        content.appendChild(label);
        button("Programar", false, () => {
          const when = new Date(dateInput.value).getTime();
          if (!savePwaUpdateSchedule(localStorage, scheduleScope(), when)) {
            scheduleError = "Elige una fecha y hora futuras.";
          } else {
            scheduledAt = when;
            scheduleError = "";
            scheduleDraft = "";
          }
          render();
        });
      } else {
        button("Cancelar programación", false, () => {
          clearPwaUpdateSchedule(localStorage, scheduleScope());
          scheduledAt = null;
          scheduleError = "";
          render();
        });
      }
    }
    button("Ocultar", false, () => {
      dismissed = true;
      render();
    });
    banner.replaceChildren(content, ...buttons);
  };

  const check = () => {
    if (!waiting || applying) return;
    const scope = scheduleScope();
    if (scope !== loadedScope) {
      loadedScope = scope;
      scheduledAt = readPwaUpdateSchedule(localStorage, scope);
      render();
    }
    const updateState = {
      cartItems: cartItems(),
      idleMs: Date.now() - lastActivity,
      hidden: document.visibilityState === "hidden",
      dialogOpen: dialogOpen(),
      sinceInputMs: Date.now() - lastInput,
    };
    // Una programación futura suspende la instalación automática y también
    // el atajo eager de apertura/cierre. Al llegar la hora sigue exigiendo
    // carrito vacío, ausencia de modal/formulario e inactividad.
    if (scheduledAt !== null) {
      if (canApplyScheduledPwaUpdate(updateState, scheduledAt)) apply();
      else reloadIfFree();
      return;
    }
    // Dejar tiempo real para leer las notas y elegir «Programar» antes de
    // cualquier instalación automática, incluso en apertura/cierre de caja.
    if (Date.now() - waitingSince < 30_000) return;
    if (eager && cartItems() === 0 && !dialogOpen()) {
      apply();
      return;
    }
    if (canApplyPwaUpdate(updateState)) apply();
    else reloadIfFree();
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (waiting) return;
      waiting = true;
      waitingSince = Date.now();
      scheduledAt = readPwaUpdateSchedule(localStorage, scheduleScope());
      render();
      void loadPwaReleaseNotes().then((notes) => {
        releaseNotes = notes;
        render();
      });
      timer = setInterval(check, 15_000);
      if (eager) check();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      registrationRef = registration;
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
  window.addEventListener(
    "input",
    (event) => {
      // Elegir la hora del aviso no es un formulario de venta sin guardar.
      if (event.target instanceof Node && banner?.contains(event.target))
        return;
      lastInput = Date.now();
    },
    { capture: true, passive: true },
  );
  document.addEventListener("visibilitychange", check);
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith("nexora:pwa-update-at:")) {
      scheduledAt = readPwaUpdateSchedule(localStorage, scheduleScope());
      render();
      check();
    }
  });
  window.addEventListener("nexora:check-update", () => {
    eager = true;
    if (navigator.onLine) void registrationRef?.update();
    check();
  });
  // El aviso cambia (con o sin botón) cuando se vacía o se llena el carrito.
  useStore.subscribe((state, previous) => {
    if (state.user?.branchId !== previous.user?.branchId) {
      loadedScope = state.user?.branchId ?? "";
      scheduledAt = readPwaUpdateSchedule(localStorage, loadedScope);
      render();
    }
    if (state.cart.length !== previous.cart.length) {
      if (state.cart.length === 0) dismissed = false;
      render();
      reloadIfFree();
    }
  });
}
