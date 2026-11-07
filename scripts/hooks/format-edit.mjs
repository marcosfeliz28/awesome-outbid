// Hook PostToolUse (Edit|Write): formatea con Prettier el archivo editado. Nunca falla ni bloquea.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
try {
  const file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path ?? "";
  if (/\.(ts|tsx|js|mjs|json|css|md)$/.test(file) && !/node_modules|pnpm-lock|migration\.sql/.test(file))
    execFileSync("pnpm", ["exec", "prettier", "--write", file], { stdio: "ignore", timeout: 20000 });
} catch {}
process.exit(0);
