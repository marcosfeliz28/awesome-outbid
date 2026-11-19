# EST-02 · Diseño de una sola regla de promociones

**Bloqueada para construcción hasta confirmación de la dueña: toca totales y descuentos.** Base `511d223f`.

## Diferencias actuales

- Servidor: `apps/api/src/sales.ts:592-613,930-942` calcula promoción y total; rechaza `scope.lotId` antes de FEFO.
- Caja: `apps/web/src/POS.tsx:118-146` mantiene otra copia de la regla; debe verificarse su guardia por lote.
- Cola: `apps/web/src/pendingSales.ts:13-45,47-90` contiene una tercera copia y recalcula pagos al cambiar precios.
- Alta: `apps/api/src/admin.ts:1350-1375` no admite `lotId` en el esquema público de alcance, aunque los consumidores lo contemplan.
- Contrato común: `packages/shared/src/index.ts` ya centraliza `lineTotals`; la regla de promoción debería vivir junto a funciones puras compartidas.

## Diseño mínimo propuesto

Crear una función pura compartida que reciba promoción normalizada, producto/variante, cantidad y contexto de lote asignado; devuelva porcentaje efectivo y razón de no aplicación. API, POS y cola importan exactamente esa función. El servidor sigue siendo autoridad y conserva la comprobación del total esperado. No habilitar promociones por lote: resolver primero si el esquema debe admitirlas y cuándo FEFO aporta `lotId`.

## Plan de paridad (prueba antes de construir)

Extender `tests/promociones-paridad.test.ts` para ejecutar la misma tabla en los tres caminos y exigir total/descuento idénticos al centavo:

1. porcentaje, monto fijo y precio especial; cantidad fraccionaria válida;
2. 2x1/3x2 y segunda unidad a mitad con cantidades justo antes/en/después del múltiplo;
3. alcance por variante, producto, categoría y marca; no coincidencia;
4. promoción vencida, futura, inactiva y dos promociones (gana la mayor);
5. descuento manual mayor/menor/igual a promoción;
6. ITBIS incluido y no incluido, precio con centavos y redondeo por línea;
7. `lotId` presente sin lote asignado (no aplica en los tres caminos);
8. reprecificación offline con efectivo, tarjeta y cuenta por cobrar sin inventar ni duplicar pagos.

La tabla debe fallar antes si se incluye el caso de lote en la copia de POS o cualquier caso divergente; pasa cuando las tres rutas usan la función común. Añadir pruebas API de total esperado y no debilitar las existentes de dinero.

## Casos límite, decisión y marcha atrás

- Decidir con la dueña si promociones se combinan; recomendación vigente: no, gana el mayor descuento frente al manual.
- Definir explícitamente alcance por lote antes de agregarlo al esquema; por defecto queda rechazado.
- No cambiar órdenes de redondeo, impuestos, mayoreo ni pagos offline en la extracción.
- Marcha atrás: restaurar las copias locales conservando la tabla de paridad; no requiere migración.
