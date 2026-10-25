/** El servidor local es la única autoridad para firma, pago y reloj. */
export async function requireLocalLicenseWrite(
  enabled: boolean,
  fetcher: typeof fetch = fetch,
) {
  if (!enabled) return;
  let response: Response;
  try {
    response = await fetcher("/api/local-license/status", {
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No se pudo comprobar la licencia local. No cobres hasta reconectar con el servidor de esta PC.",
    );
  }
  if (!response.ok || (await response.json()).mode !== "write")
    throw new Error(
      "La licencia local está en solo lectura. No se puede cobrar ni agregar ventas a la cola.",
    );
}
