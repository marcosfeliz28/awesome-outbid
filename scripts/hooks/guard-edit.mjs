// Hook PreToolUse (Edit|Write): bloquea editar migraciones ya existentes, el lockfile y archivos .env.
// Lee el JSON del evento por stdin. Sale con código 2 (y mensaje en stderr) para bloquear.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let file = "";
try {
  file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path ?? "";
} catch {
  process.exit(0); // sin entrada válida no se bloquea nada
}
const p = file.replaceAll("\\", "/");
const block = (why) => {
  console.error(`Bloqueado por regla del repo: ${why}`);
  process.exit(2);
};

if (/(^|\/)\.env(\.[^/]*)?$/.test(p) && !p.endsWith(".env.example"))
  block("no se editan archivos .env (los secretos van en Render, nunca en el repo).");
if (/(^|\/)pnpm-lock\.yaml$/.test(p))
  block("el lockfile se regenera con pnpm install, no a mano.");
if (/apps\/api\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(p)) {
  let tracked = false;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "ignore" });
    tracked = true;
  } catch {}
  if (tracked)
    block("las migraciones existentes no se reescriben; crea una migración nueva y aditiva.");
}
process.exit(0);
