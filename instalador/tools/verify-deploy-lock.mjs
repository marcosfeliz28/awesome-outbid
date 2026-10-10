import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export function verifyDeployLock(source, deployed, sourceDir, deployDir) {
  const workspacePaths = new Set(
    Object.keys(source.importers).map((name) => path.resolve(sourceDir, name)),
  );
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
  for (const [name, entry] of Object.entries(deployed.snapshots ?? {})) {
    // Cada snapshot registry debe tener su paquete (sin sufijos de peers)
    // auditado arriba. Ninguna dependencia puede introducir versiones nuevas.
    const packageName = name.split("(")[0];
    if (!deployed.packages?.[packageName]) {
      throw new Error(`Snapshot sin paquete verificado: ${name}`);
    }
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
        if (
          !deployed.snapshots?.[key] &&
          !deployed.packages?.[key.split("(")[0]]
        ) {
          throw new Error(`Dependencia sin snapshot verificado: ${dependency}`);
        }
      }
    }
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
  console.log(
    `PASS: ${count} paquetes registry conservan nombre/version/integridad del lock verificado.`,
  );
}
