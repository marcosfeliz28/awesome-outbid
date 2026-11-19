// MOD-08: el tema sigue al equipo hasta que la persona elige uno. La elección
// manual (el botón de la luna o el sol) se guarda y siempre gana.
export type Theme = "light" | "dark";
export const THEME_KEY = "fitstore-theme";
export const THEME_COLOR: Record<Theme, string> = {
  light: "#7C3AED",
  dark: "#0b0f19",
};

export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
function systemPrefersDark(): boolean {
  try {
    return !!matchMedia?.("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function initialTheme(): Theme {
  return resolveTheme(storedTheme(), systemPrefersDark());
}

// Pinta el tema antes de que React dibuje: sin destello claro en equipos oscuros.
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

// Mientras no haya una elección guardada, un cambio del sistema se sigue.
export function followSystemTheme(onChange: (theme: Theme) => void) {
  try {
    const query = matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", (e) => {
      if (storedTheme() === "light" || storedTheme() === "dark") return;
      onChange(e.matches ? "dark" : "light");
    });
  } catch {
    /* sin matchMedia: se queda el tema actual */
  }
}
