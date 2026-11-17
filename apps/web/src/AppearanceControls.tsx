import { useEffect, useState } from "react";
export type Accent = "green" | "blue";
export const ACCENT_KEY = "noxeros-visual-accent";
export function resolveAccent(value: string | null): Accent {
  return value === "blue" ? "blue" : "green";
}
function initialAccent(): Accent {
  try {
    return resolveAccent(localStorage.getItem(ACCENT_KEY));
  } catch {
    return "green";
  }
}
/** Visual preference only; never reads or changes business data. */
export function AppearanceControls({
  language = "es",
}: {
  language?: "es" | "en";
}) {
  const [accent, setAccent] = useState<Accent>(initialAccent);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* session still works */
    }
  }, [accent]);
  const en = language === "en";
  return (
    <div
      className="fusion-appearance"
      role="group"
      aria-label={en ? "Overview accent color" : "Color de Inicio"}
    >
      {(["green", "blue"] as const).map((color) => (
        <button
          key={color}
          type="button"
          className={`fusion-accent-choice fusion-accent-${color}`}
          aria-pressed={accent === color}
          onClick={() => setAccent(color)}
        >
          <span aria-hidden="true" className="fusion-accent-swatch" />
          {color === "green"
            ? en
              ? "Emerald"
              : "Esmeralda"
            : en
              ? "Sapphire"
              : "Zafiro"}
        </button>
      ))}
    </div>
  );
}
