import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function databaseConfig(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("BACKUP_DATABASE_URL no es válida.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("BACKUP_DATABASE_URL debe usar PostgreSQL.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !url.username || !database) {
    throw new Error(
      "BACKUP_DATABASE_URL debe incluir host, usuario y base de datos.",
    );
  }
  const env = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
    PGAPPNAME: "nexora-daily-backup",
    PGCONNECT_TIMEOUT: "20",
  };
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode) env.PGSSLMODE = sslMode;
  return { database, env };
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable requerida ${name}.`);
  return value;
}

function run(tool, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, { env, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${tool} falló (código ${code}).`)),
    );
  });
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function createCloudBackup() {
  const { database, env: pgEnv } = databaseConfig(
    required("BACKUP_DATABASE_URL"),
  );
  const bucket = required("S3_BUCKET_NAME");
  const region = required("AWS_REGION");
  const prefix = (process.env.BACKUP_PREFIX || "nexora/postgres").replace(
    /^\/+|\/+$/g,
    "",
  );
  if (!/^[a-zA-Z0-9._/-]+$/.test(prefix) || prefix.includes("..")) {
    throw new Error("BACKUP_PREFIX sólo admite rutas sencillas sin '..'.");
  }
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const id = randomUUID();
  const filename = `nexora-${timestamp}-${id}.dump`;
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${filename}`;
  const tempDir = await mkdtemp(join(tmpdir(), "nexora-backup-"));
  await chmod(tempDir, 0o700);
  const archive = join(tempDir, filename);
  const manifestPath = join(tempDir, `${filename}.json`);
  const checksumPath = join(tempDir, `${filename}.sha256`);
  const awsEnv = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: process.env.HOME ?? "/home/node",
    AWS_REGION: region,
    AWS_DEFAULT_REGION: region,
    AWS_ACCESS_KEY_ID: required("AWS_ACCESS_KEY_ID"),
    AWS_SECRET_ACCESS_KEY: required("AWS_SECRET_ACCESS_KEY"),
  };
  if (process.env.AWS_SESSION_TOKEN) {
    awsEnv.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
  }

  try {
    await run(
      "pg_dump",
      ["--format=custom", "--no-password", "--file", archive],
      pgEnv,
    );
    await chmod(archive, 0o600);
    const bytes = (await stat(archive)).size;
    if (!bytes) throw new Error("pg_dump produjo una copia vacía.");
    await run("pg_restore", ["--list", archive], pgEnv);
    const digest = await sha256(archive);
    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      database,
      bytes,
      sha256: digest,
      file: filename,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(checksumPath, `${digest} *${filename}\n`, {
      mode: 0o600,
      flag: "wx",
    });

    const destination = `s3://${bucket}/${key}`;
    await run(
      "aws",
      [
        "s3",
        "cp",
        archive,
        destination,
        "--only-show-errors",
        "--sse",
        "AES256",
      ],
      awsEnv,
    );
    await run(
      "aws",
      [
        "s3",
        "cp",
        checksumPath,
        `${destination}.sha256`,
        "--only-show-errors",
        "--sse",
        "AES256",
      ],
      awsEnv,
    );
    // The manifest is uploaded last; laptop clients treat it as the commit marker.
    await run(
      "aws",
      [
        "s3",
        "cp",
        manifestPath,
        `${destination}.json`,
        "--only-show-errors",
        "--sse",
        "AES256",
      ],
      awsEnv,
    );
    console.log(`Copia verificada y enviada al bucket privado: ${key}`);
    return { key, bytes, sha256: digest };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  createCloudBackup().catch((error) => {
    // Do not print environment variables, connection strings, or credentials.
    console.error(`Respaldo cloud falló: ${error.message}`);
    process.exitCode = 1;
  });
}
