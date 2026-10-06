import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/api/package.json"));
require("dotenv").config({ path: resolve(root, ".env"), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL.");
const url = new URL(process.env.DATABASE_URL);
const output = resolve(root, "backups");
await mkdir(output, { recursive: true });
const filename =
  "fitstore-" + new Date().toISOString().replace(/[:.]/g, "-") + ".dump";
const bin = process.env.PG_DUMP_BIN || "pg_dump";
const child = spawn(
  bin,
  ["--format=custom", "--file", resolve(output, filename)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.slice(1),
    },
  },
);
await new Promise((done, fail) => {
  // El instalador de PostgreSQL para Windows no agrega pg_dump al PATH.
  child.on("error", (error) =>
    fail(
      error.code === "ENOENT"
        ? new Error(
            `No se encontró ${bin}. Agrega la carpeta bin de PostgreSQL al PATH o indica la ruta completa de pg_dump en PG_DUMP_BIN.`,
          )
        : error,
    ),
  );
  child.on("exit", (code) =>
    code === 0
      ? done()
      : fail(
          new Error("Falló pg_dump; no se eliminó ningún respaldo anterior."),
        ),
  );
});
for (const name of await readdir(output)) {
  if (!/^fitstore-.*\.dump$/.test(name)) continue;
  const path = resolve(output, name);
  if ((await stat(path)).mtimeMs < Date.now() - 30 * 86400000)
    await unlink(path);
}
console.log(
  "Respaldo guardado en backups/" + filename + ". Retención local: 30 días.",
);
