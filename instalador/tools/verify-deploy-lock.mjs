import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { log } from "node:console";

const fields = ["dependencies", "devDependencies", "optionalDependencies"];
function edges(entry, projectDir, sourceDir, includeDev = true) {
  const result = {};
  for (const field of fields) {
    if (!includeDev && field === "devDependencies") continue;
    result[field] = Object.fromEntries(
      Object.entries(entry[field] ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => {
          let version = typeof value === "string" ? value : value.version;
          if (version.startsWith("link:") || version.startsWith("file:")) {
            const base = version.startsWith("link:") ? projectDir : sourceDir;
            version = `${name}@${pathToFileURL(path.resolve(base, version.slice(5))).href}`;
          }
          return [name, version];
        }),
    );
  }
  return result;
}
function compareEdges(
  expected,
  actual,
  label,
  projectDir,
  sourceDir,
  deployDir,
  includeDev = true,
) {
  if (
    JSON.stringify(edges(expected, projectDir, sourceDir, includeDev)) !==
    JSON.stringify(edges(actual, deployDir, deployDir, includeDev))
  ) {
    throw new Error(
      `Dependencias de ${label} cambiaron respecto al lock fuente.`,
    );
  }
}

export function verifyDeployLock(source, deployed, sourceDir, deployDir) {
  const workspacePaths = new Set(
    Object.keys(source.importers).map((name) => path.resolve(sourceDir, name)),
  );
  const api = source.importers?.["apps/api"];
  if (!api || Object.keys(deployed.importers ?? {}).join() !== ".") {
    throw new Error(
      "El lock dedicado debe representar solamente la API original.",
    );
  }
  let registryCount = 0;
  for (const [name, entry] of Object.entries(deployed.packages ?? {})) {
    const resolution = entry.resolution;
    if (resolution?.integrity) {
      const original = source.packages?.[name]?.resolution;
      if (
        !original ||
        original.integrity !== resolution.integrity ||
        original.tarball !== resolution.tarball
      ) {
        throw new Error(`Paquete de registro nuevo o alterado: ${name}`);
      }
      registryCount++;
    } else if (resolution?.type === "directory") {
      if (!workspacePaths.has(path.resolve(deployDir, resolution.directory))) {
        throw new Error(`Directorio externo al workspace verificado: ${name}`);
      }
    } else {
      throw new Error(`Resolucion externa no verificable: ${name}`);
    }
  }
  if (!registryCount)
    throw new Error("El lock desplegado no contiene paquetes verificables.");
  for (const name of Object.keys(deployed.snapshots ?? {})) {
    // Cada snapshot registry debe tener su paquete (sin sufijos de peers)
    // auditado arriba. Ninguna dependencia puede introducir versiones nuevas.
    const packageName = name.split("(")[0];
    if (!deployed.packages?.[packageName]) {
      throw new Error(`Snapshot sin paquete verificado: ${name}`);
    }
    const resolution = deployed.packages[packageName].resolution;
    let original = source.snapshots?.[name];
    let projectDir = sourceDir;
    let includeDev = true;
    if (resolution.type === "directory") {
      projectDir = path.resolve(deployDir, resolution.directory);
      const importer = Object.keys(source.importers).find(
        (key) => path.resolve(sourceDir, key) === projectDir,
      );
      original = source.importers[importer];
      includeDev = false;
    }
    if (!original)
      throw new Error(`Snapshot nuevo respecto al lock fuente: ${name}`);
    compareEdges(
      original,
      deployed.snapshots[name],
      `snapshot ${name}`,
      projectDir,
      sourceDir,
      deployDir,
      includeDev,
    );
  }
  for (const entry of [
    ...Object.values(deployed.snapshots ?? {}),
    ...Object.values(deployed.importers ?? {}),
  ]) {
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      for (const [dependency, value] of Object.entries(entry[field] ?? {})) {
        const version = typeof value === "string" ? value : value.version;
        const key =
          version.startsWith("@") && version.includes("@file:")
            ? version
            : `${dependency}@${version}`;
        if (!deployed.snapshots?.[key]) {
          throw new Error(`Dependencia sin snapshot verificado: ${dependency}`);
        }
      }
    }
  }
  compareEdges(
    api,
    deployed.importers["."],
    "API",
    path.resolve(sourceDir, "apps/api"),
    sourceDir,
    deployDir,
  );
  const reachable = new Set();
  const queue = [deployed.importers["."]];
  while (queue.length) {
    const current = queue.pop();
    for (const field of fields) {
      for (const [name, value] of Object.entries(current[field] ?? {})) {
        const version = typeof value === "string" ? value : value.version;
        const key =
          version.startsWith("@") && version.includes("@file:")
            ? version
            : `${name}@${version}`;
        if (!reachable.has(key)) {
          reachable.add(key);
          queue.push(deployed.snapshots[key]);
        }
      }
    }
  }
  const reachablePackages = new Set(
    [...reachable].map((name) => name.split("(")[0]),
  );
  if (
    Object.keys(deployed.snapshots).some((name) => !reachable.has(name)) ||
    Object.keys(deployed.packages).some((name) => !reachablePackages.has(name))
  ) {
    throw new Error(
      "El lock dedicado contiene paquetes fuera del grafo original de API.",
    );
  }
  return registryCount;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [sourcePath, deployDir, expectedHash] = process.argv.slice(2);
  const bytes = readFileSync(sourcePath);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
    throw new Error("El lock fuente cambio despues de verificarse.");
  }
  // js-yaml ya pertenece al arbol bloqueado de la API; no se instala nada.
  const require = createRequire(
    path.join(path.resolve(deployDir), "package.json"),
  );
  const yaml = require("js-yaml");
  const source = yaml.load(bytes.toString("utf8"), {
    schema: yaml.JSON_SCHEMA,
  });
  const deployed = yaml.load(
    readFileSync(path.join(deployDir, "pnpm-lock.yaml"), "utf8"),
    { schema: yaml.JSON_SCHEMA },
  );
  const count = verifyDeployLock(
    source,
    deployed,
    path.dirname(sourcePath),
    path.resolve(deployDir),
  );
  log(
    `PASS: ${count} paquetes registry conservan nombre/version/integridad del lock verificado.`,
  );
}
