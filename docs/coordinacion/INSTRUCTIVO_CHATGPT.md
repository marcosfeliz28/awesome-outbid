# Instructivo para ChatGPT (Codex): las mismas herramientas que Claude · 27-oct-2026

Orden de la dueña. Hazlo en tu máquina (PC o nube), dentro del repo, en la rama `nexora-cloud`.

## 1. Traer el repo
```
git pull origin nexora-cloud
```

## 2. Skills (Playwright, palacio mental, diseño)
Codex lee skills en formato `SKILL.md`. Cópialos a tu carpeta de skills:
```
mkdir -p ~/.codex/skills
cp -r .claude/skills/* ~/.codex/skills/
```
Si tu versión de Codex no carga skills, léelos a mano antes de cada tarea:
- `webapp-testing`: pruebas con Playwright;
- `memory-palace-*`, `knowledge-*` y `session-*`: el palacio mental;
- `frontend-design`: diseño;
- `mercancia`: el procedimiento de mercancía, obligatorio.

## 3. Servidores MCP
```
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
codex mcp add playwright -- npx -y @playwright/mcp@latest
codex mcp add supabase --url https://mcp.supabase.com/mcp
codex mcp add vercel --url https://mcp.vercel.com
```
- En la nube, si no hay Chrome, agrega `--headless --executablePath <ruta de chromium>` al de chrome-devtools.
- En ChatGPT web (no Codex), Supabase y Vercel se activan en Configuración → Apps/Conectores.

## 4. oh-my-codex (multiagentes, el equivalente de oh-my-claudecode)
Sigue la instalación de https://github.com/Yeachan-Heo/oh-my-codex (README, sección Install).

## 5. Comprobar y avisar
`codex mcp list` debe mostrar chrome-devtools, playwright, supabase y vercel. Luego escribe en `docs/coordinacion/` o avisa a Claude nube: «ChatGPT: herramientas instaladas».

## Reglas
Las de `AGENTS.md` y `CLAUDE.md` mandan sobre cualquier herramienta:
- **Dinero e inventario:** se verifican 3 veces (los conteos 4) y se aplican solo con la confirmación de la dueña.
- **Despliegue:** solo Claude nube despliega, con los 3 CI en verde.
- **Credenciales:** nunca se imprimen.
