// Antes de las pruebas de producto en vivo: la API debe ser local, responder y
// estar en modo producto (sin x-tenant-id, /api/products responde 400, como
// en scripts/producto-ci-smoke.sh). Si no, no se escribe nada.
import { requireLocalTargets } from "../setup/integration-api";
import { API, PLATFORM_TOKEN } from "./fixture";

export default async function setup() {
  requireLocalTargets({ ...process.env, FITSTORE_API_URL: API });
  if (!PLATFORM_TOKEN) throw new Error("Falta NEXORA_CI_PLATFORM_TOKEN.");
  const health = await fetch(API + "/health").catch(() => null);
  if (!health?.ok) throw new Error(`No hay API en ${API}.`);
  const products = await fetch(API + "/products");
  if (products.status !== 400)
    throw new Error(
      `La API de ${API} no está en modo producto (GET /products sin empresa: ${products.status}).`,
    );
}
