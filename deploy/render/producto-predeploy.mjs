// preDeployCommand del producto: Render no respeta comillas en esa orden,
// así que los dos pasos van aquí, en orden y deteniéndose al primer fallo:
// 1) rol RLS (scripts/producto-bootstrap.sql, idempotente) y 2) migraciones.
import { spawnSync } from "node:child_process";

const prisma = "apps/api/node_modules/prisma/build/index.js";
const schema = ["--schema", "apps/api/prisma/schema.prisma"];
const steps = [
  ["db", "execute", "--file", "scripts/producto-bootstrap.sql", ...schema],
  ["migrate", "deploy", ...schema],
];
for (const args of steps) {
  const run = spawnSync(
    process.execPath,
    ["deploy/render/with-cloud-env.mjs", process.execPath, prisma, ...args],
    { stdio: "inherit" },
  );
  if (run.status !== 0) process.exit(run.status ?? 1);
}
