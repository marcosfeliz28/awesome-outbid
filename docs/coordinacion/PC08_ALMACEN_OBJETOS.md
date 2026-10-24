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
  prefijo `<tenantId>/`; la API cifra nuevos objetos con SSE-S3 (`AES256`).
- Sólo bajo `NODE_ENV=test` se usa carpeta local: `PRODUCT_OBJECT_STORE_DIR` o
  un directorio temporal del proceso. No existe fallback a disco local en
  producción: si falta el bucket, la carga falla cerrada con 503.
- La cola `TenantObjectDeletion` se llena transaccionalmente al reemplazar o
  borrar referencias, incluso por purga de borradores o anonimización. Su
  trabajador reintenta la eliminación física y considera empresas suspendidas.

## Puerta operativa

Una copia de PostgreSQL por sí sola **ya no es un respaldo completo**. Antes de
activar PC-08 en una empresa real, PC-06/PC-07 deben exportar y restaurar los
objetos privados junto a las filas, probarlo con una base y bucket descartables,
y definir retención/cifrado/políticas del bucket. No migrar bytes legados ni
apuntar estas variables al almacenamiento de la tienda sin auditoría separada.
