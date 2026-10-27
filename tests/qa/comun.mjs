// Apoyo del recorrido QA (26-oct). SOLO contra una copia local de pruebas:
// WEB y API se rechazan si no son 127.0.0.1/localhost.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WEB = process.env.QA_WEB || "http://127.0.0.1:4173";
export const API = process.env.QA_API || "http://127.0.0.1:3001";
for (const u of [WEB, API]) {
  const h = new URL(u).hostname;
  if (!["127.0.0.1", "localhost"].includes(h))
    throw new Error("El recorrido solo corre contra una copia local: " + h);
}
// La clave de la semilla local sale de .env (no se imprime nunca).
function envLocal() {
  const f = join(raiz, ".env");
  const out = {};
  if (existsSync(f))
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  return out;
}
export const env = { ...envLocal(), ...process.env };
export const CLAVE = env.SEED_DEMO_PASSWORD;
export const ESTADO = join(raiz, "tests", "qa", ".estado.json");
export const ROLES = {
  admin: "admin@fitstore.demo",
  gerente: "gerente@fitstore.demo",
  cajera: "vendedor@fitstore.demo",
  gv: "gv@fitstore.demo",
};
