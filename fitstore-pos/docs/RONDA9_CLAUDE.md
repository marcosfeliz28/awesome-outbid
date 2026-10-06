# FitStore POS · ronda 9 (Claude)

Esta ronda corrige los 3 hallazgos de la auditoría de ChatGPT a la ronda 8 (`docs/AUDITORIA_RONDA8.md`, incluida sin cambios con su evidencia y reproducciones). Cada corrección tiene una regresión que **falla con la ronda 8** y pasa ahora (`docs/validacion/ronda9-regresiones-con-ronda8.txt`). El cierre por hallazgo está en `docs/validacion/ronda9-cierre.json`.

## R8-01 · P1 · Códigos con distintas mayúsculas

**Corrección:** el archivo, la base y la caja comparan los códigos **sin distinguir mayúsculas**, igual que la caja.

- **Importador:**
  - Dentro del archivo, `checkCodes()` compara en minúsculas: un ID repetido con otras mayúsculas, o una REFERENCIA o código de barras igual al ID de otra fila, detienen la carga.
  - Contra la base, la consulta es `lower(sku) = ANY(…) OR lower(barcode) = ANY(…)`, con parámetros.
  - Todo se revisa antes de escribir.
- **Caja:** `byCode()` reúne todas las variantes cuyo código de barras o SKU coincide sin mayúsculas. Si hay más de una, no agrega ninguna. Avisa "El código … es de N productos. Elige el producto en la lista y corrige el código en Productos." y deja el código a la vista para que la cajera elija.

**Pruebas:**

- **Integración (importador real, misma base que la API):**
  - El caso de ChatGPT contra la base: A con barras `QA-R9-CASE…`; la fila B con ID y REFERENCIA en minúsculas se rechaza.
  - Entre filas: la REFERENCIA de una fila es el ID de otra en mayúsculas.
  - IDs repetidos salvo mayúsculas.
  - En los tres casos no cambian categorías, productos, variantes ni movimientos.
- **Navegador:** dos productos, A con barras `E2E-CASE-n` y B con SKU `e2e-case-n`. Escribir `e2e-case-n` + Enter avisa "es de 2 productos" y no agrega nada.

## R8-02 · P2 · Devoluciones anteriores a la ronda 8

**Corrección (reporte de utilidad y ABC, `apps/api/src/reports.ts`):**

- Desde la ronda 8 cada línea de una devolución guarda su costo, y el reporte lo usa tal cual.
- Las devoluciones anteriores no lo tienen. Se concilian con lo que esa devolución **contabilizó** (`SaleReturn.costTotal`, que sólo incluye lo repuesto al stock):
  - Una sola línea repuesta recibe exactamente `costTotal`.
  - Varias líneas: `costTotal` (menos lo que ya traiga costo) se reparte en proporción al valor de cada línea, redondeado a centavos, y el resto va a la última línea. La suma es exacta.
  - Las líneas no repuestas al stock no restan costo.
- La conciliación se hace al leer: no modifica datos, así que repetirla da siempre lo mismo.
- **Caso no determinable:** el reparto por producto de una devolución antigua con **varias** líneas es una estimación proporcional; el total de la devolución sí es exacto. Si la línea de venta ya no existe, la devolución no aparece en el reporte, igual que antes.

**Prueba (integración):** venta de 10 combos con costo 50.05. La devolución de 3 contabiliza 15.02 y se le quita el costo por línea, como la guardaba la ronda 7. El reporte da **35.03** (la ronda 8 daba 35.04), igual al leerlo dos veces. La devolución de los 7 restantes deja ventas 0, costo 0, unidades 0 y utilidad 0, sin −0.01.

## R8-03 · P2 · Una carga que se detiene no deja cambios

**Corrección (`apps/api/scripts/import-inventario.ts`):**

- **Límites:** el lector rechaza números no finitos y los que no caben en la base: dinero hasta 999 999 999 999.99 (`Decimal(14,2)`) y existencia hasta 99 999 999 999.999 (`Decimal(14,3)`). El error indica fila, columna y máximo.
- **Categorías:** se revisan todas antes de escribir (lote o vencimiento obligatorios sin `--sin-lotes`).
- **Una sola transacción:** categorías nuevas, desactivación auditada de lotes, productos, variantes, movimientos de "Inventario inicial", activaciones y cambios de precio. Si algo falla, PostgreSQL revierte todo.
- `--dry-run` no escribe nada, como antes.

**Pruebas (integración):**

- El caso de ChatGPT: la primera fila es de una categoría nueva y la segunda de una categoría existente con lote obligatorio, sin la opción. La carga se detiene y la categoría nueva no existe; los conteos no cambian.
- La segunda fila con precio 1 000 000 000 000: se rechaza en la validación ("máximo") y no se escribe la primera fila.

**Inventario real (`docs/validacion/ronda9-tienda/carga-inventario.txt`), en una base nueva con migraciones y semilla:**

1. Sin `--sin-lotes`: se detiene en «Suplementos» y los conteos no cambian.
2. Con `--sin-lotes`: 616 productos y 3158 unidades en una transacción (≈3.5 s).
3. La recarga da "616 ya cargados sin cambios".

Los totales por categoría coinciden con la ronda 7: Fajas 40/186, Maquillaje 355/2062, Suplementos 221/910.

## Verificación

| Comprobación                                         | Resultado                                                                   | Registro (`docs/validacion/`)        |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `pnpm check`                                         | TypeScript, ESLint, **76** unitarias y compilación aprobadas.               | `ronda9-check.txt`                   |
| Integración con la API compilada, base nueva         | **87/87** (84 anteriores y 3 nuevas).                                       | `ronda9-integracion-compilada.txt`   |
| Navegador (PWA y API compiladas)                     | **10/10**, incluido el código ambiguo.                                      | `ronda9-navegador.txt`               |
| Las 3 regresiones nuevas con el código de la ronda 8 | Fallan las 3.                                                               | `ronda9-regresiones-con-ronda8.txt`  |
| Inventario real                                      | Bloqueo sin cambios, carga de 616 en una transacción y recarga sin cambios. | `ronda9-tienda/carga-inventario.txt` |

Se conservan todas las regresiones anteriores.
