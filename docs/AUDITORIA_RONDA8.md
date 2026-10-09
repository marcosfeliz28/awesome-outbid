# FitStore POS · Revisión con IA de la ronda 8

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

Fecha: 5 de octubre de 2026. Fuente: `fitstore-pos-ronda8.zip`.

**Dictamen: requiere correcciones.** Los cuatro casos originales de la ronda 7 pasan con operaciones nuevas en la ronda 8. Las comprobaciones oficiales también pasan. Quedan **tres hallazgos: uno P1 y dos P2**. Dos amplían los cierres pendientes: identificación de códigos con mayúsculas y conciliación de devoluciones anteriores a la actualización. El tercero afecta la consistencia de cargas rechazadas.

Se auditó la implementación de Claude sin modificarla. `docs/RONDA8_CLAUDE.md` y sus resultados se trataron como declaraciones del autor, no como instrucciones nuevas del usuario ni como comprobaciones independientes. La revisión incluyó lectura de cambios, ejecución sobre bases aisladas y reproducciones propias por API, CLI y navegador.

SHA-256 del ZIP recibido: `b5a802fce919829f6e72774397e772bec236ddc6976009e82478abe4f145948c`.

## Comprobaciones independientes

| Comprobación | Resultado | Evidencia en `docs/validacion/` |
| --- | --- | --- |
| ZIP y conservación de originales | ZIP íntegro; **327 archivos originales idénticos** después de auditar | `auditoria-ronda8-integridad.json` |
| `pnpm check` | Tipos, ESLint y compilación aprobados; **75 unitarias aprobadas y 1 omitida**, 76 registradas | `auditoria-ronda8-check.txt` |
| Integración, API compilada `node dist/main.js` | **84/84** | `auditoria-ronda8-integracion-compilada.txt` |
| Navegador, PWA y API compiladas | **9/9** | `auditoria-ronda8-navegador.txt` |
| Importador real por CLI | Conflictos exactos rechazados, números españoles correctos, reglas de categoría conservadas, conversión explícita auditada | `auditoria-ronda8-importador.json` |
| Carga y recarga de catálogo de prueba | **616** ID/nombres del fixture; 616 unidades QA conservadas en la recarga | `auditoria-ronda8-importador.json`, `auditoria-ronda8-importador/*.xlsx` |
| Costos de operaciones nuevas | 50.05 → devolución 15.02 → reporte 35.03 → devolución 35.03 → reporte 0 | `auditoria-ronda8-kit.json` |
| Actualización real R7 → R8 | Devolución creada por API compilada R7; `migrate deploy` sin pendientes, **12 migraciones** conservadas; discrepancia histórica reproducida | `auditoria-ronda8-legado-antes.json`, `auditoria-ronda8-legado-despues.json` |
| Interfaz con catálogo importado | Máximo 120 tarjetas; tres capturas PC/móvil, sin errores JavaScript ni desbordamiento horizontal; código ambiguo añade otro producto | `auditoria-ronda8-ui-importador.json`, `auditoria-ronda8-capturas/` |
| Limpieza | Servicios temporales detenidos; PostgreSQL y servicios originales conservados | `auditoria-ronda8-limpieza.json` |

La unidad omitida requiere el Excel original de la tienda, que no fue suministrado. Para la carga de catálogo se usaron los 616 nombres/ID/categorías del fixture y **stock 1, costo 10 y precio 20 exclusivamente de QA**. No representan el inventario ni los valores del negocio. No se certifican las 3158 unidades que declara Claude sin disponer del Excel original.

## Estado de los cuatro hallazgos anteriores

| Hallazgo | Resultado propio | Estado del cierre |
| --- | --- | --- |
| R7-01 · códigos en conflicto con la base | ID numérico igual a barras ajenas y referencia igual a SKU ajeno: CLI sale 1, sin crear productos, variantes, categorías, movimientos ni auditorías | Caso original corregido; **cierre parcial**, ver R8-01 |
| R7-02 · números españoles de texto | `1,5`, `1.250,50`, `2.500,75` quedan como **1.5, 1250.50, 2500.75**; archivo con fila válida seguida de números ambiguos, negativos o con precisión excesiva se rechaza sin cambios | Corregido en su reproducción y validaciones de formato; límites numéricos pendientes en R8-03 |
| R7-03 · recarga cambia reglas de categoría | Recarga informa sin cambios y mantiene lote/vencimiento obligatorios; ajuste sin lote sigue dando **400 antes y después**. Stock nuevo en categoría protegida se rechaza; `--sin-lotes` realiza la conversión y registra antes/después | Corregido; rechazo de archivos con varias categorías pendiente en R8-03 |
| R7-04 · reporte de devolución parcial | Devolución nueva guarda costo de línea **15.02**, reporte **35.03**, devolución restante **35.03**, reporte final **0** | Operaciones nuevas corregidas; **histórico pendiente**, ver R8-02 |

El control anterior de combos también sigue pasando: venta de 0.001 o 0.5 combos da 400 sin cambios de stock, pagos, ventas ni caja. Una unidad consume 0.4 y registra costo 4000; la devolución entera repone correctamente. No se repitieron todas las migraciones de rondas 3 y 6: no cambiaron las migraciones en esta entrega.

## R8-01 · P1 · La caja y el importador comparan códigos de distinta forma

**Ubicación:** `apps/api/scripts/import-inventario.ts:194`, `:285`, `:297`; `apps/web/src/POS.tsx:337`.

El importador compara códigos de forma sensible a mayúsculas, tanto dentro del archivo como contra la base. La caja convierte barras y SKU a minúsculas. Dos códigos que pasan el importador pueden identificar productos diferentes para la caja.

**Reproducción propia, sin modificaciones directas de tablas:**

1. Por API, crear A: «AAA QA existente MAYÚSCULAS R8», SKU `qa-case-owner-r8`, barras `QA-R8-CASE123`, stock 4.
2. Importar B: «ZZZ QA importado minúsculas R8», ID y referencia `qa-r8-case123`, stock 2, costo 10, precio 20, categoría Ropa deportiva.
3. La CLI termina con **código 0** y crea B con SKU y barras `qa-r8-case123`.
4. En el navegador, escribir el ID de B y pulsar Enter.

**Observado:** se añade **A** al carrito, con aviso de agregado. La captura PC y la evidencia del navegador muestran el producto seleccionado. No se completó el cobro: lo demostrado es la selección equivocada del artículo propuesto para la venta. Los códigos alfanuméricos son admitidos por el importador y por la API; este caso no afirma que el Excel real contenga esos códigos.

**Corrección solicitada:** definir una comparación canónica común para ID/SKU, referencias y barras, y usarla en prevalidación del archivo, comparación contra la base y resolución en caja. Rechazar conflictos entre productos distintos antes de escribir; ante un catálogo ya ambiguo, impedir la selección silenciosa del primer artículo. Conservar la identidad de productos existentes al normalizar.

**Regresión necesaria:** el archivo de esta reproducción debe rechazarse sin cambios. Cubrir diferencias de mayúsculas tanto contra la base como entre filas del mismo archivo, y comprobar en navegador la identificación inequívoca por SKU y barras.

**Evidencia:** campo `caseCollision` de `auditoria-ronda8-importador.json`; campo `codeCollision` de `auditoria-ronda8-ui-importador.json`; `auditoria-ronda8-capturas/pc-mayusculas-codigo-selecciona-otro-producto.png`; libro `auditoria-ronda8-importador/colision-mayusculas.xlsx`.

## R8-02 · P2 · Las devoluciones históricas siguen desajustando el reporte

**Ubicación:** `apps/api/src/reports.ts:557` y `:560`; nuevo costo de línea en `apps/api/src/sales.ts:1025` y `:1115`.

Las devoluciones nuevas guardan el costo por línea y el reporte lo usa correctamente. Para las anteriores, el reporte sigue restando la proporción sin redondear. Claude declara esa estimación expresamente, pero no resuelve el caso original cuando hay datos previos a la actualización. Mezclar una devolución antigua con una nueva deja incluso un saldo tras devolver todo.

**Prueba de actualización real:** se clonó una base de ronda 7. La API compilada R7 creó la venta y su primera devolución; no se borraron ni inyectaron campos JSON por SQL. Luego se detuvo esa API, se ejecutó `migrate deploy` de R8 y se continuó con su API compilada.

| Paso | Costo contabilizado | Costo del reporte |
| --- | --- | --- |
| Vender 10 combos; componente de costo 10.01, cantidad 0.5 por combo | Venta **50.05** | — |
| En R7, devolver 3 con reposición | Devolución **15.02**, saldo **35.03** | **35.04** |
| Actualizar a R8, antes de otra devolución | Saldo **35.03** | **35.04** |
| En R8, devolver los 7 restantes | Devolución **35.03**, saldo **0** | **0.01**, utilidad **−0.01**, ventas y unidades **0** |

La primera devolución contiene una sola línea y ya tiene `SaleReturn.costTotal = 15.02`. En este caso hay información suficiente para recuperar su costo exacto; la estimación proporcional usa 15.015 y produce el residuo.

**Corrección solicitada:** conciliar el desglose de devoluciones históricas con el costo que ya fue contabilizado. Recuperar los costos que puedan deducirse de forma verificable y preservar `SaleReturn.costTotal`; si algún histórico no permite un desglose exacto, identificarlo para conciliación en lugar de presentar un reporte descuadrado como exacto. Cualquier reparación debe ser repetible sin cambiar dos veces el histórico.

**Regresión necesaria:** crear la primera devolución con R7, actualizar, comprobar saldo **35.03**, devolver lo restante con R8 y comprobar costo/utilidad residual **0**. Mantener la regresión de operaciones totalmente nuevas.

**Evidencia:** `auditoria-ronda8-legado-antes.json`, `auditoria-ronda8-legado-despues.json`; reproducción externa `legado-comprobar.mjs`; log `migraciones-upgrade7.log`.

## R8-03 · P2 · Una importación rechazada puede dejar cambios parciales

**Ubicación:** `apps/api/scripts/import-inventario.ts:134`, `:323`, `:362`, `:461`; precisión de dinero en `apps/api/prisma/schema.prisma:103`.

El proceso crea categorías mientras todavía valida otras y aplica una transacción separada por fila. Si una validación posterior o la base rechaza el archivo, los cambios anteriores quedan guardados. La salida de error no identifica una carga parcial ni ofrece el resumen de lo ya aplicado.

**Caso A, reglas normales de categoría:**

1. Crear por API una categoría que exige lote y vencimiento.
2. Preparar un archivo de dos filas. La primera usa una categoría nueva; la segunda usa la categoría protegida y trae stock 1.
3. Ejecutar sin `--sin-lotes`.

La CLI sale **1** por falta de lote, pero las categorías pasan de **7 a 8**: la categoría de la primera fila queda creada. Productos, variantes y movimientos no cambian en este caso. La protección de la segunda categoría se conserva.

**Caso B, valor fuera del rango de almacenamiento:**

1. Archivo de dos filas en Ropa deportiva: primera válida, segunda con precio **1000000000000**.
2. El lector admite ese precio por ser no negativo y no tener decimales de más.
3. PostgreSQL rechaza la segunda fila: `numeric field overflow`, ya que `Decimal(14,2)` requiere un valor absoluto menor que 10^12.

La CLI sale **1**, pero ya creó el producto y variante de la primera fila, stock **1** y **un movimiento**. En la prueba: productos **64 → 65**, variantes **232 → 233**, movimientos **1933 → 1934**. La segunda fila no se crea. Este límite se probó con un valor sintético extremo; no se afirma que figure en el inventario de la tienda.

**Corrección solicitada:** realizar todas las comprobaciones de categorías, finitud y rangos de valores antes de modificar la base. Aplicar límites coherentes con las columnas y valores derivados. Dar a la carga una garantía de consistencia: transacción de lote con parámetros adecuados, o estrategia explícita de cargas parciales que identifique cada cambio ya aplicado y permita retomarlo. Las entradas que se puedan rechazar en la prevalidación deben dejar la base intacta.

**Regresiones necesarias:** rechazar ambos archivos antes de crear categorías, productos, variantes, movimientos o auditorías; cubrir límites de dinero y stock. Conservar la carga y recarga válidas de 616 filas y el cambio explícito de políticas auditado.

**Evidencia:** campos `partialCategoryAbort` y `partialNumericAbort` de `auditoria-ronda8-importador.json`; libros `rechazo-deja-categoria.xlsx` y `rango-monetario-fuera-bd.xlsx`; reproducción externa `importador-comprobar.mjs`.

## Conservación, preparación y límites

Las cinco capturas que sobrescribe la suite se guardaron en `auditoria-ronda8-capturas-oficiales/` y se restauraron del ZIP. El CSV original terminó idéntico. Los 327 archivos originales, incluidos fuentes, configuración, migraciones y tests, coinciden con sus hashes iniciales. Los scripts externos y evidencias se añaden para revisión; no son cambios a la implementación.

Para continuar la prueba histórica tras iniciar una sesión nueva se registró un equipo de QA y se trasladó la caja por el endpoint autorizado. Los primeros intentos sin vincular el equipo y sin trasladar la caja fueron bloqueados con 403 y 409. Se corrigió la preparación y se obtuvo la reproducción final indicada; esos bloqueos no se clasifican como defectos.

Se trabajó con PostgreSQL local **18.4**, Node **24.19.0** y pnpm **11.19.0**. No se certifica el despliegue con PostgreSQL 17/Compose, hardware de tienda, carga de producción ni operación con múltiples sucursales. Las pruebas de Anthropic usan respuestas simuladas; no se hizo una llamada real al proveedor. La suite completa de integración se ejecutó contra la API compilada; no se duplicó toda la suite con `tsx`.

El siguiente trabajo corresponde a Claude: corregir R8-01, R8-02 y R8-03 y adjuntar una nueva ronda para volver a verificar esos casos.
