import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
mkdirSync(resolve(root, "test-results"), { recursive: true });
function launch(command, args, name) {
  const log = openSync(resolve(root, "test-results", name + ".log"), "w");
  const child = spawn(command, args, {
    cwd: root,
    stdio: ["ignore", log, log],
    env: process.env,
  });
  children.push(child);
  return child;
}
async function available(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}
async function wait(url) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (await available(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("No se pudo iniciar " + url + ". Consulta test-results.");
}
async function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Falló " + args.join(" "))),
    );
  });
}
try {
  if (!(await available("http://127.0.0.1:3001/api/health"))) {
    launch("node", ["scripts/local-db.mjs"], "database");
    launch("pnpm", ["--filter", "@fitstore/api", "dev"], "api");
    await wait("http://127.0.0.1:3001/api/health");
  }
  await run("pnpm", [
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.integration.config.ts",
  ]);
  await run("pnpm", ["test:e2e"]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const child of children) child.kill("SIGTERM");
}
