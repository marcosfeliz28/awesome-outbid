// Paquete reproducible para una auditoría externa independiente.
// Incluye código, migraciones, pruebas, despliegue y notas de rondas; excluye
// anexos de validación, compilados, datos reales, respaldos y credenciales.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
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
  "compose.audit.yaml",
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "render.yaml",
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
  "instalador/lanzar-instalacion-silenciosa.ps1",
  "instalador/README.md",
  "instalador/THIRD_PARTY_NOTICES.txt",
  "instalador/VERSION",
  "instalador/build.ps1",
  "instalador/dependencias.lock.json",
  "instalador/diagnosticar-instalacion.ps1",
  "instalador/finalizar-instalacion.ps1",
  "instalador/reanudar-instalacion.ps1",
  "docs/DESPLIEGUE.md",
  "docs/DEPLOY-RENDER.md",
  "docs/INSTALADOR.md",
  "docs/MANUAL-CAJERO.md",
  "docs/RESPALDO_CLOUD_RENDER.md",
  "docs/RONDA_NEXORA_CHATGPT.md",
  "docs/AUDITORIA_CLAUDE_2_CORRECCIONES.md",
  "docs/SENTRY-API.md",
  "docs/INSTRUCCIONES_ARQUITECTURA.md",
  "docs/MANUAL.md",
  "docs/PRUEBA_ACEPTACION_CAJA.md",
  "docs/fiscal/REQUISITOS_FISCALES_RD.md",
  "docs/tienda/CUADRE_REPORTES_FACTURA.md",
  "docs/AUDITORIA_RONDA3_CHATGPT.md",
  "docs/AUDITORIA_RONDA4.md",
  "docs/AUDITORIA_RONDA6.md",
  "docs/AUDITORIA_RONDA7.md",
  "docs/AUDITORIA_RONDA8.md",
  "docs/AUDITORIA_RONDA9.md",
  "docs/REVISION_CLAUDE_RONDA2.md",
  "docs/REVISION_CLAUDE_RONDA3.md",
  "docs/REVISION_CLAUDE.md",
  "docs/RONDA4_CLAUDE.md",
  "docs/RONDA6_CLAUDE.md",
  "docs/RONDA7_CLAUDE.md",
  "docs/RONDA8_CLAUDE.md",
  "docs/RONDA9_CLAUDE.md",
]);

const DENIED_NAMES =
  /(^|\/)(\.env(?:$|\.)|credenciales?|credentials?|secrets?|tokens?)(?:$|[._-]|\/)/i;
const DENIED_BACKUPS =
  /(^|\/)backups?(?:\/|$)|(^|\/)backup[._-].*\.(?:dump|bak|sql|sql\.gz|zip)$/i;
const DENIED_EXTENSIONS =
  /\.(dump|bak|sql\.gz|xlsx|xls|csv|tsv|pdf|jpe?g|png|webp|exe|msi|7z|rar)$/i;
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
const SOURCE_BACKUP_DIR = "deploy/render/backup/";

function include(path) {
  if (
    DENIED_NAMES.test(path) ||
    (DENIED_BACKUPS.test(path) && !path.startsWith(SOURCE_BACKUP_DIR)) ||
    DENIED_EXTENSIONS.test(path)
  )
    return false;
  if (
    ROOT_FILES.has(path) ||
    EXACT_FILES.has(path) ||
    (path.startsWith("docs/") &&
      !path.slice(5).includes("/") &&
      /\.(?:md|txt)$/i.test(path))
  )
    return true;
  return ROOT_DIRS.some((dir) => path.startsWith(dir));
}

function validate(path, data) {
  if (!TEXT_EXTENSIONS.test(path)) return;
  const content = data.toString("utf8");
  for (const [label, pattern] of DENIED_CONTENT)
    if (pattern.test(content))
      throw new Error(`Contenido sensible (${label}) detectado en ${path}.`);
}

function exclusionReason(path) {
  if (DENIED_NAMES.test(path))
    return "nombre reservado para secretos/credenciales";
  if (DENIED_BACKUPS.test(path) && !path.startsWith(SOURCE_BACKUP_DIR))
    return "respaldo o datos de respaldo; sólo se incluye código fuente de backup cloud";
  if (DENIED_EXTENSIONS.test(path))
    return "datos reales, binario o formato no permitido";
  if (path.startsWith("docs/") && path.slice(5).includes("/"))
    return "material de validación histórica/anexos no incluido en el paquete de auditoría";
  return "fuera del alcance de código/documentación seleccionado para auditoría";
}

export { include as includeAuditFile, validate as validateAuditFile };

function isMain() {
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isMain()) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const output = resolve(
    process.argv[2] ||
      resolve(
        root,
        "../../outputs/auditoria-externa/Nexora-POS-Codigo-Auditoria.zip",
      ),
  );
  mkdirSync(dirname(output), { recursive: true });
  const result = pack(root, output, {
    include,
    prefix: "nexora-pos/",
    validate,
  });
  const digest = createHash("sha256")
    .update(readFileSync(output))
    .digest("hex");
  const manifest = output + ".sha256.txt";
  const exclusionsPath = output + ".excluidos.txt";
  const repositoryPaths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", windowsHide: true },
  )
    .split("\0")
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path && existsSync(resolve(root, path)) && !include(path))
    .sort();
  const exclusions = [
    "Nexora POS — exclusiones deliberadas del ZIP de auditoría",
    "",
    "No se incluyen datos de tienda ni archivos que no son necesarios para revisar el código.",
    "Cada ruta del inventario Git se enumera con su motivo:",
    ...repositoryPaths.map((path) => `- ${path} — ${exclusionReason(path)}.`),
    "",
    "También se excluyen por diseño, si existen, .git, node_modules, .pnpm-store, dist, test-results, coverage, target, build y carpetas de datos locales, según scripts/package.mjs.",
    "Los secretos y archivos sensibles se rechazan por nombre/extensión y el contenido de texto se analiza antes de empaquetar.",
  ].join("\n");
  writeFileSync(exclusionsPath, `${exclusions}\n`, "utf8");
  writeFileSync(
    manifest,
    `${digest}  ${output.split(/[\\/]/).pop()}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        output,
        manifest,
        exclusions: exclusionsPath,
        files: result.files,
        sha256: digest,
        directory: dirname(output),
      },
      null,
      2,
    ),
  );
}
