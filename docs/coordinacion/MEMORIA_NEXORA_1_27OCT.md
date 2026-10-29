# Memoria de «Nexora 1 · Software» (Claude nube) — corte del 27-oct-2026, ~11:00 a. m. RD

Sin credenciales, PIN ni contraseñas. Sirve para retomar tras un `/compact` o en una sesión nueva. Léelo junto con `AGENTS.md`, `CLAUDE.md`, `docs/coordinacion/SESIONES_Y_LIMITES.md` y `docs/operacion/PENDIENTES-DUENA.md`.

## Quién es quién
- **Dueña:** Grupo MacGen / GV Makeup Studio. Responder en español, corto, resultado primero (lee en el celular).
- **Nexora 1 · Software (esta, `session_01VUzTHmv39QwMjbYWn5CWyp`):** cerebro, arquitecta/auditora. **Única que despliega** (Render) con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
- **Nexora 2 · Mercancía** (`session_01MRpmN63Fg2XPVfHVHWCf9v`): inventario, cobros y cajas, verificado 3 veces (conteos 4). **Nexora 3 · Taller** (`session_01CjMpH4P7ZguG6eeWA4vZ18`): plugins, diseño y pruebas, sin producción. **Nexora 4 · Revisor** (`session_01CjMpH5fTbxjEGsGxg1UY55`): solo lectura, audita herramientas. **Nexora PC · Claude PC** (`session_01HGA6qCwzoy8zYp9BQgRP5c`, la laptop; mensajes directos bloqueados: se le habla por archivo).
- **ChatGPT PC y ChatGPT nube:** constructores; nunca tocan Render, base de la tienda ni credenciales. Solo se les habla por archivos del repositorio (la dueña pega).

## Reglas que no cambian
Margen = (precio − costo)/precio **sin restar ITBIS**, mínimo 15 %. No cambiar precios en el sistema por una oferta (la caja aplica el descuento). No tocar lo que la dueña contó o cambió hoy sin conteo nuevo. Todo cambio de mercancía o dinero: 3 verificaciones independientes antes y otra después, se muestra y se aplica solo con su confirmación. Nunca imprimir credenciales. Arqueo ciego: la cajera con caja abierta no ve importes. e-CF y B04 en pausa.

## Estado en vivo (27-oct)
- **Tienda** `nexora-pos-web.onrender.com` (rama `nexora-cloud`): live `7bec2ee8` (Preguntas + encuesta + «Mis ventas de hoy» + arreglos GV, desde el 26-oct 10:27 RD). Head de la rama `52e7ead0` con CI verde (solo docs/seguridad encima). Servicios Render: API `srv-db3fep59fdbs73dic6n0`, web `srv-db3feel9fdbs73diarn0` (workspace `tea-db3f7ofavr4c739hsgi0`).
- **Producto** `nexorapos.net` (rama `producto-nexora`): live `c6148bac` (portada y bóveda V2 desde el 26-oct 11:25 RD). API `srv-dbema1nb9u1s73a77jn0`, web `srv-dbem9lvb9u1s73a76l0g`.
- **Cajas:** 0 abiertas viejas (cerré la CCB5 de la dueña, prueba). Hoy abiertas Wendy y Lizbeth.
- Rutinas: «Revisar PCs y ChatGPT (cada hora)» `trig_01NQHanGFhybbjB36Ts6xR3c`; «Vigilante» `trig_018ZGJC4HvJWRET7bRDEyPSD`; «Revisión diaria» `trig_01UWGw6a6FKD1uoSv1vks4uJ`. Desactivadas: `trig_011Un4NYJQufjPE8d2ri4H7D`, `trig_01WbXfNByqSMH5FjhVUC33yq`, `trig_01Hs9V8krf32KZsguUDwNc1p`. Están atadas a ESTA sesión: en una sesión nueva hay que recrearlas.

## Decisiones tomadas
- Estilo oficial = portada V2 Obsidian Lumina. Diseño interior lo hacen **ChatGPT PC (marco, caja clara, tablero «Hoy»)** y **ChatGPT nube (Catálogo, Inventario, Clientes, Reportes, Configuración, Mercancía/Equipos, Asistente)**, orden en `docs/coordinacion/ORDEN_DISENO_INTERNO_26OCT.md`. Fase 3 de Claude PC en pausa. Cajeras en claro; admin elige claro/oscuro; tablero abre en «Hoy».
- Plugins: solo `ponytail` en config general; pesados solo en el Taller (`scripts/taller-instalar.sh`, guardia `taller/guardia.mjs` 35 pruebas, candado `scripts/plugins-lock.mjs`). **Rechazados:** OmniRoute, Headroom, claude-mem (para Claude PC falta decisión de la dueña). Task Observer 3.8.1 (`ba696b2`) instalada en el Taller; **falta su huella en `docs/seguridad/plugins.lock.json`**: calculada desde la etiqueta oficial = `5d8583079e9d7e56503cc9b5ecd6942ed84642413bfed7806729981081b838a1` (7 archivos); confirmar contra lo que vea el Taller antes de agregarla.
- Instalador local: contraseña del dueño 4–20 caracteres solo en la versión local; nube sigue con política fuerte. Tildes corregidas (UTF-8). Falta la prueba física (espera el «sí» de la dueña).

## Pendientes de la dueña (decisiones)
1. Ocultar importes en «Ventas» a la cajera con caja abierta (hallazgo del QA; rompe el arqueo ciego). Recomendado: sí.
2. «Utilidad/netProfit» ¿deja también de restar ITBIS?
3. Anular FS-0000008 (Pérez Sosa, prueba suya, RD$ 3,000). Hasta entonces cuenta como deuda.
4. Cobros: 13 créditos/contraentregas pendientes (total ≈ RD$ 233,050). Ella dice que Annya, Ginette, Alex y Juan Carlos «los tiene cuadrados»; en el sistema NO hay cobro registrado. Pedir fecha, monto y forma de pago para registrarlos. Josué Noruega FS-25 ya verificado.
5. Transferencias 26-oct: FS-306 y FS-300 coinciden con el banco (¿marcar verificadas?); FS-299 (+600), 303 (+450), 305 (+250) entraron de más y FS-302 (−100); cuenta «Banreservas ···5237» del sistema no coincide con la cuenta de la captura (9608377961): aclarar.
6. PR en borrador para coordinar agentes (necesita su «sí»). Crear entorno de Claude «Taller» sin secretos, quitarle Render/Cloudflare, proteger ramas en GitHub.
7. Promociones del análisis de rotación (`ROTACION-15-DIAS-2026-10-27.pdf`, 510 productos sin venta = RD$ 1.82 M a costo): escoger cuáles.
8. Archivar «Vamos hacerlo» y «Contador de calorías» (no son de Nexora) si no las usa.

## Hallazgos abiertos del QA (rama `claude/qa-recorrido-26oct`, `docs/qa/INFORME_RECORRIDO_26OCT.md`)
0 críticos, 1 alto (importes en «Ventas» a la cajera), 3 medios (ruta prohibida monta y dispara 403 antes de redirigir `App.tsx:1192/733`; tooltip «Ventas del año» ilegible en oscuro `styles.css:6343`; «Ventas» a 390 px corta columnas `styles.css:1330`) y 4 bajos.

## Seguridad: veredictos
`docs/seguridad/PLUGINS.md` y `PLUGINS-PROFUNDA.md`. oh-my-claudecode 5.7.19 aprobada solo en Taller (modo strict, sin HUD). Nunca proxies de IA ni plugins con hooks en la sesión con llaves.

## Cómo entrar al sistema sin imprimir nada
`docs/coordinacion/claude-nube/entrar.py` (lee NEXORA_CLAUDE_USER/NEXORA_CLAUDE_PASSWORD del entorno o su archivo local). Reportes: `reportes.py diario|anomalias`. Mercancía: `mercancia.py` con bitácora `docs/operacion/bitacora-mercancia.jsonl`. Filtro correcto de ventas: `/sales?date=YYYY-MM-DD&limit=500` (from/to no funcionan).

## ACTUALIZACIÓN (27-oct, noche) — REGLA PERMANENTE
La dueña solo interviene en lo que las sesiones no pueden hacer. Nexora 1 manda a Claude PC instrucciones detalladas; Claude PC ejecuta con ChatGPT PC y nube (chats NUEVOS si los abiertos están ocupados). Detalle: `docs/coordinacion/REGLA_OPERATIVA_CLAUDE_PC_MANOS.md`. Carriles: `LEVANTAMIENTO_Y_CARRILES_27OCT.md`. Plan visual (Gemini, 119 h): `PLAN_VISUAL_GEMINI_27OCT.md`. Estado: producto en vivo con 1a04cd33; B-01 tienda mezclado (3a6096fb, falta CI/despliegue con cajas cerradas); relevo del jueves pendiente.
