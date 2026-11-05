# Contra-auditoría de reportes · ChatGPT NUBE

Fecha: 5-nov-2026. Alcance: hallazgos Alto y Medio de
`HALLAZGOS_TOTAL.jsonl`. La verificación se hizo con código, pruebas y datos
temporales locales; no se consultó producción ni se usaron credenciales.

## Veredicto

| Hallazgos | Contra-auditoría | Evidencia |
|---|---|---|
| `lenguaje-03` | **CONFIRMA (alto)** | `reportes/dinero.ts` filtra devoluciones por `SaleReturn.createdAt`; no sigue la opción A (fecha de la venta). Decisión de dinero pendiente de la dueña. |
| `dinero-02` | **CONFIRMA** | `pct(descuento, venta neta)` usa la venta después del descuento. Cambiarlo altera una cifra publicada; no se cambió. |
| `dinero-03`, `lenguaje-05` | **CONFIRMA** | `diferencias-cuadre` entrega el neto de efectivo, tarjeta y transferencia y cuenta faltantes/sobrantes aparte; la guía debe explicar la fórmula o la dueña decidir otra presentación. |
| `dinero-04` | **CONFIRMA, no es error de suma** | `entradas-cuenta` suma pagos por su fecha, incluidos abonos; `formas-pago-mes` mide cobros de ventas del período. Falta la nota clara. |
| `dinero-07` | **NO REPRODUCIDO localmente** | La prueba API de exportación obtuvo PDF/XLSX y el conjunto local de exportación pasó. El 404 histórico requiere comprobación separada en el entorno autorizado. |
| `clientes-01` a `clientes-03` | **CONFIRMA** | Son límites de agrupación/saldo histórico: crédito sin cliente, estado de pago inicial y saldo al pasado. No hay evidencia de que el cálculo actual de deuda use `pending`; cambiar semántica requiere decisión. |
| `lenguaje-02`, `lenguaje-04` | **CONFIRMA como ambigüedad** | Los nombres mezclan venta neta de devoluciones, costo e ITBIS. Son rótulos/reglas de negocio; no se cambiaron cifras. |
| `ventas-04` | **CONFIRMA como dato maestro** | Una marca faltante no es una falla del cálculo; debe corregirse en catálogo por la dueña. |
| Corregidos Alto/Medio restantes | **CONFIRMA por regresión/código** | Las pruebas de exportación, guía y reportes cubren la corrección; no se halló regresión local. |

## Pruebas realizadas

- `pnpm exec vitest run tests/reportes-export.test.ts tests/gv-reportes-export.test.ts tests/reportes-export-ui.test.ts tests/reports-memory-postgres.test.ts`: 16/16 pasan.
- Exportación temporal de 20.000 filas: PDF y XLSX válidos; Excel reabierto con 20.001 filas incluyendo encabezado.
- PostgreSQL embebido: prueba de memoria/exportación pasa; no carga comprobantes base64 ni el período entero.

## Límites

- El caso de `tests/reportes-export-api.test.ts:219` depende de que el seed tenga crédito abierto; con el seed sin saldo la cifra esperada es `undefined`. No se clasificó como error de dinero.
- Falta la QA visual de los 43 reportes en navegador y una medición de memoria del proceso; este entorno no expone un contador compatible.
- Toda decisión que cambie el período de devoluciones, porcentaje de descuento, saldo histórico o rótulo fiscal corresponde a la dueña.
