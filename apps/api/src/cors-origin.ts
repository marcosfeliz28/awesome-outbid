// Origen permitido por CORS. Sin WEB_ORIGIN, el valor por defecto (localhost de
// desarrollo) solo existe en desarrollo: en producción o en pruebas no hay origen
// por defecto y el navegador no recibe permiso cruzado.
export function corsOrigin(
  webOrigin: string | undefined,
  nodeEnv: string | undefined,
): string | false {
  const configured = webOrigin?.trim();
  if (configured) return configured;
  return nodeEnv === undefined || nodeEnv === "development"
    ? "http://localhost:5173"
    : false;
}
