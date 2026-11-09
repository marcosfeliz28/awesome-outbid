import process from "node:process";
// Hook PostToolUse (Edit|Write): formatea con Prettier el archivo editado. Nunca falla ni bloquea.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, relative, isAbsolute } from "node:path";
try {
  const file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path ?? "";
  const abs = resolve(process.cwd(), file);
  const rel = relative(process.cwd(), abs);
  // Solo archivos dentro del repo (nada fuera ni que empiece con "-").
  if (
    rel &&
    !rel.startsWith("..") &&
    !isAbsolute(rel) &&
    /\.(ts|tsx|js|mjs|json|css|md)$/.test(rel) &&
    !/node_modules|pnpm-lock|migration\.sql/.test(rel)
  )
    execFileSync("pnpm", ["exec", "prettier", "--write", "--", rel], {
      stdio: "ignore",
      timeout: 20000,
    });
} catch {
  // se ignora a propósito: el hook nunca debe romper el trabajo
}
process.exit(0);
