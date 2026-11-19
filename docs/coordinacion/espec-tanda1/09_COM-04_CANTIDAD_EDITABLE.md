# COM-04 · Diseño de cantidad editable en el carrito

**Bloqueada para construcción hasta confirmación de la dueña: puede cambiar total, promoción, ITBIS y stock.** Base `511d223f`.

## Superficie y reglas propuestas

- `apps/web/src/POS.tsx:387-421`: `choose` controla existencia al sumar una unidad.
- `apps/web/src/POS.tsx:442-455`: `changeQty` ya ajusta descuento monetario que exceda el bruto nuevo.
- `apps/web/src/POS.tsx:826-865`: el buscador prioriza código exacto; aquí se interpretaría opcionalmente `cantidad*código`.
- `apps/web/src/POS.tsx:1165-1192`: hoy solo hay botones −/+, y el incremento directo evita parte de `changeQty`.
- `apps/web/src/api.ts:143-149`: `updateQty` actualiza la cantidad del carrito.
- `packages/shared/src/index.ts:19-33`: cantidad válida: mínimo `0.001`, máximo tres decimales; combos siguen enteros por `apps/api/src/sales.ts:944-959`.

Un único `setValidatedQuantity` debe gobernar botones, campo editable y `cantidad*código`. Reglas:

1. aceptar `0.001..10000`, máximo tres decimales; combos, solo entero;
2. cero/vacío no elimina silenciosamente: ofrecer `Quitar` por separado y restaurar el valor anterior;
3. bloquear sobre existencia salvo stock negativo permitido y producto sin lote requerido; si se permite, advertir igual que `choose`;
4. recalcular con el precio vigente de la línea, promoción para la nueva cantidad e ITBIS mediante `lineTotals`;
5. conservar porcentaje de descuento; reducir descuento por monto al bruto nuevo, como ya hace `changeQty`;
6. mayoreo conserva la condición de venta y su precio vigente; cambiar cantidad no activa/desactiva mayoreo de forma implícita;
7. `cantidad*código` solo se interpreta si ambos lados son válidos y el código coincide exactamente; de otro modo sigue siendo búsqueda normal.

## Prueba de regresión futura

Crear `tests/pos-editable-quantity.test.tsx` y ampliar `tests/promociones-paridad.test.ts`: teclado, pegar, botones y `3*CODIGO` producen la misma línea; fracciones válidas funcionan; cuarto decimal, negativo, cero y combo fraccionario se rechazan; existencia/stock negativo/lote respetan reglas; bajar cantidad limita descuento por monto; 2x1 cruza el umbral correctamente; mayoreo e ITBIS mantienen los mismos totales que servidor. Los casos de entrada editable fallan hoy y pasan después.

Pruebas de texto que pueden romperse: `tests/accessibility-contract.test.ts`, `tests/caja-web-ticket.test.ts`, `tests/compliance.test.ts`, `tests/customer-display.test.ts`, `tests/f2-03-pos-visual.test.ts`, `tests/impacto.test.ts`, `tests/promociones-paridad.test.ts` y `tests/recibo-envio.test.ts`.

## Decisiones y marcha atrás

- Confirmar con la dueña si se desea sintaxis `cantidad*código`; el campo editable puede construirse aparte.
- No aceptar coma decimal hasta definir normalización de teclado local; recomendación: aceptar `,` y normalizar a `.` solo en UI.
- Marcha atrás: volver el número a texto y retirar parser; cantidades guardadas siguen dentro del contrato actual.
