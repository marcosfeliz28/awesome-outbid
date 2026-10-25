export const ADMIN_THEME_KEY = "nexora-admin-theme";
export const ADMIN_PRIVACY_KEY = "nexora-admin-privacy";

export const ADMIN_THEMES = ["cristal", "ejecutivo", "mando"] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];

export function readAdminTheme(storage: Pick<Storage, "getItem"> = localStorage): AdminTheme {
  const saved = storage.getItem(ADMIN_THEME_KEY);
  return ADMIN_THEMES.includes(saved as AdminTheme)
    ? (saved as AdminTheme)
    : "cristal";
}

export function saveAdminTheme(
  theme: AdminTheme,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(ADMIN_THEME_KEY, theme);
}

export function adminThemeLabel(theme: AdminTheme) {
  return {
    cristal: "Cristal nocturno",
    ejecutivo: "Ejecutivo claro",
    mando: "Centro de mando",
  }[theme];
}
