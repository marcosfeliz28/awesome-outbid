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
