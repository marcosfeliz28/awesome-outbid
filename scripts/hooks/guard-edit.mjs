import process from "node:process";
// Hook PreToolUse (Edit|Write): bloquea editar migraciones ya existentes, el lockfile y archivos .env.
// Lee el JSON del evento por stdin. Sale con código 2 (y mensaje en stderr) para bloquear.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

let file = "";
try {
  file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path ?? "";
} catch {
  process.exit(0); // sin entrada válida no se bloquea nada
}
// Ruta absoluta y real (resuelve .., rutas relativas y enlaces simbólicos); si el archivo aún no existe, se usa la ruta resuelta.
let abs = resolve(process.cwd(), file);
try {
  abs = realpathSync(abs);
} catch {
  // se ignora a propósito: el hook nunca debe romper el trabajo
}
const p = abs.replaceAll("\\", "/").toLowerCase();
const block = (why) => {
  console.error(`Bloqueado por regla del repo: ${why}`);
  process.exit(2);
};

if (/(^|\/)\.env(\.[^/]*)?$/.test(p) && !p.endsWith(".env.example"))
  block(
    "no se editan archivos .env (los secretos van en Render, nunca en el repo).",
  );
if (/(^|\/)pnpm-lock\.yaml$/.test(p))
  block("el lockfile se regenera con pnpm install, no a mano.");
if (/apps\/api\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(p)) {
  let tracked = false;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", abs], {
      stdio: "ignore",
    });
    tracked = true;
  } catch {
    // se ignora a propósito: el hook nunca debe romper el trabajo
  }
  if (tracked)
    block(
      "las migraciones existentes no se reescriben; crea una migración nueva y aditiva.",
    );
}
process.exit(0);
