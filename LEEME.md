# Control del proyecto Norexos — LÉEME PRIMERO (cualquier sesión, cualquier rama)
Esta rama (`control/norexos`) es la **fuente única** del cronograma. Se lee sin cambiar de rama: `git fetch origin control/norexos && git show origin/control/norexos:proyecto/PLAN_MAESTRO_NOREXOS.md` (y `TABLERO.md`, `ESTADO_DIRECTOR.md`). **No se despliega nada desde aquí.**

## Quién manda
- La dueña habla **solo con Norexos 1** (el cerebro: decide, revisa, mezcla y despliega). Nadie más le escribe; todo se reporta por Norexos 1.
- **Norexos 5 (Director)** mantiene `proyecto/` en esta rama (cada 4 h, solo si algo cambió).
- Constructores: Norexos 3 (Taller), Norexos PC (Claude PC, laptop), ChatGPT (desde 2-nov). Manos locales sin costo: Forja y Brazo (por Norexos PC). Inventario: Norexos 2. Seguridad: Norexos 4.

## Si Norexos 1 NO está disponible
1. Sigue el **TABLERO**: toma la tarea abierta que sea tuya, trabaja en tu rama (`claude/taller-*`, `claude-pc/*`), con prueba que falle antes y pase después, y deja una línea en tu archivo de estado.
2. **Nadie despliega** salvo Norexos 1 (o su sucesora con las llaves de Render, creada por la dueña con el procedimiento escrito). Sin despliegue, la entrega es: rama + commit + los 3 CI en verde (`verify`, `windows-installer`, `render-images`) **del SHA exacto**.
3. Reglas que no cambian: margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %; no cambiar precios por ofertas; caja ciega; no tocar lo contado por la dueña; la tienda solo con cajas cerradas y OK de la dueña; nunca credenciales en archivos; usar «Norexos» en todo texto nuevo.
4. Si te detienes (laptop apagada, cuota, CI en rojo, falta una decisión), escríbelo en el TABLERO: el Director reasigna o abre un agente.
5. Decisiones de la dueña pendientes: ver «Decisiones» en el plan. Sin su respuesta, sigue con lo recomendado **solo** si no toca dinero, caja ni producción.
6. Skills de Matt Pocock (tdd, diagnosing-bugs, domain-modeling, research, handoff, writing-for-agents, pr, codebase-design): toda sesión las encuentra en `.claude/skills/` de `nexora-cloud` (5aedea50). Se usan **solo** si la tarea las pide.
