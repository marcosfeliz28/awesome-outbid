# Autoseguimiento continuo (orden de la dueña, 27-oct-2026)

La dueña quiere que todas las sesiones se revisen solas y sigan trabajando hasta terminar. Límite técnico: Nexora 1 solo puede programar rutinas **cada hora como mínimo**; las demás sesiones/chats usan el ritmo que ellas puedan (15 min o menos). Cada sesión, en cada ronda, hace **lo mismo, en este orden**, y si no hay nada nuevo no escribe ni gasta más:

1. `git fetch origin`; lee `docs/coordinacion/AUTOSEGUIMIENTO_ESTADO.md`, `PLAN_MAESTRO_POR_FASES_27OCT.md` y la orden más reciente para ti.
2. Si tienes una pieza abierta: avanza; cuando esté lista (prueba que falla antes y pasa después, 3 CI en verde `verify` / `windows-installer` / `render-images`, capturas), escribe `LISTA: <rama> <commit>` en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`.
3. Si algo está rojo en una rama tuya: arréglalo primero (reproduce, corrige, un commit, vuelve a correr). Rojo en una rama ajena: avisa en el estado con archivo:línea.
4. Si no tienes pieza: toma la siguiente de tu cola del plan maestro (no tomes la de otro; no toques dinero/caja/ventas ciegas/utilidad/anulaciones sin decisión escrita de la dueña).
5. Actualiza tu fila en `AUTOSEGUIMIENTO_ESTADO.md` (rama, CI, siguiente paso, hora UTC).

## Quién hace qué en cada ronda
| Sesión | Ronda |
|---|---|
| **ChatGPT nube** | Fases 0, 3, 4 y 6 del plan: AT-04 y AT-11 de la auditoría; página pública, registro/planes/respaldo, IA «Pregúntele a Nexora» y resumen diario con consentimiento. |
| **ChatGPT PC** | Fase 1 (diseño visual con Canva/Runway: tokens, marco, tablero «Hoy», caja clara, activos) y fase 4 (quitar Macgen del producto); instalador cuando la dueña diga «sí». |
| **Claude PC** | Ramas `claude-pc/*` (PC-23, A1, B-01), verificación local y en vivo con Playwright aislado, y leer los chats de ChatGPT (con la dueña presente). |
| **Taller / Revisor** | Solo cuando haya tarea nueva o un plugin por probar/auditar; si no, no gastan. |
| **Mercancía** | Solo con orden de la dueña y verificación 3/4 veces. |
| **Nexora 1 (hasta el jueves)** | Cada hora: revisa LISTA, audita, mezcla y despliega solo lo verde y sin dinero. |

## Nunca, en ninguna ronda
Desplegar (salvo Nexora 1), tocar Render/base/credenciales, imprimir claves, mezclar dinero sin decisión escrita de la dueña, instalar plugins fuera de lo aprobado.
