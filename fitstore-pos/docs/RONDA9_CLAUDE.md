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

## Revisión adversarial de Claude

Después de corregir R8, Claude revisó todo el sistema con **7 buscadores**, uno por área: códigos, devoluciones, importador, caja, dinero, facturas y seguridad. Cada hallazgo propuesto lo intentaron refutar **dos verificadores independientes**, uno leyendo el código y otro reproduciéndolo. Sólo cuenta si ambos lo confirman.

- **Resultado:** de 47 propuestos se confirmaron **43**: 2 P1, 22 P2 y 19 P3. Lista completa en `docs/validacion/ronda9-revision-adversarial.json`.
- **Corrección por área:** un agente escribe primero la regresión y comprueba que falla, después corrige y corre las suites completas. Luego un revisor adversarial revisa el área, y lo que encuentra se repara con el mismo método.

### Caja (`apps/web/src/POS.tsx`)

| Id        | Prioridad | Problema                                                                                    | Corrección                                                                                                                                                                                                          |
| --------- | --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R9-caja-3 | **P1**    | Tras un clic, el Enter del lector volvía a pulsar la tarjeta o el botón + con foco.         | Un solo manejador de teclado: una tecla imprimible fuera de un campo lleva el foco a la búsqueda. Un escaneo dentro del campo de descuento también se recupera.                                                     |
| R9-caja-1 | P2        | Código + Enter agregaba otro producto si el código exacto no estaba en el catálogo cargado. | Un código que no existe avisa y no agrega. Sólo cuenta como código un token sin espacios, todo dígitos o con 5 o más dígitos. Los códigos de modelo o tono del nombre («275n», «a40») siguen buscando por palabras. |
| R9-caja-4 | P2        | La venta en espera perdía el descuento RD$ por línea y el global.                           | `POST /quotes` guarda `globalDiscount`, `discountAmount` y el nombre de cada línea. Migración idempotente `202610090001_r9_caja`.                                                                                   |
| R9-caja-5 | P2        | Recuperar una venta en espera reemplazaba el carrito sin aviso o la perdía.                 | Pide confirmación si el carrito tiene productos o faltan productos y los nombra. Si se cancela, no se consume nada.                                                                                                 |
| R9-caja-6 | P2        | Escaneos perdidos tras «Nueva venta», tras elegir una variante o tras Enter por palabras.   | El foco vuelve a la búsqueda. El Enter no cierra la ventana de variantes recién abierta.                                                                                                                            |
| R9-caja-2 | P3        | Tras el aviso de código ambiguo, el siguiente escaneo se pegaba al anterior.                | El código queda seleccionado.                                                                                                                                                                                       |
| R9-caja-7 | P3        | F8 guardaba la venta en espera sin el cliente recién elegido.                               | Los atajos leen el estado actual.                                                                                                                                                                                   |
| R9-caja-8 | P3        | Descuento de línea sin límite (150 %, monto mayor que la línea).                            | Límite de 0–100 % y del importe de la línea. Un valor fuera de rango se marca y no se cobra.                                                                                                                        |
| R9-caja-9 | P3        | El ticket no mostraba descuentos.                                                           | Descuento por línea, subtotal y descuentos antes del total; con conexión usa los importes del servidor.                                                                                                             |

### Dinero y devoluciones (`sales.ts`, `reports.ts`, `packages/shared`)

| Id           | Prioridad | Problema                                                                                             | Corrección                                                                                                                                                                     |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-dinero-1  | P2        | Una devolución nueva ignoraba el costo contabilizado por una devolución histórica de la misma línea. | `replayReturns()` (shared) repite todas las devoluciones de la venta en orden y usa lo que cada una contabilizó. La que completa la línea deja el costo neto exactamente en 0. |
| R9-dinero-2  | P2        | Las devoluciones parciales reembolsaban más de lo cobrado (total e ITBIS redondeados por separado).  | Redondeo acumulado también para el total y el ITBIS. Cada parte guarda su total e ITBIS.                                                                                       |
| R9-dinero-3  | P2        | Devolver una venta a crédito con un abono por transferencia pendiente dejaba el abono sin resolver.  | La devolución pide verificar o rechazar antes. Nueva ruta `POST /payments/:id/reject` (auditada) y botón «Rechazar» en el detalle de la venta.                                 |
| R9-dinero-4  | P2        | Anular una venta no recalculaba el costo promedio.                                                   | Mismo cálculo que la devolución.                                                                                                                                               |
| R9-dinero-5  | P3        | Abonos y pagos con más de 2 decimales.                                                               | `moneyAmount()` en shared: 2 decimales en pagos y abonos. Una venta sin conexión con un descuento de 3 decimales se sincroniza igual.                                          |
| R9-dinero-6  | P3        | Una devolución histórica de varias líneas, repartida en proporción, dejaba ±0.01 por producto.       | Se reconstruye por línea el redondeo acumulado de la ronda 7. Si no suma `costTotal`, se reparte en proporción.                                                                |
| R9-dinero-7  | P3        | En ventas antiguas, la suma de líneas no coincidía con `Sale.costTotal`.                             | `bookedLineCosts()` reparte `Sale.costTotal` entre las líneas cuando no coinciden.                                                                                             |
| R9-dinero-8  | P3        | «Devoluciones y descuentos» mostraba costos a roles sin `profit:read`.                               | El detalle pasa por `safe()` en JSON, XLSX y PDF.                                                                                                                              |
| R9-dinero-9  | P3        | «Ventas por método de pago» contaba dos veces el crédito.                                            | Columnas «Ventas» (suma = lo vendido) y «Cobros de crédito» (por fecha del abono, sólo verificados).                                                                           |
| R9-dinero-10 | P3        | La tendencia del dashboard comparaba neto contra bruto.                                              | Ambos períodos netos de devoluciones.                                                                                                                                          |
| R9-dinero-11 | P3        | Subtotal − descuento ≠ total por redondeos separados.                                                | Se redondean bruto, cobrado e ITBIS; descuento y neto salen por diferencia.                                                                                                    |

**Efecto en R8-02:** la conciliación de las devoluciones anteriores a la ronda 8 pasó de `reports.ts` a `replayReturns()` en shared. Ahora la usan el reporte y la creación de devoluciones nuevas. Para cada parte sin costo guardado, primero reconstruye el redondeo acumulado de la ronda 7. Si eso no suma lo que la devolución contabilizó, reparte `costTotal` en proporción, con el resto en la última línea.

<!-- R9-AREAS-PENDIENTES: offline, facturas, códigos, importador, seguridad -->

## Verificación

| Comprobación                                         | Resultado                                                                   | Registro (`docs/validacion/`)        |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `pnpm check`                                         | TypeScript, ESLint, **76** unitarias y compilación aprobadas.               | `ronda9-check.txt`                   |
| Integración con la API compilada, base nueva         | **87/87** (84 anteriores y 3 nuevas).                                       | `ronda9-integracion-compilada.txt`   |
| Navegador (PWA y API compiladas)                     | **10/10**, incluido el código ambiguo.                                      | `ronda9-navegador.txt`               |
| Las 3 regresiones nuevas con el código de la ronda 8 | Fallan las 3.                                                               | `ronda9-regresiones-con-ronda8.txt`  |
| Inventario real                                      | Bloqueo sin cambios, carga de 616 en una transacción y recarga sin cambios. | `ronda9-tienda/carga-inventario.txt` |

Se conservan todas las regresiones anteriores.

## Windows y zona horaria

Validación en la computadora de la tienda: Windows 11, Node 24 y PostgreSQL 18.6 local, con el servidor en UTC-4. La primera corrida, sobre `aa345c7`, dio 45/99 en integración y 21/22 en navegador. Una revisión local de sólo lectura (cinco enfoques, cada hallazgo verificado por un segundo agente que intentaba refutarlo) confirmó 37 riesgos. Se corrigieron en cuatro canales aislados, cada uno con su copia del repositorio, su base y sus puertos. Cada corrección tiene una regresión que falla antes, y cada canal pasó una revisión adversarial después de rebasarse sobre el trabajo de la nube (0 bloqueantes).

### Qué se corrigió

| Área                                           | Antes                                                                                                                                                                                                                                                                                      | Ahora                                                                                                                                                                                                                                       | Regresión                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bloqueos por PIN y contraseña (`security.ts`)  | `UPDATE "AuthAttempt" … NOW()+INTERVAL '15 minutes'` guardaba la hora local de la sesión en una columna que Prisma lee como UTC. Con PostgreSQL en UTC-4 el bloqueo nacía vencido (−225 min) y nunca se aplicaba.                                                                          | `(NOW() AT TIME ZONE 'UTC')`. `auth.ts` queda igual que en la nube: desde R9-seguridad-1 la contraseña usa ese mismo contador.                                                                                                              | Describe «Ronda 9 · Windows y zona horaria», al final de `tests/api.test.ts`. Arranca una segunda API compilada cuya `DATABASE_URL` fuerza la zona (`options=-c TimeZone=…`), comprueba en `pg_settings` que tomó efecto y repite cada caso con `America/Santo_Domingo` y con `UTC`. |
| Paneles del tablero (`reports.ts`)             | Cinco consultas crudas comparaban `"createdAt"` con una fecha enviada como `timestamptz`. Con la sesión en UTC-4 la ventana se corría 4 horas y los paneles no cuadraban con los totales del ORM.                                                                                          | Comparan con `(fecha::timestamptz AT TIME ZONE 'UTC')`.                                                                                                                                                                                     | «TZ-1 y TZ-6», en el mismo describe.                                                                                                                                                                                                                                                 |
| Sesión fijada (`compose.yaml`, `.env.example`) | Nada fijaba la zona de la sesión.                                                                                                                                                                                                                                                          | `?options=-c%20TimeZone%3DUTC`, como defensa adicional. El código ya no depende de ello.                                                                                                                                                    | «TZ-3», en el mismo describe.                                                                                                                                                                                                                                                        |
| Finales de línea e instalación                 | Sin `.gitattributes`, Windows bajaba 304 archivos con CRLF y fallaba «Ronda 2 > 5: Compose». `pnpm install` terminaba con código 1 (`ERR_PNPM_IGNORED_BUILDS`) y reescribía `pnpm-workspace.yaml`.                                                                                         | `.gitattributes` con `* text=auto eol=lf`. `allowBuilds` decide los binarios de `embedded-postgres` para Windows y macOS.                                                                                                                   | Estáticas en `tests/portabilidad.test.ts`.                                                                                                                                                                                                                                           |
| Pruebas de integración (`tests/api.test.ts`)   | La ruta de `.env` y `runImport` usaban `URL.pathname`, que en Windows es `/C:/…`: la prueba no cargaba `.env` (48 fallos) y el importador daba `ENOENT` (4 fallos). La prueba «6» bloqueaba el proceso 6 segundos con `spawnSync` y la siguiente recibía `ECONNRESET`.                     | `fileURLToPath`, `tsx` lanzado con `node` y arranques asíncronos. Las aserciones no cambian.                                                                                                                                                | Las propias pruebas, que fallaban en Windows, y tres estáticas.                                                                                                                                                                                                                      |
| Scripts                                        | `pnpm db:local`, `pnpm verify`, `pnpm package:source` y `pnpm backup` no funcionaban en Windows.                                                                                                                                                                                           | `local-db.mjs` arranca en UTC y UTF-8, admite `FITSTORE_DB_PORT` y `FITSTORE_DB_DIR`, y se detiene limpio (`--detener`). `verify.mjs` usa la API de `FITSTORE_API_URL` o `PORT` y no deja procesos. El ZIP fuente se escribe sólo con Node. | `tests/portabilidad.test.ts`.                                                                                                                                                                                                                                                        |
| Suite de navegador repetible                   | Cada corrida reescribía PNG versionados de `docs/`. Dos ventas agotaban existencias de la semilla y fallaban desde la corrida 14. Todas las pruebas compartían el límite de 60 peticiones por minuto de `/api/auth/*`. Playwright reutilizaba sin avisar lo que hubiera en el puerto 4173. | `tests/e2e/apoyo.ts`: `screenshotPath()` (escribe en `docs/` sólo con `FITSTORE_ACTUALIZAR_CAPTURAS=1`), `ensureStock()` y una dirección de cliente por prueba. `FITSTORE_WEB_PORT` cambia el puerto.                                       | `tests/e2e/repetible.spec.ts` y `tests/e2e-higiene.test.ts`.                                                                                                                                                                                                                         |
| Fuentes y barra superior (`styles.css`)        | Inter y Plus Jakarta Sans se pedían a Google Fonts. Sin internet no había fuentes; con ellas, la barra superior medía entre 323 y 327 px en una pantalla de 320 px. En celular, la barra de Mercancía tapaba opciones del menú abierto.                                                    | Fuentes empaquetadas (4 archivos woff2, +184 KB, dentro de la precarga sin conexión). La ruta de la barra cede con puntos suspensivos y el menú queda por encima. Sólo CSS.                                                                 | `tests/e2e/fuentes.spec.ts` (9 pruebas).                                                                                                                                                                                                                                             |

### Reglas nuevas para las pruebas

- Las pruebas de navegador toman `test` y `expect` de `./apoyo`, pasan por `screenshotPath()` las capturas que van a `docs/` y llaman a `ensureStock()` antes de vender existencias de la semilla. Lo exige `tests/e2e-higiene.test.ts`, que forma parte de `pnpm check`. Para cumplirlo se cambió la línea de importación de `store.spec.ts`, `facturas.spec.ts` y `cuatro-cajas.spec.ts`, sin tocar lo que comprueban.
- El describe de zona horaria arranca `apps/api/dist/main.js`: la API tiene que estar compilada antes de correr la integración.
- En Windows no se ejecuta `pnpm install` ni `pnpm db:generate` con la API en marcha, porque el proceso bloquea el motor de Prisma.

### Pendiente para la nube

Los cuatro hallazgos que caían en archivos que la nube estaba editando:

| Hallazgo | Archivo                                     | Estado                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-5     | `apps/api/scripts/import-inventario.ts:633` | El importador sigue escribiendo `revision-inventario.csv` en la carpeta actual. La nube ya lo sacó del repositorio y está ignorado. Falta poder indicar la ruta de salida; además, `.dockerignore` no lo excluye y el `Dockerfile` hace `COPY . .`. |
| TZ-2     | `apps/api/src/common.ts`                    | Sin acción. R9-seguridad-1 quitó esa lectura de `lockedUntil`, y la escritura ya es UTC.                                                                                                                                                            |
| PI-5     | `apps/api/src/common.ts:20`                 | `PrismaClient` no limita sus conexiones: abre hasta 17 por proceso en esta computadora. Con `max_connections = 100` caben unas cuatro copias a la vez. Hoy se resuelve con `?connection_limit=` en `DATABASE_URL`.                                  |
| PI-8     | `apps/api/src/main.ts:69`                   | La API escucha en `0.0.0.0`. Para desarrollo convendría poder limitarla a `127.0.0.1`.                                                                                                                                                              |

También quedan para la nube:

- `tests/e2e/facturas.spec.ts:65`: «R9-facturas-8» espera el campo «Cantidad pendiente», que ya no existe (`Purchases.tsx:358` lo llama «… · Unidades buenas»). Es el único fallo de la corrida final de navegador.
- Pruebas sensibles al tiempo o al orden (TS-4 a TS-8): cambian ajustes de toda la sucursal, dependen de que otras corran antes, tienen presupuestos de 2 segundos o esperan teclas a menos de 50 ms. Además, `today` se calcula al cargar `tests/api.test.ts`: una corrida que cruzó la medianoche local falló 19 pruebas.
- Nada de esto se probó en Linux, porque esta computadora no tiene WSL ni Docker. Conviene correr allí `pnpm check` y las dos suites.

Sin cambio de código: TZ-5 (`RealtimeEvent.createdAt` no tiene lectores), TZ-6, WP-7, WP-CRLF-4 a 6 y PI-7.

### Verificación en Windows

La corrida final se hizo con estos cambios aplicados sobre `0fb2383` de la nube, en una base nueva, con el rol `fitstore` sin ajustes (sesión en `America/La_Paz`, UTC-4), la API y la PWA compiladas y las variables sólo en `.env`.

| Comprobación                                | Resultado                                                                               | Registro (`docs/validacion/`)                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Primera validación, integración (`aa345c7`) | 45/99 tal cual; 90/99 con las variables exportadas; 93/99 además con el rol en UTC.     | `ronda9-windows-antes-integracion.txt`                                             |
| Primera validación, navegador (`aa345c7`)   | 21/22 y 4 PNG de `docs/` modificados.                                                   | `ronda9-windows-antes-e2e.txt`                                                     |
| `pnpm install` y finales de línea           | Código 1 y 304 archivos con CRLF antes; código 0 y todo en LF después.                  | `ronda9-windows-instalacion.txt`                                                   |
| Regresiones de zona horaria                 | Fallan con la API anterior y la sesión en Santo Domingo; pasan después, también en UTC. | `ronda9-windows-zona-antes.txt`, `ronda9-windows-zona-despues.txt`                 |
| Regresiones de portabilidad                 | Fallan antes y pasan después.                                                           | `ronda9-windows-portabilidad-antes.txt`, `ronda9-windows-portabilidad-despues.txt` |
| Regresiones de la suite de navegador        | Fallan antes y pasan después.                                                           | `ronda9-windows-e2e-antes.txt`, `ronda9-windows-e2e-despues.txt`                   |
| Regresiones de fuentes y barra superior     | Fallan antes y pasan después.                                                           | `ronda9-windows-fuentes-antes.txt`, `ronda9-windows-fuentes-despues.txt`           |
| `pnpm check` final                          | TypeScript, ESLint, **128** unitarias (1 omitida) y compilación aprobadas.              | `ronda9-windows-check.txt`                                                         |
| Integración final                           | **136/136**.                                                                            | `ronda9-windows-integracion.txt`                                                   |
| Navegador final                             | **54/55**: falla «R9-facturas-8», de la nube. `git status` queda vacío tras la corrida. | `ronda9-windows-e2e.txt`                                                           |
