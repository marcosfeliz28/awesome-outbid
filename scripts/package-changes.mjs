import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pack } from "./package.mjs";
import {
  includeAuditFile,
  validateAuditFile,
} from "./package-external-audit.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      result.stderr.trim() || "No se pudo leer el estado de Git.",
    );
  return result.stdout;
}

const tracked = git(["diff", "--name-only", "HEAD", "--"]);
const untracked = git(["ls-files", "--others", "--exclude-standard"]);
const changed = new Set(
  [tracked, untracked]
    .join("\n")
    .split(/\r?\n/)
    .map((path) => path.trim().replaceAll("\\", "/"))
    .filter(Boolean),
);
const output = resolve(
  process.argv[2] || resolve(root, "outputs/entrega/Nexora-POS-Cambios.zip"),
);
const result = pack(root, output, {
  prefix: "nexora-pos-cambios/",
  include: (path) => changed.has(path) && includeAuditFile(path),
  validate: validateAuditFile,
});
const digest = createHash("sha256").update(readFileSync(output)).digest("hex");
writeFileSync(
  `${output}.sha256.txt`,
  `${digest}  ${output.split(/[\\/]/).pop()}\n`,
);
console.log(
  JSON.stringify({ output, files: result.files, sha256: digest }, null, 2),
);
