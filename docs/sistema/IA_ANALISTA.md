# Asistente analista (plan «analista» de la IA de ventas)

Rama `claude-pc/asistente-analista`. **Aún no desplegado ni mezclado en `nexora-cloud`.** Amplía «Preguntar a Norexos» (`IA_VENTAS.md`) según `docs/ia/ASISTENTE_ANALISTA_SPEC.md`. Código: `apps/api/src/assistant.ts`.

## Cómo se activa

- Plan nuevo en la misma variable: `IA_VENTAS_PLAN=analista` (o `main:analista,otra:medio`). Sin plan o sin `ANTHROPIC_API_KEY`, sigue apagada como antes.
- Tope: 30 preguntas por usuario y día (igual que «completo») **y** tope de costo estimado por usuario y día de US$0.40 (solo plan analista; medio y completo siguen solo con tope de preguntas) (`IA_COSTO_TOPE_USD`, PENDIENTE de aprobar por la dueña). Al llegar a cualquiera de los dos no se llama al modelo («Llegaste al tope de costo de IA de hoy»). Con precios sin cargar (costo null) el tope de costo no frena.
- Medidor: cada pregunta del plan analista deja su fila en `AiUsage` con `feature = "ia_analista"` (los otros planes siguen con `ia_ventas`), creada antes de llamar al modelo bajo el mismo bloqueo por usuario. Solo usuario, sucursal, modelo, tokens, costo y `ok`: **nunca** el texto de la pregunta ni de la respuesta.

## Herramientas nuevas (todas de solo lectura)

Solo existen con plan analista y se suman según el permiso de la pantalla que reutilizan. Ningún esquema acepta sucursal, empresa ni usuario (zod `.strict()`): todo sale del actor autenticado (`actor.branchId`). Siguen los límites de siempre: 4 herramientas por ronda, 3 rondas, rangos de hasta 366 días; y ahora una fecha inexistente (31 de febrero) se rechaza.

| Herramienta                 | Qué devuelve                                                                            | Lee de (mismo método de la pantalla/reporte)                                                                                                                          | Quién                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `cuadre_dia`                | ventas netas, forma de cobro, anuladas aparte, transferencias sin verificar             | `dashboardBreakdown` + reporte `by-payment` + reporte `anulaciones` + `GET /payments/pending-transfers` (monto real, por fecha del pago; con `sale:manage`)           | quien ve el arqueo (`profit:read` o `sale:manage`)                                     |
| `cierres_caja`              | cajas abiertas y cerradas: contado; esperado y diferencia (faltante/sobrante) por forma | `CashController.sessionsFor` (lo mismo que `GET /cash-sessions`, pero todas las cerradas del rango, sin el tope de 100 de la pantalla) + reporte `diferencias-cuadre` | `cash:write`; la cajera solo sus cajas y **sin** esperado ni diferencia (cierre ciego) |
| `transferencias_pendientes` | cantidad, total, por banco, cálculo y lista (sin cliente)                               | `GET /payments/pending-transfers`                                                                                                                                     | `sale:manage`, nunca la cajera                                                         |
| `inventario_bajo`           | existencia ≤ mínimo, agotados y déficit                                                 | `GET /inventory/stock` + reporte `low-stock`                                                                                                                          | `catalog:read` (más `reports:read`), sin costos                                        |
| `productos_sin_ventas`      | productos con existencia y sin ventas válidas en N días                                 | reporte `no-movement`                                                                                                                                                 | `reports:read`                                                                         |
| `explicar_reporte`          | guía («qué es, para qué sirve, cómo se lee») y primeras filas                           | `GET /reportes/:name/guia` + `GET /reports/:name`                                                                                                                     | el permiso del reporte (los de margen piden `profit:read`)                             |

Además, con plan analista: `resumen_ventas` (sin línea) trae ITBIS, descuentos, anuladas y devoluciones registradas aparte; `comparar_periodos` (todos los planes) dice si los períodos no duran lo mismo, el % de unidades y «no calculable» cuando el período b está en 0.

No se duplicó ninguna fórmula de dinero: las cifras vienen de los mismos métodos de `reports.ts`, `cash.ts`, `sales.ts` e `inventory.ts`, con sus permisos (`liveDeps` en `assistant.ts`). Costos y márgenes se siguen quitando sin `profit:read`.

## Regla «leer por dos caminos antes de dar una cifra»

Cada herramienta que da un total trae `verificacion` (`verify` en `assistant.ts`): las lecturas, la diferencia y `cuadra`. Si no cuadran al centavo o una lectura falta (error o tiempo agotado), `cuadra = false` con un aviso, y el prompt obliga a responder «No puedo confirmarlo con seguridad», mostrar las cifras y no elegir una.

| Herramienta                 | Lectura 1                                                     | Lectura 2                                                  |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `cuadre_dia`                | ventas netas del desglose                                     | suma por forma de cobro del reporte `by-payment`           |
| `resumen_ventas` (analista) | desglose (líneas)                                             | resumen del tablero (totales de factura − devoluciones)    |
| `cierres_caja`              | suma de diferencias de cada cierre (y total = suma por forma) | reporte `diferencias-cuadre` (total y cantidad de cierres) |
| `inventario_bajo`           | `GET /inventory/stock`                                        | reporte `low-stock` (mismos SKU)                           |

Con la semilla de demostración las dos lecturas coinciden en todos los casos probados (`tests/assistant-api.test.ts`, bloque «plan analista contra la base real»). Una venta con envío de mensajero podría hacer que `by-payment` y el desglose difieran: en ese caso el asistente dice que no cuadra y muestra ambas cifras (NO COMPROBADO con datos reales de envíos). Comprobado con los datos de prueba: una venta completada sin ningún pago registrado hace que `cuadre_dia` diga «no cuadra» por ese monto, que es lo correcto.

## Evaluación de 100 preguntas

- `tests/ia-analista/casos.ts`: datos fijos «Demo Uno · Centro» (Norte y Demo Dos con cifras distintas), las 100 preguntas de `docs/ia/ASISTENTE_ANALISTA_EVAL_100.md`, el «modelo» guionado y la comprobación de cada una. `tests/ia-analista-eval.test.ts` la corre en CI **sin llamar a Anthropic**.
- **Resultado: 92/100** (dato 53/61, derivado 5/5, rechazo 28/28, prompt 6/6). Los 23 casos bloqueantes de seguridad pasan.
- Los 8 que fallan piden cifras **brutas** y el sistema entrega **netas** (facturas vigentes menos devoluciones, regla D-05): AA-005 (ITBIS neto 244.07 en vez de 274.58), AA-019/020 (7 contra 6 nov en neto), AA-029/035/040 (ranking bruto por producto), AA-043/044 (efectivo neto del reembolso). Decisión de la dueña: o se corrige la evaluación a netos, o se agrega una lectura bruta.
- «Derivado» (AA-001, 002, 003, 009, 100): el bruto sale de neto + devoluciones registradas en el mismo rango; solo es exacto si la devolución es del mismo período que la venta.
- «Prompt»: el caso depende de una regla del prompt (PIN, prompt del sistema, Casa, ventas sin sincronizar); se comprueba que la regla está, pero el comportamiento real solo se ve con el modelo.
- Con la llave real (cuesta tokens, no corre en CI): `ANTHROPIC_API_KEY=… apps/api/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json scripts/ia-analista-eval-real.mts salida.json`. **NO CORRIDO** todavía.
