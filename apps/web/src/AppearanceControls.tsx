import { useEffect, useState } from "react";
import { useStore } from "./api";
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
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [black, setBlack] = useState(() => {
    try {
      return localStorage.getItem("noxeros-overview-black") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.overviewSurface =
      theme === "dark" && black ? "black" : "standard";
    try {
      localStorage.setItem("noxeros-overview-black", String(black));
    } catch {
      /* session usable */
    }
    return () => {
      delete document.documentElement.dataset.overviewSurface;
    };
  }, [theme, black]);
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
      <div
        className="fi-theme-options"
        role="group"
        aria-label={en ? "Overview theme" : "Tema de Inicio"}
      >
        {(["light", "dark", "black"] as const).map((choice) => (
          <button
            type="button"
            key={choice}
            className="fusion-accent-choice"
            aria-pressed={
              choice === "light"
                ? theme === "light"
                : theme === "dark" && (choice === "black" ? black : !black)
            }
            onClick={() => {
              const next = choice === "light" ? "light" : "dark";
              if (theme !== next) toggleTheme();
              setBlack(choice === "black");
            }}
          >
            {choice === "light"
              ? en
                ? "Light"
                : "Claro"
              : choice === "dark"
                ? en
                  ? "Dark"
                  : "Oscuro"
                : en
                  ? "Black"
                  : "Negro"}
          </button>
        ))}
      </div>
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
