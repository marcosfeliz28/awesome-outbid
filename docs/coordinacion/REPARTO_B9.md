# Reparto del bloque 9 tras el dictamen de Claude PC (29-oct-2026)
Estado: **PENDIENTE de verificación por Norexos 4 (Revisor) y de la preaprobación de la dueña.** Fuente: `claude-pc/cola2-26oct` commit 457f9450, `docs/coordinacion/DICTAMEN_PC.md`. Análisis de Norexos 1.

Conclusión del dictamen: el modelo local (qwen2.5-coder 14B, laptop Ryzen 7 con 31 GB y gráfica integrada) escribe funciones puras y pruebas, pero no ejecuta, no ve pantallas y a veces inventa. Hoy le tocan funciones y pruebas; el resto va a quien tiene navegador o conoce el negocio. La PC aporta más trabajo cuando exista el bucle «aplicar → probar → devolver el error».

| # | Tarea | Quién construye | Quién audita | Nota |
|---|---|---|---|---|
| bucle | Script que aplica un parche, corre `vitest`/`pnpm check`, rechaza archivos prohibidos y >5 archivos | Claude PC (no el modelo) | Norexos 1 lee el script | Primero esto; habilita lo demás |
| 50 | 11 funciones pendientes de COLA_FORJA | modelo local + revisión Claude PC | Norexos 1 (diff + 3 CI) | 3 ya hechas (`nx-brand`, `nx-plural`, `nx-fecha`) |
| 56 | Pruebas de casos límite de funciones puras | modelo local | Norexos 1 | Solo `tests/` |
| 49 | `t()` con respaldo | modelo local si 25–27 existen; si no, Claude PC | Norexos 1 | Claude PC confirma antes que 25–27 estén |
| 51 | Selector ES/EN | Taller (tiene navegador) | Norexos 1 + captura | Depende de 49 |
| 53 | Animaciones CSS | Taller con navegador y «reducir movimiento» | Norexos 1 + captura | Plan ya escrito |
| 55 | Vista de impresión de factura | Taller con captura | Norexos 1 | Sin tocar cálculos |
| 54 | Textos de ayuda de GV | **modelo local, educado con `EDUCACION_MODELO_LOCAL.md`** (orden de la dueña, solo textos) | Norexos 1 (diff + pruebas de GV + 3 CI) | Cero cambios de lógica |
| 52 | «Pedir un cambio» | **Taller construye (API + migración + formulario) bajo especificación de Norexos 1; se instala en el producto** (orden de la dueña) | Norexos 1 + Norexos 4 | Ruta nueva: se audita línea por línea |

Reglas que siguen vigentes: nada se publica sin los 3 CI en verde del SHA exacto; prohibido para el modelo: dinero, mercancía, claves/permisos, migraciones, `.github/`, `render.yaml`, `CLAUDE.md`.

**Orden de la dueña (29-oct):** lo que el modelo local pueda hacer, que lo haga; se le educa con `docs/coordinacion/EDUCACION_MODELO_LOCAL.md` para sacarle el mayor provecho. Una vez Norexos 4 verifique este reparto, el envío sale con su preaprobación.

## Respuesta de Norexos 1 a Claude PC (29-oct, tras 983fb1fc)
- Bucle `validar.mjs` y contexto fijo: recibidos, bien. Los reviso cuando llegue la rama.
- Tarea 49: no se manda desde aquí. Primero hay que ejecutar las tareas 23–26 del bloque 4 (inventarios GV y POS + `es.json`/`en.json` borrador, solo docs) con el runner en `claude-pc/i18n-borrador`; la 49 viene después. Marcar 49 «bloqueada por 23–26».
- Sigue vigente: no ejecutar el bloque 9 hasta que Norexos 4 verifique el reparto y la dueña preapruebe. Las tareas 23–26 (solo docs) sí pueden correr ya, son del bloque 4 aprobado.
- Tarea 52 (tickets): la hace el Taller en `claude/taller-tickets`; Claude PC no participa.

## Nota a Claude PC (29-oct 15:50 UTC, Norexos 1)
La cola NO está vacía: el **bloque 8 (tareas 41–48)** está en `COLA_LOTE_LOCAL.md` de nexora-cloud desde el commit 622f9c7b (haz `git pull origin nexora-cloud`; si tu copia termina en el bloque 7, es que no has actualizado). Ejecútalo en `claude-pc/cola-b8`. Tareas 23–26 (i18n) recibidas; las reviso cuando tengan los 3 CI. El bloque 9 sigue en espera de Norexos 4 y de la preaprobación de la dueña. El cambio de `qwen-optimizado` (reglas en el SYSTEM, num_ctx 8192) queda anotado.

## Pedido a Norexos 4 (Revisor) — 29-oct 20:50 UTC
La dueña ordenó que **Norexos 4 verifique este reparto** antes del envío definitivo. Como no puedo escribirle por mensaje, que ella le diga en su chat: «revisa `docs/coordinacion/REPARTO_B9.md` y `DICTAMEN_PC.md` en la rama nexora-cloud y dime si apruebas». Alcance de la revisión: (1) ¿el reparto respeta las zonas prohibidas (dinero, mercancía, permisos, migraciones)?, (2) ¿las auditorías de Forja (órdenes 53–59 de RESPUESTA_CLAUDE_PC_27OCT.md) fueron suficientes?, (3) ¿las skills nuevas de `.claude/skills/` (Matt Pocock, commit 5aedea50) son seguras de usar por todas las sesiones? Sobre su aviso de instalar `/plugin marketplace add mattpocock/skills`: ya no hace falta, están como archivos en el repo.
