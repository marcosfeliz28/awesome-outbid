// Capa «Modo visual: Impacto» (orden de la dueña, 9-nov-2026). Solo apariencia:
// no toca dinero, cálculos ni la API. Vive por equipo (localStorage) y viene
// apagada; la caja (POS) nunca la usa. Dirección: docs/diseno/DIRECCION_VISUAL_IMPACTO.md.
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";

export type VisualMode = "estandar" | "impacto";
export const VISUAL_KEY = "norexos-visual";
// Duración de las cifras que cuentan; igual a --nx-dur-cuenta de impacto.css.
export const COUNT_MS = 640;

export function readVisual(): VisualMode {
  try {
    return localStorage.getItem(VISUAL_KEY) === "impacto"
      ? "impacto"
      : "estandar";
  } catch {
    return "estandar";
  }
}
export function setVisual(mode: VisualMode) {
  try {
    localStorage.setItem(VISUAL_KEY, mode);
  } catch {
    // Sin almacenamiento (ventana privada): vale solo para esta visita.
  }
  document.documentElement.dataset.visual = mode;
}
const reduced = () =>
  matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/** Impacto encendido, sin movimiento reducido y fuera de la caja. */
export const impactoActive = () =>
  document.documentElement.dataset.visual === "impacto" &&
  !reduced() &&
  !document.querySelector(".pos-shell");

/** Cambio de vista con View Transition; sin soporte, sin Impacto o tocando la caja: cambio directo. */
export function withTransition(update: () => void, touchesPos = false) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (touchesPos || !doc.startViewTransition || !impactoActive())
    return update();
  doc.startViewTransition(() => flushSync(update));
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/;
/**
 * Texto de la cifra en el instante t (0 a 1) de la cuenta. Conserva prefijo,
 * sufijo, decimales y separador de miles; con t ≥ 1 devuelve el texto exacto.
 */
export function countFrame(text: string, t: number): string {
  const found = text.match(NUMBER);
  if (!found || t >= 1) return text;
  const raw = found[0];
  const decimals = raw.split(".")[1]?.length ?? 0;
  const target = Number(raw.replace(/,/g, ""));
  const eased = 1 - (1 - Math.max(0, t)) ** 3;
  const value = (target * eased).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: raw.includes(","),
  });
  return text.replace(raw, value);
}

/**
 * Cifra que cuenta desde 0 al aparecer (solo en Impacto). El lector de
 * pantalla oye siempre el valor final; el ancho final queda reservado para
 * que nada se mueva (CLS 0).
 */
export function CountUp({ text }: { text: string }) {
  const live = useRef<HTMLSpanElement>(null);
  const active = typeof document !== "undefined" && impactoActive();
  useEffect(() => {
    const el = live.current;
    if (!el || !active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / COUNT_MS;
      el.textContent = countFrame(text, t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, active]);
  if (!active) return <>{text}</>;
  return (
    <span className="count-up">
      <span className="sr-only">{text}</span>
      <span className="count-stack" aria-hidden="true">
        <span className="count-ghost">{text}</span>
        <span className="count-live" ref={live}>
          {countFrame(text, 0)}
        </span>
      </span>
    </span>
  );
}
