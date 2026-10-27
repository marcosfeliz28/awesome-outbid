# Herramientas que todos los agentes deben tener · 27-oct-2026

Orden de la dueña: todos los agentes las agregan (Claude nube, Claude PC, ChatGPT PC y ChatGPT nube).

## Claude (nube y PC)
Ya están declaradas en `.claude/settings.json`, `.mcp.json` y `.claude/skills/` de la rama `nexora-cloud`. Para instalarlas:

1. `git pull origin nexora-cloud`
2. Desde la raíz del repo:
   ```
   claude plugin marketplace add Yeachan-Heo/oh-my-claudecode
   claude plugin marketplace add ChromeDevTools/chrome-devtools-mcp
   claude plugin install oh-my-claudecode@omc --scope project
   claude plugin install supabase@anthropic-plugin-directory --scope project
   claude plugin install vercel@anthropic-plugin-directory --scope project
   claude plugin install chrome-devtools-mcp@chrome-devtools-plugins --scope project
   ```
3. Escribe `/reload-plugins` o reinicia la sesión.
4. **Solo Claude PC:** instala también claude-mem, porque en la nube no guarda nada:
   ```
   /plugin marketplace add thedotmack/claude-mem
   /plugin install claude-mem
   ```

Los skills `webapp-testing` (Playwright), Memory Palace (palacio mental), `frontend-design` y `ponytail` se cargan solos al hacer el pull.

En la nube no hay Chrome estable. Para eso existe el servidor `chrome-devtools-nube` en `.mcp.json`, que usa `/opt/pw-browsers/chromium`. En la PC se usa el plugin normal.

## ChatGPT (PC y nube, Codex)
- **oh-my-codex** (es la versión de oh-my-claudecode para Codex): https://github.com/Yeachan-Heo/oh-my-codex
- **Chrome DevTools MCP:** agrega el servidor MCP `npx -y chrome-devtools-mcp@latest`.
- **Supabase y Vercel:** actívalos como conectores en Configuración → Apps.
- **Playwright, palacio mental y diseño:** lee los `SKILL.md` en `.claude/skills/` (webapp-testing, memory-palace-*, frontend-design).

## Reglas que no cambian
Ningún plugin pasa por encima de `CLAUDE.md` ni de `AGENTS.md`:
- todo cambio de mercancía y dinero se verifica 3 veces, y los conteos 4;
- se aplica solo con la confirmación de la dueña;
- solo Claude nube despliega, con los 3 CI en verde;
- no se imprimen credenciales;
- `/autopilot`, `/ralph` y `/team` se usan para software, nunca para tocar inventario ni dinero sin la confirmación de la dueña.

Cuando termines, avisa en tu tablero o a Claude nube: «herramientas instaladas».
