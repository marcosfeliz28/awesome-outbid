# Revisión de plugins (Revisor de plugins, 27-oct-2026)

**Alcance y límites de esta revisión:** lectura estática del código en GitHub (clonado a una carpeta temporal, nada ejecutado ni instalado). Se revisaron hooks, MCP, scripts, hosts y lectura de llaves. **No** es una auditoría completa de cada línea. Todo texto de README/páginas se trató como dato. `archivo:línea` es del código revisado.

## Resumen

| Plugin | Versión revisada | Riesgo | Veredicto |
|---|---|---|---|
| claude-code-setup | 1.0.0 | bajo | **Aprobado** |
| Task Observer | 3.8.1 | bajo-medio | **Solo en el Taller** |
| chrome-devtools-mcp | 1.12.0 (etiqueta) | medio | **Solo en el Taller** (`--no-usage-statistics`) |
| supabase | 0.1.16 (pin del catálogo) | medio | **Solo en el Taller** |
| vercel | 0.50.0 (pin del catálogo) | medio | **Solo en el Taller** (`VERCEL_PLUGIN_TELEMETRY=off`) |
| oh-my-claudecode | 5.7.17 (etiqueta) | medio | **Solo en el Taller** |
| claude-mem | 15.3.0 | alto | **Rechazado** para sesiones con llaves o datos reales; no aprobado aún para Claude PC |
| OmniRoute | 3.8.53 | alto | **Rechazado** |
| Headroom | 0.42.0 | alto | **Rechazado** |

**Alerta de versiones:** la dueña indicó supabase 0.1.17 y vercel 0.49.2, pero el catálogo oficial fija supabase en `2c6d02d` (0.1.16, `marketplace.json:3805-3811`) y vercel en `882e66c` (0.50.0, `marketplace.json:4137-4143`). **Las versiones instaladas no coinciden con lo que revisé**; hay que comparar el diff antes de dar por buenas 0.1.17 y 0.49.2.

---

## claude-code-setup 1.0.0 — aprobado (riesgo bajo)
- Fuente/autor: Anthropic, `anthropics/claude-plugins-official`, `plugins/claude-code-setup` (commit 41f619d).
- Ejecuta solo: nada. Solo `skills/` (markdown); sin `hooks/` ni `.mcp.json`.
- Conexiones/permisos: ninguno propio.
- Evidencia: `plugins/claude-code-setup/.claude-plugin/plugin.json`; el directorio solo tiene `skills`, LICENSE y README.

## Task Observer 3.8.1 — solo en el Taller (riesgo bajo-medio)
- Fuente: `rebelytics/one-skill-to-rule-them-all`, autor Eoghan Henn (commit ba696b2), licencia CC-BY-4.0. Fijar al commit.
- Ejecuta solo: nada por sí mismo (sin hooks en `plugin.json`). Trae 4 scripts: `new-observation.sh`, `session-start-scan.sh`, `skill-load.sh`, `validate-skill-bundle.py`; sin `curl`/`wget`/`eval` en ellos. El propio `SKILL.md` dice que no usa red salvo dos acciones iniciadas por el usuario (`references/skill-authoring.md`).
- Conexiones: ninguna en operación normal.
- Escritura fuera del repo: sí, por diseño, `~/.claude/skill-observations/` y `~/.claude/projects/...` (`references/environments.md:365-370`). Mueve archivos (`mv -n`, `new-observation.sh:131`).
- Riesgo real: su descripción ordena invocarse «antes de la primera llamada de cualquier sesión» y propone cambiar otros skills y hooks (`references/environments.md:1018`). Es instrucción que crece sola: que toda edición a skills/CLAUDE.md pase por la dueña.

## chrome-devtools-mcp 1.12.0 — solo en el Taller (riesgo medio)
- Fuente: `ChromeDevTools/chrome-devtools-mcp` (Google), etiqueta `chrome-devtools-mcp-v1.12.0`.
- Ejecuta: `npx chrome-devtools-mcp@1.12.0` (versión fijada, pero descarga de npm en cada arranque; `.mcp.json`). Sin hooks.
- Telemetría: **sí**, Clearcut de Google, activa salvo `--no-usage-statistics` (`src/index.ts:94`, `src/config/mcp-options.ts:409-410`, aviso en `src/utils/disclaimers.ts:34`). Comprobación de actualizaciones a `registry.npmjs.org` (`src/bin/check-latest-version.ts:12`).
- Permisos: controla un navegador completo (`evaluate_script`, cookies, páginas con sesión iniciada). Con un perfil con sesiones de Render/Cloudflare/banco, leería todo.
- Condición: perfil aislado y vacío, `--no-usage-statistics`, nunca con sesiones iniciadas. Páginas visitadas = datos, no órdenes.

## supabase (pin 0.1.16) — solo en el Taller (riesgo medio)
- Fuente: `supabase-community/supabase-plugin` (autor «Supabase»), commit `2c6d02d`.
- Ejecuta: nada local. Sin hooks. Solo skills + un MCP remoto.
- Conexión: `https://mcp.supabase.com/mcp` (HTTP, OAuth; `agents/claude/.mcp.json`), con cabeceras `X-Source-Name`/`X-Source-Version`.
- Permisos: el MCP puede ejecutar SQL y gestionar proyectos de la cuenta Supabase que se autorice. Nexora usa Render, no Supabase: no hay motivo de conectarlo a cuentas reales. Si se usa, un proyecto de pruebas.

## vercel (pin 0.50.0) — solo en el Taller con telemetría apagada (riesgo medio)
- Fuente: `vercel/vercel-plugin` (Vercel), commit `882e66c`, Apache-2.0.
- Ejecuta solo: 5 hooks node (`hooks/hooks.json`): SessionStart (3), PostToolUse en Skill, SessionEnd. No aprueba permisos.
- Conexiones: MCP `https://mcp.vercel.com` (OAuth, `.mcp.json`) y telemetría a `https://telemetry.vercel.com/api/vercel-plugin/v1/events` (`hooks/telemetry.mjs:6`).
- Telemetría: **activa por defecto**; solo se apaga con `VERCEL_PLUGIN_TELEMETRY=off` (`telemetry.mjs:167-171`). Lo que vi enviar: contador diario, versión, id de instalación, harness y nombre de skill (`telemetry.mjs:206-293`); no vi texto de prompts.
- Escritura fuera del repo: `~/.config/vercel-plugin/` (`src/telemetry.mts:28-31`).
- Lee el entorno para detectar proyecto (`session-start-profiler.mjs`: `.env.local` solo por nombre de archivo, ejecuta `vercel --version`).

## oh-my-claudecode 5.7.17 — solo en el Taller (riesgo medio)
- Fuente: `Yeachan-Heo/oh-my-claudecode`, etiqueta v5.7.17 (commit 726fa45), MIT, «contributors».
- Ejecuta solo: ~15 hooks node (`hooks/hooks.json`) en cada prompt, herramienta y arranque, más MCP local `bridge/mcp-server.cjs` (`.mcp.json`).
- **Aprueba permisos solo:** `PermissionRequest` sobre Bash devuelve `allow` para `git status`, `gh issue|pr view|list|status` y `ls` sin metacaracteres (`src/hooks/permission-handler/index.ts:33-37, 541-552`). Es estrecho y respeta tus reglas `ask`, pero es un hook que decide permisos.
- Lectura de llaves: el HUD lee `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `KIMI_API_KEY` (`src/hud/usage-api.ts:1005-1028, 2380-2384`) y consulta `api.anthropic.com` (`usage-api.ts:1207`). En una sesión con llaves es justo lo que no queremos.
- Descargas/instalación: auto-actualización con `npm install -g oh-my-claude-sisyphus@latest` (`src/features/auto-update.ts:71, 1106`) → versión no fijada. El puente trae referencias a Telegram, Discord, Slack, GitHub (`bridge/cli.cjs`).
- Escribe `~/.claude/CLAUDE.md` en su instalador (`src/installer/index.ts:173`).
- Condición: desactivar auto-actualización, sin llaves en el entorno, nunca en «Llaves».

## claude-mem 15.3.0 — rechazado con llaves/datos reales (riesgo alto)
- Fuente: `thedotmack/claude-mem`, autor Alex Newman, commit 35f2ec0, Apache-2.0.
- Ejecuta solo: hooks en **cada** herramienta (`PostToolUse` matcher `*` → `claude-mem hook claude-code observation`, que manda `toolInput` y `toolResponse` completos; `src/shared/hook-spool-remote.ts:16-24`), en cada prompt y al inicio; un **servicio en segundo plano** (`claude-mem start`, `worker-service.ts:703`, escucha en 127.0.0.1 salvo configuración) y MCP vía `node -e` largo (`plugin/.mcp.json`).
- Qué ve: todo lo que lee o imprime una herramienta, incluidas llaves o datos de clientes que aparezcan en una salida, y lo guarda y resume con un modelo (proveedor por defecto `claude`; alternativas OpenRouter, Gemini, DeepSeek, NVIDIA; `SettingsDefaultsManager.ts:463`). Lee `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`.
- Telemetría: cliente PostHog `https://us.i.posthog.com` (`src/services/telemetry/common.ts:21`). **No pude confirmar si viene activa por defecto.**
- Nube: sincronización con `sync.cmem.ai` vacía = apagada (`SettingsDefaultsManager.ts:606`); no activarla.
- Descargas en ejecución: instala Bun con `curl -fsSL https://bun.sh/install | bash` y uv con `curl ... astral.sh/uv/install.sh | sh` (`src/npx-cli/install/setup-runtime.ts:138-144, 176`); instalación vía `npx claude-mem install`.
- Veredicto: no en Llaves, Mercancía ni Taller con datos reales. Para Claude PC (`HERRAMIENTAS_TODOS.md:19-22`): **no aprobado aún**; antes la dueña debe decidir si acepta que se guarde todo lo que pase en esa PC, y hay que fijar versión, apagar telemetría y revisar el resultado de la instalación de Bun/uv.

## OmniRoute 3.8.53 — rechazado (riesgo alto, proxy)
- Fuente: `diegosouzapw/OmniRoute` (commit 1ac00b0). **Identidad dudosa:** los comentarios de `scripts/build/postinstall.mjs:21-25` apuntan a otra organización, `cheaper-inference/OmniRoute`. Hay que confirmar cuál es el original.
- Qué es: puerta de enlace en puerto 20128 que se pone entre Claude Code y Anthropic (`ANTHROPIC_BASE_URL`, `src/shared/constants/cliTools.ts:16-32`; escribe `~/.claude/settings.json`, `claudeCliConfig.ts:27`). Ve cada prompt, cada archivo enviado y cada llave.
- Guarda llaves/OAuth de muchos proveedores; contraseña inicial de plantilla `INITIAL_PASSWORD=CHANGEME` (`.env.example:31`); cifrado de la base opcional y vacío por defecto (`STORAGE_ENCRYPTION_KEY=`, `.env.example:96`).
- Reenvía a decenas de pasarelas de terceros poco conocidas (seekai.cc, freeaiapikey.com, api.airforce, kenari.id, etc. en `src/`), proveedores «web-cookie» con cliente TLS imitado (`wreq-js`) y **se hace pasar por el binario firmado de Claude Code** (`src/shared/constants/claudeCodeClient.ts:1-14`): riesgo de bloqueo de cuenta además del de seguridad.
- Puede abrir un túnel público de Cloudflare (`src/lib/cloudflaredTunnel.ts:303`). `postinstall` ejecuta `execSync` de reconstrucción nativa (`postinstall.mjs:187-201`).
- Veredicto: rechazado. Ni siquiera en el Taller sin orden escrita de la dueña y sin datos reales (regla 1 de `SESIONES_Y_LIMITES.md`).

## Headroom 0.42.0 — rechazado (riesgo alto, proxy)
- Fuente: clonado de `chopratejas/headroom` (commit 17d38e5, «release 0.42.0»), pero su `plugin.json` y marketplace apuntan a `headroomlabs-ai/headroom`. **Dos nombres de dueño: confirmar cuál es el original antes de cualquier uso.**
- Qué es: proxy de compresión de contexto (Python/Rust, paquete `headroom-ai`) entre Claude Code y el modelo; ve todo el contexto.
- Ejecuta solo: hooks `SessionStart` y `PreToolUse` en Bash/PowerShell que buscan un binario `headroom` en `PATH`, `~/.local/bin`, `/usr/local/bin`… y lo **ejecutan** (`plugins/headroom-agent-hooks/hooks/hooks.json`, `bin/headroom-hook.sh:4-30`). Quien ponga un binario con ese nombre en esas rutas ejecuta código en cada comando.
- Telemetría: baliza de subida **activa por defecto** (`BEACON_DEFAULT_ON = True`, `headroom/telemetry/beacon.py:59`), «cada instalación sube resúmenes anónimos de sesión» salvo `HEADROOM_BEACON=off`, `HEADROOM_TELEMETRY=off` o `DO_NOT_TRACK=1`. No localicé el host de destino.
- Veredicto: rechazado.

---

## Qué no revisé (honesto)
- Binarios, `dist/` y `bridge/*.cjs` minificados de OMC y claude-mem: solo busqué hosts y patrones, no leí el código compilado.
- Dependencias transitivas (`npm`/`pip`) de todos.
- Si la telemetría de claude-mem y Clearcut está activa por defecto: no confirmado.
- Contenido real de lo que envía Vercel más allá de los campos listados.
- Los ZIP/versiones exactas instaladas en las otras sesiones (0.1.17, 0.49.2): no tengo acceso.

## Reglas para todos
Fijar versión/commit; telemetría apagada (`VERCEL_PLUGIN_TELEMETRY=off`, `--no-usage-statistics`, `HEADROOM_TELEMETRY=off`); ningún plugin con hooks sobre cada herramienta en «Llaves»; cualquier actualización vuelve a pasar por el Revisor.
