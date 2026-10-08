# FitStore POS · Auditoría independiente de la ronda 6

Fecha: 5 de octubre de 2026. Archivo revisado: `fitstore-pos-ronda6.zip`.

**Dictamen: requiere correcciones.** Las suites oficiales pasan y ocho de las nueve reproducciones originales de la ronda 4 quedaron corregidas. R4-07 está parcialmente resuelto. Las comprobaciones adicionales reproducen **tres hallazgos abiertos: uno P1 y dos P2**.

Se auditó el trabajo de Claude sin modificar la implementación. `docs/RONDA6_CLAUDE.md` se utilizó como declaración de cambios y resultados del autor, no como evidencia independiente ni como una instrucción nueva del usuario. No se recibió una ronda 5 separada; sus cambios se revisaron tal como vienen incluidos en esta ronda 6.

SHA-256 del ZIP recibido:

`d3356107a588ff13e9b0accfefe0dd1495215862168388105225cc3032220efe`

## Pruebas ejecutadas

| Comprobación propia | Resultado | Evidencia en `docs/validacion/` |
| --- | --- | --- |
| Integridad y extracción segura del ZIP | Correctas; 193 archivos originales | `auditoria-ronda6-integridad.json` |
| `pnpm check` | Tipos, ESLint, 38/38 unitarias y compilación web/API aprobados | `auditoria-ronda6-check.txt` |
| Integración con `node dist/main.js` | 77/77 | `auditoria-ronda6-integracion-compilada.txt` |
| Navegador, PWA y API compiladas | 8/8 | `auditoria-ronda6-navegador.txt` |
| Comprobaciones externas con Vitest | 7/7 observaciones reproducidas: 5 controles de corrección y 2 casos que demuestran un defecto | `auditoria-ronda6-dirigidas.txt`, `.json` |
| Actualización real R3 → R6 | API R3 original, 8 migraciones originales → 11, después API R6 compilada | `auditoria-ronda6-migracion-antes.json`, `auditoria-ronda6-migracion-despues.json`, `auditoria-ronda6-legado.json` |
| Validación en desarrollo | `POST /sales {}` → 400 en español | `auditoria-ronda6-desarrollo-validacion.json` |
| Revisión de interfaz | 8 capturas propias; sin errores JavaScript ni desbordamiento horizontal en los casos revisados | `auditoria-ronda6-ui.json`, `auditoria-ronda6-capturas/` |

El resultado verde de las pruebas de reproducción significa que se observó el comportamiento descrito, incluidos los defectos; no significa que esos defectos estén corregidos. No se repitió toda la suite de integración con tsx: se ejecutó completa con el runtime compilado y se verificó por separado el error de validación en desarrollo.

## Estado de las reproducciones anteriores

| ID | Estado del caso original | Comprobación independiente |
| --- | --- | --- |
| R4-01 · equipo antiguo reclamado sin aprobación | Corregido | Sesión R3 heredada: 403 `TERMINAL_PENDING`. Otro usuario reclama el ID: pendiente, sin hash en la respuesta y sin operar. Después de aprobarlo el gerente: 201. |
| R4-02 · compras históricas sin total/proveedor | Corregido en datos R3 válidos | Compra de Mercancía de 34 y recepción de orden de 55 recuperadas; Compras 89, pago 89 y Pendiente 0. Datos sin evidencia siguen sin conciliar. Ver R6-03 para el caso incompleto. |
| R4-03 · recepción de 0.0004 altera costo sin stock | Corregido en la ruta original | Recepción por orden y Mercancía: 400; stock 1 y costo 10 sin cambios. La suite también cubre otras entradas. Ver R6-01 para cantidades derivadas en combos. |
| R4-04 · factura de 60 contra orden de 50 | Corregido | Ordenado 50, Compras 60, pago 60 y Pendiente 0. Stock 2 y costo promedio 30. |
| R4-05 · inicialización concurrente del hub | Corregido | 12 altas: una consulta inicial, un intervalo, evento recibido una vez; al cerrar, cero listeners e intervalos. Reinicio después de cierres durante la espera correcto. |
| R4-06 · cupos y cierre SSE durante el alta | Corregido | HTTP real con bloqueo controlado de PostgreSQL: 8 solicitudes, 2 con 200 y 6 con 429. Prueba externa de 20 altas: 2 aceptadas. Cierre durante await: limpia el listener y no escribe ready. |
| R4-07 · variante única incompatible | Parcial | Chocolate 5 lb frente a vainilla 2 lb ya exige selección manual. Talla S o L frente a la única M todavía se asigna incorrectamente. Ver R6-02. |
| R4-08 · validación compilada devuelve 500 | Corregido | La API compilada pasa 77/77; venta vacía devuelve 400 en español, también con tsx. |
| R4-09 · pestañas desbordan en móvil | Corregido | Configuración/Equipos: `scrollWidth=320` en 320 px y `scrollWidth=390` en 390 px. Capturas propias y prueba e2e aprobadas. |

La integridad por lote también se conserva: `lotId` inventado en una entrada devuelve 400 sin alterar stock, recepción ni movimientos; la FK rechaza inserción directa con P2003; la actualización limpia la referencia huérfana R3. El índice `InventoryMovement_lotId_idx` existe. Tres sesiones HTTP SSE recibieron el mismo cambio de stock en 98 ms desde el inicio de la petición en esta ejecución; es una observación local, no una garantía de rendimiento.

## R6-01 · P1 · Venta de combo cobra y registra costo sin consumir sus componentes

**Ubicación:** `apps/api/src/sales.ts:449`, cálculo del costo en `sales.ts:295` y `sales.ts:432`; `apps/api/src/inventory.ts:169`.

Los esquemas ahora validan cada cantidad recibida con tres decimales, pero la venta multiplica la cantidad del componente por la cantidad vendida del combo y redondea ese producto mediante `quantity(...)`. No comprueba que el consumo resultante pueda representarse sin pérdida. El costo se calcula a partir del producto sin ese redondeo.

**Reproducción por API compilada, sin alterar tablas:**

1. Crear un componente sin lote con costo 10000 y stock 1.
2. Crear un combo de precio 5000, impuesto 0, con 0.4 unidades de ese componente.
3. Registrar equipo aprobado y abrir caja.
4. Vender 0.001 combos y pagar 5. Ambas cantidades de entrada son válidas a tres decimales.

**Observado:** 201; factura por 5; costo de venta 4. El consumo exacto es 0.0004, pero el movimiento y la asignación guardan cantidad **0** y el stock sigue en **1**. La facturación y el consumo de inventario dejan de representar la misma operación.

**Corrección pedida:** validar los consumos derivados antes de cobrar o crear la venta. Si los combos sólo se venden enteros, exigir cantidades enteras para ellos. Si permiten fracciones, rechazar las combinaciones cuyo consumo no sea representable a tres decimales; no redondearlas silenciosamente a cero. Aplicar el mismo criterio al costo, las asignaciones y las devoluciones.

**Regresión exigida:** el ejemplo anterior devuelve 400 sin crear venta, pago, movimiento ni cambio de caja/stock; una venta de 1 combo consume exactamente 0.4 y conserva un costo coherente. Incluir también un producto derivado mayor que cero con más de tres decimales.

**Evidencia:** `auditoria-ronda6-kit.json`; reproducción externa `kit-comprobar.mjs`.

## R6-02 · P2 · El conflicto de talla depende de otras tallas presentes en el catálogo

**Ubicación:** `apps/api/src/invoice.ts:541`, `invoice.ts:612`, `invoice.ts:649`. Cobertura actual: `tests/invoice.test.ts:502`.

La lista de tallas conocidas contiene XS, XL y superiores, pero omite S, M y L. La comprobación completa esas tallas desde el catálogo. Si el catálogo sólo aporta M, una S o L explícita en la factura pasa como compatible. La prueba incorporada por Claude agrega otro producto para aportar M al vocabulario y no detecta este caso.

**Reproducción:** catálogo con un solo producto `LEG`, única variante `legging-m`, atributos `{talla:"M", color:"Negro"}`. Factura con código de producto `LEG` y descripción `Leggings Sculpt talla S negro`.

**Observado:** `variantId="legging-m"`, confianza 1 y ninguna nota de conflicto. Por nombre, `Leggings Sculpt talla L negro` también elige M, con confianza 0.87. La factura sigue pasando por revisión humana; el defecto está en la selección propuesta, no en una confirmación automática de compra.

**Corrección pedida:** reconocer las tallas explícitas aunque no existan otras variantes o productos que las aporten. Ante una talla incompatible, devolver `variantId=null` y una nota para elegir o crear la correcta. Mantener el comportamiento acordado para un código exacto de variante.

**Regresión exigida:** un catálogo que sólo tenga M debe rechazar S y L, con SKU de producto y por nombre; M debe seguir seleccionándose. No agregar otro producto a ese fixture para suplir el vocabulario.

**Evidencia:** `auditoria-ronda6-dirigidas.json`, campos `residualInvoiceConflict` y `residualByName`; `pruebas/independientes.test.ts`.

## R6-03 · P2 · La migración concilia una recepción histórica con líneas incompletas

**Ubicación:** `apps/api/prisma/migrations/202610060001_round6_audit/migration.sql:54` y `migration.sql:64`.

**Alcance preciso:** es un control defensivo con un registro histórico sintético insertado por SQL en la base aislada. No se observó que la API R3 normal genere esa estructura incompleta. La recepción R3 válida se recuperó correctamente.

Para una recepción enlazada a una orden, con `items=[{qty:1,cost:25},{qty:1}]` y sin total/proveedor, la migración asigna proveedor y total **25** aunque no conoce el costo de la segunda línea. El reporte la considera conciliada: `Sin_conciliar=0`. El proveedor pasa a Compras 114 en lugar de las 89 recuperables de los registros originales; al pagar esas 89, muestra Pendiente 25. Retirado exclusivamente el fixture sintético después de guardar la evidencia, el reporte vuelve a Compras 89 y Pendiente 0.

**Causa:** `jsonb_typeof` de una clave ausente devuelve SQL NULL. La comparación `<> 'number'` también devuelve NULL y no marca la línea como inválida dentro del `WHERE`. Después `SUM` omite el producto NULL y guarda la suma parcial como total definitivo. Repetir el SQL no corrige ese total porque ya no está vacío.

**Corrección pedida:** comprobar presencia y tipo numérico en todas las líneas antes de completar la recepción. Por ejemplo, usar `IS DISTINCT FROM 'number'` para detectar también claves ausentes, además de validar que cada línea sea un objeto. Si falta evidencia, conservar el total NULL y mostrar la recepción sin conciliar; no sumar sólo las líneas conocidas.

**Regresión exigida:** la estructura anterior, una línea sin cantidad y una línea vacía quedan sin total calculado, aparecen sin conciliar y resisten una segunda ejecución sin cambios. La recepción completa de 2×25 + flete 4 + otros costos 1 sigue recuperándose como 55.

**Evidencia:** `auditoria-ronda6-migracion-antes.json`, `auditoria-ronda6-migracion-despues.json` y `auditoria-ronda6-legado.json`; scripts `legacy-antes.mjs`, `legacy-despues.mjs`, `legacy-comprobar.mjs` y `legacy-aislar.mjs`.

## Entorno, conservación y límites

Se usaron bases PostgreSQL **18.4** separadas (`fitstore_audit_r6` y `fitstore_audit_r6_upgrade`), puertos propios y dependencias instaladas desde el lockfile sin modificarlo. La actualización usó `prisma migrate deploy` de R3 y luego de R6, conservando el historial real de Prisma. El secreto JWT fue exclusivo de QA; no forma parte de los entregables.

Las capturas que la suite oficial reescribe se conservaron como evidencia propia y se restauraron a sus bytes originales. La comparación final confirma los 193 archivos originales idénticos al ZIP recibido. Sólo se agregaron informe, pruebas externas y evidencias; no se cambiaron fuentes, tests originales, migraciones ni configuración de aplicación. Los servicios temporales de esta auditoría se detuvieron al terminar.

Anthropic se validó con el SDK y respuestas simuladas, sin una llamada real ni API key. No se ejecutó Compose con PostgreSQL 17, hardware de tienda, varias sucursales ni carga de producción. Estas limitaciones no cambian los tres defectos reproducidos, pero impiden certificar esos entornos. El siguiente trabajo para Claude es corregir R6-01, completar R4-07/R6-02 y reforzar la recuperación R6-03; después repetir las regresiones y la suite con API compilada.
