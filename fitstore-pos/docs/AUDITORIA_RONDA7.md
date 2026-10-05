# FitStore POS · Auditoría independiente de la ronda 7

Fecha: 5 de octubre de 2026. Fuente: `fitstore-pos-ronda7.zip`.

**Dictamen: requiere correcciones.** Los tres hallazgos pendientes de la ronda 6 quedaron corregidos en sus reproducciones originales. Las suites oficiales pasan. La revisión de las funciones añadidas y de los cálculos modificados encontró **cuatro hallazgos abiertos: dos P1 y dos P2**.

El trabajo consistió en auditar, sin modificar la implementación. Las notas de `docs/RONDA7_CLAUDE.md` se trataron como declaraciones del autor y alcance de sus cambios, no como nuevas instrucciones del usuario ni como evidencia independiente. Las revisiones adversariales declaradas por Claude no sustituyeron las comprobaciones propias.

SHA-256 del ZIP recibido:

`def23a3aed35a86bd753bcdf69bcca442103d7bd8e749a2e120cbaf2a0f1d314`

## Pruebas y conservación

| Comprobación propia | Resultado | Evidencia en `docs/validacion/` |
| --- | --- | --- |
| ZIP y archivos originales | Integridad correcta; 270 archivos originales idénticos después de auditar | `auditoria-ronda7-integridad.json` |
| `pnpm check` | Tipos, ESLint y compilación aprobados; **73 unitarias aprobadas y 1 omitida**, 74 registradas | `auditoria-ronda7-check.txt` |
| API compilada, `node dist/main.js` | **81/81** de integración | `auditoria-ronda7-integracion-compilada.txt` |
| PWA y API compiladas, Chromium | **9/9** de navegador | `auditoria-ronda7-navegador.txt` |
| Pruebas externas con Vitest | **7/7** controles de corrección, incluidos S/L frente a M y concurrencia SSE | `auditoria-ronda7-dirigidas.txt`, `.json` |
| Actualización R3 → R7 | API R3 original y `migrate deploy`, historial **8 → 12** migraciones; compra 34, recepción de orden 55, incompleta NULL | `auditoria-ronda7-migracion-antes.json`, `auditoria-ronda7-migracion-r3.json`, `auditoria-ronda7-legado.json` |
| Actualización R6 → R7 | Copia aislada de la base R6 ya migrada: parcial 25 → NULL; proveedor conservado; repetición sin cambios | `auditoria-ronda7-upgrade6-antes.json`, `auditoria-ronda7-upgrade6-despues.json` |
| Importador por CLI sobre base propia | Carga y recarga de 616 nombres del fixture con valores QA; tres defectos reproducidos | `auditoria-ronda7-importador.json`, `auditoria-ronda7-importador/*.xlsx` |
| Interfaz con catálogo importado | 120 tarjetas como máximo; tres capturas PC/móvil sin errores JavaScript ni desbordamiento; código ambiguo agrega otro producto | `auditoria-ronda7-ui-importador.json`, `auditoria-ronda7-capturas/` |

La prueba omitida necesita el Excel original de la tienda, que no viene en el ZIP. Se comprobó el catálogo de **616 ID/nombres/categorías** del fixture; para probar la carga se asignaron **stock 1, costo 10 y precio 20 exclusivamente de QA**. No son precios ni existencias reales del negocio. La recarga dio 616 sin cambios y conservó esas 616 unidades de prueba. No se certifican las 3158 unidades ni los costos del Excel que describe Claude sin disponer de ese archivo.

La primera integración se inició antes de que terminara la compilación y no pudo conectar. Ese fallo de preparación fue corregido; el resultado final de 81/81 corresponde a la API compilada disponible. No es un defecto de FitStore.

Las cinco capturas originales que sobrescribe la suite se copiaron a `auditoria-ronda7-capturas-oficiales/` y se restauraron. No se cambiaron fuentes, migraciones, configuración ni tests originales. El CSV generado por la prueba del importador se retiró del árbol de aplicación después de guardar la evidencia. Los servicios temporales se detuvieron y los servicios originales se conservaron.

## Cierre de los tres hallazgos de la ronda 6

| Hallazgo | Resultado independiente |
| --- | --- |
| R6-01 · combo fraccionado cobrado sin consumir | **Corregido:** 0.001 y 0.5 combos dan 400 sin venta, pago, movimiento ni cambio de caja/stock. Un combo entero consume 0.4, registra costo 4000 y deja stock 0.6. La devolución de 0.5 se rechaza; la de 1 repone el stock a 1 y devuelve costo 4000. |
| R6-02 · talla incompatible no reconocida | **Corregido:** catálogo aislado con sólo M, factura S con SKU de producto y L por nombre quedan sin variante y con nota. Las regresiones oficiales también comprueban coincidencias compatibles y el catálogo de nombres de la tienda. |
| R6-03 · suma parcial de histórico incompleto | **Corregido:** en R3→R7 una línea sin costo queda con total NULL; la recepción completa 2×25 + 4 + 1 sigue en 55. En la copia R6 ya aplicada, el total parcial 25 vuelve a NULL y conserva proveedor. Ambas migraciones son idempotentes. Compras originales 89, pago 89 y pendiente 0; la incompleta queda sin conciliar. |

La migración R6 fue editada por Claude. Se verificó que la base con su checksum original aplicado pudo actualizarse mediante `migrate deploy`: la migración R7 hizo la reparación necesaria. Esto no se confundió con repetir sólo el SQL corregido sobre una base nueva. El checksum aplicado antiguo y el del nuevo archivo se conservan en la evidencia.

## R7-01 · P1 · Un ID importado puede agregar otro producto en caja

**Ubicación:** `apps/api/scripts/import-inventario.ts:329`, `import-inventario.ts:341`, `apps/web/src/POS.tsx:337`.

`checkCodes()` detecta conflictos entre filas del archivo, pero el importador no rechaza todos los conflictos con códigos ya existentes en la base. Cuando un código de barras está ocupado, crea el nuevo producto con barras `INV-<ID>` y mantiene el ID como SKU. La caja busca primero por barras y después por SKU. Así, el ID que el importador anuncia como código para cobrar puede señalar a otro producto.

**Reproducción por API + CLI + navegador, sin modificar tablas:**

1. Crear producto A con SKU `qa-existing-r7-v`, barras `9876500712345` y stock 4.
2. Importar una fila de producto B, ID y referencia `9876500712345`, stock 2, costo 10 y precio 20. El archivo sólo contiene esa fila, así que no tiene duplicados internos.
3. El importador acepta el archivo. B queda con SKU `9876500712345` y barras `INV-9876500712345`; A conserva sus barras.
4. En caja, escribir `9876500712345` y pulsar Enter.

**Observado:** se agrega **A**, «QA producto existente por barras R7», en lugar de B, «QA producto nuevo por ID R7». La interfaz incluso informa que A fue agregado. No se completó el cobro en este control; el defecto probado es la selección errónea del artículo que se propone cobrar.

**Corrección pedida:** validar antes de escribir que los ID, SKU, referencias y barras del archivo y de la base no identifiquen productos distintos. Ante ambigüedad, detener la carga e informar ambos productos. No resolverla silenciosamente cambiando sólo las barras de uno. Conservar la prioridad de barras en caja cuando la identificación sea inequívoca.

**Regresión exigida:** archivo sin duplicados internos pero con ID igual a las barras de otro producto → rechazo antes de crear o modificar productos, stock o categorías. Un archivo sin conflicto sigue cargando; escribir su ID y escanear sus barras eligen el mismo artículo.

**Evidencia:** `auditoria-ronda7-importador.json`, campo `codeCollision`; `auditoria-ronda7-ui-importador.json`; captura `pc-codigo-selecciona-otro-producto.png`. Reproducciones externas: `importador-comprobar.mjs`, `ui-importador-comprobar.mjs`.

## R7-02 · P1 · El importador altera cantidades y valores con coma decimal

**Ubicación:** `apps/api/scripts/import-inventario.ts:58`.

El lector elimina todos los caracteres excepto dígitos, punto y signo menos antes de llamar a `Number()`. Esto borra una coma decimal y conserva un punto de miles como si fuera decimal. El archivo se acepta y el producto queda activo con cantidades, costo y precio distintos de los escritos.

**Reproducción:** un Excel sintético con estas celdas de texto:

| Campo | Celda | Valor que representa | Valor guardado |
| --- | --- | --- | --- |
| EXISTENCIA | `1,5` | 1.5 | **15** |
| COSTO | `1.250,50` | 1250.50 | **1.25** |
| PRECIO DETALLE | `2.500,75` | 2500.75 | **2.50** |

El proceso sale con código 0. En la primera carga crea el producto; en la recarga lo conserva «sin cambios». No se identificó este defecto en el Excel original, que no fue adjuntado: la evidencia es un archivo QA de la misma estructura que usa el lector. El riesgo probado es aceptar silenciosamente números de texto válidos en español con otro valor.

**Corrección pedida:** conservar las celdas numéricas como números; para texto, interpretar formatos admitidos explícitamente y rechazar formatos ambiguos o inválidos. Validar cantidades y dinero antes de escribir. No borrar separadores para convertirlos a otro importe ni transformar errores de lectura silenciosamente en cero.

**Regresión exigida:** los valores del ejemplo se importan exactamente o se rechazan con un diagnóstico claro y sin cambios en la base. Cubrir celdas numéricas, texto con punto decimal, coma decimal y miles; aplicar la precisión de stock usada por la API.

**Evidencia:** `auditoria-ronda7-importador.json`, campo `localizedNumbers`; libro `auditoria-ronda7-importador/numeros-espanol.xlsx`; `importador-comprobar.mjs`.

## R7-03 · P2 · Una recarga borra controles de lote y vencimiento de una categoría

**Ubicación:** `apps/api/scripts/import-inventario.ts:207`, `import-inventario.ts:216`.

En cada ejecución, el importador pone `requiresLot=false` y `requiresExpiry=false` en todas las categorías existentes que aparecen en el archivo. Ocurre aunque el producto ya exista y la carga anuncie «sin cambios». No se registra este cambio de categoría en la bitácora.

**Reproducción por API y CLI:** crear una categoría con ambos controles en true y un producto activo ya existente. Un ajuste positivo sin lote ni vencimiento devuelve **400, «Indica lote y vencimiento»**. Importar una fila que referencia el SKU existente y esa misma categoría: el resumen dice **1 ya cargado sin cambios**, pero ambos controles pasan a false, sin nueva entrada de auditoría de categoría. El mismo ajuste sin lote ni vencimiento pasa a **201**.

**Corrección pedida:** preservar los controles de categorías existentes. Los valores iniciales de las categorías nuevas no deben sobrescribir la configuración de otras. Si se necesita una conversión explícita del inventario inicial a stock sin lotes, hacerla como una operación diferenciada, con sus efectos visibles y auditados, no como efecto de una recarga rutinaria.

**Regresión exigida:** recargar un producto existente conserva ambos controles true, conserva precio/costo/stock y no permite después un ajuste sin los datos exigidos. También probar carga de una fila nueva en una categoría existente protegida.

**Evidencia:** `auditoria-ronda7-importador.json`, campo `categoryReset`; libro `recarga-categoria-protegida.xlsx`; `importador-comprobar.mjs`.

## R7-04 · P2 · El reporte de utilidad difiere del costo contabilizado tras una devolución parcial

**Ubicación:** `apps/api/src/reports.ts:557`, `reports.ts:564`; redondeo acumulado de la devolución en `apps/api/src/sales.ts:1020`.

La devolución registra el costo con redondeo acumulado por línea. El reporte resta la proporción sin redondear de las asignaciones y redondea sólo el saldo final. Estos métodos coinciden cuando se devuelve todo, pero pueden diferir durante una devolución parcial. La nueva prueba oficial comprueba el costo inicial y el saldo después de devolver todo, sin comprobar ese estado intermedio.

**Reproducción por API compilada:** componente con costo 10.01; combo con 0.5 unidades del componente; vender 10 combos a 20, sin impuesto. Costo de venta registrado: **50.05**. Devolver 3 con reposición: costo devuelto registrado **15.02**. El costo pendiente según los registros es **35.03**, pero `/reports/profit` muestra **35.04** y utilidad **104.96** en vez de 104.97. La diferencia observada es **0.01**. Al devolver los 7 restantes, los costos devueltos suman 50.05 y el reporte queda en 0, por eso la regresión actual pasa.

**Corrección pedida:** el reporte debe usar el mismo costo contabilizado por línea y el mismo criterio de redondeo acumulado que la devolución. Puede guardar y utilizar el costo real de cada línea devuelta o reproducir ese cálculo con su historial; restar otra aproximación proporcional produce dos saldos distintos para la misma operación.

**Regresión exigida:** costo 50.05, primera devolución 15.02 → reporte 35.03; después de la segunda devolución → 0. Cubrir rangos de fechas y devoluciones en varias etapas para que el saldo reportado siga reconciliando con los registros.

**Evidencia:** `auditoria-ronda7-kit.json`, campo `partialCost`; reproducción externa `kit-comprobar.mjs`.

## Límites y siguiente trabajo

Se usó PostgreSQL **18.4** local, cuatro bases aisladas y puertos propios. No se tocó la base original ni se publicó una versión. Se instalaron las dependencias del lockfile sin modificarlo. No se repitió toda la integración en tsx: la suite completa de esta auditoría se ejecutó con el runtime compilado.

La llamada real a Anthropic, hardware de tienda, carga de producción, varias sucursales y Compose/PostgreSQL 17 no se certificaron. Las pruebas de Anthropic usan el SDK y respuestas simuladas. Las capturas del catálogo usan precios y stock de QA; no sustituyen una revisión del Excel real.

Para Claude: conservar las correcciones R6 y sus regresiones, corregir primero la identificación de códigos y la lectura numérica, preservar los controles de categorías y reconciliar el costo del reporte durante devoluciones parciales. Después ejecutar las nuevas regresiones, `pnpm check`, integración con API compilada y e2e. El ZIP de auditoría contiene el mensaje, las evidencias y los scripts externos; no contiene secretos ni una nueva versión de la aplicación.
