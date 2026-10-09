import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import {
  mkdir,
  readFile,
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

// Comprueba el dump contra su manifiesto (.json) y su .sha256. Lanza si algo
// no coincide: un dump truncado pasa `pg_restore --list` (el índice va al
// inicio), por eso el SHA-256 es la verificación que cuenta.
async function verifyDump(dumpPath) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(`${dumpPath}.json`, "utf8"));
  } catch {
    throw new Error(`No se pudo leer el manifiesto ${dumpPath}.json.`);
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.sha256 ?? "")) {
    throw new Error("El manifiesto no contiene un SHA-256 válido.");
  }
  let sidecar;
  try {
    sidecar = (await readFile(`${dumpPath}.sha256`, "utf8"))
      .trim()
      .split(/\s+/)[0];
  } catch {
    throw new Error(`No se pudo leer ${dumpPath}.sha256.`);
  }
  if (sidecar !== manifest.sha256) {
    throw new Error("El .sha256 no coincide con el manifiesto.");
  }
  const actualBytes = (await stat(dumpPath)).size;
  if (manifest.bytes !== actualBytes) {
    throw new Error(
      `Tamaño distinto al del manifiesto (${actualBytes} B, esperado ${manifest.bytes} B).`,
    );
  }
  const actual = await sha256(dumpPath);
  if (actual !== manifest.sha256) {
    throw new Error("El SHA-256 del dump no coincide con su manifiesto.");
  }
  return manifest;
}

// pg_restore --list sin volcar el índice: solo conteo; los errores salen por stderr.
function listSummary(tool, archive, env, missingMessage) {
  return new Promise((resolveSummary, reject) => {
    const child = spawn(tool, ["--list", archive], {
      stdio: ["ignore", "pipe", "inherit"],
      env,
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", (error) => {
      reject(error.code === "ENOENT" ? new Error(missingMessage) : error);
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            "pg_restore no pudo verificar el respaldo; se descartará la copia incompleta.",
          ),
        );
      }
      const entries = out.split("\n").filter((l) => /^\d+;/.test(l));
      resolveSummary({
        entries: entries.length,
        tables: entries.filter((l) => l.includes(" TABLE DATA ")).length,
      });
    });
  });
}

// Restaura un respaldo verificando antes su SHA-256. Por defecto usa
// --single-transaction --exit-on-error: si algo falla, la base destino queda
// sin cambios (sin tablas parciales). --single-transaction NO es compatible con
// --jobs; con `jobs > 1` se restaura en paralelo sin transacción única, y un
// fallo puede dejar objetos parciales: úsalo solo en una base nueva y
// descartable, que se borra si falla.
async function restoreDump(dumpPath, databaseUrl, { jobs = 1 } = {}) {
  await verifyDump(dumpPath);
  const { env } = getDatabaseConfig(databaseUrl);
  const args = [
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--no-password",
  ];
  if (jobs > 1) args.push("--jobs", String(jobs));
  else args.push("--single-transaction");
  args.push("--dbname", env.PGDATABASE, dumpPath);
  await run(
    process.env.PG_RESTORE_BIN || "pg_restore",
    args,
    env,
    "No se encontró pg_restore. Agrega PostgreSQL al PATH o indica PG_RESTORE_BIN.",
    "Falló pg_restore; la restauración no se dio por buena.",
  );
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
    const summary = await listSummary(
      pgRestore,
      temporaryPath,
      env,
      `No se encontró ${pgRestore}. Agrega PostgreSQL al PATH o indica PG_RESTORE_BIN.`,
    );
    console.log(
      `Índice del respaldo: ${summary.entries} entradas, ${summary.tables} tablas con datos.`,
    );

    const digest = await sha256(temporaryPath);
    await rename(temporaryPath, finalPath);
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
    try {
      await verifyDump(finalPath);
    } catch (error) {
      await unlink(finalPath).catch(() => {});
      await unlink(hashPath).catch(() => {});
      await unlink(manifestPath).catch(() => {});
      throw new Error(`Respaldo descartado: ${error.message}`);
    }

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

export { getDatabaseConfig, listSummary, main, restoreDump, verifyDump };
