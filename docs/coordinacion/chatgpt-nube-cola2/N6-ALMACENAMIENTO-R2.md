# N6 · Diseño para sacar fotos y comprobantes a Cloudflare R2

**Estado:** diseño terminado; **no implementado**

**Fecha:** 2026-10-26 (UTC)

**Base revisada:** `origin/nexora-cloud` en `a9123336ca4e1cf5882ec8f31557896119467628`

**Alcance:** código, esquema y documentación. No se consultó ni modificó la base de producción, no se crearon buckets, no se añadieron secretos y no se desplegó.

## 1. Decisión recomendada

Usar un bucket R2 **privado** y guardar en PostgreSQL solamente metadatos, el identificador del objeto y su suma SHA-256. La API de Nexora sigue siendo quien decide si una persona puede subir o leer cada archivo; conocer una clave de R2 nunca debe otorgar acceso.

**No construir otro almacén desde cero.** La rama `origin/producto-nexora` ya contiene PC-08/PC-04: una interfaz S3/local por tenant, claves validadas, nuevas escrituras externas, lectura compatible con bytes antiguos, cola durable de borrado, RLS y portabilidad. N6 debe convertir/configurar esa interfaz para R2 y completar sus huecos (inventario y backfill del legado, SHA-256 persistente, streaming, verificación, respaldo externo y operación), no crear un segundo mecanismo paralelo. Esa pieza todavía no está en `nexora-cloud`; por eso la sección 2 distingue el estado de la tienda del estado del producto.

La transición recomendada es:

1. conservar y endurecer el esquema aditivo de PC-08 y configurar un bucket privado;
2. transición por bandera con escritura externa y lectura compatible con la columna antigua;
3. migración idempotente de los objetos existentes, verificando cada SHA-256;
4. lectura desde R2 con retorno controlado al dato antiguo;
5. simulacro de respaldo/restauración y período de observación;
6. dejar de escribir binarios en PostgreSQL;
7. vaciar las columnas antiguas sólo cuando el manifiesto marque 100 %, no haya errores y existan dos respaldos restaurables.

No recomiendo un cambio de una sola vez ni una doble escritura permanente. El código del producto ya reserva una eliminación antes de subir y la cancela al confirmar la transacción; debe mantenerse ese patrón. R2 y PostgreSQL no comparten transacciones: la transición necesita estados y reconciliación explícitos.

## 2. Cómo se guardan hoy

| Clase | Persistencia actual | Subida y lectura | Riesgo/observación |
|---|---|---|---|
| Evidencia de cobro | `Payment.proofUrl String?`, una `data:image/...;base64,...` dentro de PostgreSQL (`apps/api/prisma/schema.prisma:457-481`). | La API acepta JPG/PNG/WebP de hasta 2 MB, convierte todo el búfer a Base64 y actualiza el pago (`apps/api/src/sales.ts:118-131`, `apps/api/src/sales.ts:3500-3542`). La lectura vuelve a decodificarlo y responde con `private, no-store` (`apps/api/src/sales.ts:3544-3558`). | Base64 aumenta el tamaño aproximadamente 33 %. Una consulta descuidada puede llevar fotos grandes a memoria; por eso caja ya selecciona sólo columnas monetarias (`apps/api/src/cash.ts:55-73`). |
| Factura/documento de mercancía | `InvoiceAttachment.data Bytes` (`BYTEA`), con MIME, sucursal y usuario (`apps/api/prisma/schema.prisma:914-924`). `InvoiceDraft` y `GoodsReceipt` conservan `attachmentId` (`apps/api/prisma/schema.prisma:610-621`, `apps/api/prisma/schema.prisma:902-912`). | El importador admite hasta 5 MB, procesa imagen/PDF/XLSX/CSV y crea el adjunto y el borrador en una transacción (`apps/api/src/merchandise.ts:194-225`, `apps/api/src/merchandise.ts:253-328`). La descarga filtra por `branchId` y permiso de inventario (`apps/api/src/merchandise.ts:179-193`). | Las recepciones protegen su adjunto con FK `RESTRICT`. Los adjuntos huérfanos de más de 14 días se purgan, pero los ligados a una recepción no (`apps/api/src/retention.ts:32-36`, `apps/api/src/retention.ts:189-204`). |
| Logo del negocio | Data URL dentro de `Settings.data` JSON (`apps/api/prisma/schema.prisma:810-814`). | Hasta 200 KB; se valida por bytes reales y se vuelve a insertar como Base64 en el JSON (`apps/api/src/admin.ts:109-122`, `apps/api/src/admin.ts:897-930`). El PDF vuelve a convertir el Base64 a `Buffer` (`apps/api/src/receipt-pdf.ts:121-140`). | No tiene FK ni metadatos independientes. Además, la impresión PDF actual sólo decodifica PNG/JPEG aunque la subida también acepta WebP/GIF; la migración no debe “convertir” formatos silenciosamente. |
| Foto de producto | `Product.imageUrl String?` (`apps/api/prisma/schema.prisma:93-103`). | El formulario acepta una cadena de hasta 1,000 caracteres (`apps/api/src/catalog.ts:175-190`) y la interfaz la usa directamente. | Es una referencia externa, no un binario controlado por Nexora. Puede caducar, rastrear al usuario o desaparecer. Debe importarse a R2 sólo con una decisión explícita y descarga segura contra SSRF; no se incluye automáticamente en el primer backfill. |
| Comprobante de gasto | `Expense.receiptUrl String?` (`apps/api/prisma/schema.prisma:727-744`). | Hoy es una URL de texto de hasta 1,000 caracteres (`apps/api/src/admin.ts:675-719`); la pantalla pide “URL del comprobante” (`apps/web/src/Management.tsx:1517`). | Tampoco es un archivo en la base. Mantenerla como URL externa inicialmente; una fase posterior puede reemplazar el campo por subida administrada a R2. |

La bitácora ya elimina las imágenes de sus copias (`apps/api/src/common.ts:330-365`). La anonimización de una clienta pone `Payment.proofUrl` en `null` porque la imagen puede contener nombre y cuenta bancaria (`apps/api/src/admin.ts:437-453`). El diseño nuevo tiene que conservar ambas propiedades: no duplicar el contenido en auditoría y borrar también el objeto externo.

### Trabajo existente en `origin/producto-nexora` que N6 debe reutilizar

- `tenant-object-store.ts` ya define `put`, `putNew`, `get` y `delete`, y separa cada clave con el UUID del tenant (`apps/api/src/tenant-object-store.ts:8-25` en `origin/producto-nexora`). Tiene implementación local para pruebas y S3 compatible para producto (`apps/api/src/tenant-object-store.ts:28-103`). R2 entra por esa interfaz mediante endpoint S3; no hace falta otra abstracción.
- Las nuevas evidencias de pagos del producto se escriben fuera de PostgreSQL y `proofUrl` conserva una referencia `object:v1`; la lectura mantiene compatibilidad con Base64 antiguo (`apps/api/src/sales.ts:3335-3405` en `origin/producto-nexora`).
- Las nuevas facturas de mercancía guardan `objectKey` y `data=null`, pero aún leen `data` legado (`apps/api/src/merchandise.ts:183-200`, `apps/api/src/merchandise.ts:296-359` en `origin/producto-nexora`).
- `TenantObjectDeletion` reserva y reintenta borrados por tenant; el worker no expone el detalle del proveedor en logs (`apps/api/src/tenant-object-deletion.ts:6-40`, `apps/api/src/tenant-object-deletion.ts:43-76` en `origin/producto-nexora`). La migración habilita RLS y disparadores para referencias retiradas (`apps/api/prisma/migrations/202610280007_product_objects/migration.sql:16-67` en `origin/producto-nexora`).
- La copia por empresa ya descubre las referencias, incluye los bytes con SHA-256 y usa una transacción `REPEATABLE READ` (`apps/api/src/tenant-object-portability.ts:4-57`, `apps/api/src/tenant-backup.ts:168-203` en `origin/producto-nexora`). Esto es una buena base de portabilidad, pero no sustituye una copia secundaria diaria del bucket ni evita cargar cada objeto completo en memoria/Base64.

Huecos comprobados que este plan completa: `put/get` reciben/devuelven `Buffer` completo; no hacen streaming ni `HEAD`; el objeto vivo no guarda SHA-256 verificable como metadato; las claves sólo admiten `payment|billing|invoice`; PC-08 migra **nuevas** escrituras, no trae un backfill de todos los bytes existentes; y la cola considera exitoso `delete` sin una comprobación posterior. Referencias: `apps/api/src/tenant-object-store.ts:11-17,66-90` y comentario de la migración `apps/api/prisma/migrations/202610280007_product_objects/migration.sql:1-13`, ambos en `origin/producto-nexora`.

### Alcance inicial de la migración

Se migran primero:

- todas las evidencias válidas de `Payment.proofUrl`;
- todos los `InvoiceAttachment.data`;
- el logo Base64 de cada `Settings`.
- en el producto, cualquier `BillingRequest.proof` legado todavía sin `proofObjectKey` (`apps/api/prisma/schema.prisma:1453-1476` en `origin/producto-nexora`).

No se descargan automáticamente `Product.imageUrl` ni `Expense.receiptUrl`. Primero se inventarían y clasificarían por `https`, dominio, disponibilidad y propiedad; mover contenido de terceros sin autorización puede infringir licencias o abrir una vía SSRF.

## 3. Modelo de metadatos propuesto

No reemplazar `InvoiceAttachment.objectKey`, `BillingRequest.proofObjectKey`, la referencia `object:v1` de pagos ni `TenantObjectDeletion`, que ya existen en el producto (`apps/api/prisma/schema.prisma:1145-1177`, `apps/api/prisma/schema.prisma:1453-1476` en `origin/producto-nexora`). Agregar una tabla compañera equivalente a `TenantObjectMetadata` (nombre por confirmar) para que toda referencia viva tenga integridad y estado verificables:

| Campo | Propósito |
|---|---|
| `id UUID` | Identificador interno estable. |
| `tenantId UUID` | Dueño del objeto. Es obligatorio en el producto multiempresa. |
| `branchId` | Sucursal dentro de la empresa, cuando aplique. |
| `kind` | `payment-proof`, `supplier-document`, `business-logo`, luego `product-image` o `expense-receipt`. |
| `bucket`, `objectKey` | Ubicación; clave única. No guardar una URL pública. |
| `contentType`, `byteSize`, `sha256` | Validación, respuesta HTTP e integridad. `sha256` debe ser 64 hexadecimales y único por fuente, no necesariamente global. |
| `status` | `uploading`, `ready`, `delete_pending`, `deleted`, `failed`. Sólo `ready` se sirve. |
| `sourceType`, `sourceId` | Trazabilidad e idempotencia del backfill. Restricción única `(tenantId, sourceType, sourceId)`. No reemplaza las FKs/reglas de los modelos actuales. |
| `createdBy`, `createdAt`, `verifiedAt`, `deletedAt` | Auditoría sin copiar el contenido. |

Evolución aditiva sugerida sobre las referencias ya existentes:

- mantener por compatibilidad `Payment.proofUrl = object:v1:...`; evaluar una FK `proofObjectId` sólo en una migración posterior, no como requisito para R2;
- mantener `InvoiceAttachment.objectKey` y `data` nullable, que PC-08 ya creó;
- mantener `BillingRequest.proofObjectKey` y `proof` nullable;
- una tabla `BusinessAsset` para `logoObjectId` en vez de esconder una FK dentro de `Settings.data`;
- más adelante, `Product.imageObjectId` y `Expense.receiptObjectId`, conservando las URLs antiguas durante la transición.

La arquitectura del producto distingue `Tenant` de `branchId`: todas las tablas de negocio deberán llevar `tenantId`, mientras las sucursales quedan dentro de la empresa (`docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md:12-15`). La rama revisada todavía usa `branchId` como cerrojo operativo —por ejemplo, al descargar facturas (`apps/api/src/merchandise.ts:187-192`) y pruebas de pagos (`apps/api/src/sales.ts:3560-3577`)—. Por ello, la implementación para el SaaS debe enlazar el objeto al `tenantId` real; no debe equiparar para siempre “empresa” y `branchId`.

## 4. Bucket y claves por empresa

Usar buckets distintos por entorno, nunca prefijos compartidos entre producción y pruebas:

```text
nexora-files-prod
nexora-files-staging
nexora-files-ci
```

Conservar el formato que PC-08 ya valida, siempre con identificadores opacos generados por el sistema (`apps/api/src/tenant-object-store.ts:8-25` en `origin/producto-nexora`):

```text
{tenantUuid}/{kind}/{objectUuid}
```

Ejemplo ficticio:

```text
8c.../payment/77...
```

Reglas:

- nunca incluir nombre del negocio, cliente, RNC, teléfono, número de factura, referencia bancaria ni nombre original del archivo;
- no aceptar una clave suministrada por el navegador;
- una sustitución crea una clave nueva e inmutable; nunca sobrescribe la anterior;
- conservar MIME en la referencia/metadatos; la clave actual no necesita extensión y evita confiar en el nombre;
- el prefijo ayuda a operar y borrar por empresa, pero **no es control de acceso**;
- ampliar `kind` sólo mediante migración de regex, portabilidad y pruebas coordinadas; hoy admite `payment`, `billing` e `invoice`;
- el bucket permanece privado. No usar `r2.dev` ni dominio público para estos documentos.

## 5. Variables y credenciales

Reutilizar los nombres que ya consume PC-08 para no crear dos configuraciones. Variables propuestas, sólo en el servicio de API y en el ejecutor de migración:

```text
PRODUCT_OBJECT_BUCKET=
PRODUCT_OBJECT_REGION=auto
PRODUCT_OBJECT_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PRODUCT_OBJECT_PRESIGNED_GET_TTL_SECONDS=60
PRODUCT_OBJECT_UPLOAD_TIMEOUT_MS=30000
PRODUCT_OBJECT_MIGRATION_BATCH_SIZE=100
PRODUCT_OBJECT_LEGACY_READ_FALLBACK=true
```

`AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` son los nombres estándar que usa el SDK S3; para este servicio contendrían las credenciales R2 y son secretos: no se envían a la web, no se imprimen y no entran al repositorio. `PRODUCT_OBJECT_BUCKET`, `PRODUCT_OBJECT_REGION` y `PRODUCT_OBJECT_ENDPOINT` ya son leídos por `tenantObjectStore()` (`apps/api/src/tenant-object-store.ts:93-103` en `origin/producto-nexora`). Crear tokens separados:

1. **API:** lectura y escritura de objetos sólo en el bucket del entorno;
2. **backfill:** temporal, mismo bucket, revocado al terminar;
3. **respaldo:** lectura del origen y escritura en un bucket/cuenta de respaldo, sin permiso para borrar el origen;
4. **restauración:** credencial temporal aprobada para el simulacro o incidente.

Cloudflare permite limitar tokens de lectura o lectura/escritura a buckets concretos. No dar permisos administrativos de cuenta a la aplicación. Rotar claves y probar la anterior revocada antes de cerrar el cambio.

## 6. Subida y lectura seguras

### 6.1 Subida

Para los tamaños actuales (200 KB, 2 MB y 5 MB), la primera versión debe recibir el archivo por la API y transmitirlo a R2; así conserva las autorizaciones y validaciones existentes. El flujo es:

1. autenticar y autorizar la operación (`tenantId`, sucursal, permiso y propiedad de la entidad);
2. reservar la clave final nueva en la cola ya existente y crear metadatos con estado `uploading`;
3. aplicar límite de bytes durante el stream, no sólo confiar en `Content-Length`;
4. detectar el tipo por magic bytes. Conservar las listas actuales: evidencia JPG/PNG/WebP; factura según el importador; logo según decisión explícita;
5. calcular SHA-256 y tamaño mientras se transmite;
6. subir por HTTPS con `Content-Type` ya normalizado, metadatos mínimos (`object-id`, `sha256`, `tenant-id` opaco) y sin PII;
7. verificar con `HEAD` tamaño y metadatos y, para el backfill, leer el objeto para recalcular SHA-256;
8. en una transacción PostgreSQL, marcarlo `ready` y enlazar la entidad;
9. si la transacción falla, conservar la reserva para que el reconciliador elimine el objeto; si la subida falla, marcar `failed` y no cambiar la entidad. PC-08 ya aplica esta reserva/cancelación en pagos y facturas (`apps/api/src/sales.ts:3352-3386`, `apps/api/src/merchandise.ts:301-358` en `origin/producto-nexora`).

No usar el ETag como prueba universal de igualdad: los objetos multipart tienen semántica distinta. La fuente de verdad de integridad será SHA-256 calculado por Nexora.

Una segunda versión puede usar `PUT` prefirmado directamente desde el navegador, pero sólo mediante dos endpoints: `iniciar` entrega una URL de 60 segundos para una clave, MIME y tamaño exactos; `finalizar` hace `HEAD`, valida SHA-256/tamaño y enlaza la entidad. Las URLs prefirmadas pueden reutilizarse hasta vencer, así que no sustituyen estados, idempotencia ni verificación final. CORS se limitaría al origen web de Nexora y a `PUT`, `GET`, `HEAD`; nunca `*` con credenciales.

### 6.2 Lectura

Mantener los endpoints actuales. La API:

1. busca la entidad con `tenantId` y `branchId` del actor;
2. aplica el permiso y la propiedad actuales;
3. obtiene el objeto `ready`;
4. transmite el contenido desde R2 con `Content-Type` de metadatos, `Content-Disposition` seguro y `Cache-Control: private, no-store`.

Como optimización posterior, la API podría devolver una URL GET prefirmada de 60 segundos después de autorizar. No guardar esa URL en PostgreSQL, logs, historial del navegador ni mensajes. Para comprobantes sensibles prefiero el proxy de la API: permite revocación inmediata y deja una bitácora central de acceso.

Defensas obligatorias: límites de concurrencia y tiempo, abortar streams incompletos, no seguir redirecciones al tratar URLs antiguas, protección SSRF, nombres de descarga fijos, `nosniff`, y nunca incluir el binario o una URL firmada en `AuditLog`, Sentry o avisos.

R2 cifra objetos y metadatos en reposo con AES-256 y el tránsito con TLS; eso no reemplaza los permisos de la aplicación ni el control de copias descargadas.

## 7. Migración de existentes sin pérdida

### Fase 0 · Inventario de sólo lectura

Sobre una copia descartable, no producción, generar por empresa y tipo:

- cantidad y bytes decodificados de `Payment.proofUrl` válidos e inválidos;
- cantidad, `sum(octet_length(data))` y MIME de `InvoiceAttachment`;
- logos presentes y formato real;
- cantidad de URLs externas de producto y gasto, agrupadas por dominio sin guardar rutas ni parámetros sensibles;
- referencias rotas (`attachmentId` sin fila, objeto sin borrador/recepción) y duplicados por SHA-256.

El resultado debe ser un manifiesto sin contenido ni PII: fuente, ID, tamaño, MIME, SHA-256, destino, estado e intento. No copiar datos reales a CI.

### Fase 1 · Cambio aditivo y lectura compatible

- Agregar metadatos de integridad sin reemplazar las referencias y cola de PC-08.
- Nuevas subidas: R2 primero; cuando esté verificado, enlazar el puntero. Mantener las filas antiguas sin puntero intactas; no es necesario duplicar cada archivo nuevo en PostgreSQL porque el código ya falla cerrado y reserva su limpieza.
- Lecturas: dato antiguo por defecto mientras se prueba R2; habilitación por empresa mediante bandera.
- Métricas: subidas, huérfanos, divergencias de SHA, latencia, retornos al legado y errores por tipo.

### Fase 2 · Backfill idempotente

Procesar lotes pequeños con una restricción única por fuente. Para cada fila:

1. bloquear o tomar una instantánea de la versión actual; incluir `Payment.proofUrl`, `InvoiceAttachment.data` y `BillingRequest.proof` legados;
2. decodificar/leer, validar bytes y calcular SHA-256;
3. si el manifiesto ya tiene `ready` con el mismo hash, no volver a subir;
4. subir con clave inmutable, descargar y comparar hash y tamaño;
5. enlazar sólo con actualización condicional: la columna antigua debe conservar el hash observado. Si alguien sustituyó la foto durante el backfill, abandonar ese intento y procesar la versión nueva;
6. registrar éxito o error sanitizado y continuar; un archivo corrupto no detiene todo el lote.

No deduplicar físicamente entre empresas. Aunque dos objetos tengan el mismo hash, cada empresa debe tener su propia clave y ciclo de borrado para evitar referencias cruzadas y filtraciones por existencia.

### Fase 3 · Lectura R2 y comprobación

Activar por empresa:

- si el puntero `ready` funciona, servir R2;
- si R2 falla y todavía existe el legado, servirlo, emitir alerta y contar el retorno;
- si ambos faltan, responder error explícito; nunca una imagen de otra empresa.

Requisitos antes de continuar: 100 % de fuentes clasificadas, 100 % de objetos migrados o excepciones aprobadas, cero diferencias de SHA/tamaño, cero referencias cruzadas y 14–30 días sin retorno al legado (plazo final por decidir).

### Fase 4 · Corte y limpieza

1. simulacro completo de restauración;
2. respaldo coherente de base + manifiesto + objetos;
3. desactivar escritura antigua, mantener lectura de retorno;
4. observar al menos otro ciclo de respaldo;
5. limpiar Base64/BYTEA por lotes con auditoría de conteos, nunca con una sentencia masiva sin control;
6. retirar el retorno sólo en una versión posterior.

Rollback antes de la limpieza: desactivar la bandera y leer lo antiguo. Después de la limpieza: restaurar el conjunto coherente base + objetos, no sólo `pg_dump`.

## 8. Respaldo y restauración

Hoy `pg_dump` incluye los binarios. Después del corte, una copia de PostgreSQL sola quedaría incompleta. Cada ejecución diaria debe producir un **conjunto** con un mismo `backupId` y hora de corte:

1. dump cifrado de PostgreSQL y su SHA-256;
2. manifiesto de referencias vivas y `TenantObjectMetadata`: tenant, clave, versión si existe, tamaño, MIME y SHA-256;
3. copia de los objetos a un bucket de respaldo en otra cuenta o, preferiblemente, a otro proveedor/región para evitar un único punto de fallo;
4. manifiesto final firmado o autenticado que enlaza los tres componentes;
5. verificación diaria de conteos/bytes y muestreo de descarga; verificación completa periódica.

R2 primario no es por sí solo un respaldo. Una credencial equivocada, borrado lógico o compromiso de cuenta puede afectar todo. La credencial de respaldo no debe poder borrar el origen y la de producción no debe borrar el respaldo. Configurar alarmas de antigüedad, objetos faltantes, diferencias de hash, cuota y factura.

### Restauración probada

Mensualmente, en tenant/base/bucket aislados:

1. elegir un `backupId` cerrado;
2. restaurar PostgreSQL en una base vacía;
3. restaurar o montar la copia exacta de objetos;
4. recorrer todos los punteros vivos y comprobar existencia, tamaño y SHA-256 por streaming;
5. comprobar que no existen objetos de otro tenant bajo el prefijo restaurado;
6. abrir una evidencia, una factura PDF/imagen/XLSX/CSV y el logo mediante la API con un rol permitido;
7. probar denegación con otro tenant y rol sin permiso;
8. registrar duración, RPO, RTO, conteos y hashes; destruir el entorno aislado.

No declarar el respaldo válido sólo porque `HEAD` responde. La prueba de no pérdida requiere leer bytes y comparar SHA-256. Antes del corte final, el conteo por fuente, metadatos, manifiesto y objetos restaurados debe coincidir exactamente.

## 9. Borrado, retención y privacidad

R2 no participa en la transacción de anonimización. Crear una `ObjectDeletionOutbox` dentro de la misma transacción que quita el puntero; un trabajador idempotente borra el objeto, comprueba que dejó de existir y marca `deleted`. Si R2 no responde, el pedido queda visible y reintenta con alerta; nunca se marca completado antes.

Casos:

- **Anonimización de cliente:** mantener el `proofUrl=null` actual de `apps/api/src/admin.ts:437-453`; el disparador que PC-08 ya pone sobre `Payment.proofUrl` debe encolar la referencia `object:v1` retirada (`apps/api/prisma/migrations/202610280007_product_objects/migration.sql:39-67` en `origin/producto-nexora`). No esperar a una regla de ciclo de vida.
- **Borrador de factura vencido:** conservar la regla actual: sólo borrar si ningún borrador ni recepción usa el adjunto (`apps/api/src/merchandise.ts:72-102`, `apps/api/src/retention.ts:189-204`). Primero quitar referencia/crear outbox; luego R2.
- **Reemplazo de logo o foto:** enlazar el nuevo objeto y encolar el anterior después del commit. Una espera corta permite rollback, salvo una solicitud de privacidad.
- **Baja de empresa:** exportación y plazo contractual primero; luego borrar todos los objetos del tenant y verificar el inventario vacío. No reutilizar su prefijo.
- **Respaldos:** documentar cuánto tardan en expirar copias borradas y cómo se atiende una solicitud de eliminación. La retención fiscal/contable de facturas debe validarla el abogado/contador; no asumir que autoriza guardar indefinidamente evidencia bancaria.

Las reglas de Bucket Lock tienen prioridad sobre Lifecycle. Por eso no se debe aplicar una retención inmutable larga al bucket primario de evidencias personales: impediría cumplir un borrado válido. Si se usa lock en respaldos, separar clases y documentar legalmente el plazo. Las reglas Lifecycle pueden tardar normalmente hasta 24 horas en retirar el objeto vencido; el borrado solicitado debe usar la API y verificarse.

Mantener un registro sin PII de `requestedAt`, `deletedAt`, objeto, tenant, motivo normalizado y resultado. No conservar el hash como medio para reconstruir o correlacionar información entre tenants más allá del período operativo necesario.

## 10. Costos aproximados

Precios oficiales consultados el 2026-10-26 para **R2 Standard**:

- almacenamiento: **US$0.015/GB-mes**;
- operaciones Class A (escritura/listado): **US$4.50 por millón**;
- operaciones Class B (lectura): **US$0.36 por millón**;
- salida de datos a Internet: sin cargo de egress de R2;
- nivel gratis mensual de Standard: 10 GB-mes, 1 millón Class A y 10 millones Class B.

Ejemplo meramente dimensional, no una factura: 100 negocios con 2 GB cada uno son 200 GB; descontando 10 GB gratis, el almacenamiento sería aproximadamente **US$2.85/mes**, antes de impuestos y sin incluir API/Render, copias secundarias, Workers ni operaciones que excedan el nivel gratis. Un respaldo completo duplicado duplica aproximadamente los GB almacenados. El precio real se calcula con el inventario de Fase 0 y se revisa antes de contratar.

No usar Infrequent Access de inicio: añade cargo de recuperación y duración mínima de almacenamiento. Standard simplifica comprobantes que se consultan y borran de forma irregular.

## 11. Riesgos y controles

| Riesgo | Control requerido |
|---|---|
| Fuga entre empresas | `tenantId` obligatorio en metadatos y consultas; autorización antes de firmar/servir; pruebas cruzadas; credenciales nunca en navegador. El prefijo no basta. |
| Base enlaza un objeto no subido | Estado `uploading/ready`, `HEAD` + SHA antes de enlazar y reconciliador. |
| R2 guarda objeto huérfano tras rollback SQL | Claves inmutables, estado reservado y barrido de `uploading` sin referencia tras un margen seguro. |
| Sustitución durante backfill | Hash de origen y actualización condicional; reintentar la versión nueva. |
| Corrupción silenciosa | SHA-256 del contenido de origen, descarga y respaldo; no confiar sólo en ETag. |
| URL prefirmada filtrada o reutilizada | TTL 60 s, `no-store`, alcance de un objeto, HTTPS, sin logs; preferir proxy para evidencia sensible. |
| SSRF al importar URLs actuales | No importarlas en N6; fase separada con DNS/IP denylist, límite, timeout, sin redirecciones y descarga aislada. |
| Borrado en DB pero no en R2 | Outbox transaccional, reintentos, alerta y verificación de inexistencia. |
| Bucket Lock impide privacidad | No bloquear por largo plazo el primario; política por clase y revisión legal. |
| Caída de R2 detiene operaciones | Subida falla cerrada sin perder el archivo antiguo durante transición; lecturas usan retorno legado temporal. Tras el corte, cola/reintento y mensaje claro, no guardar otra vez Base64 sin límite. |
| Costo u operaciones disparadas | Topes por tipo/tenant, presupuestos y alertas; métricas de bytes, Class A/B y huérfanos. |
| Restaurar sólo PostgreSQL | Herramienta exige manifiesto y objetos del mismo `backupId`; validación completa antes de habilitar la API. |
| Malware/documentos hostiles | Magic bytes, límites, parser aislado y las defensas existentes de XLSX; considerar escaneo antes de `ready`. Nunca renderizar HTML/SVG subido. |

## 12. Plan de pruebas de no pérdida

### Contrato y unidad

- generación de claves sin PII, `..`, barras de usuario ni colisiones;
- lista blanca de MIME/magic bytes y límites exactos (0, máximo y máximo + 1);
- SHA-256 conocido para cada formato;
- reemplazo crea clave nueva;
- sanitización de nombres, logs y errores;
- URLs firmadas con TTL máximo y sin credenciales persistidas.

### Integración con PostgreSQL + bucket R2 de pruebas

- subida exitosa enlaza sólo un objeto `ready`;
- fallo antes/después de `PUT`, `HEAD` o commit no pierde el legado y deja un estado reconciliable;
- reintento con la misma fuente no duplica;
- dos tenants con UUID conocidos no pueden leer, enumerar, sustituir ni borrar objetos del otro;
- rol sin permiso recibe 403; rol permitido obtiene exactamente MIME, tamaño y SHA esperados;
- anonimización crea la orden de borrado en el mismo commit; caída de R2 reintenta; éxito termina en inexistencia comprobada;
- purga respeta adjuntos de `GoodsReceipt` y elimina sólo huérfanos;
- la API no devuelve Base64 en listados y mantiene `private, no-store`.

### Backfill adversario

- Base64 inválido, MIME declarado distinto, `BYTEA` vacío, duplicados, fila reemplazada durante migración y corte de red;
- ejecutar el backfill dos veces produce los mismos punteros y conteos;
- comparar para **cada** objeto origen y destino: ID, tamaño y SHA-256;
- total clasificado = migrado + excepción documentada; nunca “saltado” sin estado;
- lote grande no retiene bloqueos ni carga todos los binarios en memoria.

### Respaldo/restauración y salida

- restaurar el conjunto en un entorno vacío y verificar el 100 % de hashes;
- abrir por la API al menos un archivo de cada tipo;
- simular pérdida de base, pérdida del bucket primario y clave revocada;
- medir RPO/RTO y confirmar que el procedimiento no requiere producción;
- prueba de salida del proveedor: exportar todos los objetos y manifiesto con hashes a almacenamiento alterno.

### Puertas para el corte

No limpiar datos antiguos hasta que se cumplan simultáneamente:

- 100 % del manifiesto resuelto;
- cero diferencias de hash/tamaño;
- cero lecturas cruzadas en pruebas;
- cero retorno al legado durante el período acordado;
- dos respaldos consecutivos verificados;
- una restauración completa aprobada;
- alarma y procedimiento de borrado ensayados;
- revisión de privacidad/retención por abogado o responsable designado.

## 13. Orden futuro de implementación

1. decisión de retención por clase y responsable legal;
2. bucket privado, tokens mínimos, presupuesto y alertas;
3. cliente de almacenamiento y tabla aditiva;
4. pruebas de autorización/fallos antes de conectar endpoints;
5. escritura externa, lectura compatible y observabilidad por bandera;
6. inventario y backfill en copia; luego ejecución controlada;
7. lectura R2 por tenant y período de observación;
8. respaldo/restauración integral;
9. limpieza por lotes y retiro posterior del legado.

**Decisiones que necesita la dueña/Claude antes de implementar:** plazo de conservación de cada clase; si fotos de productos y comprobantes de gastos externos pasan a ser archivos administrados; región/jurisdicción requerida; RPO/RTO; proveedor/cuenta del respaldo secundario; y duración del retorno de lectura al legado.

## 14. Fuentes oficiales de Cloudflare

Consultadas el **2026-10-26**:

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/) — tarifas, nivel gratis, egress e Infrequent Access.
- [Authentication](https://developers.cloudflare.com/r2/api/tokens/) — tokens S3 y alcance por bucket.
- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — operaciones, expiración, reutilización hasta vencer y CORS.
- [Data security](https://developers.cloudflare.com/r2/reference/data-security/) — AES-256 en reposo y TLS en tránsito.
- [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/) y [Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) — multipart, ETag y checksums.
- [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/) — retención y precedencia sobre Lifecycle.
- [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) — expiración y ventana de eliminación.
- [Limits](https://developers.cloudflare.com/r2/platform/limits/) — tamaños máximos de objeto y metadatos.
- [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) — los buckets no son públicos por defecto; este diseño prohíbe habilitarlos.

Los precios y capacidades pueden cambiar; deben volver a verificarse antes de implementar o contratar.
