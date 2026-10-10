# Revisión con IA — FitStore POS, ronda 9

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

**Fecha:** 6 de octubre de 2026  
**Archivo auditado:** `fitstore-pos-ronda9.zip`  
**SHA-256:** `6de8b75d1c9e055fc678f13011c1be13a8f966b30f250d5a276eb0e47d4201d1`  
**Resultado:** **REQUIERE CORRECCIONES — no aceptar todavía para producción**

La ronda 9 mejora de forma considerable la caja, el trabajo sin conexión, las recepciones y los controles de dinero. Las tres observaciones de la ronda 8 quedaron cerradas de forma independiente. La aplicación compiló, pasó sus suites y soportó las pruebas de cuatro cajas.

La aceptación se detiene por **R9-A01**: `POST /returns` no tiene una clave de idempotencia. Al repetir exactamente la misma devolución sobre una venta que todavía tenía otra unidad retornable, el sistema creó otra devolución, otra nota de crédito y otra entrada de inventario. El paso 31 de la lista de aceptación exige bloquear expresamente ese caso y el propio documento clasifica una devolución excesiva o duplicada como bloqueo de salida.

## Alcance y método

La revisión se hizo sobre una extracción limpia del ZIP, sin cambiar el código de implementación. Se usaron datos sintéticos en una base PostgreSQL aislada y una API compilada. Se revisaron y ejecutaron:

- caja, lector, búsqueda, variantes, descuentos y todos los medios de pago;
- crédito, abonos, contraentrega, trabajo sin conexión y sincronización;
- devoluciones, anulaciones, notas, stock, costos, caja y reportes;
- cuatro cajas concurrentes y entrada de mercancía desde celular;
- órdenes, recepciones, facturas, dañados, importador e historial;
- permisos, bloqueos, sesiones, proxy, dependencias y exposición de datos;
- las 15 migraciones desde cero y una actualización real de R7 a R9;
- los 40 pasos de `docs/PRUEBA_ACEPTACION_CAJA.md` y las brechas previas de Claude.

La emisión e-CF y la comunicación con DGII quedaron fuera del alcance por instrucción expresa. Tampoco se probaron lector, impresora, gaveta ni adquirente físicos.

## Resultado de las pruebas

| Verificación                                     |               Resultado independiente |
| ------------------------------------------------ | ------------------------------------: |
| TypeScript, ESLint y compilación                 |                                  Pasa |
| Vitest                                           | 128 pasan, 1 omitida, 129 registradas |
| Integración sobre API compilada                  |             137/137, repetida 5 veces |
| Ejecuciones de integración acumuladas            |                               685/685 |
| Chromium E2E                                     |                                 55/55 |
| Repetición del caso antes intermitente R9-caja-5 |                                 10/10 |
| Portabilidad e higiene de E2E                    |                                 31/31 |
| Migraciones nuevas                               |                                 15/15 |
| Actualización R7 → R9                            |          Pasa, sin pérdida de conteos |
| Cuatro cajas + recepción concurrente             |      Pasa en las 5 corridas completas |

La base R7 de prueba tenía 4 usuarios, 5 categorías, 60 productos, 228 variantes y 847 ventas. Tras aplicar las tres migraciones nuevas, esos conteos permanecieron iguales, aparecieron las nueve columnas y los dos índices esperados, y la API R9 respondió correctamente en salud, inicio de sesión y catálogo. Evidencia: [actualización R7→R9](validacion/auditoria-ronda9-actualizacion-r7-r9.json).

Las corridas de integración y navegador se hicieron inicialmente en Linux con Node 22.22.0. Después se repitió el `check` completo —tipos, lint, 129 pruebas y ambos builds— con Node 24.19.0, que cumple la versión declarada por el proyecto. Las pruebas específicas de portabilidad pasaron 31/31. El ZIP contiene evidencia del autor de 136/136 en integración y 54/55 en navegador sobre Windows antes del último ajuste de selector; esta auditoría no ejecutó el código exacto de entrega en Windows.

## Observaciones abiertas

| ID         | Prioridad | Área          | Resultado                                                                         |
| ---------- | --------- | ------------- | --------------------------------------------------------------------------------- |
| **R9-A01** | **P1**    | Devoluciones  | Un reintento idéntico puede duplicar devolución, nota, crédito/reembolso y stock. |
| **R9-A02** | **P2**    | Caja/reportes | Una devolución posterior reescribe la utilidad del cierre original.               |
| **R9-A03** | **P2**    | Compras       | Se pierde el total documental de una factura que incluye dañados.                 |
| **R9-A04** | **P2**    | Dinero        | Un costo con tres decimales hace diferir orden y recepción.                       |
| **R9-A05** | **P2**    | Mermas        | Una devolución dañada deja cantidad 0 y costo devuelto 0 en el kardex.            |
| **R9-A07** | **P2**    | Arqueo        | El esperado es visible y campos vacíos se autocompletan con ese esperado.         |
| **R9-A08** | **P2**    | Rendimiento   | Las listas incluyen imágenes base64 completas y pueden alcanzar cientos de MB.    |
| **R9-A06** | **P3**    | Concurrencia  | Dos recepciones simultáneas guardan una vez, pero una respuesta es 500.           |
| **R9-A09** | **P3**    | Despliegue    | La cadena de proxy documentada colapsa las IP cliente en la del proxy HTTPS.      |
| **R9-A10** | **P3**    | Dependencias  | `pnpm audit --prod` informa 2 avisos altos y 2 moderados.                         |
| **R9-A11** | **P3**    | Comprobantes  | El PDF y el historial omiten el efectivo entregado.                               |
| **R9-A12** | **P3**    | Descuentos    | El autorizador no queda completo y legible en ticket/reporte.                     |

No se encontró un P0. El total es **1 P1, 6 P2 y 5 P3**.

### R9-A01 — P1 — devolución duplicada por reintento

`POST /returns` valida venta, caja y saldo bajo bloqueo, pero el cuerpo no contiene `operationId` y `SaleReturn` no tiene una clave equivalente (`apps/api/src/sales.ts:966-1007`; `apps/api/prisma/schema.prisma:246-262`). Esa protección impide devolver más que la venta, pero no distingue un segundo negocio legítimo de la repetición del mismo envío.

La reproducción vendió dos unidades y envió dos veces el mismo JSON para devolver una. Las respuestas crearon `NC-000134` y `NC-000135`, quedaron dos devoluciones y el stock pasó de 2 a 4. Ambas peticiones fueron aceptadas porque cada una cabía en el saldo retornable. Evidencia completa: [riesgos contables, `returnRetry`](validacion/auditoria-ronda9-riesgos-contables.json).

**Corrección requerida:** enviar un UUID estable desde la interfaz; guardar `operationId` único y un hash del cuerpo en `SaleReturn`; adquirir el bloqueo por ese ID antes de evaluar el saldo. Mismo ID y mismo cuerpo debe devolver el resultado original; mismo ID y cuerpo distinto debe fallar. La regresión debe cubrir repetición secuencial y concurrente.

### R9-A02 — P2 — cierre histórico mutable y ajuste en la sesión equivocada

`buildCuadre` carga las ventas de la sesión original con **todas** sus devoluciones (`apps/api/src/cash.ts:127-143`) y resta esas devoluciones al calcular utilidad (`cash.ts:239-258`). La consulta separada por `SaleReturn.cashSessionId` se usa para efectivo, pero no para margen.

Una venta cerrada tenía utilidad 60. Después de devolverla desde otra caja, el cierre original mostró 0 y la caja de la devolución también mostró utilidad 0. Esto contradice la regla de la lista de aceptación que pide no reescribir silenciosamente un cierre antiguo.

**Corrección requerida:** acordar la política con contabilidad, congelar las cifras aprobadas del cierre y registrar el ajuste por fecha/sesión de la devolución con referencia a la venta original. La prueba debe cerrar A, devolver en B y comprobar que A no cambia y B o el reporte de su fecha recibe el ajuste una sola vez.

### R9-A03 — P2 — total de factura descartado

El flujo acepta que `invoiceTotal` coincida con líneas buenas o con líneas buenas más dañadas (`apps/api/src/merchandise.ts:417-425`). Al crear `GoodsReceipt`, sólo guarda `total` operativo y `damagedCost`; el esquema no contiene `invoiceTotal` (`merchandise.ts:514-548`; `schema.prisma:317-340`).

La prueba presentó una factura de 400: 300 buenos y 100 dañados. La respuesta, la base y la exportación sólo pueden recuperar total 300 y dañados 100; ya no existe el valor documental 400 que el sistema validó.

**Corrección requerida:** conservar por separado el total del documento, el pagadero/aceptado, lo reclamado o dañado y la diferencia reconocida. Esos campos deben salir en consulta, comprobante y exportación contable.

### R9-A04 — P2 — precisión monetaria inconsistente

Los validadores generales `amount` y `positive` sólo imponen signo y máximo (`apps/api/src/common.ts:183-184`). En la orden, `unitCost` usa `positive` y el total se calcula antes de que PostgreSQL reduzca el costo a `Decimal(14,2)` (`apps/api/src/inventory.ts:627-669`).

Con 2 × 100.005, la orden guardó costo unitario 100.01 pero total 200.01. La recepción leyó el costo guardado y produjo 200.02: diferencia de 0.01. Otras rutas monetarias también reutilizan esos validadores.

**Corrección requerida:** aplicar `moneyAmount` a toda entrada monetaria que terminará en `Decimal(14,2)` y conservar validadores distintos para cantidades físicas. Probar 100.005 en precios, costos, flete, apertura, movimientos y documentos; debe responder 400 sin escrituras.

### R9-A05 — P2 — merma sin cantidad ni costo total en kardex

Si `restock` es falso, el costo de devolución permanece en cero y el movimiento `return_waste` se crea con `qty: 0` (`apps/api/src/sales.ts:1077-1099`, `1142-1155`). La prueba devolvió una unidad dañada cuyo costo era 20. El stock vendible quedó correctamente en 0, pero `SaleReturn.costTotal` fue 0 y el movimiento tuvo cantidad 0; el kardex no puede recuperar que se recibió una unidad no vendible ni su valor total.

**Corrección requerida:** modelar la cantidad física de la devolución no vendible y su costo, sin incrementar stock disponible ni descontar dos veces la utilidad. Evidencia: [devolución dañada](validacion/auditoria-ronda9-devolucion-danada.json).

### R9-A07 — P2 — cierre sin conteo independiente

El formulario revela “Efectivo esperado” antes del conteo (`apps/web/src/Tienda.tsx:181-186`). Tarjeta y transferencia explican que vacío equivale al esperado (`Tienda.tsx:225-234`), y la API efectivamente copia esos valores (`apps/api/src/cash.ts:577-582`). Las notas del cierre tienen valor predeterminado vacío y no dependen de la diferencia (`packages/shared/src/index.ts:551-562`).

**Corrección requerida:** capturar primero el conteo sin mostrar el esperado, exigir cifras declaradas por método y luego revelar la comparación. Toda diferencia que supere la política acordada debe exigir explicación; vouchers, comisión y retención de tarjeta deben quedar conciliados aparte.

### R9-A08 — P2 — imágenes base64 en respuestas de lista

`GET /sales` incluye todos los pagos de hasta 100 ventas (`apps/api/src/sales.ts:757-775`) y cada evidencia se guarda como `data:` URL de hasta 2 MB (`sales.ts:1312-1354`). `GET /cod/pending` devuelve hasta 500 ventas y copia cada `proofUrl` (`sales.ts:1372-1438`).

Con una sola prueba grande, `/sales` pesó 3,117,415 bytes; la imagen ocupó 2,796,226 caracteres. Cien imágenes al máximo representan aproximadamente 279.6 MB antes del resto del JSON. Esto es material para teléfonos sencillos y para la memoria del proceso.

**Corrección requerida:** las listas deben devolver sólo `hasProof`, tamaño y tipo. La imagen debe descargarse por un endpoint individual autenticado, con paginación y almacenamiento privado. Evidencia: [peso de comprobantes](validacion/auditoria-ronda9-peso-comprobantes.json).

### R9-A06 — P3 — error 500 en recepción concurrente

La recepción usa `operationId`, bloqueo asesor y bloqueo de la orden (`apps/api/src/inventory.ts:766-785`). Eso evitó la duplicación. Sin embargo, en cinco pares concurrentes siempre hubo un 201 y un 500, con una sola fila persistida. PostgreSQL produjo `40001`, expuesto por Prisma como `P2010`; el filtro sólo convierte `P2034` en conflicto reintentable (`apps/api/src/common.ts:402-410`).

**Corrección requerida:** reintentar la transacción cuando el error corresponda a serialización y, tras el conflicto, consultar `operationId` y comparar el cuerpo. Ninguna petición idéntica debe terminar en 500.

### R9-A09 — P3 — IP compartida detrás del proxy documentado

La guía coloca el Nginx de la aplicación detrás de un proxy HTTPS. Ese Nginx reemplaza `X-Forwarded-For` por `$remote_addr` (`deploy/nginx.conf:12,22`), mientras Express confía en un salto (`apps/api/src/main.ts:20`). En esa topología, `$remote_addr` es el proxy exterior y todos sus clientes llegan con la misma `req.ip`. El límite de autenticación y ventas usa directamente esa IP (`main.ts:29-49`).

**Corrección requerida:** declarar proxies de confianza concretos y preservar una cadena validada de la IP original. Probar dos IP cliente a través de los dos saltos y comprobar límites separados; una conexión directa no debe poder falsificar la cabecera.

### R9-A10 — P3 — avisos de dependencias

`pnpm audit --prod` encontró:

- altos: `effect 3.18.4` (`GHSA-38f7-945m-qr2g`) y `deepmerge-ts 7.1.5` (`GHSA-ggr8-5vv4-36mx`), ambos por configuración de Prisma;
- moderados: `uuid 8.3.2` por ExcelJS (`GHSA-w5hq-g745-h8pq`) y `js-yaml 5.3.0` por Nest Swagger (`GHSA-r3ph-w7gj-g6xm`).

No se demostró una ruta explotable en las solicitudes normales. Deben actualizarse o documentarse como excepciones verificadas y volver a ejecutar todas las suites. Evidencia: [auditoría de dependencias](validacion/auditoria-ronda9-evidencias/dependencias.json).

### R9-A11 — P3 — efectivo entregado ausente en reimpresión

El ticket térmico usa `sale.tendered` (`apps/web/src/Prints.tsx:304-305`). El PDF del servidor imprime sólo importe neto y cambio (`apps/api/src/sales.ts:1619-1620`), y el detalle histórico tampoco presenta claramente el importe entregado. Una venta de 100 pagada con 150 debe mostrar 150 entregado, 50 de cambio y 100 de entrada en todas las representaciones.

### R9-A12 — P3 — autorización de descuento incompleta

El evento `discount_approved` se crea si hubo PIN o vendió un gerente, y guarda un UUID (`apps/api/src/sales.ts:665-685`). El reporte imprime el JSON de auditoría (`apps/api/src/reports.ts:689-708`). Los descuentos de cajera dentro de su límite no generan ese evento y no se conserva un motivo o autorizador legible para el paso 17.

**Corrección requerida:** conservar para cada descuento el actor, la regla aplicada, la autorización necesaria y el motivo, y resolver nombres/roles en ticket y reporte.

## Cierre de R8

Las tres correcciones solicitadas en la ronda 8 pasaron reproducciones propias:

- **R8-01:** colisiones de código sin distinguir mayúsculas rechazadas por creación API, edición de variante, producto rápido e importador/CLI, sin escrituras;
- **R8-02:** venta histórica con costo 50.05, devolución previa 15.02, saldo 35.03 y devolución final 35.03; el reporte termina en 0;
- **R8-03:** un error en la segunda fila por categoría protegida o rango monetario aborta toda la carga, incluidas categorías y movimientos previos.

Evidencia: [regresiones R8](validacion/auditoria-ronda9-regresiones-r8.json).

## Prueba de aceptación de 40 pasos

| Clasificación                |  Pasos |
| ---------------------------- | -----: |
| Cumple por software          |     21 |
| Parcial                      |     13 |
| Falla                        |      1 |
| Fiscal, fuera del alcance R9 |      4 |
| Dependiente de hardware      |      1 |
| **Total**                    | **40** |

El detalle por paso está en [auditoria-ronda9-aceptacion.json](validacion/auditoria-ronda9-aceptacion.json). El único paso clasificado como falla es el 31. Los pasos fiscales 02, 19, 20 y 21 no se cuentan como defectos de implementación de esta ronda, pero deben resolverse con el contador y el PSFE antes de usar comprobantes fiscales en producción.

La comparación con `aceptacion-caja-brechas.json` muestra progreso real en stock vencido, documentos de compra, dañados, historial de recepciones, reportes e impresión del cierre. Permanecen las brechas ya descritas allí para los pasos 12, 17, 31, 32, 39 y parte del 40. Las reproducciones nuevas añadieron el desfase monetario, la pérdida del total documental, la respuesta 500 concurrente, el tamaño de comprobantes y la topología de proxy.

## Condiciones antes de producción

1. Corregir **R9-A01** y repetir el paso 31 de forma secuencial y concurrente.
2. Corregir los P2 financieros y de control: **A02, A03, A04, A05, A07 y A08**.
3. Ejecutar de nuevo las suites completas y la actualización R7→R9.
4. Ejecutar los 40 pasos con productos, existencias, lector, impresora y adquirente reales.
5. Definir el flujo B/E y contingencia con contador/PSFE; la aplicación todavía imprime documentos internos no fiscales.
6. Configurar respaldo automático fuera de la PC y demostrar una restauración completa en otra máquina.
7. Validar el ZIP corregido en el Windows y Node 24 que usará la tienda.

## Evidencias entregadas

- [Resultado estructurado de auditoría](validacion/auditoria-ronda9.json)
- [Comparación de los 40 pasos](validacion/auditoria-ronda9-aceptacion.json)
- [Riesgos contables reproducidos](validacion/auditoria-ronda9-riesgos-contables.json)
- [Regresiones R8](validacion/auditoria-ronda9-regresiones-r8.json)
- [Actualización R7→R9](validacion/auditoria-ronda9-actualizacion-r7-r9.json)
- [Devolución dañada](validacion/auditoria-ronda9-devolucion-danada.json)
- [Peso de comprobantes](validacion/auditoria-ronda9-peso-comprobantes.json)
- [Integridad contra el ZIP original](validacion/auditoria-ronda9-integridad.json)
- `docs/validacion/auditoria-ronda9-evidencias/`: salidas de corridas y dependencias
- `docs/validacion/auditoria-ronda9-reproducciones/`: scripts y archivos sintéticos reproducibles

Los **418 archivos originales** coinciden byte por byte con el ZIP recibido. No se modificó ningún archivo de implementación; sólo se añadieron 30 archivos de informe, resultados, scripts de reproducción y evidencias bajo `docs/`.
