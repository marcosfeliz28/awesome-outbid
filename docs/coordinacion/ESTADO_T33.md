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

## Costo por pregunta (pedido de N1, 30-oct)
- Modelo por defecto `claude-haiku-5-5` (`ASSISTANT_MODEL`); `render.yaml` ya lo fija igual, sin override en producción. `max_tokens` 600, timeout 20 s, máx. 4 rondas, 30 preguntas/día/usuario.
- Tamaño real medido (API local, administrador, texto exacto enviado: instrucciones + herramientas + pregunta + resultado; tokens ≈ caracteres ÷ 3, estimación prudente):
  - Ronda 1 (instrucciones + 4 herramientas + pregunta): 3 879 caracteres ≈ 1 300 tokens.
  - Ronda 2 (+ resultado de la herramienta): 4 270 (resumen), 4 445 (cobros), 4 573 (comparar), 5 567 (top 10) ≈ 1 400–1 900 tokens.
  - Salida: ~100 (llamada a la herramienta) + ~150 (respuesta de ≤5 líneas) ≈ 250 tokens.
- La IA ya recibe solo agregados (totales, hasta 10 filas del top, bancos), nunca filas de ventas; no hace falta reducir más.
- Costo con precios por defecto 1 / 5 USD por millón de tokens (entrada / salida; **sin verificar** contra la tarifa real, ajustables con `ASSISTANT_PRICE_*`):
  - Pregunta típica: ~2 900–3 200 tokens de entrada + 250 de salida ≈ **US$0.004–0.005**.
  - 300 preguntas ≈ **US$1.2–1.5**.
  - Peor caso (4 rondas, 600 tokens de salida cada una): ≈ US$0.02 por pregunta, US$6 por 300.
- Cada pregunta guarda tokens y costo en `AssistantQuery`, así que el gasto real se puede sumar con una consulta.

## Estado final (30-oct)
- Código final de T33: `0f1a751`, CI de GitHub **verde** (run 41034156111). Commits posteriores de esta rama solo tocan este documento.
- Sigue pendiente (no depende de CI): probar con la llave real de Anthropic y confirmar id del modelo y tarifa.
