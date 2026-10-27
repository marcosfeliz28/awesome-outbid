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
