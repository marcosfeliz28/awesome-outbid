# PC-08 — objetos privados del producto

En `PRODUCT_TENANCY=required`, las nuevas evidencias de pago, pruebas de
transferencia de planes y facturas de proveedor se guardan fuera de PostgreSQL.
La base retiene sólo la clave del objeto, MIME y metadatos. Las rutas GET
autenticadas leen el objeto con el ID de empresa del actor; nunca se entrega
una URL pública o una clave de acceso. Los bytes históricos permanecen legibles
en sus columnas anteriores hasta una migración operativa aparte. La tienda
actual, sin modo producto, no cambia su escritura de evidencias.

## Configuración aislada

- Fuera de pruebas, `PRODUCT_OBJECT_BUCKET` y `PRODUCT_OBJECT_REGION` son
  obligatorios para nuevas cargas. `PRODUCT_OBJECT_ENDPOINT` es opcional para
  un proveedor S3 compatible. Las credenciales se obtienen por la cadena
  estándar del SDK; nunca se guardan en el repositorio.
- El bucket debe ser privado, con acceso mínimo a `PutObject`, `GetObject` y
  `DeleteObject` bajo el prefijo de este producto. Cada clave real tiene el
  prefijo `<tenantId>/`; en AWS la API cifra nuevos objetos con SSE-S3 (`AES256`).
- Sólo bajo `NODE_ENV=test` se usa carpeta local: `PRODUCT_OBJECT_STORE_DIR` o
  un directorio temporal del proceso. No hay disco local en producción.
- **Facturas de proveedor sin bucket (25-oct-2026):** si faltan
  `PRODUCT_OBJECT_BUCKET`/`PRODUCT_OBJECT_REGION`, la importación (CSV, Excel o
  foto con IA) ya no responde 503: guarda el archivo (≤ 5 MB) en la columna
  `InvoiceAttachment.data` de PostgreSQL, como la tienda. La comprobación va
  antes de llamar a la IA, así nunca se paga una extracción que luego falla.
  Las evidencias de pago y de planes siguen exigiendo bucket.
- **Cloudflare R2 (S3 compatible)**, variables en Render (servicio API):
  - `PRODUCT_OBJECT_BUCKET` = nombre del bucket privado
  - `PRODUCT_OBJECT_REGION` = `auto`
  - `PRODUCT_OBJECT_ENDPOINT` = `https://<ID_DE_CUENTA>.r2.cloudflarestorage.com`
  - `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` = el token de API de R2
    con permiso «Object Read & Write» limitado a ese bucket.
  Con endpoint propio no se envía `x-amz-server-side-encryption` (R2 cifra en
  reposo siempre); en AWS S3 sigue SSE-S3.
- La cola `TenantObjectDeletion` se llena transaccionalmente al reemplazar o
  borrar referencias, incluso por purga de borradores o anonimización. Su
  trabajador reintenta la eliminación física y considera empresas suspendidas.

## Puerta operativa

Una copia de PostgreSQL por sí sola **ya no es un respaldo completo**. Antes de
activar PC-08 en una empresa real, PC-06/PC-07 deben exportar y restaurar los
objetos privados junto a las filas, probarlo con una base y bucket descartables,
y definir retención/cifrado/políticas del bucket. No migrar bytes legados ni
apuntar estas variables al almacenamiento de la tienda sin auditoría separada.
