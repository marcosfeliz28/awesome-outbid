# Ronda 4 · Desarrollo de Claude

Fecha: 5 de octubre de 2026. Base: ronda 3 entregada por ChatGPT (SHA-256 del ZIP auditado `2ed7cb7667d40c0afceb7224bea14620b815d8f2b4541982345ba6e0497f074a`).

A partir de esta ronda Claude desarrolla y ChatGPT audita. Todo el trabajo está en la rama `claude/facturacion-app-architecture-a3bz90` del repositorio `marcosfeliz28/awesome-outbid`, carpeta `fitstore-pos/`:

| Commit    | Contenido                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `30393fc` | Base: ronda 3 tal como la entregó ChatGPT (sin cambios).                                                    |
| `830decc` | Caja asignada a un equipo, traslado con PIN y cierre del gerente desde su equipo.                           |
| `370c37b` | Facturas: formatos dominicanos, CSV de Excel en español, variantes sin adivinar, Claude con el SDK oficial. |
| `cf58dd1` | Hallazgos de la auditoría de ChatGPT y de la revisión propia; Mercancía y Equipos rediseñados.              |
| `be454f1` | Ajustes visuales en celular, documentación y evidencia de validación.                                       |

Para auditar el código: `git diff 30393fc -- fitstore-pos` (o comparar este ZIP con el de la ronda 3).

## 1. Hallazgos de la auditoría de ChatGPT (`docs/AUDITORIA_RONDA3_CHATGPT.md`)

### P1 · Entradas sin orden no aparecían en compras

- **Corrección:** `GoodsReceipt` guarda ahora `supplierId`, `total` (líneas + flete + impuestos adicionales), `attachmentId` (comprobante) y `operationId` (único). Mercancía y la recepción de órdenes los rellenan (`apps/api/src/merchandise.ts`, `apps/api/src/inventory.ts`).
- **Reporte** (`apps/api/src/reports.ts`, `purchases`): compras = órdenes del período por su total **más** recepciones **sin orden** del período por su total. Las recepciones con orden no se suman (la orden ya cuenta), así no hay doble conteo. Pagos y pendiente en el mismo rango de fechas; todo filtrado por sucursal.
- **Regresión:** `Ronda 4 · auditoría de ChatGPT y propia > P1 compras…`. Proveedor nuevo y entrada sin orden de 2 a 15 más flete 4: el reporte muestra 34. El mismo UUID repetido sigue en 34 y hay una sola recepción. Una orden de 50 recibida da 84, no 134. El pago de 34 deja pendiente 50, y en un rango de 2020 todo queda en 0.

### P1 · Mutaciones sin equipo

- **Política de enrolamiento:**
  - **Identidad del equipo:** cada dispositivo guarda un `id` y un `secret` aleatorio; el servidor sólo conserva el hash SHA-256. Otro dispositivo no puede reclamar ese `id` sin el secreto (403).
  - **Aprobación:**
    - Los equipos nuevos de gerente o administrador se aprueban automáticamente.
    - Los de vendedor y almacén quedan **pendientes** hasta que un gerente los apruebe, desde `POST /terminals/:id/approve` (Configuración › Equipos) o con su PIN en el propio equipo (`POST /terminals/:id/approve-with-pin`). El PIN tiene bloqueo por intentos.
  - **Revocación:** revocar cierra las sesiones del equipo y ese `id` no vuelve a registrarse. Un `id` nuevo queda pendiente otra vez.
  - **Integraciones que no son navegadores:** usan el mismo proceso, con su propio `id` + `secret` y aprobación de un gerente (`docs/DESPLIEGUE.md`).
- **Aplicación:** el decorador `@RequireTerminal()` (`apps/api/src/common.ts`), validado en `AuthGuard`, se aplica en:
  - Ventas: ventas, sincronización offline, anulación, devoluciones, abonos y verificación de pagos.
  - Caja: abrir, movimientos, trasladar y cerrar.
  - Inventario: ajustes, recepción de órdenes, aplicación de conteos y Mercancía.
  - Sin equipo la API responde `403 TERMINAL_REQUIRED`; con equipo pendiente, `403 TERMINAL_PENDING`.
  - La bitácora guarda `terminalId` en cada operación.
- **Interfaz:** el aviso **Este equipo necesita aprobación** pide nombre y PIN de gerente, y el aviso de equipo revocado ofrece registrarlo como nuevo. Configuración › Equipos muestra el estado, el último usuario y la caja abierta, y permite aprobar o revocar.
- **Regresión:** `P1 equipos…`, que comprueba lo siguiente:
  - Una sesión nueva sin equipo no puede ajustar, mover mercancía ni abrir caja.
  - Un equipo pendiente no puede operar.
  - Otro dispositivo no puede reclamar el equipo sin su secreto.
  - Un PIN incorrecto se rechaza; con el PIN correcto el equipo queda aprobado, el ajuste pasa y la bitácora registra el equipo.
  - Al revocar, la sesión recibe 401, el mismo `id` recibe 400 y un `id` nuevo queda pendiente.
  - El stock no cambió en ninguno de los rechazos.
  - Además, la prueba de navegador 7 recorre la aprobación con PIN en la interfaz.

### P2 · Entrada con `lotId` inventado

- **Corrección:**
  - Una **entrada** ya no acepta `lotId`: el lote se indica por número, y se crea o se incrementa validando el vencimiento. Una **salida** no acepta número de lote y valida el `lotId` contra la variante y la sucursal.
  - Hay integridad referencial: FK `InventoryMovement.lotId → Lot.id` (`ON DELETE RESTRICT`). La migración `202610050001_round4_claude` anula las referencias huérfanas existentes antes de crear la FK.
- **Regresión:** `P2 lotes…`, que comprueba lo siguiente:
  - Una entrada válida por número de lote deja coherentes el stock, la cantidad del lote y el `lotId` del kardex.
  - Un `lotId` inexistente o de otra variante devuelve 400, sin cambios de stock ni recepción, y el lote no cambia.
  - La FK impide insertar un movimiento con un lote inexistente.

## 2. Hallazgos propios (revisión de la ronda 3)

| Hallazgo                                                                                                                                   | Corrección                                                                                                                                                                                                                                         | Prueba                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| El gerente no podía cerrar la caja de un vendedor desde su equipo (regresión de la ronda 3).                                               | `cashLock`: el gerente actúa sobre cajas ajenas; el dueño cierra desde cualquier equipo.                                                                                                                                                           | `Ronda 4 · Claude: caja y equipos`                 |
| La caja abierta en otro equipo daba un 403 genérico al cobrar y la pantalla decía «Caja abierta».                                          | 409 con el nombre del equipo, aviso en Punto de venta y Caja, `POST /cash-sessions/:id/transfer` (PIN de gerente para el vendedor, bitácora `cash_transferred`).                                                                                   | ídem                                               |
| Importar factura: «chocolate 5lb» se emparejaba con **Vainilla 2 lb** con 75 %; el SKU de producto fijaba una variante arbitraria.         | El emparejamiento usa los atributos (sabor, tamaño, talla, color, con unidades normalizadas). Si la factura no identifica la variante, se sugiere el producto y hay que elegir. La pantalla muestra variante y texto original.                     | `tests/invoice.test.ts`                            |
| CSV/Excel: `1,200.00`, `RD$ 450`, `;`, Windows-1252, membrete y totales fallaban; ExcelJS convertía códigos (perdía ceros) y fechas.       | `apps/api/src/invoice.ts`: lector de números dominicanos, detección de separador y codificación, sinónimos de columnas, lectura sin conversión, errores por fila.                                                                                  | `tests/invoice.test.ts`                            |
| Lectura con IA: modelo obsoleto `claude-sonnet-4-20250514`; `tool_choice` forzado (rechazado por los modelos actuales); sin `stop_reason`. | SDK oficial `@anthropic-ai/sdk`, `claude-opus-5-5`, salida estructurada (`output_config.format`), `fallbacks: "default"`, manejo de `refusal`/`max_tokens` y errores tipados, líneas ilegibles omitidas e informadas. Revisión humana obligatoria. | `tests/invoice.test.ts` (SDK simulado)             |
| SSE: una consulta cada 100 ms por conexión y sin límite (1,000 conexiones → venta de 1.25 s).                                              | Un solo sondeo por proceso (150 ms) que reparte a todas las conexiones; máximo 2 por sesión y 6 por usuario.                                                                                                                                       | `SSE: como máximo dos conexiones…`; medición abajo |
| Importación de archivos grandes bloqueaba el servidor (4.7 MB → 159 s, 1.3 GB RAM).                                                        | Excel/CSV > 1 MB o > 1,000 filas se rechazan antes de leerlos; máx. 30 borradores pendientes por día; borradores sin confirmar > 7 días se eliminan con su archivo.                                                                                | `importación: archivos grandes…`                   |
| Almacén podía crear productos vendibles con cualquier precio (producto rápido).                                                            | Sin `catalog:write`, el producto se crea inactivo y genera la alerta `product_review`.                                                                                                                                                             | `almacén: producto rápido…`                        |
| Para almacén el costo se rellenaba con RD$1 y deformaba el costo promedio.                                                                 | El costo queda vacío y es obligatorio; nunca se inventa.                                                                                                                                                                                           | Prueba de navegador 5                              |
| Cantidades como 0.0004 cambiaban el costo sin cambiar existencias.                                                                         | Máximo 3 decimales y mínimo 0.001.                                                                                                                                                                                                                 | `almacén: … cantidades finas`                      |
| El kardex de entradas guardaba el nuevo promedio en lugar del costo recibido.                                                              | `stockChange` recibe el costo aterrizado de la línea (Mercancía y órdenes).                                                                                                                                                                        | `almacén: … kardex usa el costo recibido`          |
| Errores de validación en inglés y con rutas internas (`lines.0.unitCost: Expected number`).                                                | Mensajes de zod en español con nombres de campo comprensibles.                                                                                                                                                                                     | Manual                                             |
| En el celular un aviso emergente tapaba «Confirmar entrada» (~2 s).                                                                        | Los avisos van arriba en pantallas angostas.                                                                                                                                                                                                       | Medición de tiempo real                            |

## 3. Diseño

- **Mercancía:**
  - Selector Entrada/Salida.
  - Buscador por nombre, SKU, sabor, talla o color, con existencias.
  - Cantidades con +/−.
  - Costo actual y aviso de margen, sólo para quien ve costos.
  - Revisión de factura con contadores y variantes por elegir.
  - Errores dentro del formulario de importación.
  - Barra de confirmación fija en el celular, con resumen.
  - Motivos de salida con nombre legible.
  - Historial con detalle y fechas es-DO.
  - Sin desborde horizontal a 390 px.
- **Equipos:** tarjetas con estado, «este equipo», último usuario, caja abierta y acciones; aviso de aprobación en el equipo.
- **Caja y Punto de venta:** nombre del equipo en lugar del UUID y aviso de caja en otro equipo con traslado.

Capturas: `docs/validacion/ronda4-capturas/`.

## 4. Verificación (resultados en `docs/validacion/`)

| Comando                                   | Resultado                                                                 | Archivo                  |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `pnpm check`                              | TypeScript, ESLint, 24 pruebas unitarias y compilación web/API aprobados. | `ronda4-check.txt`       |
| `pnpm test:integration`                   | 69 de 69 sobre PostgreSQL (57 anteriores + 12 nuevas).                    | `ronda4-integracion.txt` |
| `pnpm test:e2e` (PWA compilada, Chromium) | 7 de 7: los 6 escenarios anteriores más la aprobación de equipo con PIN.  | `ronda4-navegador.txt`   |
| Tres equipos simultáneos                  | Entrada, venta y salida reflejadas en las otras pantallas en 207–215 ms.  | `ronda4-tiempo-real.txt` |

Las pruebas de IA simulan la API con el SDK real; no se llamó a Anthropic. Los tiempos son de red local.

## 5. Decisiones y límites

- **Compras con orden** se registran por el total de la orden en su fecha. **Compras sin orden**, por el total recibido en la fecha de recepción. Las recepciones sin orden anteriores a esta ronda no tienen proveedor ni total y no aparecen.
- **Equipos anteriores** a esta ronda quedan aprobados por la migración y fijan su secreto en el siguiente registro desde el navegador.
- **Revocar** un equipo no cambia la contraseña del usuario: si se perdió un celular con la sesión guardada, revoca el equipo y cambia la contraseña.
- **Lectura con IA:** cada foto o PDF cuesta unos pocos centavos de dólar, según su tamaño.
- **Deriva previa a esta ronda:** `prisma migrate diff` informa una diferencia en `GoodsReceipt_orderId_fkey` (`ON DELETE`) que ya existía en la base de la ronda 3.
- **Sin certificar:** hardware (impresora, lector, cámara), despliegue HTTPS en internet ni volumen de producción.
