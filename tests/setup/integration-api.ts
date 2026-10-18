// Comprobación previa de las suites de integración (auditoría 07 v2, Q-08).
// Doce suites usan por defecto http://127.0.0.1:3001/api sin saber QUÉ API
// contesta ahí: con otra copia del repositorio en ese puerto la corrida probaba
// la API equivocada sobre la base equivocada y no avisaba. Antes de empezar:
//  1. la API de FITSTORE_API_URL (o :3001) debe responder;
//  2. debe usar la MISMA base que DATABASE_URL: se inicia sesión como el
//     administrador demo y la sesión recién creada tiene que existir en esa base.
// Si no, la corrida falla de inmediato con un mensaje que dice qué hacer.
// NEXORA_TEST_SKIP_API_CHECK=1 omite salud/login, pero nunca la validación local.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assertSafeTestTargets } from "../../scripts/test-target-safety.mjs";

export const DEFAULT_API = "http://127.0.0.1:3001/api";

/** host:puerto/base de una URL de conexión, sin usuario ni contraseña. */
export function databaseLabel(url: string | undefined) {
  if (!url) return "(DATABASE_URL sin definir)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL no válida)";
  }
}

export type ApiCheckOptions = {
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  /** ¿Existe en la base de las pruebas la sesión con este id? */
  sessionExists: (sessionId: string) => Promise<boolean>;
};

export async function verifyIntegrationApi({
  env = process.env,
  fetchFn = fetch,
  sessionExists,
}: ApiCheckOptions) {
  const base = (env.FITSTORE_API_URL || DEFAULT_API).replace(/\/+$/, "");
  assertSafeTestTargets({
    apiUrl: base,
    proxyUrl: env.FITSTORE_API_PROXY,
    databaseUrl: env.DATABASE_URL,
    env,
  });
  if (env.NEXORA_TEST_SKIP_API_CHECK === "1") return "omitida";
  const how =
    "Arranca la API de este repositorio sobre la base de DATABASE_URL " +
    "(`pnpm --filter @fitstore/api dev`), usa `pnpm verify` (arranca la suya) " +
    "o apunta FITSTORE_API_URL a la API correcta. Si sólo corres suites que " +
    "arrancan su propia API (Drive, Telegram), define NEXORA_TEST_SKIP_API_CHECK=1.";
  let health: Response;
  try {
    health = await fetchFn(base + "/health", {
      signal: AbortSignal.timeout(5000),
    });
  } catch (error: any) {
    throw new Error(
      `No hay una API que responda en ${base} (${error?.cause?.code ?? error?.message ?? error}). ${how}`,
    );
  }
  if (!health.ok)
    throw new Error(
      `La API de ${base} respondió HTTP ${health.status} a /health. ${how}`,
    );
  const login = await fetchFn(base + "/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.18.250." + (1 + Math.floor(Math.random() * 250)),
    },
    body: JSON.stringify({
      email: "admin@fitstore.demo",
      password: env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body: any = await login.json().catch(() => null);
  if (!login.ok || typeof body?.accessToken !== "string")
    throw new Error(
      `La API de ${base} no dejó entrar al administrador demo (HTTP ${login.status}). ` +
        `Puede ser otra copia del sistema o una base sin sembrar (pnpm db:seed). ${how}`,
    );
  let sessionId: unknown;
  try {
    sessionId = JSON.parse(
      Buffer.from(body.accessToken.split(".")[1], "base64url").toString(),
    ).sid;
  } catch {
    sessionId = undefined;
  }
  if (typeof sessionId !== "string")
    throw new Error(
      `La API de ${base} devolvió un token sin sesión: no es la API de este repositorio. ${how}`,
    );
  if (!(await sessionExists(sessionId)))
    throw new Error(
      `La API de ${base} NO usa la base de datos de las pruebas (${databaseLabel(env.DATABASE_URL)}): ` +
        "la sesión que acaba de crear no existe ahí. Probablemente contesta otra copia del repositorio " +
        "o está conectada a otra base. " +
        how,
    );
  return base;
}

// Punto de entrada de Vitest (globalSetup de vitest.integration.config.ts).
export default async function setup() {
  const requireApi = createRequire(
    new URL("../../apps/api/package.json", import.meta.url),
  );
  requireApi("dotenv").config({
    path: fileURLToPath(new URL("../../.env", import.meta.url)),
    quiet: true,
  });
  const base = (process.env.FITSTORE_API_URL || DEFAULT_API).replace(
    /\/+$/,
    "",
  );
  assertSafeTestTargets({
    apiUrl: base,
    proxyUrl: process.env.FITSTORE_API_PROXY,
    databaseUrl: process.env.DATABASE_URL,
    env: process.env,
  });
  if (process.env.NEXORA_TEST_SKIP_API_CHECK === "1") return;
  const { PrismaClient } = requireApi("@prisma/client");
  const db = new PrismaClient();
  try {
    await verifyIntegrationApi({
      sessionExists: async (id) =>
        !!(await db.authSession.findUnique({ where: { id } })),
    });
  } finally {
    await db.$disconnect();
  }
}
