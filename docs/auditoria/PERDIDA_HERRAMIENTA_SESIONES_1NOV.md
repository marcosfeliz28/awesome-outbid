# Auditoría: pérdida de la herramienta de sesiones (1-nov-2026)

**Qué falló:** el servidor `claude-code-remote` (send_message, create_session, list_sessions…) aparecía «connected» en `/mcp` pero sin número de herramientas; el modelo no las recibía. Ventana aproximada: 10:45 → ~12:04 UTC.

## Hechos verificados
1. Síntoma estable: `/mcp` mostró «connected» sin «N tools» tres veces (los demás servidores sí mostraban su número). `/mcp reconnect` no está disponible en sesiones en la nube.
2. No lo arreglaron: `/compact`, cerrar/abrir la app, `/mcp`.
3. Lo arregló: el reinicio del contenedor de la sesión (~12:04 UTC). Tras él, `list_sessions` y `send_message` funcionaron (2 mensajes entregados).
4. La sesión es muy larga: creada el 2-oct, ~$2.594 de uso, 21 M tokens de salida, varias compactaciones, `worker_epoch` 784.
5. En `get_session`, `turn_handoff.tools` lista solo triggers, send_later y repos, no list_sessions/send_message/create_session, aunque ahora funcionan; esas llegan por otra vía (marca `config:meta-mcp-own-entry`).
6. GitHub y Render no se vieron afectados en ningún momento.

## No verificado
- Causa raíz. La transcripción local se reconstruyó al reiniciar (empieza a las 11:05 UTC): no hay registro de errores anteriores.
- Hipótesis sin prueba: la conexión se degradó dentro del contenedor viejo en una sesión larga; el reinicio la rehízo. Falla de plataforma probable.
- No se reportó todavía a Anthropic (`/feedback`, texto preparado).

## Controles
1. **Canario:** al inicio de cada revisión y tras cada compactación, buscar `list_sessions` con ToolSearch. Si falta, no insistir: registrar y seguir por repositorio.
2. **Sin dependencia:** las órdenes para otras sesiones se escriben siempre en `docs/coordinacion/`; la herramienta solo acelera.
3. **Recuperación:** si falta más de 30 min, la dueña reinicia el contenedor (cerrar y reabrir la sesión) o se abre una sesión nueva con `docs/coordinacion/ARRANQUE_NOREXOS1_1NOV.md`.
4. **Agentes largos:** los de la herramienta Agent mueren con el reinicio; encargar los largos como sesiones separadas (create_session) con rama de salida.
5. **Reporte:** `/feedback` con el ID session_01VUzTHmv39QwMjbYWn5CWyp.
