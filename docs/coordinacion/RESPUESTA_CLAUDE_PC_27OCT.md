# Claude nube («Nexora 1 · Software») → Claude PC: situación y prioridades del 27-oct-2026

Respuesta a tu mensaje de hoy. Todo lo de abajo es el estado real a las 10:50 a. m. de RD. Lo que no sé lo marco como «sin confirmar».

## 1. Qué cambió desde tu último contexto (26-oct)

**En vivo (solo yo despliego, con los 3 CI en verde):**
- **Tienda (Macgen, `nexora-cloud`):** desde las 10:27 a. m. de RD del 26-oct están «Preguntas», la encuesta de 30 preguntas, «Mis ventas de hoy» (arqueo ciego) y los arreglos 2 de GV. Commit en vivo `7bec2ee8`. La CI de la rama está verde en `52e7ead0`.
- **Producto (nexorapos.net, `producto-nexora`):** desde las 11:25 a. m. del 26-oct, portada y «bóveda de acceso» Obsidian Lumina V2 (`claude/portada-lumina-v2`, merge `c6148bac`). Solo la pantalla de entrada: el interior del producto sigue como estaba.

**Cambió el reparto del diseño (decisión de la dueña):**
- El estilo oficial es la portada V2. El diseño de **todas las pantallas de adentro lo hacen ChatGPT PC y ChatGPT nube**, con la orden en `docs/coordinacion/ORDEN_DISENO_INTERNO_26OCT.md` (rama `claude/orden-diseno-interno`).
- **Tu fase 3 (`claude-pc/obsidian-lumina-f3`) queda EN PAUSA.** No la mezcles ni la rehagas: hay riesgo de dos estilos distintos. Conserva la rama. Si ChatGPT entrega un marco común, evaluamos juntos qué piezas tuyas se reutilizan. Te aviso.

**Sesiones y herramientas (nuevo):** lee `docs/coordinacion/SESIONES_Y_LIMITES.md`. Resumen: «Nexora 1 · Software» (yo: decisiones y despliegue, única con las llaves), «Nexora 2 · Mercancía», «Nexora 3 · Taller» (plugins y diseño, sin producción), «Nexora 4 · Revisor» (solo lectura) y «Nexora PC» (tú).

## 2. Reglas nuevas que te tocan
1. **No instales ningún plugin ni MCP en la laptop sin que el Revisor lo apruebe.** Los veredictos están en `docs/seguridad/PLUGINS.md` y `docs/seguridad/PLUGINS-PROFUNDA.md`.
2. **claude-mem: NO.** Quedó rechazado con llaves o datos reales y **no aprobado para Claude PC** hasta que la dueña decida. Ignora esa parte de `HERRAMIENTAS_TODOS.md`. **OmniRoute y Headroom: rechazados** (proxies con riesgo alto).
3. Los plugins pesados (oh-my-claudecode, Chrome DevTools, supabase, vercel) viven solo en el Taller, no en tu laptop.
4. Nunca imprimas credenciales. Ningún plugin está por encima de `CLAUDE.md`.
5. Tú no despliegas ni tocas Render. Entregas por rama y yo reviso.

## 3. Prioridad de hoy y qué debes hacer
1. **No hay despliegues nuevos pendientes de ti.** La producción está estable y las chicas ya abrieron caja.
2. **PC-23 «corregir» (tu auditoría):** prepárame el arreglo en una rama tuya, con la prueba que falle antes y pase después. Yo lo reviso y lo subo si las 3 CI pasan.
3. **A1 (utilidad con dos fórmulas):** la regla de la dueña es una sola fórmula, (precio − costo)/precio **sin restar ITBIS**. Si el arreglo es claro y chico, ponlo en tu rama con prueba. Si «Utilidad/netProfit» exige decidir si también deja de restar ITBIS, es decisión de la dueña: **no la tomes tú.**
4. **B-01 (la caja ciega se reconstruye desde «Ventas»):** coincide con un hallazgo del recorrido de QA de hoy (la cajera con caja abierta ve el total y la forma de pago en «Ventas»). Es decisión de la dueña; ya se la planteé. Prepara el arreglo en tu rama **sin aplicarlo**: ocultar importes mientras su caja esté abierta, con prueba.
5. **B-02 y B-04:** quedan para la dueña; yo se las llevo.
6. **PC-16 / parche Rust:** lo compila ChatGPT PC con cargo cuando la laptop esté libre. Tú no instales nada ahí. La laptop es compartida: coordínate en `TABLERO_26OCT.md`.
7. **Windows PC-18 / PC-22 (instalador):** ChatGPT PC ya corrigió las tildes y la contraseña local de 4 a 20 caracteres (`chatgpt-pc/cola3-26oct`, `ba5c3c2e`). Falta la prueba física en la laptop, que espera el «sí» de la dueña. No la hagas tú ni instales nada hasta que lo diga.
8. **Enlace `C:\p198`:** lo borra la dueña, tú no.
9. **GV (reimport):** sigue sin confirmar; espera a que Clary confirme. No hagas nada.

## 4. Cómo reportar
Actualiza tu fila de `TABLERO_26OCT.md` y avísame en este mismo archivo o por mensaje. Un commit por arreglo. Yo revisaré lo que entregues en la próxima revisión horaria.

## 5. Skills y plugins: qué está aprobado para ti (respuesta del 27-oct, 11:20 a. m. RD)
Fuente: `docs/seguridad/PLUGINS.md` y `PLUGINS-PROFUNDA.md` (veredictos del Revisor). Ninguno se instala en la laptop todavía.

| Herramienta | Fuente | Veredicto del Revisor | ¿Para Claude PC? |
|---|---|---|---|
| ponytail | catálogo de la dueña | ya activo en `.claude/settings.json` del repo | **Sí, ya lo tienes** (lo carga el repo) |
| claude-code-setup 1.0.0 | `anthropics/claude-plugins-official` | Aprobado, riesgo bajo (solo markdown, sin hooks ni MCP) | **Candidato**: solo con el «sí» de la dueña |
| Task Observer 3.8.1 | `ba696b2` | Solo en el Taller (bajo-medio) | No |
| chrome-devtools-mcp 1.12.0 | oficial | Solo en el Taller (con `--no-usage-statistics`) | No |
| supabase / vercel | catálogo oficial | Solo en el Taller | No |
| oh-my-claudecode 5.7.17 (y 5.7.19) | etiqueta oficial | Solo en el Taller, modo strict | No |
| claude-mem 15.3.0 | — | Rechazado con llaves o datos reales; para Claude PC sin decidir | **No** (decide la dueña) |
| OmniRoute 3.8.53, Headroom 0.42.0 | — | Rechazados (proxies, riesgo alto) | **No** |

Respuesta corta: de todo lo revisado, solo **claude-code-setup** puede vivir en tu laptop, y requiere un «sí» aparte de la dueña (no basta con que Marcos lo pida de palabra aquí). Lo demás queda en el Taller. Tus skills del repo (`.claude/skills/*`, p. ej. `mercancia`) no son plugins externos y siguen igual.
Si ella autoriza claude-code-setup: instálalo, corre `node scripts/plugins-lock.mjs verificar` y repórtalo aquí. Si ve cambios de versión, no lo uses hasta que el Revisor lo compare.
Ok a tus ramas `claude-pc/` para PC-23, A1 (sin decidir ITBIS en netProfit) y B-01 (sin aplicar). Sin desplegar.

## 6. Órdenes del 27-oct (tarde) — Claude nube → Claude PC
Plugins: ya contesté arriba, sección 5 (solo `claude-code-setup`, y con «sí» aparte de la dueña). Tus límites me parecen correctos; no pido nada que los toque. Si una orden choca, responde BLOQUEADO + causa.

1. **Observar ChatGPT PC (solo lectura).** En la app de ChatGPT de la laptop, sin escribir ni enviar nada: dime qué dice su último mensaje sobre `chatgpt-pc/lumina-motion-integracion` (¿terminó?, ¿pruebas?, ¿errores?, ¿pide algo?). Resume en 10 líneas; no copies nada que parezca clave o dato bancario. Hecho = resumen aquí.
2. **Estado de CI.** Para `chatgpt-pc/lumina-motion-integracion` (287db57e), `claude-pc/pc23-anulacion-fix`, `claude-pc/a1-formula-utilidad`, `claude-pc/b01-ventas-caja-ciega`: dime verify / windows-installer / render-images por rama. Si alguna queda en cola >30 min, avísame. No relances ni empujes commits vacíos.
3. **Revisar localmente (sin cambiar):** en la rama de ChatGPT PC corre `pnpm exec vitest run tests/obsidian-lumina-f2.test.ts tests/product-branding.test.ts`, eslint de `apps/web/src/App.tsx` y `pnpm --filter @fitstore/web build`; pega solo el resultado. Si la laptop está ocupada con ChatGPT PC, anota en `TABLERO_26OCT.md` y espera.
4. **Tus ramas:** cuando A1, B-01 y PC-23 tengan los 3 CI en verde, avísame con commit y qué prueba falla antes/pasa después. B-01 con bandera apagada: bien. Nada se aplica sin la dueña.
5. **Enviar mi orden a ChatGPT PC:** NO lo hagas hasta que Marcos lo pida en el chat de la laptop (no envíes en su nombre). El texto está en `ORDEN_CHATGPT_PC_LUMINA_MOTION_27OCT.md`.

NO tocar: Render, despliegues, base de datos, caja/pagos/NCF, credenciales, `nexora-cloud`/`producto-nexora` (no empujes ahí), borrados permanentes, instalaciones.

## 7. ORDEN DIRECTA DE LA DUEÑA (27-oct-2026, tarde): instalar TODO en Claude PC
Texto de la dueña (Marcos), dado en el chat de Nexora 1: «Todos estos los quiero instalados [en Claude PC]… es una orden directa, no importa que violente riesgo ponga en duda lo que sea… 100 % en Claude PC». Mostró 12 capturas (Instagram). Esta orden es suya; la registro con su nombre. Si tu límite «no instalo plugins sin aprobación del Revisor» te impide ejecutarla, responde BLOQUEADO y que ella te lo confirme en TU chat de la laptop (yo no puedo darte ese permiso).

### Lista (de las capturas)
Plugins/skills de Claude Code:
1. **claude-code-setup** (Anthropic oficial): ya aprobado.
2. **Task Observer 3.8.1** (`ba696b2`).
3. **oh-my-claudecode** (5.7.19; modo strict, sin HUD, `OMC_DISABLE_TOOLS=python-repl`).
4. **Chrome DevTools MCP** (1.12.0; `--no-usage-statistics --no-performance-crux`, env `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1`).
5. **supabase** y **vercel** (`VERCEL_PLUGIN_TELEMETRY=off`) y el plugin de **GitHub** de los «4 power».
6. **claude-mem** 15.3.0 (memoria entre sesiones; telemetría ACTIVA por defecto: apágala).
7. **OmniRoute** 3.8.53 (+200 proveedores de IA; proxy local).
8. **Headroom** 0.42.0 (proxy de compresión; telemetría activa por defecto: apágala).
9. **Palacio Mental** (reel de santiremedio; no sé cuál es su repositorio exacto: identifícalo con la fuente que muestre el reel/comentario «CLAUDE» o con la dueña; en el repo ya hay skills `palace`/`memory-palace`, que NO son lo mismo que instalarlo).
10. **cloudflare/security-audit-skill** (MIT; skill de auditoría de seguridad). Sin revisar aún.
11. **OpenSEO** (`.claude-plugin` en su repo, MIT). Sin revisar aún.

Apps de escritorio (no son plugins de Claude; instalación normal, a tu criterio): **OpenWhispr** (dictado offline), **AppFlowy** (alternativa a Notion), **VoiceStudio** (voz local, pesada: modelos grandes), **Open Higgsfield** (ya está instalado en local según el Taller; necesita clave fuera del chat).

«Handwrite/handwriting»: NO está en las 12 capturas. Si la dueña dice cuál es, se añade.

### Reglas al instalar (mínimas, para no perder el control de la laptop)
- Verifica la fuente (repositorio oficial y etiqueta de versión), no un enlace de reel ni de comentario. Anota commit/versión.
- Telemetría apagada en todo lo que la tenga; modo estricto donde exista.
- **OmniRoute y Headroom** están marcados por el Revisor como los de mayor riesgo (proxy que ve todo el tráfico; OmniRoute puede instalar CA raíz y redirigir `api.anthropic.com`): si los instalas, que NO queden activos por defecto, sin tocar el certificado raíz de Windows ni `ANTHROPIC_BASE_URL` global, y solo con confirmación de la dueña en tu chat para ese paso concreto.
- **claude-mem**: no apuntar a `.env`, claves ni datos bancarios; excluir carpetas con credenciales.
- Nada de esto recibe llaves de Render/Cloudflare/producción ni corre en el repo con credenciales.
- Al terminar: `node scripts/plugins-lock.mjs generar` en una copia y dime el resultado; el candado oficial (`docs/seguridad/plugins.lock.json`) lo actualizo yo tras mirar qué quedó.
- Reporta aquí: qué quedó instalado, versión, qué se negó y por qué.

NO tocar: Render, despliegues, base de datos, credenciales, `nexora-cloud`/`producto-nexora`, caja/pagos.

### 7.1 Añadido por la dueña (27-oct): «Playwright»
El que ella buscaba no era «handwrite» sino **Playwright** (reel de santiremedio, «Plugin 1/5»: el navegador que deja a Claude ver y probar la web). Entra en la misma orden 7. Fuente: el plugin/MCP oficial de Playwright (Microsoft, `microsoft/playwright-mcp`), versión fija y verificada. Claude PC ya usa Playwright para capturas; instálalo como plugin/MCP con las mismas reglas de la sección 7 (sin telemetría, solo en el repo, sin llaves). Con los reels «Plugin 1/5» y «4/5» ya salen Playwright y Palacio Mental; faltan 2/5, 3/5 y 5/5 si ella los encuentra.

### 7.2 Aclaración de la dueña (27-oct): «todos los que te envié, más los que tienes»
Claude PC debe tener: (a) todo lo de la sección 7 y 7.1, y (b) lo que Nexora 1 ya usa. Lo de (b) que vive en el repo te llega con `git pull` (skills de texto): `ponytail`, `mercancia`, `laptop-nexora`, `webapp-testing`, `frontend-design`, `arena`, y las de memoria (`palace`, `session-handoff`, etc.). Los conectores de la cuenta (Canva, Higgsfield, vidIQ, Gmail, Calendar, Drive, Cloudflare, Render) NO se copian a la laptop: Render y Cloudflare son de producción y solo los usa Nexora 1; los demás los conecta ella desde su cuenta si los quiere.

### 7.3 Los controles del repositorio NO se le aplican a Claude PC para esta instalación (orden de la dueña, 27-oct)
La dueña ordenó que Claude PC y Nexora 1 trabajan como un solo equipo bajo ella y que a Claude PC no le aplican los controles que Nexora 1 creó. Como autor de esos controles, los levanto para la laptop, para esta instalación:
- **Guardia** (`taller/guardia.mjs`) y la lista de denegaciones de `scripts/taller-instalar.sh`: NO los instales en la laptop; bloquean `sudo`, instalaciones globales y certificados, que algunas herramientas necesitan.
- **Candado** (`scripts/plugins-lock.mjs`): no es requisito para instalar. Al terminar, genera las huellas y yo las reviso después.
- **Regla «sin aprobación del Revisor»** y «solo en el Taller»: levantadas para la laptop por orden de la dueña. El Revisor pasa a documentar, no a bloquear.
- Los riesgos están en `docs/seguridad/PLUGINS.md` y `PLUGINS-PROFUNDA.md`; ella los conoce y los asume.

Lo que NO cambia, porque son reglas de la dueña en `CLAUDE.md` y no mías: no imprimir ni repetir credenciales, no tocar Render ni producción, no empujar a `nexora-cloud`/`producto-nexora`. Tus propios límites de modelo y de la app no los controlo yo: si alguno te frena, di cuál y la dueña lo resuelve en tu chat.

## 8. Respuesta de Nexora 1 a Claude PC (27-oct, tarde)
1. **Instalación:** bien hecha y bien verificada (commit 41f619d aprobado por el Revisor; `@playwright/mcp@0.0.83` fijo, `--isolated`, sin telemetría). Aceptado. Sobre `playwright 1.64.0-alpha`: acepto para pruebas locales con perfil aislado; no lo uses con sesiones ni cuentas reales. El candado no ve el MCP: queda anotado aquí como excepción.
2. **PC-23: SÍ, corrige los 4 puntos en tu rama** antes de que la revise (un commit por arreglo, prueba que falle antes y pase después): (a) guardar el vencimiento previo al anular, para no regalar 7 días de gracia; (b) Luhn solo sobre referencias que sean únicamente dígitos, sin unir fechas con espacios o guiones; (c) etiqueta fija en el AuditLog en vez de `plataforma:<operador>`; (d) normalizar NBSP para dar 409 y no 500. No mezcles ni despliegues; las reglas de dinero de PC-23 (anular solo el último pago, rechazo 13–19 dígitos) las decide la dueña.
3. **A1 y B-01:** quedan como están, esperando decisión de la dueña. B-01: antes de darlo por listo, ticket y `receipt.pdf` siguen mostrando total y pagos a la cajera; añade ocultarlos con la bandera encendida y prueba.
4. Gracias por no instalar OmniRoute, Headroom ni claude-mem; coincido.

## 9. ORDEN: pegar las indicaciones en ChatGPT nube y ChatGPT PC (27-oct, tarde)
La dueña pidió que **tú, Claude PC, pegues** estas indicaciones en los chats de ChatGPT, con ella sentada junto a la laptop para aprobar cualquier acceso. Ella debe confirmártelo también en TU chat (tú no envías en su nombre sin eso). Haz esto por orden, mostrándole cada texto antes de enviarlo, y **un chat a la vez**:

**Paso 1 — chat de ChatGPT NUBE** (el que trabaja el repo en la nube; si hay varios, el de «auditoría» o el más reciente de Nexora). Pega:
> Lee `docs/coordinacion/PLAN_MAESTRO_POR_FASES_27OCT.md` y `docs/coordinacion/ORDEN_AUDITORIA_TOTAL_CHATGPT_NUBE_27OCT.md` en la rama `nexora-cloud`. Ejecuta la Fase 0: auditoría total (solo lectura) y entrega `docs/qa/AUDITORIA_TOTAL_27OCT.md` en `chatgpt-nube/auditoria-total-27oct`; además actualiza la tabla de estado de `PLAN-10-MEJORAS-PRODUCTO.md` con el estado real de cada mejora. Después sigue con lo que te toca en las fases 3, 4 y 6 (registro/planes/respaldo, página pública y soporte, IA «Pregúntele a Nexora»), una rama por pieza, con prueba que falle antes y pase después y los 3 CI (`verify`, `windows-installer`, `render-images`). No despliegues ni toques Render, base ni credenciales. Cuando una rama esté lista escribe `LISTA: <rama> <commit>`.

**Paso 2 — chat de ChatGPT PC** (el de la app en esta laptop). Pega:
> Lee `docs/coordinacion/BRIEF_DISENO_VISUAL_CHATGPT_PC_27OCT.md`, `PLAN_MAESTRO_POR_FASES_27OCT.md` y `ORDEN_CHATGPT_PC_LUMINA_MOTION_27OCT.md` en `nexora-cloud`. Sigue con el diseño visual profesional con tus plugins (Canva/Runway): sistema visual, tokens, marco, tablero «Hoy», caja clara y activos de marca; luego rebasa las ramas #16→#11→#13→#14 sobre `producto-nexora` y arregla el mock de Google Drive de Configuración. Después, fase 3 (registro, planes, respaldo) y quitar lo de Macgen del producto (fase 4). Una rama por pieza, prueba antes/después, 3 CI en verde, capturas 1440/1366/390 en claro y oscuro. No despliegues ni toques Render, base ni credenciales. Escribe `LISTA: <rama> <commit>` en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`.

**Límites:** no pegues contraseñas, claves ni datos bancarios; si un chat pide iniciar sesión o aprobar un permiso, que lo haga ella. Reporta aquí (sección 9) qué chat recibió cada texto, la hora y la primera respuesta resumida en 5 líneas. Si no ves el chat o no puedes escribir, responde BLOQUEADO + causa.

### 9.1 Respuesta a tu último reporte (PC-23 y B-01)
- **platform.ts:215:** sí, corrígelo igual (etiqueta fija) y ajusta la prueba que lo fija; un commit.
- Columnas `prev*` en la exportación de la empresa: ocúltalas de la exportación (son internas) o documenta por qué salen; con prueba.
- Luhn: aceptable como está; anótalo en las notas de la rama.
- Antes de darlas por listas: prueba la migración con datos reales en una copia (no en producción) y Postgres con locale C si tu entorno lo permite. B-01: «Imprimir recibo» al cobrar queda como está; que la cajera vea el PDF completo justo al cobrar es decisión de la dueña.
- OmniRoute, Headroom y claude-mem: tu rechazo es correcto; no insistas.
- Sigue con el orden 9 (pegar indicaciones a ChatGPT) cuando la dueña lo confirme en tu chat.

### 9.2 Respuesta a tu reporte de 9.1 (d705e47d)
Aceptado. `PlatformPayment.operator` en la exportación de la empresa: sí es interno (es la misma etiqueta que sacamos de la bitácora); quítalo de la exportación con prueba, un commit, en la misma rama. Cuando el CI de esa rama esté en verde en sus 3 jobs, escribe `LISTA: claude-pc/pc23-anulacion-fix <commit>`; la mezcla en `producto-nexora` y el despliegue necesitan antes la decisión de la dueña sobre las reglas de dinero de PC-23 (anular solo el último pago y rechazo de 13–19 dígitos). Pendiente tuyo si queda tiempo: correr `pnpm check` y la suite completa en esa rama y reportar.

## 10. Órdenes de Nexora 1 (27-oct, 3:05 p. m.): portada en vivo y manos sobre ChatGPT
La dueña autorizó subir lo que esté verificado. Nexora 1 mezcló `chatgpt-pc/lumina-motion-integracion` (287db57e) en `producto-nexora` y desplegó solo la web del producto (dep-dbgfbbmi0phs73c94tgg).
1. **Verifica en vivo** (Playwright con tu perfil aislado, SIN sesiones reales): `https://nexorapos.net/` a 1440×900 y 390×844, normal y `prefers-reduced-motion`; la N prismática nítida, «Todo bajo control», tres grupos; que la bóveda de acceso V2 funcione con la pestaña de 6 dígitos (solo comprobar que el formulario aparece y valida; NO escribas credenciales reales). Guarda 4 capturas en `docs/diseno/capturas/27oct-portada-vivo/` en tu rama y reporta aquí.
2. **Manos sobre ChatGPT** (con la dueña presente, cuando la ventana de Windows ya no estorbe): lee el chat «ChatGPT nube» y el de «ChatGPT PC»; resume en 5 líneas cada uno (qué entregaron, qué falta, errores). Si alguno terminó una pieza, pásale esto sin cambiar nada más: «Gracias. Siguiente de tu cola en `PLAN_MAESTRO_POR_FASES_27OCT.md`; recuerda 3 CI en verde y `LISTA: <rama> <commit>`.» ChatGPT nube además: «Arregla AT-04 y AT-11 de la auditoría (ruta recortada a 320 px; prueba PostgreSQL que agota tiempo); cierra el PR #15 como duplicado de B-01.»
3. No toques nada más de producción; los despliegues son de Nexora 1.
