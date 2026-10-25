import { useEffect, useId, useState } from "react";
import "./PrivacyToggle.css";

export const PRIVACY_STORAGE_KEY = "nexora-admin-privacy-mode";
export const PRIVACY_MODE_CLASS = "nexora-privacy-mode";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
type PrivacyRoot = {
  classList: Pick<DOMTokenList, "toggle">;
};

function availableStorage(): PreferenceStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function documentRoot(): PrivacyRoot | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement;
}

export function readPrivacyPreference(
  storage: PreferenceStorage | undefined = availableStorage(),
): boolean {
  try {
    return storage?.getItem(PRIVACY_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writePrivacyPreference(
  active: boolean,
  storage: PreferenceStorage | undefined = availableStorage(),
): void {
  try {
    storage?.setItem(PRIVACY_STORAGE_KEY, active ? "on" : "off");
  } catch {
    // El modo sigue funcionando durante la sesión aunque el navegador
    // bloquee el almacenamiento local.
  }
}

export function applyPrivacyMode(
  active: boolean,
  root: PrivacyRoot | undefined = documentRoot(),
): void {
  root?.classList.toggle(PRIVACY_MODE_CLASS, active);
}

/**
 * Control visual para ocultar cifras del tablero ante personas cercanas.
 * No cambia permisos, respuestas de la API ni contenido para lectores de
 * pantalla. Las cifras que admiten este efecto se marcan con
 * `data-private-value` en sus propias tarjetas.
 */
export function PrivacyToggle() {
  const [active, setActive] = useState(readPrivacyPreference);
  const headingId = useId();
  const statusId = useId();

  useEffect(() => {
    applyPrivacyMode(active);
    return () => applyPrivacyMode(false);
  }, [active]);

  const toggle = () => {
    const next = !active;
    writePrivacyPreference(next);
    applyPrivacyMode(next);
    setActive(next);
  };

  return (
    <section className="privacy-toggle" aria-labelledby={headingId}>
      <div className="privacy-toggle__copy">
        <span className="privacy-toggle__icon" aria-hidden="true">
          {active ? "●" : "◉"}
        </span>
        <div>
          <h2 id={headingId}>Modo privacidad</h2>
          <p>Oculta las cifras del tablero cuando haya otras personas cerca.</p>
        </div>
      </div>

      <button
        className="privacy-toggle__button"
        type="button"
        aria-pressed={active}
        aria-describedby={statusId}
        onClick={toggle}
      >
        <span className="privacy-toggle__switch" aria-hidden="true">
          <span />
        </span>
        <span>{active ? "Mostrar cifras" : "Ocultar cifras"}</span>
      </button>

      <p
        className="privacy-toggle__status"
        id={statusId}
        role="status"
        aria-live="polite"
      >
        {active
          ? "Las cifras están ocultas en esta pantalla."
          : "Las cifras están visibles en esta pantalla."}
      </p>
      <small>
        Esta opción es visual y no sustituye los permisos de acceso.
      </small>
    </section>
  );
}
