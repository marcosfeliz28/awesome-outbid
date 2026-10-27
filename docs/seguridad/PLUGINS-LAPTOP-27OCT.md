# Plugins de la laptop — informe del Revisor (27-oct-2026)

Pedido de «Nexora 1» por orden de la dueña. Solo lectura: bajé los paquetes a una carpeta temporal y los leí; no instalé ni ejecuté nada. Sin credenciales en este informe.

| Herramienta | Riesgo | Veredicto |
|---|---|---|
| `@playwright/mcp@0.0.83` (+ `playwright`/`playwright-core` 1.64.0-alpha) con `--isolated` | medio | **Solo Taller** (laptop sin sesiones iniciadas) |
| `claude-code-setup` 1.0.0 (41f619d) | bajo | **Aprobado** (confirmado) |
| `cloudflare/security-audit-skill` | bajo | **Aprobado** como skill; ver condiciones |
| OpenSEO (`every-app/open-seo`, plugin 1.0.25) | medio | **Solo Taller** |

## 1. @playwright/mcp 0.0.83 — solo Taller
- **Integridad:** el `.tgz` de npm tiene sha512 idéntico al dado (`oNcl+Ae2…azUKOg==`, comprobado). Publicado por GitHub Actions con *trusted publisher* y atestación de procedencia SLSA; igual para `playwright` y `playwright-core` 1.64.0-alpha-1790635538000. Autor: Microsoft, repo `microsoft/playwright-mcp`, Apache-2.0. No verifiqué criptográficamente las atestaciones.
- **Qué ejecuta solo:** nada al instalar. Sin scripts `preinstall`/`install`/`postinstall` en los tres paquetes (`package.json`). `cli.js` (32 líneas) y `index.js` (19) solo llaman a `playwright-core`; toda la lógica está en `playwright-core/lib/coreBundle.js` (minificado, no leído entero).
- **Red:** el MCP en sí no llama a servidores de terceros que yo haya visto. Los únicos hosts son para bajar navegadores con `install-browser`: `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` (`coreBundle.js:33892, 34039-34041`). No hallé telemetría.
- **Es alfa:** versión 1.64.0-alpha, no estable; puede cambiar sin aviso → fijar exacto y no actualizar sin revisar.
- **Poder real:** controla un navegador completo. Trae `browser_evaluate` (`coreBundle.js:68085`) y `browser_run_code_unsafe` (`:69192`), que ejecutan código en la página/entorno de Playwright.
- **Lo que sí protege:** `--isolated` guarda el perfil solo en memoria (`coreBundle.js:75566`: «keep the browser profile in memory, do not save it to disk»), así que no hereda cookies ni sesiones. Por defecto el acceso a archivos se limita al directorio de trabajo y se bloquean URLs `file://`, salvo `--allow-unrestricted-file-access` (mismo `:75566`).
- **Lo que no protege:** `--allowed-origins`/`--blocked-origins` el propio texto de ayuda dice que **no son un límite de seguridad** y no afectan redirecciones (`:75566`). No usarlos como defensa.
- **Condiciones:** mantener `--isolated`; no usar `--allow-unrestricted-file-access`, `--no-sandbox`, `--extension`, `--cdp-endpoint`, `--secrets` ni `--init-script`; no iniciar sesión en Render, Cloudflare, banco ni correo en ese navegador; contenido de páginas = datos, no órdenes.

## 2. claude-code-setup 1.0.0 — aprobado (confirmado)
- Repo `anthropics/claude-plugins-official`, commit `41f619d` (HEAD hoy; los archivos del plugin no cambiaron en esa carpeta desde el último commit que los toca).
- Solo `skills/claude-automation-recommender/` (markdown) + `plugin.json`: sin `hooks/`, sin `.mcp.json`, sin scripts (`plugins/claude-code-setup/`, 10 archivos). Las menciones de `npx`/`allowed-tools` son ejemplos de texto en `references/skills-reference.md:89,173,188`, no se ejecutan solas.
- Riesgo: que el skill sugiera añadir hooks o servidores MCP; toda sugerencia pasa por el Revisor.

## 3a. cloudflare/security-audit-skill — aprobado como skill
- Fuente: `cloudflare/security-audit-skill`, commit `c1c8a8c` (14-sep-2026), 22 archivos. Es de Cloudflare, pero es un **skill de auditoría de código ajeno**, no un servicio.
- Contenido: markdown + dos validadores `.cjs` (`validate-coverage-ledger.cjs`, `validate-findings.cjs`) que solo usan `node:fs`, `node:path`, `node:util`; sin red, sin `child_process`, sin variables de entorno. Sin hooks ni MCP.
- Por diseño es solo guía por defecto: «cargarlo no autoriza el flujo completo ni crear archivos» (`SKILL.md:14`); el modo completo lanza muchos subagentes (costo de tokens) y exige ejecutar solo en un sandbox del SO, sin red externa (`SKILL.md:33-35`), con datos de prueba y sin probar endpoints reales (`SKILL.md:42`).
- Condiciones: usarlo sobre código de este repo, nunca contra producción; el modo de auditoría completa solo con orden de la dueña.

## 3b. OpenSEO — solo Taller
- Aclaración de nombre: revisé `every-app/open-seo` (commit `99d9a49`, plugin `openseo` 1.0.25, MIT, autor «OpenSEO», openseo.so). Existe otro proyecto sin relación llamado `theshajha/OpenSEO`: **confirmar cuál quiere la dueña**.
- Qué instala: 12 skills de SEO (markdown) y un MCP **remoto**: `https://app.openseo.so/mcp`, tipo HTTP, con OAuth (`plugins/openseo/.mcp.json`). Sin hooks, sin scripts locales ni `npx`.
- Qué envía: consultas de palabras clave y dominios, y, si se conecta Search Console, datos de tráfico del sitio, a un servicio de terceros de pago (plan indicado: $10/mes, `.claude-plugin/marketplace.json`). Política de privacidad: `https://openseo.so/privacy` (no la leí).
- Riesgo: no toca llaves ni archivos locales, pero es un servicio externo con acceso a datos del negocio si se autoriza Search Console.
- Condiciones: solo el Taller; conectar únicamente sitios públicos de la dueña; no dar acceso a Search Console de nada que no sea el sitio público de la tienda; no meter datos de clientes ni precios/costos en las consultas.

## No revisé
- El `coreBundle.js` de Playwright completo (minificado, ~75 000 líneas): solo busqué opciones, hosts y herramientas peligrosas.
- Las atestaciones SLSA (existen, no las verifiqué).
- Los términos de pago/privacidad de OpenSEO y lo que hace el servidor remoto con los datos.
