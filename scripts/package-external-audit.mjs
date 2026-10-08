// Paquete mínimo y reproducible para una auditoría externa independiente.
// Incluye código, migraciones, pruebas y documentación operativa; excluye
// compilados, datos reales, respaldos, credenciales y auditorías anteriores.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pack } from "./package.mjs";

const ROOT_FILES = new Set([
  ".dockerignore",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  ".prettierignore",
  "Dockerfile",
  "README.md",
  "compose.yaml",
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "vitest.integration.config.ts",
]);

const ROOT_DIRS = [
  ".github/workflows/",
  "apps/api/prisma/",
  "apps/api/scripts/",
  "apps/api/src/",
  "apps/web/public/",
  "apps/web/src/",
  "apps/web/src-tauri/",
  "deploy/",
  "instalador/assets/",
  "instalador/installer/",
  "instalador/runtime/",
  "instalador/scripts/",
  "instalador/service/",
  "instalador/tests/",
  "packages/",
  "scripts/",
  "tests/",
];

const EXACT_FILES = new Set([
  "apps/api/package.json",
  "apps/api/prisma.config.ts",
  "apps/api/tsconfig.json",
  "apps/web/capacitor.config.ts",
  "apps/web/index.html",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/vite.config.ts",
  "instalador/README.md",
  "instalador/THIRD_PARTY_NOTICES.txt",
  "instalador/VERSION",
  "instalador/build.ps1",
  "instalador/dependencias.lock.json",
  "instalador/diagnosticar-instalacion.ps1",
  "instalador/finalizar-instalacion.ps1",
  "instalador/reanudar-instalacion.ps1",
  "docs/DESPLIEGUE.md",
  "docs/INSTALADOR.md",
  "docs/INSTRUCCIONES_ARQUITECTURA.md",
  "docs/MANUAL.md",
  "docs/PRUEBA_ACEPTACION_CAJA.md",
  "docs/fiscal/REQUISITOS_FISCALES_RD.md",
  "docs/tienda/CUADRE_REPORTES_FACTURA.md",
]);

const DENIED_NAMES =
  /(^|\/)(\.env(?:$|\.)|credenciales?|credentials?|secrets?|tokens?)(?:$|[._-]|\/)/i;
const DENIED_BACKUPS =
  /(^|\/)backups?(?:\/|$)|(^|\/)backup[._-].*\.(?:dump|bak|sql|sql\.gz|zip)$/i;
const DENIED_EXTENSIONS = /\.(dump|bak|sql\.gz|xlsx|xls|csv|tsv|pdf|jpe?g|png|webp|exe|msi|7z|rar)$/i;
const TEXT_EXTENSIONS =
  /\.(?:ts|tsx|js|mjs|cjs|json|md|txt|ps1|nsi|sql|prisma|toml|ya?ml|html|css|svg|xml|example|npmrc|gitignore|dockerignore|gitattributes|prettierignore)$/i;
const DENIED_CONTENT = [
  ["clave privada", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["token OpenAI", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["token GitHub", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["clave AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["clave Google", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["ruta de usuario Windows", /[A-Za-z]:\\Users\\[^\\\r\n]+/i],
  ["correo local", /[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)*local\b/i],
];

function include(path) {
  if (
    DENIED_NAMES.test(path) ||
    DENIED_BACKUPS.test(path) ||
    DENIED_EXTENSIONS.test(path)
  )
    return false;
  if (ROOT_FILES.has(path) || EXACT_FILES.has(path)) return true;
  return ROOT_DIRS.some((dir) => path.startsWith(dir));
}

function validate(path, data) {
  if (!TEXT_EXTENSIONS.test(path)) return;
  const content = data.toString("utf8");
  for (const [label, pattern] of DENIED_CONTENT)
    if (pattern.test(content))
      throw new Error(`Contenido sensible (${label}) detectado en ${path}.`);
}

function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = resolve(
    process.argv[2] ||
      resolve(root, "../../outputs/auditoria-externa/Nexora-POS-Codigo-Auditoria.zip"),
  );
  mkdirSync(dirname(output), { recursive: true });
  const result = pack(root, output, {
    include,
    prefix: "nexora-pos/",
    validate,
  });
  const digest = createHash("sha256").update(readFileSync(output)).digest("hex");
  const manifest = output + ".sha256.txt";
  writeFileSync(manifest, `${digest}  ${output.split(/[\\/]/).pop()}\n`, "utf8");
  console.log(
    JSON.stringify(
      { output, manifest, files: result.files, sha256: digest, directory: dirname(output) },
      null,
      2,
    ),
  );
}
