#!/usr/bin/env node
// Comprobación posterior al despliegue: consulta /api/health de la web pública
// y, si se indica, de la API, y falla si no responde 200 con `status: "ok"`.
// /api/health comprueba la base de datos (503 si no responde) pero, al ser
// público, ya no detalla el estado (S-06); se acepta también la respuesta
// anterior con `database: "ok"` para verificar un despliegue previo.
//
// Uso: node deploy/render/post-deploy-check.mjs <URL_WEB> [URL_API]
//   o con NEXORA_WEB_URL / NEXORA_API_URL. La API es un servicio privado en
//   Render: sólo es alcanzable desde la red privada (p. ej. un shell del web).
// Salida: 0 si todo está bien, 1 si algún destino falla. No imprime cuerpos.

const targets = [
  ["web", process.argv[2] ?? process.env.NEXORA_WEB_URL],
  ["api", process.argv[3] ?? process.env.NEXORA_API_URL],
].filter(([, url]) => url);

if (!targets.length) {
  console.error("Uso: post-deploy-check.mjs <URL_WEB> [URL_API]");
  process.exit(2);
}

const timeoutMs = Number(process.env.NEXORA_CHECK_TIMEOUT_MS ?? 15000);
const attempts = Number(process.env.NEXORA_CHECK_ATTEMPTS ?? 6);
const delayMs = Number(process.env.NEXORA_CHECK_DELAY_MS ?? 10000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name, base) {
  let url;
  try {
    url = new URL("/api/health", base);
  } catch {
    return `${name}: URL no válida`;
  }
  let reason = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.json().catch(() => null);
      if (
        response.ok &&
        (body?.database === "ok" ||
          (body?.status === "ok" && body?.database === undefined))
      )
        return null;
      reason = response.ok
        ? `status=${JSON.stringify(body?.status ?? null)}`
        : `HTTP ${response.status}`;
    } catch (error) {
      reason =
        error?.name === "TimeoutError" ? "tiempo agotado" : "sin respuesta";
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return `${name}: ${url.origin}/api/health falló (${reason})`;
}

const failures = [];
for (const [name, base] of targets) {
  const failure = await check(name, base);
  if (failure) failures.push(failure);
  else console.log(`${name}: ok (API y base de datos)`);
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
