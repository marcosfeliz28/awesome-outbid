# T33 · IA de ventas («Preguntar a Norexos») — diseño

Rama `claude/ia-ventas-linea` (Norexos 9). Solo lectura. No se despliega desde aquí.

1. **Endpoints** (`apps/api/src/assistant.ts`): `GET /assistant/status` (¿activo?, preguntas restantes hoy) y `POST /assistant/ask {question}` → `{answer, used:[{tool,params,range}], remaining}`.
2. **Sin API key** (`ANTHROPIC_API_KEY`, patrón `aiEnabled`): status `enabled:false`, el menú se oculta y `ask` responde 404 sin llamar a nada.
3. **Herramientas** (zod `.strict()`, nunca SQL libre): `resumen_ventas`, `top_productos`, `cobros` (por método y banco), `comparar_periodos`, `mis_ventas`. Las cuatro primeras llaman a la MISMA función que `GET /dashboard/breakdown` (D-05 devoluciones) → cifras idénticas; cada respuesta incluye `from`/`to` y totales usados.
4. **Permisos en el servidor, antes de la IA**: sin `reports:read` y sin ser cajera → 403. Gerente/dueña (`reports:read`) → herramientas de tienda. Costo, ganancia y margen solo con `profit:read` (campos quitados por `safe()` + se quitan las herramientas que los piden).
5. **Cajera (`seller`)**: solo `mis_ventas` (reutiliza `mySales`: sus ventas, hoy/semana, sin costos, caja ciega hasta cerrar), sin totales de tienda, sin datos de clientes.
6. **Solo lectura**: no hay herramienta que escriba; el prompt manda decir «no puedo cambiar nada» si piden cambiar precio/stock/venta.
7. **Límites**: 30 preguntas/día/usuario (día de negocio America/Santo_Domingo, contado en la tabla); al llegar al tope avisa y NO llama a la IA. `max_tokens` 600, timeout 20 s, máx. 4 vueltas de herramientas.
8. **Modelo**: `ASSISTANT_MODEL` (por defecto `claude-haiku-5-5`, distinto de `ANTHROPIC_MODEL` de facturas). Cliente inyectable para pruebas (mock).
9. **Tabla nueva** `AssistantQuery` (migración `202611010001_assistant_query`, solo `CREATE TABLE IF NOT EXISTS`): id, userId, branchId, question (≤500), model, inputTokens, outputTokens, costUsd, status (`ok|error|limit`), createdAt. Índice (userId, createdAt).
10. **UI**: entrada «Preguntar a Norexos» en el menú solo si status.enabled y el usuario puede usarlo; panel simple con caja de texto y respuesta; sin tocar estilos globales.
11. **Pruebas**: unitarias (`tests/assistant-*.test.ts`: permisos, límites, solo lectura) y de integración con cliente falso (`tests/assistant-api.test.ts`) que compara cifras con `/dashboard/breakdown`.
12. **Docs**: PANTALLAS, ROLES_Y_PERMISOS, DATOS_Y_MODELOS, CAMBIOS en cada commit; avance en `ESTADO_T33.md`.
