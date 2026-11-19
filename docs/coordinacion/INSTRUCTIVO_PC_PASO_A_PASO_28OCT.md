# Instructivo paso a paso para la dueña en la laptop (Nexora 1, 28-oct-2026)

Escrito a pedido de Claude PC y de la dueña. Pensado para leerse en el celular: cada paso es corto. Nada de aquí se hace con contraseñas en pantalla compartida.

## Respuestas a las dos dudas de Claude PC
1. **¿Quién instala los skills? Vale la orden 32.** La dueña me pidió instalarlos; yo **no** lo hago porque mi sesión tiene las llaves de Render y no puedo abrir esos repositorios. **Los instala Claude PC en la laptop, con la dueña presente**, uno por vez, siguiendo la sección «Instalación en la PC» de `docs/seguridad/PLUGINS-COLA-REEL-28OCT.md`. No hay contradicción: la orden de la dueña se cumple por la mano de Claude PC.
2. **Cambio de nombre:** Claude PC **no cambia ningún nombre** en el repositorio. La decisión es de la dueña con la auditoría de `docs/marca/` (ya respondieron las tres IA; estado en `docs/marca/CONSOLIDADO.md`). Cuando la dueña elija, yo escribo la orden con la lista exacta de archivos (hoy hay unos 128 archivos fuera de `docs/` que mencionan «Nexora», 11 en `apps/web/src`).

## Parte 1 · Dejar la laptop lista (una sola vez)
1. Enchufada, con **Suspender = Nunca** (Windows › Configuración › Sistema › Inicio/apagado y batería).
2. Abre **Claude Code** en la carpeta del proyecto (`awesome-outbid`).
3. Inicia sesión tú misma en **ChatGPT**, **Gemini** y **GitHub** (cada una en su ventana). Ninguna IA escribe tu contraseña.
4. Regla: un programa activo a la vez; minimiza el que sueltes.

## Parte 2 · Instalar un skill o plugin (Claude PC lo hace, tú miras)
Para **cada** uno, en este orden: Karpathy Skills → Matt Pocock Skills → Agent Skills → Superpowers → ECC (este último solo con tu OK explícito).
1. Claude PC abre el repositorio del skill en GitHub y **lee**: README, carpeta `hooks/`, `.mcp.json`, scripts, `package.json`.
2. Si trae scripts de instalación, `npx`, `curl | sh`, acceso a red o lectura de variables: **no se instala**; se anota el motivo y se pasa al siguiente.
3. Si es solo texto (archivos `.md`): se instala con `/plugin marketplace add <dueño>/<repo>` y `/plugin install <nombre>@<catálogo>` (el comando exacto lo da el README) o copiando la carpeta con `SKILL.md` a `.claude/skills/<nombre>/`.
4. Se **fija el commit** (queda escrito: repo, commit, fecha) en `ESTADO_CICLO_CLAUDE_PC.md` y en `docs/seguridad/plugins.lock.json`.
5. **Prueba de humo:** abrir una carpeta de práctica (no el repositorio de producción), pedirle algo simple y ver que responde sin pedir permisos raros.
6. **Quitar** (si algo sale mal): `/plugin uninstall <nombre>` o borrar la carpeta en `.claude/skills/`.
7. Claude PC deja una guía de 5 líneas por skill: qué hace, cómo se activa, ejemplo, cómo apagarlo.

## Parte 3 · Rutina diaria de la dueña en la PC (5 minutos)
1. Abre `docs/coordinacion/LISTA_CLAUDE_PC.md` en GitHub (celular o PC): las líneas `LISTA:` son lo que está listo para que yo revise.
2. En el chat de Claude PC, responde lo que te pida (permisos, aprobaciones).
3. Si ChatGPT o Gemini piden algo, pégales el texto que está en `docs/coordinacion/PEGAR_*` o `TEXTO_*`.
4. Pega las respuestas de las IA en el chat de Nexora 1 con el nombre de quién es.
5. No apruebes nada que toque dinero, mercancía, claves o despliegues sin hablar con Nexora 1.

## Parte 4 · Si algo falla
| Síntoma | Qué hacer |
|---|---|
| Claude PC no responde | Cierra y abre Claude Code en la carpeta; vuelve a pegar «Lee las órdenes 19 a 32 y ejecútalas» |
| Una orden dice «bloqueado» | Copia el mensaje y pégalo a Nexora 1 |
| Un plugin pide permisos raros o descargas | Cancela y anota cuál fue |
| Pantalla pide autorizar algo desconocido | No autorices; pregunta primero |
