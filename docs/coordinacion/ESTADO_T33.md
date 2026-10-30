# Estado T33 (Norexos 9) — IA de ventas de solo lectura

Rama `claude/ia-ventas-linea`. No desplegar sin los 3 CI en verde (lo hace Norexos 1).

## Hecho
- [x] Diseño: `T33_DISENO.md`.
- [x] Pruebas: `tests/assistant-unit.test.ts` (permisos, límites, solo lectura; vitest.config) y `tests/assistant-api.test.ts` (5 preguntas con IA falsa = cifras de `/dashboard/breakdown`, rutas, tope 30; vitest.integration.config).
- [x] API: `apps/api/src/assistant.ts` (`GET /assistant/status`, `POST /assistant/ask`), tabla `AssistantQuery` + migración `202611010001_assistant_query` (aditiva; probada migrate desde cero).
- [x] UI: «Preguntar a Norexos» (`apps/web/src/AssistantPanel.tsx`), oculta sin llave o sin permiso.
- [x] Docs: PANTALLAS, ROLES_Y_PERMISOS, DATOS_Y_MODELOS, CAMBIOS; `render.yaml` con `ASSISTANT_MODEL`.

## Verificado localmente
typecheck, lint y build OK; unitarias 697 OK; integración propia + desglose OK.
`pnpm check` falla SOLO en 14 suites `*-postgres` (embedded-postgres: initdb se niega a correr como root en este contenedor); el CI de GitHub las corre.

## Falta / para Norexos 1
- Poner `ANTHROPIC_API_KEY` ya existe en Render; `ASSISTANT_MODEL` (por defecto `claude-haiku-5-5`) viene en `render.yaml`. Confirmar el id del modelo económico vigente.
- Precio por token para el costo: `ASSISTANT_PRICE_IN_USD_PER_MTOK` / `_OUT_` (por defecto 1 y 5 USD/MTok, estimado).
- Prueba real con la llave de verdad (aquí solo se probó con cliente falso).
- Citas de `App.tsx` posteriores a la línea 290 en docs/sistema pueden estar corridas ~17 líneas.
Bloqueos: ninguno.

## Fusión con Norexos 8 (`claude/ia-ventas-linea-obrero2`)
- Fusionada. Conservado de la rama de N8: `"categories"` en la lista pública de `safe()` (sin eso, `reports:read` sin `profit:read` rompía `resumen_ventas` por línea; ahora las filas pasan por la lista blanca y no salen costo/ganancia/margen: probado con datos reales).
- Conservado de la mía: `assistant.ts` (cajera = rol `seller` aunque tenga `reports:read`/`profit:read`; permisos por `toolsFor`), tabla `AssistantQuery` con migración `202611010001` (se descartó la `202610310003` de N8: misma tabla, no se pueden tener las dos), panel «Preguntar a Norexos» en el menú (se descartó el cuadro del inicio, `AssistantBox`), 5 preguntas vs `/dashboard/breakdown`.
- Tomado de N8: el lugar se reserva ANTES de llamar al modelo (fila `pending`), así el tope de 30 no se salta con peticiones simultáneas. `max_tokens` 600, timeout 20 s.
- Pruebas adversariales nuevas (`tests/assistant-api.test.ts`, "permisos con datos reales"): sin profit:read no hay costo/ganancia/margen; con profit:read sí; cobros bloqueados sin ver el esperado de caja; cajera con `reports:read`+`profit:read` solo `mis_ventas`; sin permisos 403; pedir cambiar un precio no altera `Variant`.
- Se borró `tests/asistente-ventas-api.test.ts` (probaba la API de la versión de N8, ya reemplazada).
- `pnpm check`: solo fallan las 14 suites `*-postgres` (initdb no corre como root aquí). Resto verde.
