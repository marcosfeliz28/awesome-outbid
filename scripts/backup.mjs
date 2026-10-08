import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import {
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/api/package.json"));
require("dotenv").config({ path: resolve(root, ".env"), quiet: true });

function getDatabaseConfig(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL no es una URL PostgreSQL válida.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL debe usar el protocolo PostgreSQL.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !database || !url.username) {
    throw new Error(
      "DATABASE_URL debe incluir servidor, usuario y base de datos.",
    );
  }

  const env = {
    PATH: process.env.PATH ?? "",
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGAPPNAME: "nexora-pos-backup",
  };
  for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode) env.PGSSLMODE = sslMode;
  const sslRootCert = url.searchParams.get("sslrootcert");
  if (sslRootCert) env.PGSSLROOTCERT = sslRootCert;
  return { database, env };
}

function run(tool, args, env, missingMessage, failedMessage) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(tool, args, { stdio: "inherit", env });
    child.on("error", (error) => {
      reject(error.code === "ENOENT" ? new Error(missingMessage) : error);
    });
    child.on("exit", (code) =>
      code === 0 ? resolveExit() : reject(new Error(failedMessage)),
    );
  });
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Configura DATABASE_URL con la base que deseas respaldar.");
  }
  const { database, env } = getDatabaseConfig(process.env.DATABASE_URL);
  const output = resolve(
    process.env.NEXORA_BACKUP_DIR || resolve(root, "backups"),
  );
  await mkdir(output, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const databaseSlug = database.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const filename = `nexora-${databaseSlug}-${stamp}.dump`;
  const finalPath = resolve(output, filename);
  const temporaryPath = `${finalPath}.incompleto`;
  const pgDump = process.env.PG_DUMP_BIN || "pg_dump";
  const pgRestore = process.env.PG_RESTORE_BIN || "pg_restore";

  try {
    await run(
      pgDump,
      ["--format=custom", "--no-password", "--file", temporaryPath],
      env,
      `No se encontró ${pgDump}. Agrega PostgreSQL al PATH o indica PG_DUMP_BIN.`,
      "Falló pg_dump; no se reemplazó ni eliminó ningún respaldo anterior.",
    );
    const archive = await stat(temporaryPath);
    if (archive.size === 0) throw new Error("pg_dump creó un archivo vacío.");
    await run(
      pgRestore,
      ["--list", temporaryPath],
      env,
      `No se encontró ${pgRestore}. Agrega PostgreSQL al PATH o indica PG_RESTORE_BIN.`,
      "pg_restore no pudo verificar el respaldo; se descartará la copia incompleta.",
    );

    await rename(temporaryPath, finalPath);
    const digest = await sha256(finalPath);
    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      database,
      bytes: archive.size,
      sha256: digest,
      file: filename,
    };
    const hashPath = `${finalPath}.sha256`;
    const manifestPath = `${finalPath}.json`;
    await writeFile(`${hashPath}.tmp`, `${digest} *${filename}\n`, {
      flag: "wx",
    });
    await writeFile(
      `${manifestPath}.tmp`,
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    await rename(`${hashPath}.tmp`, hashPath);
    await rename(`${manifestPath}.tmp`, manifestPath);

    const cutoff = Date.now() - 30 * 86400000;
    for (const name of await readdir(output)) {
      if (
        !name.startsWith(`nexora-${databaseSlug}-`) ||
        !name.endsWith(".dump")
      )
        continue;
      const path = resolve(output, name);
      if ((await stat(path)).mtimeMs >= cutoff) continue;
      await unlink(path);
      await unlink(`${path}.sha256`).catch(() => {});
      await unlink(`${path}.json`).catch(() => {});
    }
    console.log(
      `Respaldo PostgreSQL verificado: ${finalPath} (retención: 30 días).`,
    );
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    await unlink(`${finalPath}.sha256.tmp`).catch(() => {});
    await unlink(`${finalPath}.json.tmp`).catch(() => {});
    throw error;
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { getDatabaseConfig, main };
