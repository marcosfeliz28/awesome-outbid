export const ADMIN_THEME_KEY = "nexora-admin-theme";
export const ADMIN_THEMES = ["cristal", "ejecutivo", "mando"] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];

function localPreferenceStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readAdminTheme(
  storage: Pick<Storage, "getItem"> | undefined = localPreferenceStorage(),
): AdminTheme {
  try {
    const saved = storage?.getItem(ADMIN_THEME_KEY);
    return ADMIN_THEMES.includes(saved as AdminTheme)
      ? (saved as AdminTheme)
      : "cristal";
  } catch {
    return "cristal";
  }
}

export function saveAdminTheme(
  theme: AdminTheme,
  storage: Pick<Storage, "setItem"> | undefined = localPreferenceStorage(),
) {
  try {
    storage?.setItem(ADMIN_THEME_KEY, theme);
  } catch {
    // El tema sigue activo durante la sesión aunque el equipo bloquee storage.
  }
}

export function adminThemeLabel(theme: AdminTheme) {
  return {
    cristal: "Cristal nocturno",
    ejecutivo: "Ejecutivo claro",
    mando: "Centro de mando",
  }[theme];
}
