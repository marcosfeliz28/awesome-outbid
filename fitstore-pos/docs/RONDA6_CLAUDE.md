# FitStore POS · ronda 6 (Claude)

Esta ronda corrige los **9 hallazgos** de la auditoría completa de ChatGPT a la ronda 4 (`docs/AUDITORIA_RONDA4.md`): 4 P1, 4 P2 y 1 P3. La ronda 5 había atendido un documento previo con 3 hallazgos (fuga SSE, JSON con Markdown e índice por lote); esos cambios se conservan.

Cada hallazgo tiene la prueba que pidió ChatGPT, y la suite completa pasa también con la **API compilada** (`node dist/main.js`, como el CMD de Docker). Su evidencia está en `docs/validacion/` y el cierre por hallazgo en `docs/validacion/ronda6-cierre.json`.

## 1. Hallazgos P1

### R4-01 · Equipo anterior reclamado sin aprobación

**Corrección:**

- La migración `202610060001_round6_audit` marca como `legacy` los equipos sin creador (anteriores a la ronda 4). Si ningún gerente los aprobó, vuelven a **pendiente**.
- `terminals/register` acepta que alguien reclame un equipo anterior sin secreto. Fija el secreto de quien lo reclama, lo deja **pendiente** (salvo que lo reclame un gerente) y lo registra en la bitácora como `terminal_legacy_claimed`. Ya no acepta automáticamente el primer secreto que llega.
- No se puede aprobar un equipo sin secreto: nadie ha demostrado ser ese dispositivo.
- El guard exige aprobación **y** secreto, como defensa adicional.
- En Equipos, el gerente ve «Equipo de antes de la actualización, reclamado por X» y decide si lo aprueba o lo revoca.

**Pruebas:**

- `tests/api.test.ts`, «R4-01». Cubre:
  - Una sesión heredada ya enlazada al ID → 403 `TERMINAL_PENDING`.
  - Otro usuario con el ID conocido y un secreto nuevo → pendiente y sin operar.
  - El dueño original → 403.
  - Revocar deja fuera a quien reclamó el equipo.
  - Flujo autorizado: el dueño lo reclama y el gerente lo aprueba → 201.
  - Aprobar un equipo que nunca se identificó → 400.
  - Un gerente que reclama un equipo anterior → queda aprobado.
  - El SQL se ejecuta dos veces.
- **Actualización real R3 → R6:** `docs/validacion/ronda6-actualizacion/`. Los datos se crearon con la API de la ronda 3 (commit `30393fc`) sobre una base separada. Después se ejecutó `prisma migrate deploy` (R4, índice y R6) y se comprobó con la API compilada. Los seis controles dieron `true`.

### R4-02 · Compras históricas sin proveedor ni total

**Corrección:** la misma migración completa sólo las recepciones con datos vacíos, de forma idempotente:

1. **Mercancía:**
   - El total y el comprobante salen de `MerchandiseOperation.result`.
   - El proveedor sale de la entrada de bitácora de esa operación. Si no lo tiene, se usa el de su orden.
   - Se exige que haya una sola operación y una sola entrada de bitácora, que el total coincida en ambas, y que la sucursal y el `receiptId` coincidan.
2. **Recepción por la ruta de la orden:** el proveedor es el de la orden. El total es la suma de cantidad × costo de las líneas guardadas en la recepción, más flete y otros costos.
3. **Sin evidencia suficiente** (por ejemplo, una bitácora duplicada): no se toca. El reporte lo muestra en la columna **Sin conciliar** o en la fila «Recepciones sin proveedor (conciliar)».

**Pruebas:**

- «R4-02» en la suite:
  - Compra de 34 y orden de 50 en formato R3.
  - Reparación ejecutada dos veces sin duplicados.
  - Compras 84, Pendiente 84; después de pagar 84, pendiente 0.
  - El caso ambiguo queda sin conciliar.
  - Un rango de fechas de 2020 da 0.
- **Actualización real:** compra R3 de 34 + orden de 50 → Compras 84 → pagar → pendiente 0.

### R4-03 · Cantidades que cambian el costo sin cambiar el stock

**Corrección:**

- `@fitstore/shared` define `stockQty`, `countedQty` y `signedStockQty`: mínimo 0.001 y como máximo 3 decimales.
- Se aplican en recepción de orden, creación de orden, Mercancía, ajuste, conteo, venta, devolución, cotización y kit.
- Se validan antes de cualquier cálculo o escritura.

**Prueba («R4-03»):**

- 0.0004 y 1.0001 → 400 en la recepción, sin cambiar costo, stock, lotes, orden, recepción ni kardex.
- Lo mismo en las demás rutas.
- 0.001 se acepta: stock 1.001, recibido 0.001, recepción por 1000 y costo de 1008.99.

### R4-04 · Factura aceptada contra una orden

**Corrección:** el reporte de compras cuenta **lo recibido o facturado** (el total de cada recepción, al costo real con flete e impuestos), con o sin orden.

- La orden se muestra aparte, en **Ordenado**. Es un compromiso y no forma parte de la deuda.
- Cada recepción parcial cuenta una sola vez.
- Un reintento con el mismo UUID no crea otra recepción.

**Prueba («R4-04»):**

- Orden de 50, factura de 60 aceptada, pago de 60 → pendiente 0.
- Parciales: 2 unidades al costo de la orden (20) y 2 por factura a 12 con flete 3 e impuestos 2 (29) → Compras 49.
- Reintento del mismo UUID.
- Filtro por fechas.

## 2. Hallazgos P2 y P3

### R4-05 · Inicio concurrente del hub

**Corrección:**

- `RealtimeHub.start()` comparte una sola promesa de inicialización.
- Si todos los clientes se desconectan, la generación invalida las inicializaciones pendientes y no queda ningún intervalo.
- Cada `remove` es idempotente.

**Prueba (`tests/realtime.test.ts`):**

- Tres altas simultáneas → una consulta y un intervalo.
- El evento confirmado llega una sola vez.
- Desconectar durante o después del inicio → 0 intervalos.
- El hub reinicia limpio.

### R4-06 · Cupos SSE y cierre durante el alta

**Corrección:**

- El cupo se reserva **antes** del primer `await` y se devuelve ante un error 503 o un cierre.
- Los manejadores de cierre se instalan antes del alta.
- `hub.add` recibe `isClosed`: si el cliente cerró, no registra nada. Si cierra justo al terminar el alta, se retira el listener.
- Se quitó `req.on("close")`, que en Node 16+ puede dispararse al terminar de leer el GET. `res.on("close")` cubre el cierre de la respuesta y el corte de la conexión.

**Pruebas:**

- Unitarias:
  - 20 altas simultáneas → 2 aceptadas y 18 con 429.
  - 10 sesiones del mismo usuario → 4 con 429.
  - Un cierre durante el alta → no deja cupo, listener ni latido.
- Integración por HTTP: una ráfaga de 8 → 2 con 200 y 6 con 429; después se pueden reabrir 2.

### R4-07 · Variante única incompatible

**Corrección:**

- `matchInvoiceLines` detecta atributos en conflicto antes de asignar una variante, también cuando el producto tiene una sola.
- Usa:
  - el vocabulario del catálogo por atributo;
  - listas de sabores, colores y tallas;
  - las medidas número + unidad (por ejemplo, «5 lb» frente a «2 lb»).
- Si hay conflicto, la variante queda sin asignar y la nota indica qué atributo no coincide.
- El SKU o el código de barras exacto de la variante siguen mandando.

**Prueba (`tests/invoice.test.ts`):**

- Chocolate 5 lb frente a la única vainilla 2 lb → resolución manual, con y sin código.
- Variante única compatible → se asigna.
- Talla o color incompatibles → resolución manual.
- Varias variantes.
- Códigos exactos.

### R4-08 · La API compilada devolvía 500

**Causa:** la API compilada (CommonJS) cargaba zod dos veces, una como CommonJS y otra como ESM desde `@fitstore/shared`. Por eso el error de validación no era `instanceof ZodError`.

**Corrección:**

- `@fitstore/shared` reexporta `z` y `ZodError`, y la API importa zod sólo desde ahí: una única instancia, con el mapa de errores en español.
- `ApiExceptionFilter` reconoce además el error por su forma, como defensa adicional.

**Prueba:** la suite completa pasa **77 de 77 con `node dist/main.js`** y 77 de 77 con tsx. La prueba «R4-08» verifica 400 y los campos en español para una venta vacía y para un descuento inválido.

### R4-09 · Pestañas de Configuración en celular

**Corrección:**

- `.tabs` nunca empuja la página: si no cabe, se desplaza dentro de su propia fila.
- En pantallas de hasta 640 px, las pestañas de Configuración pasan a dos columnas, todas visibles.

**Prueba e2e** (Configuración y Equipos a 320 y 390 px):

- Las cuatro pestañas quedan dentro del ancho.
- `scrollWidth` es como máximo `innerWidth + 1`.
- Ningún elemento de la página queda recortado.
- La misma prueba **falla con el CSS anterior** (403.8 px en una pantalla de 390).
- Capturas en `docs/validacion/ronda6-capturas/`.

## 3. Verificación

| Comprobación                                                        | Resultado                                                                        | Registro                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| `pnpm check`                                                        | TypeScript, ESLint, **38** unitarias y compilación web/API aprobadas.            | `ronda6-check.txt`                  |
| `pnpm test:integration` con **API compilada** (`node dist/main.js`) | **77/77** (71 anteriores y 6 nuevas).                                            | `ronda6-integracion-compilada.txt`  |
| `pnpm test:integration` con tsx                                     | **77/77**.                                                                       | `ronda6-integracion-desarrollo.txt` |
| `pnpm test:e2e`, PWA compilada y API compilada                      | **8/8** (7 anteriores y la de R4-09).                                            | `ronda6-navegador.txt`              |
| Actualización real R3 → R6                                          | Datos creados por la API R3, `migrate deploy` y API R6 compilada: 6/6 controles. | `ronda6-actualizacion/`             |

Las cuatro reproducciones externas de ChatGPT (`auditoria-ronda4-reproducciones/pruebas/`) comprueban el comportamiento defectuoso, como advirtió el auditor, y ahora fallan. Sus versiones corregidas son `tests/realtime.test.ts` y el bloque R4-07 de `tests/invoice.test.ts`.

## 4. Decisiones y límites

- **Equipos anteriores:** si otra persona reclama primero un equipo anterior, el dueño legítimo recibe 403. El gerente ve quién lo reclamó y puede revocarlo; el equipo legítimo se registra entonces como nuevo. Con sólo el ID no existe una prueba de posesión mejor.
- **Reporte de compras:** «Pendiente» puede ser negativo cuando se pagó una orden antes de recibirla (anticipo).
- **Una sola sucursal:** la recuperación compara la sucursal de la recepción con la de la operación, la bitácora, el proveedor y la orden. Sin embargo, el sistema actual tiene una sola sucursal y no se probaron varias.
- **Sin certificar:** lectura real de una factura con Anthropic (las pruebas usan respuestas simuladas), hardware de tienda, PostgreSQL 17 en Compose (aquí se usó 16) y volumen de producción.
