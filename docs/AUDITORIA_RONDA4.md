# Revisión con IA de FitStore POS · ronda 4

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

**Resultado: requiere otra revisión antes de aprobar la entrega para pruebas en tienda.** Hay cuatro hallazgos P1, cuatro P2 y uno P3. Las correcciones de compras nuevas, equipos nuevos y lotes se comprobaron; las dos primeras siguen incompletas al migrar datos anteriores.

Se auditó el ZIP cuyo SHA-256 es `2dab7feecca84918b95443a6636e67c31b32234e98bcbc7b6f675780ea43c7c2`. El texto adjunto de Claude se utilizó como alcance y como lista de afirmaciones por verificar, de acuerdo con el papel de auditor solicitado por el usuario. Se trabajó en una copia y dos bases separadas, con datos ficticios. No se corrigió la implementación. La API compilada se ejecutó con el mismo comando que figura en Docker; no se ejecutó toda la infraestructura de Compose ni se certifica hardware de tienda.

## Verificación independiente

| Comprobación | Resultado |
| --- | --- |
| `pnpm check` | TypeScript, ESLint, 24 unitarias y ambas compilaciones aprobadas. |
| `pnpm test:integration`, API compilada | **67/69**; dos respuestas 500 donde se espera 400. |
| `pnpm test:integration`, API con tsx | **69/69**. |
| `pnpm test:e2e`, PWA compilada | **7/7**, Chromium. |
| Cuatro reproducciones externas | Reprodujeron los fallos de concurrencia y emparejamiento. Sus asserts comprueban el fallo observado. |
| Actualización R3→R4 | Datos creados por API/esquema R3; migración SQL R4 exacta aplicada y comprobada por API R4. |
| SSE, tres sesiones independientes | El mismo evento de stock llegó a las tres en 23 ms desde la petición, en esta prueba local por HTTP. No es una medición de tres teléfonos. |
| Revisión de interfaz | Mercancía, aprobación y aviso de otra caja sin errores JS; aprobación por PIN funcionó. Equipos desborda en 320/390 px (R4-09). Ocho capturas propias. |

## Estado de los tres hallazgos anteriores

| Hallazgo R3 | Evidencia nueva | Estado |
| --- | --- | --- |
| P1 compras sin orden | Entrada 34 → compras 34; reintento conserva una recepción; orden 50 → total 84; pago 34 → pendiente 50. La compra histórica migrada sigue en 0. | **Parcial**, R4-02 y R4-04. |
| P1 mutaciones sin equipo | Sin equipo y pendiente → 403; aprobado → 201 con terminal en bitácora; revocado → 401; nueva sesión sin equipo → 403. Un ID heredado puede reclamarse sin aprobación. | **Parcial**, R4-01. |
| P2 lote inventado | Entrada con lotId → 400 sin alterar stock, recepción ni kardex; inserción directa inválida → P2003; lote válido conserva cantidades; la migración limpió la referencia huérfana creada con R3. | **Cerrado en los casos auditados**. |

## Hallazgos para la siguiente ronda

### R4-01 · P1 · Se puede reclamar un equipo anterior sin aprobación del gerente

**Comprobado:** Tras crear un equipo con la API y esquema R3 y aplicar el SQL R4 exacto, otro usuario de almacén registró su ID con un secreto elegido por él. Recibió 201, status approved y approvedBy null; pudo ajustar stock (201). El usuario original recibió 403 al intentar fijar su propio secreto.

**Causa:** La migración aprueba todo equipo antiguo no revocado, pero deja secretHash vacío. register permite que el primer usuario autenticado de la sucursal que conoce el ID establezca ese secreto, sin prueba de posesión ni aprobación. El ID por sí solo no acredita un dispositivo. Referencias: `apps/api/prisma/migrations/202610050001_round4_claude/migration.sql:12`; `apps/api/src/realtime.ts:155`.

**Corrección pedida:** Exigir aprobación gerencial para convertir una identidad antigua sin secreto en un equipo operativo, o un mecanismo de migración que demuestre posesión. Conservar los revocados bloqueados y auditar la conversión; no aceptar automáticamente el primer secreto enviado.

**Prueba exigida:** Migrar un equipo real R3; otro usuario/navegador con ID conocido y secreto nuevo no puede operar ni apropiarse de él. El equipo legítimo sólo queda aprobado mediante el flujo autorizado. Cubrir también una sesión heredada ya enlazada a ese ID.

**Evidencia:** [auditoria-ronda4-migracion.json](validacion/auditoria-ronda4-migracion.json) · [auditoria-ronda4-legado.json](validacion/auditoria-ronda4-legado.json).

### R4-02 · P1 · Las compras históricas sin orden siguen fuera del saldo del proveedor

**Comprobado:** Una entrada R3 de dos unidades a 15 y flete 4 se migró a R4. La recepción conservó supplierId y total nulos; compras y pendiente siguieron en 0. Al pagar exactamente 34, el reporte mostró Compras 0, Pagado 34 y Pendiente -34. AuditLog.after conserva el proveedor, total 34 y receiptId de esa operación.

**Causa:** La migración añade los campos pero no recupera las recepciones anteriores. El reporte excluye las que siguen sin supplierId. La documentación de Claude reconoce la omisión, que deja incompleta la corrección del P1 anterior. Referencias: `apps/api/prisma/migrations/202610050001_round4_claude/migration.sql:15`; `apps/api/src/reports.ts:354`.

**Corrección pedida:** Añadir una migración de datos verificable e idempotente que recupere las compras enlazables a MerchandiseOperation/AuditLog por receiptId, operación y sucursal. Los registros sin evidencia suficiente deben quedar para conciliación explícita; no inventar proveedor ni total.

**Prueba exigida:** Crear una compra de 34 mediante R3, migrar y verificar Compras/Pendiente 34; pagarla y obtener pendiente 0. Repetir la reparación sin duplicados; cubrir comprobantes, fechas, sucursales y registros ambiguos.

**Evidencia:** [auditoria-ronda4-migracion.json](validacion/auditoria-ronda4-migracion.json) · [auditoria-ronda4-legado.json](validacion/auditoria-ronda4-legado.json).

### R4-03 · P1 · La recepción antigua acepta cantidades que cambian costos sin cambiar stock

**Comprobado:** Con stock 1 y costo promedio 10, recibir 0.0004 unidades de una orden a costo unitario 1000000 devolvió 201. El stock siguió en 1 y las cantidades persistidas en kardex y receivedQty fueron 0, pero el costo promedio pasó a 409.84 y se creó una recepción por 400. Mercancía rechaza esa misma cantidad con 400.

**Causa:** goodsQty, con mínimo 0.001 y máximo tres decimales, sólo se aplica a Mercancía. purchase-orders/:id/receive usa positive. El costo se calcula con la cantidad completa y las existencias/columnas de tres decimales la redondean. Referencias: `apps/api/src/inventory.ts:407`; `apps/api/src/merchandise.ts:64`.

**Corrección pedida:** Compartir la validación de cantidades representables y aplicarla antes de cualquier cálculo o escritura en todas las rutas de inventario, recepción, venta, devolución y conteo. Rechazar una cantidad fuera de precisión con rollback completo.

**Prueba exigida:** 0.0004 y 1.0001 deben dar 400 en recepción y no alterar costo, stock, lotes, orden, recepción ni kardex. 0.001 y cantidades válidas deben conservar todas las cantidades y su costo contable.

**Evidencia:** [auditoria-ronda4-api.json](validacion/auditoria-ronda4-api.json).

### R4-04 · P1 · La factura aceptada contra una orden puede dejar un saldo de proveedor incorrecto

**Comprobado:** Orden de dos unidades a 25: total 50. Se confirmó una factura vinculada por dos unidades a 30, invoiceTotal 60: recepción aceptada, stock 2 y costo 30. El reporte siguió contando 50. Pagar la factura completa de 60 dejó Pendiente -10.

**Causa:** Mercancía admite el costo real de la factura y guarda ese total en la recepción, pero purchases suma exclusivamente el total original de la orden e ignora sus recepciones. Evita duplicados, pero también descarta diferencias reales aceptadas. Referencias: `apps/api/src/merchandise.ts:395`; `apps/api/src/reports.ts:342`.

**Corrección pedida:** Conciliar la compra facturada con la orden y calcular la deuda a partir del importe real aceptado. Distinguir los compromisos de la orden de las compras facturadas si se necesitan ambos. Definir recepciones parciales, cambios de costo, flete e impuestos sin doble conteo.

**Prueba exigida:** Orden 50, factura aceptada 60 y pago 60 deben dejar saldo 0. Añadir casos con parcialidades, diferencias de costo, flete/impuestos, reintento del mismo UUID y filtros temporales/sucursal.

**Evidencia:** [auditoria-ronda4-compras-orden.json](validacion/auditoria-ronda4-compras-orden.json).

### R4-05 · P2 · El inicio concurrente del hub duplica sondeos y puede saltarse eventos

**Comprobado:** Una reproducción determinista del código original con dos add simultáneos ejecutó dos consultas iniciales y creó dos intervalos. El segundo máximo avanzó el cursor por encima de un evento confirmado cuando el primer listener ya estaba activo: éste no lo recibió. Tras desconectar todos, quedó un intervalo sin limpiar.

**Causa:** add comprueba !timer antes de await aggregate, sin compartir una promesa de inicialización. Cada llamada pendiente puede reinicializar cursor y sobrescribir el único handle que el cleanup conoce. Referencias: `apps/api/src/realtime.ts:63`.

**Corrección pedida:** Hacer única la inicialización concurrente del hub y proteger el cursor contra reinicios. Gestionar el cierre de modo que al quedarse sin clientes se eliminen todos los recursos, incluidas inicializaciones pendientes.

**Prueba exigida:** Varias altas simultáneas deben producir una consulta inicial y un intervalo. Un evento confirmado con un listener activo debe llegar una sola vez. Desconectar todos durante y después de la inicialización debe dejar cero intervalos.

**Evidencia:** [auditoria-ronda4-pruebas-dirigidas.json](validacion/auditoria-ronda4-pruebas-dirigidas.json) · [auditoria-ronda4-pruebas-dirigidas.txt](validacion/auditoria-ronda4-pruebas-dirigidas.txt).

### R4-06 · P2 · Las altas SSE concurrentes eluden el límite y un cierre temprano pierde la limpieza

**Comprobado:** Por HTTP, retrasando únicamente la consulta inicial mediante un bloqueo controlado en la base de auditoría, ocho altas con el mismo JWT quedaron esperando aggregate y después obtuvieron 200: superaron los límites de dos por sesión y seis por usuario. Otra reproducción cerró cliente y respuesta durante await hub.add; al resolver, se escribió ready y no se retiró el listener. La prueba determinista de cuota admitió 20 altas simultáneas.

**Causa:** events comprueba la cuota antes de await hub.add y la incrementa después. Los manejadores close se instalan al final, por lo que una desconexión durante ese await ocurre antes de que exista cleanup. Referencias: `apps/api/src/realtime.ts:367`; `apps/api/src/realtime.ts:401`; `apps/api/src/realtime.ts:443`.

**Corrección pedida:** Reservar la cuota antes del primer await, con rollback en error o desconexión. Instalar y comprobar el estado de cierre antes de registrar el listener; cancelar o retirar el resultado de un alta que llega después de cerrar. Mantener la limpieza idempotente.

**Prueba exigida:** Una ráfaga concurrente sobre una sesión acepta como máximo dos conexiones; varias sesiones del mismo usuario, como máximo seis. Un cliente que se desconecta antes de la respuesta no deja cuota, listener, heartbeat ni intervalo pendientes.

**Evidencia:** [auditoria-ronda4-sse.json](validacion/auditoria-ronda4-sse.json) · [auditoria-ronda4-pruebas-dirigidas.json](validacion/auditoria-ronda4-pruebas-dirigidas.json).

### R4-07 · P2 · Una sola variante se empareja aunque contradiga sabor y tamaño

**Comprobado:** Catálogo: producto WHEY con una única variante Vainilla, 2 lb. Factura: código del producto WHEY, descripción Proteína Whey chocolate 5 lb. matchInvoiceLines seleccionó Vainilla 2 lb, confidence 1 y ninguna nota de conflicto.

**Causa:** pickVariant retorna inmediatamente cuando options.length es 1 y omite comprobar atributos. Un SKU del producto no identifica una combinación de variante. Referencias: `apps/api/src/invoice.ts:483`.

**Corrección pedida:** No asignar automáticamente la variante única cuando la descripción declara atributos incompatibles. Diferenciar coincidencia exacta de SKU/barcode de variante y coincidencia del producto; dejar la variante sin resolver y señalar el conflicto cuando corresponda.

**Prueba exigida:** SKU del producto + chocolate 5 lb frente a única vainilla 2 lb requiere resolución manual. Cubrir una variante única compatible, talla/color incompatibles, varias variantes y códigos exactos de variante.

**Evidencia:** [auditoria-ronda4-pruebas-dirigidas.json](validacion/auditoria-ronda4-pruebas-dirigidas.json).

### R4-08 · P2 · La API compilada devuelve 500 para ventas inválidas

**Comprobado:** Con la API compilada ejecutada como en el CMD de Docker, la integración dio 67/69. Fallaron la validación de ventas vacías en la prueba del límite por IP y la de descuento superior al importe. POST /sales con {} respondió 500. Con tsx, los mismos 69 casos pasaron. La comprobación de módulos mostró que saleSchema lanza un ZodError ESM que no es instanceof el ZodError CommonJS del filtro.

**Causa:** La API compila a CommonJS; @fitstore/shared se distribuye como TypeScript ESM. Zod usa clases distintas para import y require. ApiExceptionFilter depende de instanceof y el mapa global de errores tampoco cruza ambas instancias. El patrón ya estaba en R3; este hallazgo aparece al verificar el runtime compilado. Referencias: `apps/api/src/common.ts:368`; `apps/api/tsconfig.json:4`; `packages/shared/package.json:4`; `Dockerfile:20`.

**Corrección pedida:** Unificar la resolución/formato de módulos y la instancia de validación, o normalizar de forma segura sus errores en la frontera de la API. Conservar los errores de campos en español. Incorporar la API compilada al criterio de aceptación.

**Prueba exigida:** La suite completa debe pasar ejecutando node dist/main.js, además de desarrollo. Ventas vacías y descuentos inválidos devuelven 400 con campos en español; el límite por IP sigue devolviendo 429 y no hay mutaciones.

**Evidencia:** [auditoria-ronda4-integracion.txt](validacion/auditoria-ronda4-integracion.txt) · [auditoria-ronda4-integracion-desarrollo.txt](validacion/auditoria-ronda4-integracion-desarrollo.txt) · [auditoria-ronda4-api.json](validacion/auditoria-ronda4-api.json) · [auditoria-ronda4-modulos.json](validacion/auditoria-ronda4-modulos.json).

### R4-09 · P3 · Las pestañas de Configuración desbordan la pantalla móvil

**Comprobado:** Después de terminar las transiciones y cargar fuentes, Equipos produjo scrollWidth 401 en pantallas de 390 y 320 px. La fila de pestañas tenía overflow-x visible y scrollWidth 385. Hay desplazamiento horizontal y recorte del contenido; las capturas lo muestran.

**Causa:** Las cuatro pestañas de Configuración usan flex y texto nowrap, sin ajuste de filas ni contenedor de desplazamiento horizontal. La regla overflow de .modal .tabs no aplica a .tabs.outside. Referencias: `apps/web/src/styles.css:1303`; `apps/web/src/Management.tsx:2873`.

**Corrección pedida:** Hacer que las pestañas se adapten al ancho o se desplacen dentro de su propio contenedor, manteniendo accesibles todas las opciones y evitando desplazamiento horizontal de la página.

**Prueba exigida:** Configuración y Equipos en 320 y 390 px: todas las pestañas alcanzables, scrollWidth del documento no mayor que innerWidth + 1 y contenido sin recortes.

**Evidencia:** [auditoria-ronda4-ui.json](validacion/auditoria-ronda4-ui.json) · [auditoria-ronda4-capturas/cel-equipos.png](validacion/auditoria-ronda4-capturas/cel-equipos.png) · [auditoria-ronda4-capturas/cel-equipos-320.png](validacion/auditoria-ronda4-capturas/cel-equipos-320.png).

## Facturas y alcance de la IA

Las pruebas de formatos numéricos, CSV dominicano/Windows-1252, XLSX, tamaños de subida y salida estructurada simulada pasaron. El SDK instalado es 0.131.0 y declara `claude-opus-5-5`; la petición simulada confirma `output_config.format` y `fallbacks`. No se envió ninguna factura a Anthropic y no se verificó la extracción con una foto real. La asignación incorrecta de una variante única está reproducida por separado (R4-07).

## Entrega y criterios de cierre

La evidencia consolidada está en [validacion/auditoria-ronda4.json](validacion/auditoria-ronda4.json), acompañada de registros, capturas y reproducciones externas. El paquete de auditoría incluye un mensaje para Claude y **no es una nueva versión de la aplicación**. El ZIP original permanece intacto.

Corregir primero R4-01 a R4-04, luego los P2, y repetir sus casos sobre la versión compilada y la migración desde R3. Sólo cerrar cada hallazgo con evidencia de la corrección y de su regresión. Las pruebas normales en verde no cubren todos estos casos.
