// Esta prueba cierra cajas abiertas o cambia restricciones de la base: se niega a correr si
// DATABASE_URL no es de este equipo (localhost, 127.0.0.1 o ::1). Llamar tras cargar el .env.
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]", "::1"];
export function exigirBaseLocal(env: NodeJS.ProcessEnv = process.env) {
  let host = "";
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    // Sin URL válida se trata como ajena.
  }
  if (!LOOPBACK.includes(host))
    throw new Error(
      "DATABASE_URL no es de este equipo: esta prueba sólo corre contra una base local (localhost, 127.0.0.1 o ::1).",
    );
}
