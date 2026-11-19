# Cola de skills y plugins del reel «30 best Claude plugins» (orden de la dueña, 28-oct-2026)

La dueña pidió agregar estos skills/plugins y asignarlos. **Nada se instala todavía:** el procedimiento de este proyecto exige que el Revisor (Nexora 4) lea el código fijado a un commit antes de que cualquiera lo use (`docs/seguridad/PLUGINS.md`, `scripts/plugins-lock.mjs`, `docs/seguridad/plugins.lock.json`). Nexora 1 (la sesión con las llaves de Render) **no instala ninguno**: un plugin con hooks ahí leería llaves de producción. Desde mi sesión no puedo leer esos repositorios (mi acceso a GitHub está limitado a este proyecto), así que no los audité.

**Aviso sobre la fuente:** es un reel promocional. Los números de estrellas cambian entre capturas (Superpowers se ve 116k y luego 304k) porque son un contador animado; no son una señal de confianza. Hay que verificar cada repositorio en GitHub (autor real, licencia, fecha del último commit, hooks y scripts).

## Reparto propuesto
| # | Skill/plugin | Repo (según el reel) | Para qué sirve | Dónde corre | Riesgo a revisar |
|---|---|---|---|---|---|
| — | **Ponytail** | DietrichGebert/ponytail | Menos código, respuestas cortas | **Ya activo** en todas las sesiones (regla del proyecto) | Ninguno nuevo |
| 1 | **Superpowers** | obra/superpowers | Planear y probar primero | Taller y Claude PC (construcción). **No en Nexora 1** | Suele traer hooks de inicio de sesión: revisar `hooks/` y qué inyecta |
| 2 | **Matt Pocock Skills** | mattpocock/skills | Hábitos de ingeniería diarios | Taller y Claude PC | Normalmente solo markdown: confirmar que no hay scripts |
| 3 | **ECC** | affaan-m/ECC | Paquete enorme de skills y agentes | **Solo Taller**, aislado; **no** Claude PC ni Nexora 1 | Alto: muchos agentes, hooks, MCP y scripts; revisar uno por uno; si no se puede, rechazar |
| 4 | **Karpathy Skills** | multica-ai/andrej-karpathy-skills | Evita malos hábitos de código de Claude | Taller y Claude PC; además se puede copiar su texto a `CLAUDE.md` sin instalar nada | Bajo si es solo texto |
| 5 | **Agent Skills** | addyosmani/agent-skills | Cómo envían código los ingenieros senior | Taller y Claude PC | Confirmar que es solo markdown y sin scripts |

Regla: **un solo skill de «estilo de trabajo» a la vez por sesión** para que no se contradigan (Ponytail ya fija el estilo corto; Superpowers y Karpathy pueden chocar con él en el nivel de detalle). Primero Karpathy y Matt Pocock (los de menor riesgo), después Agent Skills y Superpowers, y ECC al final y solo si el Revisor lo aprueba.

## Orden para el Revisor (Nexora 4) — por cada uno
1. Clonar a una carpeta temporal y **fijar el commit**; no ejecutar nada.
2. Listar `hooks/`, `.mcp.json`, scripts, hosts de red, lectura de variables de entorno y de archivos fuera del proyecto.
3. Calcular la huella (sha256 de los archivos) y agregarla a `docs/seguridad/plugins.lock.json` con `scripts/plugins-lock.mjs`.
4. Veredicto en `docs/seguridad/PLUGINS.md`: Aprobado / Solo Taller / Rechazado, con la evidencia (archivo:línea).
5. Avisar a Nexora 1 en el repositorio (no puedo escribirle al Revisor directo).

## Instalación en la PC (Claude PC) — solo para los que el Revisor apruebe
Claude PC lo hace con Marcos presente, un plugin a la vez:
1. Confirmar que el veredicto del Revisor dice «Aprobado» o «Solo Taller» **para Claude PC**, y que la huella coincide con `plugins.lock.json`.
2. En Claude Code, agregar el catálogo y fijar el commit aprobado: `/plugin marketplace add <dueño>/<repo>` y luego `/plugin install <nombre>@<catálogo>`. El comando exacto lo da el README de cada repo; si el README pide `npx`, scripts de instalación o `curl | sh`, **detenerse** y avisar.
3. Probar en una carpeta de práctica, no en el repositorio de producción.
4. Si es un skill suelto (carpeta con `SKILL.md`), copiarlo a `~/.claude/skills/<nombre>/` o a `.claude/skills/` del repositorio, ya revisado, y listarlo en `docs/seguridad/PLUGINS.md`.
5. Anotar versión, commit y fecha en `ESTADO_CICLO_CLAUDE_PC.md`.
6. Para que la dueña también lo use cuando lo aprenda: dejar en `docs/seguridad/` una guía de 5 líneas por plugin (qué hace, cómo se activa, un ejemplo y cómo desactivarlo).

## Qué decide la dueña
Cuáles de los cinco quiere de verdad (recomiendo Karpathy y Matt Pocock primero) y si acepta que ECC quede solo en el Taller o se descarte.
