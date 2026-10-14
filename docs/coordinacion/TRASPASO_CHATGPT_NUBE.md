# Traspaso a ChatGPT NUBE: operar Nexora POS como lo hace Claude (14-oct-2026)

**Orden de la dueña (14-oct):** «ChatGPT nube también toma el control de todo esto y lo trabaja como yo trabajo con Claude, porque Claude se puede ir». Este documento es la memoria completa. Léelo entero antes de actuar. Reemplaza la regla antigua «nunca te conectes a producción» de `LEER_PRIMERO_NUBE.md` solo en lo que dice aquí.

Si eres ChatGPT PC, no es para ti: tú sigues con pruebas y código en tu rama.

## 0. Lo que la dueña tiene que darte (una vez)

Sin esto solo puedes preparar cambios, no operar. Las claves **nunca** van en el chat, ni en commits, ni en documentos: se guardan en los secretos/variables de tu entorno.

1. **Un usuario tuyo en Nexora POS** (Configuración › Usuarios, rol administrador, nombre `chatgpt`). Variables de tu entorno: `NEXORA_USER` y `NEXORA_PASSWORD`.
2. **Escritura en GitHub** del repositorio `marcosfeliz28/awesome-outbid`.
3. **Render** (solo si ella lo autoriza): ser miembro del workspace `tea-db3f7ofavr4c739hsgi0` con permiso de despliegue, o que ella pulse «Deploy» cuando tú se lo pidas.
   Si no tienes internet saliente hacia `https://nexora-pos-web.onrender.com`, avísale: en ese caso preparas el cambio (código o un script) y ella o Claude lo ejecutan. No inventes que lo hiciste.

## 1. Qué es esto

Nexora POS: punto de venta en la nube de **Grupo Macgen** (Santo Domingo). Suplementos, maquillaje y fajas. Monorepo pnpm: `apps/api` (NestJS + Prisma + PostgreSQL 17), `apps/web` (React PWA), `tests/`. Rama de producción: `nexora-cloud`. Web pública `https://nexora-pos-web.onrender.com` (la API está en `/api`). Render: API `srv-db3fep59fdbs73dic6n0`, web `srv-db3feel9fdbs73diarn0`.
Almacenes: **Tienda** `53900cab-31a6-eca2-bb72-0917353e02de`, **Casa** `5cf94802-9429-521f-2a12-38b16ed514e8`. Categorías: Suplementos, Maquillaje, Fajas, Ropa deportiva (`GET /categories`).

## 2. Reglas del dinero (no cambian)

- Margen = (precio − costo) / precio, **sin restar ITBIS**. Mínimo 15 %. Si un producto queda debajo, **no cambies el precio**: anótalo en «anomalías» para la dueña.
- **No cambies precios en el sistema por una oferta**: la caja aplica el descuento.
- Cuando la dueña da un precio o costo, **ponlo tal cual**. No le hagas preguntas de margen.
- Costo promedio ponderado al entrar mercancía con otro costo (ver `claude-nube/LEEME_CLAUDE_NUBE.md`).
- **No toques lo que ella contó o modificó ayer u hoy** sin un conteo nuevo suyo.
- Producto nuevo sin precio: créalo con precio y costo 0, y deja el aviso en `docs/operacion/PENDIENTES-DUENA.md`. Nunca inventes un precio.
- Nunca imprimas ni repitas contraseñas, PIN, claves de API ni tokens.

## 3. Cómo se trabaja con ella (lo aprendido)

- Escribe por **dictado de voz**: los nombres salen deformados («Sirius más» = Serious Mass, «Mabel» = Maybelline). Interpreta con el catálogo; pregunta solo si hay dos opciones reales.
- Respóndele en **español, corto**, sin tecnicismos: primero qué hiciste, luego qué le falta a ella.
- Palabras suyas: **«sácame/sácalo del sistema»** = ajuste −1 en Tienda. **«Entrala/entra»** = ajuste +cantidad en Tienda. «Casa» es el otro almacén; no lo toques si no lo nombra.
- Antes de un cambio masivo: **foto** del inventario (SKU, existencia, precio, costo). Después: **verifícalo leyendo de nuevo, 4 veces** (cantidades pedidas, tienda+casa = total, lo no tocado intacto, totales). Cuéntale el antes y el después.
- Un cambio de código no se da por bueno hasta que los 3 CI estén en verde en el último commit.

## 4. Cómo entrar al sistema (API)

Base: `https://nexora-pos-web.onrender.com/api`. Inicia sesión como en `docs/coordinacion/claude-nube/entrar.py` (cámbiale las variables a `NEXORA_USER`/`NEXORA_PASSWORD`); guarda el token en un archivo temporal de modo 600. **El token dura ~1 h**: si ves 401, entra de nuevo. Cabecera: `Authorization: Bearer <token>`.

| Para                                                 | Llamada                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Productos (con variantes, existencia, precio, costo) | `GET /products?limit=200&page=N` → `items`                                                                                                         |
| Existencia por almacén                               | `GET /inventory/location-report` (campos `store`, `home`)                                                                                          |
| Historial de una variante                            | `GET /inventory/movements?variantId=…&limit=50`                                                                                                    |
| Entrar/sacar                                         | `POST /inventory/adjustments {variantId, qty (±), warehouseId, reason}`                                                                            |
| Mover Casa↔Tienda                                    | `POST /inventory/transfers {operationId, fromId, toId, reason, lines[{variantId, qty}]}`                                                           |
| Crear producto                                       | `POST /products {name, sku, categoryId, variants[{sku, barcode, price, costAvg}]}` (barcode = sku; siguiente SKU libre ≥ 1673)                     |
| Cambiar nombre/categoría                             | `PATCH /products/:id`                                                                                                                              |
| Cambiar costo/precio                                 | `PATCH /variants/:id {costAvg, price}`                                                                                                             |
| Ventas del día                                       | `GET /sales?date=AAAA-MM-DD&limit=200`                                                                                                             |
| Anular venta                                         | `POST /sales/:id/void {reason}`                                                                                                                    |
| Cajas                                                | `GET /cash-sessions?limit=40`, `GET /cash-sessions/:id/cuadre`, `GET /cash-sessions/:id/reports/venta-diaria-usuario` y `.../venta-por-forma-pago` |
| Verificar transferencia                              | `POST /payments/:id/verify`                                                                                                                        |
| Corregir banco/referencia                            | `POST /payments/:id/correct-transfer`                                                                                                              |
| Bitácora                                             | `GET /audit-log?limit=300`                                                                                                                         |
| Contraseña temporal                                  | `POST /users/:id/reset-password` (vendedora = exactamente 6 números no triviales)                                                                  |

## 5. Rutina diaria (como la hace Claude)

1. **Revisión del día (21:07):** ventas, anulaciones, cajas abiertas, diferencias de cierre, créditos/contraentregas pendientes. Informe corto con anomalías.
2. **Cierre de caja de cada cajera:** ella cuenta efectivo y **tarjeta** (el total que imprimió el verifón; el verifón se cierra todos los días). **Las cajeras no declaran transferencias:** el sistema las suma. Si la tarjeta no coincide, la cajera no cierra sola: la dueña autoriza con PIN de gerente. Al cerrar se imprimen cuadre, productos vendidos de esa caja y facturas por forma de pago.
3. **Transferencias (tú y la dueña):** al terminar el día ella te manda fotos de los **3 bancos**. Compara **factura por factura**: monto (obligatorio) y nombre (si sale, mejor). Si el monto coincide, verifica. Lo que no cuadre, lista aparte. Al final, total de facturas contra total de bancos. Ahora todas quedan en `pending_verification` hasta que lo hagas.
4. **Inventario:** altas, bajas y conteos que ella dicte o mande en foto/Excel. Ver §3 y §2.
5. **Pendientes:** `docs/operacion/PENDIENTES-DUENA.md` es la lista viva. Actualízala y súbela.

## 6. Cambios de código

Rama tuya `nexora-chatgpt-nube`; un lote = una entrega, con prueba que falle antes y pase después y `pnpm check` en verde. **No hay PostgreSQL en tu entorno**: lo que necesite base de datos lo prueba el CI (`verify` tarda ~21 min). Lee los fallos con los logs del job de CI, no adivines. No relajes ni borres pruebas. Datos de prueba con fechas relativas.

## 7. Despliegue

Solo cuando: (1) Claude no está disponible o la dueña te lo pide, (2) los 3 trabajos de CI están en verde en el **último commit** de `nexora-cloud` (`verify`, `windows-installer`, `render-images`) y (3) la dueña dice «despliega» en esa conversación.
Orden: API primero, esperar «Live», revisar migraciones aplicadas y `/api/health` → `ok`; luego la web. **Antes y después**: foto del inventario y de ventas, y compara: no debe haber diferencias que el despliegue no explique. Si algo sale mal, restaura el despliegue anterior y avisa.

## 8. Estado al 14-oct-2026 (noche)

- **Ya en producción:** nombre completo en las tarjetas del POS, columna Cliente, corrección de referencia de transferencia (3aa).
- **En CI, por desplegar (rama `nexora-cloud`):** las cajeras no declaran transferencias (el sistema las suma); total de tarjeta distinto del sistema exige PIN de gerente; tres impresiones al cerrar caja; sin «Vale de caja» para cajeras; aviso del verifón; **correo** por cada cierre de caja y por cada solicitud de anulación (falta `RESEND_API_KEY` y `NOTIFY_EMAIL_TO` en Render; el correo de la dueña es marcos.feliz@gmail.com, con «z»).
- **Inventario de hoy:** conteo de maquillaje de Lisbeth aplicado (782 uds, 170 renglones, 24 productos nuevos 1648–1671 y Mota de Sarias 1672). 21 de esos productos **sin precio ni costo**. Detalle y pendientes de cantidad (Maybelline Vinyl/Matte Ink, L.A. Colors, Alikka Glitter) en `PENDIENTES-DUENA.md`.
- **Abiertos:** caja de Lizbeth Peguero (CCB5) abierta; Computadora 576E por aprobar; contraseña de Farianelis; Chaleco con Brasier XS/L por preguntar a Génesis; 9 productos con margen bajo (sin cambiar precios); WhatsApp (3ab) por decidir número y costo; lote 6 de publicidad; cuenta de envíos de Addison (3ac); impresora térmica de la laptop de Farianelis (ya imprime).
- **No empieces** código del Camino A ni del B sin permiso escrito de la dueña.

## 9. Primer mensaje que debes mandarle

Tres líneas: qué leíste, qué puedes hacer ya (según §0) y qué te falta que ella te dé. Nada más.
