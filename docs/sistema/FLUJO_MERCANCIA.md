# Flujo de mercancía: entradas, salidas, traspasos, ajustes, conteos y facturas de proveedor

Rama `cola-n26` (= `nexora-cloud`). Citas `archivo:línea`. Regla madre: **todo cambio de mercancía de suplementos, maquillaje y fajas se verifica 3 veces con métodos independientes antes y después; los conteos contra el sistema, 4 veces; se le muestra a la dueña y se aplica solo con su confirmación** (`CLAUDE.md` punto 6; `.claude/skills/mercancia/SKILL.md:12-24`).

## 1. Dónde está la mercancía

- Hay **dos almacenes** por sucursal: **Tienda** (`kind=store`, vendible) y **Casa** (`kind=home`, no vendible). Se crean solos con la sucursal (`apps/api/prisma/migrations/202610240401_warehouses/migration.sql:52-57`, `:70-74`); solo la Tienda puede ser vendible (`:11`, `CHECK warehouse_sellable_store`).
- **La caja vende de Tienda.** El campo `Variant.stock` es el stock de Tienda; el de Casa está en `VariantStock` (`apps/api/prisma/schema.prisma` modelos `Variant` y `VariantStock`; la pantalla lo confirma en `apps/web/src/Management.tsx:810-821`).
- **Casa solo se mueve con instrucción expresa de la dueña, y cada salida dice su destino** (regalo a X / traspaso a Tienda) (`.claude/skills/mercancia/SKILL.md:33`).
- Cada cambio de existencia deja un renglón de **kardex** (`InventoryMovement`) con tipo, cantidad, saldo después, motivo y usuario (`apps/api/prisma/schema.prisma` modelo `InventoryMovement`). Se ve con el ícono del ojo en Inventario (`apps/web/src/Management.tsx:956-962`, `:760`).
- Lotes: categorías con `requiresLot` y/o `requiresExpiry` exigen número de lote y vencimiento (`apps/api/prisma/schema.prisma` modelo `Category`; `apps/web/src/Merchandise.tsx:1159`, `:1172`). Un lote vencido no se recibe: «No se recibe mercancía vencida.» (`apps/api/src/merchandise.ts:632`).

## 2. Pantalla «Mercancía»: entradas y salidas

Permiso `inventory:write`; el rol `seller` queda bloqueado (`apps/api/src/merchandise.ts:155-156`). El equipo debe estar registrado/aprobado: «Registra este equipo antes de mover mercancía.» (`:359-360`). Encabezado «Mercancía — Entradas y salidas con revisión antes de confirmar.» y pestañas **ENTRADA** / **SALIDA** (`apps/web/src/Merchandise.tsx:632-657`). Al cambiar de modo con líneas cargadas: «¿Descartar las líneas al cambiar de modo?» (`:460-471`).

### 2.1 ENTRADA (compra o mercancía que llega)

1. **«Proveedor (opcional)»** y, si hay internet, **«Orden de compra (opcional)»** (solo órdenes no recibidas de ese proveedor; carga las líneas pendientes) (`:685-765`).
2. Desplegable **«Documento del proveedor (opcional)»**: factura, NCF del proveedor, fecha, condición de pago Contado/Crédito, ITBIS; se puede completar después desde el historial (`:812-821`; `apps/web/src/Purchases.tsx:82-180`).
3. Cargar productos de **tres formas**:
   - **«Código de barras o SKU»** + **«Sumar una unidad»** (también lector) (`:858-872`);
   - **«Escanear con la cámara»** (`:873-880`) o escaneo continuo (`:110-171`);
   - buscador de producto por nombre (`ProductSearch`, `:177-279`).
   - Si el código no existe, se ofrece **«Crear producto rápido»**: Nombre, Categoría, Código de barras, Precio de venta… (`:1444-1500`). Un código repetido en dos productos no elige ninguno en silencio (`:99-109`).
4. **«Importar factura del proveedor»** (botón, solo con internet y lista vacía): Excel o CSV (y foto/PDF si la IA está activa; cada usuario puede hacer **30 lecturas con IA por día**, según el día de Santo Domingo, y la lectura cuenta aunque falle; `apps/api/src/ai-daily-limit.ts`), con las columnas «Columna de código / descripción / cantidad / costo»; botón **«Extraer para revisar»** (`:822-846`, `:1542-1600`; API `POST /merchandise/import`, `apps/api/src/merchandise.ts:195`). **Nada entra al inventario hasta que se confirma**: pantalla «Revisión de factura» con líneas «por resolver» / «Todas emparejadas» (`:894-915`).
5. Por cada línea: **Cantidad** (− / +), **Costo unitario** (obligatorio, mayor que 0), **Lote** y **Vencimiento** si la categoría lo pide, **«Unidades dañadas o rechazadas»** con motivo (Dañado, Vencido o por vencer, Producto equivocado, Rechazado por calidad: no entran al stock) (`:1060-1220`, `:1627-1700`; `apps/web/src/Purchases.tsx:30-35`). Quien ve costos (`profit:read`) ve «Costo promedio actual … sube/baja N %» y el aviso **«Margen con este costo: N %. Revisa el precio de venta.»** si el margen cae de 15 % (`:1138-1152`). El costo promedio de la variante (`costAvg`) se recalcula con las entradas.
6. Pie: **«Flete»**, **«Impuestos adicionales»**, **«Total de la factura»** y «Total calculado» (`:1223-1260`). Si no coincide: «El total no coincide con la factura (RD$ …). Revisa líneas, flete e impuestos.» y casilla «Confirmo la diferencia después de revisar» (`:1262-1278`).
7. **«Confirmar entrada»** (`:1297-1310`). Pregunta «¿Confirmar entrada de N unidad(es)…?» (`:498-505`) y envía `POST /merchandise/operations` con un identificador único (reintentar no duplica) (`:508-568`; API `apps/api/src/merchandise.ts:343-`). Validaciones: «Elige o crea todos los productos antes de confirmar.», «Escribe el costo unitario de cada producto.», «Cada línea necesita una cantidad mayor que 0.» (`:472-497`).
8. Resultado: «Entrada registrada» con unidades, productos y total, y el botón **«Imprimir etiquetas de lo recibido»** (`:659-679`, `:1604-1625`). «Entradas recientes» tiene **«Etiquetas»** (`:1318-1345`).
9. Sin internet la operación queda en cola local: «Guardado en cola. Se sincronizará al reconectar.» (`:573-575`) y se ve en **«Pendientes de este equipo»** con «Reintentar» y corregir (`:1348-1400`).

### 2.2 SALIDA (merma, daño, regalo, devolución a proveedor)

1. Elegir **«Motivo de la salida»**: **Merma**, **Dañado**, **Vencido**, **Muestra o probador**, **Uso interno**, **Devolución a proveedor** (`:73-80`, `:767-781`).
2. «Devolución a proveedor» exige **Proveedor** y **«Referencia (documento o nota de crédito)»** (`:782-809`, validación `:490-497`).
3. Cargar productos igual que en la entrada. Si hay lotes se elige **«Lote de salida»** (solo lotes con existencia) (`:1185-1215`; API: «Selecciona el lote de salida.» `merchandise.ts:686`). En una salida no se crean productos (`merchandise.ts:376`).
4. **«Confirmar salida»** (`:1297-1310`), pregunta «¿Confirmar salida de N unidad(es) por …?» (`:498-505`).
5. Una orden solo permite entradas; una factura solo permite entradas (`merchandise.ts:435`, `:478`).
- El **tipo** importa para el reporte de ganancias: una merma real no se registra como «conteo». Tipos de la bitácora de la dueña: `conteo`, `entrada`, `salida`, `regalo`, `ajuste` (`.claude/skills/mercancia/SKILL.md:27-29`). Mermas, ajustes y devoluciones a proveedor se restan a costo en el Resumen; las «Correcciones del conteo de inventario» **no restan** (`apps/web/src/Dashboard.tsx:671-678`).

## 3. Pantalla «Inventario»: stock, ajustes y conteos

Permiso `inventory:write` (`apps/web/src/App.tsx:240`).

- Selector **«Almacén»**: Todos / Tienda / Casa (`Management.tsx:845-853`). Pestañas **«Stock actual»** y **«Conteos físicos»** (`:858-870`). Columnas: Producto / Variante, Precio, Costo (solo `profit:read`), «En Tienda» o «En Casa», Total, «Lote en Tienda», Vencimiento, Acciones (`:880-945`).
- **«Ajustar»** (`:946-950`, ventana `:1018-1090`): Almacén, **«Cantidad (+ entrada / − salida)»**, Tipo (**Ajuste**, **Merma**, **Devolución a proveedor**), Proveedor y referencia (solo devolución), «Lote de salida», «Lote de entrada», «Vencimiento de entrada», **«Motivo»** obligatorio. API `POST /inventory/adjustments`, permiso `inventory:write` (`apps/api/src/inventory.ts:637-720`). No deja negativo: «Stock insuficiente en …» (`inventory.ts:705`); pide lote/vencimiento donde corresponde (`:713-720`).
- **«Contar»** (`:951`, ventana `:1092-1130`): Almacén y **«Cantidad contada»**. Crea un **conteo físico pendiente** (`POST /inventory/counts`, `inventory:write`, `apps/api/src/inventory.ts:1495-1549`). Un conteo **no cambia la existencia hasta aprobarlo**.
- **Aprobar un conteo**: pestaña «Conteos físicos» › estado «Pendiente» › **«Aprobar ajuste»** (solo `sale:manage`) → «Conteo aprobado y aplicado.» (`Management.tsx:985-1010`; API `POST /inventory/counts/:id/apply`, `apps/api/src/inventory.ts:1550-1620`). Si el stock cambió desde el conteo: «El stock cambió. Repite el conteo.» (`inventory.ts:1595`); los productos con lote se ajustan desde su lote (`:1597`).
- **Kardex** (ojo): movimientos de la variante (`Management.tsx:760-780`, API `GET /inventory/movements`, `inventory.ts:618`).
- **Compras**: ver §5.

## 4. Traspasos Casa ↔ Tienda

Dentro de **Inventario**, panel **«Almacenes y traspasos»** (`apps/web/src/WarehousesPanel.tsx:74`):

1. Tabla **«Dónde está la mercancía»**: Producto, Tienda, Casa, Total y «Valor a costo» (`:76-110`; API `GET /inventory/location-report`, `apps/api/src/warehouses.ts:54`).
2. Solo `*` (administración) ve **«Traspasar mercancía»**: «El movimiento resta del origen y suma al destino en una sola operación.» Se elige el producto, se pulsa **«Traspasar»** y se llena la ventana **«Traspasar · producto»**: **Desde**, **Hasta**, **Cantidad** (3 decimales), «Lote (si aplica)», **Motivo** (mín. 3 letras) (`:113-205`).
3. API `POST /inventory/transfers`, permiso `*`, equipo registrado, idempotente por `operationId` (`apps/api/src/warehouses.ts:112-300`). Valida: dos almacenes distintos, sin renglones repetidos, existencia suficiente en el origen («No hay suficiente existencia en … para …») y lote obligatorio en productos con lote/vencimiento («Selecciona el lote de la mercancía que quieres mover.») (`:117-120`, `:195-206`, `:276-282`). Escribe dos movimientos de kardex `transfer_out` y `transfer_in` (`:310-360`).
4. **«Historial de traspasos»**: Fecha, Desde, Hasta, Producto, Cantidad, Motivo (`WarehousesPanel.tsx:272-300`; API `GET /inventory/transfers`, `warehouses.ts:94`).
5. **«Levantamiento inicial de Casa»**: sube un Excel con columnas **ID, EXISTENCIA, COSTO y PRECIODETALLE**; primero vista previa («Existencia actual en Casa» / «Existencia después de cargar») y luego aplicar. Los productos nuevos se crean con 0 en Tienda; los de lote se cuentan por lote (`apps/api/src/inventory-import.ts:236-257`, `WarehousesPanel.tsx:208-270`; API `inventory-import/casa/preview` y `/apply`, `apps/api/src/inventory-import.ts:314`, `:346`, permiso `inventory:import`, que solo tiene `*`).
6. Un traspaso de Casa a Tienda es el único camino normal para que mercancía de Casa se pueda vender.

## 5. Compras y facturas de proveedor

Pantalla **Compras** (`purchase:write`), `apps/web/src/Management.tsx:1158`:

- **«Orden de compra»** (botón): proveedor + líneas con cantidad y costo (`apps/web/src/Purchases.tsx:181-337`; API `POST /purchase-orders`, `apps/api/src/inventory.ts:966`). Número de orden consecutivo.
- En la lista de órdenes, **recibir** una orden abre el editor de recepción (`Purchases.tsx:338-453`; API `POST /purchase-orders/:id/receive`, `inventory.ts:1039`): cantidad buena y dañada por línea (nunca más que lo pendiente: «Cantidad mayor que lo pendiente.»), flete y otros costos, lote y vencimiento, documento del proveedor. El flete y otros costos se **reparten** en el costo de cada línea (`apps/api/src/inventory.ts:165` `receiptCosts`, llamada en `:1165`). Se crea una `GoodsReceipt` y sube el stock de Tienda.
- **Recepciones** (pestaña): historial con detalle y exportación (`Purchases.tsx:454-640`; API `GET /goods-receipts`, `inventory.ts:1337`, `:1441`; exportar `goods-receipts/export` requiere `reports:read`, `:1360`).
- **Proveedores**: crear proveedor (nombre, RNC, teléfono, correo, plazo de pago, entrega) y **registrar un pago al proveedor** (monto, método, referencia) (`Management.tsx:1185`, `:1348-1370`; API `apps/api/src/admin.ts:568-600`). Las cuentas por pagar salen en el reporte «Compras y cuentas por pagar» (`Management.tsx:2729`).
- La **factura del proveedor** (foto/PDF/Excel) que se sube en Mercancía queda adjunta a la recepción y no se puede borrar (`apps/api/prisma/schema.prisma` modelo `GoodsReceipt`, campo `attachmentId`; modelos `InvoiceDraft` e `InvoiceAttachment`). Hay un tope diario de facturas sin confirmar: «Tienes muchas facturas sin confirmar hoy. Confirma o espera.» (`merchandise.ts:236`).
- No confundir: **«FS-0000123» es el número de una VENTA de la tienda** (factura al cliente), no una factura de proveedor (`apps/api/src/sales.ts:1120`). La factura del proveedor se identifica por su propio número (`supplierInvoice`) y NCF (`supplierNcf`).

## 6. Procedimiento fijo de la dueña (verificación triple)

Fuente: `.claude/skills/mercancia/SKILL.md`, `CLAUDE.md` punto 6. Resumen:

1. **Buscar antes de actuar** en la bitácora y el historial del producto (`python3 mercancia.py buscar <producto>`).
2. **Identificar el SKU exacto**; si el nombre puede ser dos productos (p. ej. Carnivor Mass 5.83 lb vs Shred 3.8 lb), preguntar.
3. **Plan sin aplicar** (`mercancia.py ajuste|traspaso … --orden "<frase exacta de la dueña>"`): mostrar «antes → después».
4. **Con su «sí»**: repetir con `--aplicar`. El programa lee la existencia por 3-4 caminos antes, la vuelve a leer justo antes de aplicar, aplica y la lee otra vez por 3-4 caminos. Si algo no cuadra, se detiene: no se fuerza, se investiga.
5. **Ventas o facturas que haga Claude**: después, `mercancia.py nota --orden … --detalle "FS-xxxx, productos y montos"` y verificar la existencia de cada producto en modo plan.
6. **Conteos**: comparar con 4 métodos (existencia, suma de movimientos, saldo anterior menos ventas, recálculo por renglón) y entregar la tabla antes de ajustar.
7. **Guardar** la bitácora `docs/operacion/bitacora-mercancia.jsonl` (una línea por cambio con la frase exacta de la dueña) y subirla a la rama de producción.
- Programa: `docs/coordinacion/claude-nube/mercancia.py` (entra con `entrar.py`; credenciales del entorno, nunca impresas). La bitácora tiene campos `id`, `cuando`, `cuando_rd`, `quien`, `orden`, `tipo`, `detalle` (`docs/operacion/bitacora-mercancia.jsonl:1`).
- Reglas fijas: Casa solo con instrucción expresa; no tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suyo; nunca imprimir credenciales (`.claude/skills/mercancia/SKILL.md:33`).
- Antes de dar cualquier cifra, lista, estado de factura o cuadre a la dueña: skill `informe-triple` (leer el dato 3 veces por caminos distintos y decir qué no se comprobó).

## 7. Quién puede qué (mercancía)

| Acción | Permiso | Cita |
|---|---|---|
| Entradas/salidas (pantalla Mercancía) | `inventory:write`, no `seller` | `apps/api/src/merchandise.ts:155-156`, `:343` |
| Ajustar / Contar | `inventory:write` | `apps/api/src/inventory.ts:637-639`, `:1495-1496` |
| Aprobar conteo | `sale:manage` | `inventory.ts:1550-1552` |
| Traspasar Casa↔Tienda | `*` | `apps/api/src/warehouses.ts:112-114` |
| Levantamiento de Casa | `inventory:import` (solo `*`) | `apps/api/src/inventory-import.ts:47`, `:314-348` |
| Órdenes de compra y recepciones | `purchase:write` | `inventory.ts:954-1041` |
| Ver stock, kardex, productos | `catalog:read` | `inventory.ts:581-619` |
