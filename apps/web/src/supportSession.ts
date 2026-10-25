// Sesión de soporte de solo lectura: la hora a la que vence, leída del propio
// token (claim `exp`), en la hora de la tienda.
export function supportExpiresAt(token: string | null | undefined): Date | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof json.exp === "number" ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}
export const supportBannerText = (expiresAt: Date | null) =>
  "Modo soporte · solo lectura" +
  (expiresAt
    ? " · vence " +
      expiresAt.toLocaleTimeString("es-DO", {
        timeZone: "America/Santo_Domingo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "");
