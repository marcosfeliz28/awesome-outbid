#!/usr/bin/env node
// Guardia del Taller: hook PreToolUse que bloquea acciones peligrosas ANTES de ejecutarlas,
// sin importar qué plugin o skill las pida. Complementa los permisos; no los reemplaza.
// Reglamento: docs/coordinacion/SESIONES_Y_LIMITES.md · Informe: docs/seguridad/PLUGINS-PROFUNDA.md
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const PROTEGIDAS = ["nexora-cloud", "producto-nexora", "main", "master"];
const SERVIDORES_PROHIBIDOS = ["mcp__Render", "mcp__cloudeflare", "mcp__Cloudflare_Developer_Platform"];
const HOSTS_PRODUCCION = /(nexora-pos-web\.onrender\.com|nexora-pos-api[\w.-]*\.onrender\.com|nexorapos\.net|\.onrender\.com)/i;

const REGLAS_BASH = [
  [/\b(curl|wget)\b[^\n|;]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i, "descarga y ejecución directa (curl|sh)"],
  [/\b(bash|sh|zsh)\s+<\(\s*(curl|wget)\b/i, "ejecución de un script descargado"],
  [/\bnpm\s+(i|install|add)\s+(-g|--global)\b|\bpnpm\s+(add|install)\s+(-g|--global)\b|\byarn\s+global\b/i, "instalación global de paquetes"],
  [/\bnpm\s+publish\b|\bpnpm\s+publish\b/i, "publicar paquetes"],
  [/\bsudo\b/, "uso de sudo"],
  [/\b(update-ca-certificates|trust\s+anchor|security\s+add-trusted-cert)\b/i, "instalar certificados raíz"],
  [/(>>?|\btee\b(\s+-a)?)\s*(~|\$HOME|\/root|\/home\/[^/\s]+)?\/?\.?(bashrc|zshrc|profile|bash_profile|zprofile)\b/, "modificar el perfil del shell"],
  [/(>>?|\btee\b(\s+-a)?)\s*\/etc\/(hosts|resolv\.conf|environment)\b/, "modificar archivos del sistema de red"],
  [/\b(printenv|export\s+-p)\b|\benv\s*($|\||;|>)|\/proc\/[^\s]*\/environ|\bset\s*\|\s*grep/i, "volcar variables de entorno"],
  [/\becho\s+["']?\$\{?[A-Z0-9_]*(TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*/i, "imprimir una variable con credenciales"],
  [/(\.ssh\/|\.aws\/|\.config\/(gcloud|gh)\b|\.docker\/config|\.netrc|\.git-credentials|\.npmrc|\.pypirc|\.claude\/\.credentials|credentials\.json|id_(rsa|ed25519))/i, "leer o copiar archivos de credenciales"],
  [/\bcat\b[^\n|;]*\.env(\.[\w.-]+)?\b/i, "leer archivos .env"],
  [/\bnc\b\s+-[a-z]*l|\bngrok\b|\bcloudflared\b\s+(tunnel|access)|\bssh\s+-R\b|\bsocat\b/i, "abrir túneles o puertos hacia afuera"],
  [/\b(cron|crontab)\b\s+(-e|-)/i, "crear tareas programadas del sistema"],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)/, "borrado recursivo de raíz o home"],
];

function rutaNoPermitida(p, repo) {
  if (!p) return null;
  const ruta = resolve(repo, p);
  const casa = homedir();
  const sensibles = [
    join(casa, ".claude", "settings.json"),
    join(casa, ".claude", "CLAUDE.md"),
    join(casa, ".bashrc"),
    join(casa, ".zshrc"),
    join(casa, ".profile"),
    join(casa, ".ssh"),
    join(casa, ".aws"),
    "/etc/",
  ];
  for (const s of sensibles) if (ruta === s || ruta.startsWith(s.endsWith("/") ? s : s + "/")) return `escritura en ${s}`;
  if (!ruta.startsWith(resolve(repo) + "/") && !ruta.startsWith("/tmp/") && !ruta.startsWith(join(casa, ".claude", "projects"))) {
    return "escritura fuera del repositorio";
  }
  return null;
}

export function evaluar(entrada, repo = process.cwd()) {
  const nombre = String(entrada?.tool_name ?? "");
  const input = entrada?.tool_input ?? {};

  for (const s of SERVIDORES_PROHIBIDOS) {
    if (nombre === s || nombre.startsWith(s + "__")) return `el Taller no puede usar ${s} (producción)`;
  }
  if (nombre === "Bash") {
    const cmd = String(input.command ?? "");
    if (HOSTS_PRODUCCION.test(cmd)) return "el Taller no toca la tienda ni el producto en producción";
    for (const [re, motivo] of REGLAS_BASH) if (re.test(cmd)) return motivo;
    const push = cmd.match(/\bgit\s+push\b([^\n;&|]*)/);
    if (push) {
      const a = push[1];
      if (/--force|-f\b|--delete|\s:\w/.test(a)) return "git push forzado o de borrado";
      for (const r of PROTEGIDAS) {
        if (new RegExp(`(^|[\\s:/])${r}(\\s|$)`).test(a) || new RegExp(`HEAD:(refs/heads/)?${r}\\b`).test(a)) return `push a la rama protegida ${r}`;
      }
    }
  }
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(nombre)) {
    const motivo = rutaNoPermitida(input.file_path ?? input.notebook_path, repo);
    if (motivo) return motivo;
  }
  if (nombre === "WebFetch" && HOSTS_PRODUCCION.test(String(input.url ?? ""))) return "el Taller no consulta la producción";
  return null;
}

function registrar(linea) {
  try {
    const dir = join(homedir(), ".claude");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "guardia.log"), JSON.stringify({ t: new Date().toISOString(), ...linea }) + "\n");
  } catch {
    /* el registro nunca debe romper la guardia */
  }
}

async function main() {
  let texto = "";
  for await (const trozo of process.stdin) texto += trozo;
  let entrada;
  try {
    entrada = JSON.parse(texto);
  } catch {
    return; // sin datos legibles: deja seguir al flujo normal de permisos
  }
  const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const motivo = evaluar(entrada, repo);
  if (motivo) {
    registrar({ decision: "deny", tool: entrada.tool_name, motivo });
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Guardia del Taller: bloqueado (${motivo}). Si es necesario, pídele la orden a la dueña.`,
        },
      }),
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
