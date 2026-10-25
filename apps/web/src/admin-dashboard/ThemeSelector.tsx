import type { AdminTheme } from "./preferences";
import { ADMIN_THEMES, adminThemeLabel } from "./preferences";

export function ThemeSelector({
  value,
  onChange,
}: {
  value: AdminTheme;
  onChange: (theme: AdminTheme) => void;
}) {
  return (
    <fieldset className="admin-theme-selector">
      <legend>Estilo del tablero administrativo</legend>
      <p>Se guarda solamente en este equipo.</p>
      <div>
        {ADMIN_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            aria-pressed={theme === value}
            onClick={() => onChange(theme)}
          >
            <span aria-hidden="true" data-theme-swatch={theme} />
            {adminThemeLabel(theme)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
