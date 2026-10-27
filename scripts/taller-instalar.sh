#!/usr/bin/env bash
# Instala en ESTA sesión (solo en el Taller) los plugins pesados y apaga la telemetría.
# La sesión «Llaves» NO debe correr este script. Reglamento: docs/coordinacion/SESIONES_Y_LIMITES.md
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ -n "${NEXORA_LLAVES:-}" ]; then echo "Esta sesión tiene llaves; no instalar aquí." >&2; exit 1; fi
claude plugin marketplace add Yeachan-Heo/oh-my-claudecode || true
claude plugin marketplace add ChromeDevTools/chrome-devtools-mcp || true
claude plugin install oh-my-claudecode@omc --scope project
claude plugin install supabase@anthropic-plugin-directory --scope project
claude plugin install vercel@anthropic-plugin-directory --scope project
claude plugin install claude-code-setup@anthropic-plugin-directory --scope project
claude plugin install chrome-devtools-mcp@chrome-devtools-plugins --scope project
# Navegador sin cabeza para la nube (sin estadísticas de uso hacia Google).
cp taller/mcp.chrome-devtools-nube.json .mcp.json
# Telemetría apagada (solo local, no se sube).
python3 - <<'PY'
import json,os
p=".claude/settings.local.json"
d=json.load(open(p)) if os.path.exists(p) else {}
d.setdefault("env",{})["VERCEL_PLUGIN_TELEMETRY"]="off"
d.setdefault("env",{})["CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS"]="1"
d["enabledMcpjsonServers"]=["chrome-devtools-nube"]
json.dump(d,open(p,"w"),indent=2)
PY
echo "Plugins del Taller instalados. Reinicia la sesión para cargarlos."
