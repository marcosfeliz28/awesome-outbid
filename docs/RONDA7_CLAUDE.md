# FitStore POS · ronda 7 (Claude)

Esta ronda corrige los **3 hallazgos abiertos** de la auditoría de ChatGPT a la ronda 6 (`docs/AUDITORIA_RONDA6.md`): R6-01 (P1), R6-02 (P2) y R6-03 (P2). También adapta el sistema al **inventario real de la tienda**: 616 productos de suplementos, maquillaje y fajas, con la venta y la facturación lo más simples posible.

Antes de entregar, Claude hizo **tres revisiones adversariales** con agentes independientes. Cada hallazgo propuesto lo intentaron refutar dos verificadores, y sólo cuenta como confirmado si ambos lo reprodujeron. Las tres revisiones confirmaron 12, 12 y 10 hallazgos, todos corregidos con regresiones (`docs/validacion/ronda7-revision-adversarial.json`). El cierre por hallazgo está en `docs/validacion/ronda7-cierre.json`.

## 1. Hallazgos de la auditoría R6

### R6-01 · P1 · Combo fraccionado: se cobraba sin consumir componentes

**Corrección:**

- **Venta:**
  - Los combos se venden por **unidades enteras**.
  - Antes de cualquier escritura, cada consumo derivado (componente × combos) se calcula con `derivedStockQty()` de `@fitstore/shared`. Es exacto y nunca redondea; si no es representable con 3 decimales, la venta da 400.
  - Las asignaciones de los combos se marcan `exact: true`.
- **Devoluciones:**
  - Un combo se devuelve por unidades enteras.
  - Una línea fraccionada vendida antes de esta ronda puede devolverse completa.
  - Lo que vuelve al stock se reparte con `returnShares()`: llenado en orden, sobre lo acumulado y en milésimas, sin redondeos que se sumen entre devoluciones parciales.
- **Costo:**
  - `Sale.costTotal` es la suma del costo redondeado de cada línea guardada (lotes y combos).
  - La devolución usa el valor de las asignaciones (`allocationCost()`) con redondeo acumulado por línea, así que una devolución total deja el costo neto en cero.
  - El reporte de utilidad redondea una sola vez.
  - Los combos antiguos vendidos en fracción conservan su costo registrado.

**Pruebas:**

- **Integración, reproducción exacta de ChatGPT:** 0.001 combos y pago de 5 dan 400 sin crear venta, pago, movimiento ni cambio de caja o stock. 0.5 combos también se rechazan.
- **Integración, combo entero:** 1 combo consume exactamente 0.4, con costo de 4000 y asignaciones de 0.4. Media unidad devuelta da 400; una devuelta repone 0.4.
- **Integración, costo exacto:** 10 combos a 5.005 suman 50.05. Dos devoluciones (3 y 7) suman 50.05 y el reporte de utilidad queda en 0.
- **Unitarias:** `derivedStockQty`, `returnShares` (tres devoluciones de un combo repartido en dos lotes suman lo tomado de cada lote) y `allocationCost` (combo nuevo, antiguo fraccionado y antiguo entero).
- **Con el código anterior:** la venta de 0.001 combos devuelve 201.

### R6-02 · P2 · Talla incompatible según el vocabulario del catálogo

**Corrección:**

- **Tallas reconocidas:**
  - Por sí mismas: XS, S, M, L, XL y 2XL–9XL (XXL equivale a 2XL).
  - Escritas como palabra: X-Large, Extra Large, 2X-Large, Mediana, Small, Large…
  - Con la palabra "talla": cuenta la talla que la sigue, incluidas las seguidas ("talla L-XL").
- **Casos especiales:**
  - "1 l" es un litro, no talla L.
  - "Women's", con cualquier apóstrofo, no se lee como talla S.
- **Comparación:**
  - La talla se compara como talla antes que como texto: XL no pasa por 2XL.
  - Una talla no estándar (32, One Size) choca con una talla declarada distinta.

**Prueba:** el catálogo aislado que pidió ChatGPT, sólo con talla M, rechaza S y L, tanto con el SKU del producto como por nombre; M sigue eligiéndose. El código anterior falla esa prueba.

### R6-03 · P2 · La migración concilió una recepción con líneas incompletas

**Corrección:**

- El SQL de `202610060001_round6_audit` se corrigió:
  - Exige que todas las líneas sean objetos con `qty > 0` y `cost >= 0` numéricos, con `IS DISTINCT FROM`.
  - Usa `CASE` para no leer como arreglo algo que no lo es.
  - Prisma no valida el checksum de una migración aplicada al hacer `migrate deploy`; se comprobó.
- La nueva `202610070001_round7` repara las bases que ya aplicaron la versión con el error: el total vuelve a NULL y la recepción aparece "sin conciliar".
- Ambas se pueden repetir sin cambiar nada más.

**Pruebas:**

- **Integración:** seis variantes incompletas (sin costo, sin cantidad, vacía, no objeto, cantidad 0, sin líneas) y una base que ya tenía el total parcial de 25 quedan sin total, aunque se ejecuten dos veces. La recepción completa 2×25 + 4 + 1 sigue en 55. Después de pagar 55, el pendiente queda en 0.
- **Actualización real R3 → R7** (`docs/validacion/ronda7-actualizacion/`): los datos los crea la API de la ronda 3, se agregan las recepciones sintéticas de ChatGPT sobre el esquema R3, se ejecuta `migrate deploy` y se verifica con la API compilada. Pasan 7/7 controles: equipos, compras de 139 recuperadas, la incompleta sin conciliar y el pendiente en 0 después de pagar.

## 2. Revisiones adversariales de Claude

| Revisión | Sobre                        | Confirmados | Principales                                                                                                                                                                                                           |
| -------- | ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Correcciones R6 e inventario | 12          | Tallas escritas en el nombre (las fajas de la tienda: un producto por talla), "2XL" frente a "XL", 6 productos cuyo código era el de barras, una nueva carga pisaba costos, código + Enter decía "agregado" sin stock |
| 2        | Correcciones de la 1         | 12          | "1.3 lb" se leía también como "3 lb" (P1), "2X-Large", empates entre tallas elegidos al azar, una REFERENCIA repetida, costo por línea frente al de la venta, lector de códigos                                       |
| 3        | Correcciones de la 2         | 10          | Otra marca preelegida ("Gold Standard" frente a "Isoflex"), "5-lb", tolerancia de tamaño, "Shaker" sin color, "Natural" frente a "Unflavored", café como color                                                        |

**Emparejamiento de facturas resultante:**

- **Con código:** el código exacto de la variante (SKU o barras) siempre manda. El SKU del producto se acepta si el nombre no contradice la factura.
- **Por nombre, sólo se deja elegido un producto si:**
  - la factura menciona todas sus palabras identificadoras. La marca es opcional; los sinónimos de sabor y color cuentan ("Fresa" por "Strawberry"); las palabras de empaque como "bolsa" no son necesarias;
  - y su presentación no contradice la factura (talla, color, sabor o tamaño).
- **En los demás casos, la línea se sugiere sin variante y con una nota:**
  - "Coincidencia parcial…";
  - "Hay N productos parecidos y la factura no indica cuál";
  - "La factura indica talla L; este producto es talla S".

  La pantalla de revisión permite elegir, buscar otro producto o crear uno rápido.

- **Tamaños:**
  - Se leen del texto con decimales, miles ("1,000 ml" y "1.000 ml") y guion ("5-lb").
  - "1.3 lb" equivale a "1.34 lb", pero "1.02 lb" no es "1 lb" ni "4.4 lb" es "4.5 lb".
- **Comprobación con el catálogo real:** los 616 productos se encuentran por su propio nombre (`tests/invoice.test.ts`), además de los casos de las tres revisiones.

## 3. Inventario real de la tienda

- **Importador (`apps/api/scripts/import-inventario.ts`, `pnpm --filter @fitstore/api inventory:import archivo.xlsx`):**
  - Crea un producto por fila. El **ID** es el código para cobrar; la REFERENCIA o el "Barcode …" distintos son el código de barras.
  - Las existencias entran como "Inventario inicial" en el kardex.
  - Los productos sin precio o costo quedan inactivos.
  - Genera `revision-inventario.csv`: sin precio, margen bajo, sin existencia.
  - Rechaza códigos repetidos o ambiguos antes de tocar la base.
  - Repetirlo no duplica ni pisa lo editado en la app: sólo crea nuevos, activa los que ahora tienen precio y costo y, con `--actualizar-precios`, cambia precios dejando constancia en la bitácora.
  - Evidencia: `docs/validacion/ronda7-tienda/carga-inventario.txt`. Se cargaron 616 productos y 3158 unidades; los totales coinciden con la hoja Resumen, y la segunda carga dio "616 sin cambios".
- **Caja:**
  - Código + Enter: se busca primero por código de barras y después por ID. Si no hay stock, el aviso queda visible y el código queda seleccionado para el siguiente escaneo; "Código no encontrado" avisa de un código desconocido.
  - Búsqueda por palabras sin acentos ni apóstrofos ("loreal"). Si ninguna coincidencia completa existe, se muestran los productos más parecidos.
  - Tarjetas con el nombre en dos líneas (tono, talla o sabor visibles), el código y una imagen por categoría.
  - Hasta 120 tarjetas dibujadas.
  - Sólo aparecen las categorías con productos.
- **Prueba con el inventario real** (`docs/validacion/ronda7-tienda/`, PC y celular, PWA y API compiladas):
  - Código 1002 + Enter: 127–137 ms.
  - "iso100 vanilla" → 3, "moira 275n" → 1, "cinturilla 2xs" → 1 y "proteina whey" → 16 parecidos.
  - Las tarjetas muestran el tono.
  - Sin desbordamiento horizontal y sin errores JavaScript.
- **Datos del negocio:** el Excel original y el reporte con costos **no** van en el repositorio ni en el ZIP. Las pruebas usan `tests/fixtures/catalogo-tienda.json`, que sólo contiene ID, nombre y categoría.

## 4. Verificación

| Comprobación                                                        | Resultado                                                                | Registro (`docs/validacion/`)       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `pnpm check`                                                        | TypeScript, ESLint, **74** unitarias y compilación web/API aprobadas.    | `ronda7-check.txt`                  |
| Integración con **API compilada** (`node dist/main.js`), base nueva | **81/81** (77 anteriores y 4 nuevas).                                    | `ronda7-integracion-compilada.txt`  |
| Integración con tsx                                                 | **81/81**.                                                               | `ronda7-integracion-desarrollo.txt` |
| Navegador (PWA y API compiladas)                                    | **9/9**, incluido código + Enter con stock, lector y código desconocido. | `ronda7-navegador.txt`              |
| Actualización real R3 → R7                                          | 7/7 controles.                                                           | `ronda7-actualizacion/`             |
| Caja con el inventario real                                         | PC y celular; capturas incluidas.                                        | `ronda7-tienda/`                    |

Las regresiones nuevas de R6-01, R6-02 y R6-03 y la de la caja **fallan con el código anterior** y pasan con el nuevo.

## 5. Decisiones y límites

- **Combos:** sólo por unidades enteras. Ninguna regla de la tienda pide fracciones.
- **Lotes:** el Excel no trae lotes ni vencimientos, así que el importador deja Suplementos y Maquillaje sin lote obligatorio, para que la caja venda sin pedir datos extra. Se puede activar después desde la categoría, cuando se reciba mercancía con lote.
- **Emparejamiento de facturas:** es conservador. Muchas líneas quedarán como sugerencia para confirmar en vez de preelegidas, a propósito: el error caro es recibir mercancía en el producto equivocado.
- **Migración de la ronda 6:** se editó estando ya aplicada en algunas bases. `migrate deploy` y `migrate status` no la marcan, y la nueva migración de la ronda 7 repara esas bases.
- **Sin certificar:**
  - una lectura real de factura con Anthropic (las pruebas usan respuestas simuladas);
  - varias sucursales;
  - PostgreSQL 17 en Compose (aquí se usó 16);
  - hardware de tienda.
