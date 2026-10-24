# Respaldo lógico por empresa (fase 1, punto 6)

`pnpm --filter @fitstore/api tenant:backup create <tenant-uuid> <archivo.nxtb>`
usa exclusivamente `TENANT_BACKUP_DATABASE_URL` y `BACKUP_ENCRYPTION_KEY`. No
acepta `DATABASE_URL` por defecto. El archivo temporal se protege antes de
escribirlo (ACL exacta y verificada para la cuenta actual, SYSTEM y
Administradores en Windows; modo 0600 en Unix). El nombre final se publica
sólo al terminar el cifrado mediante un enlace atómico y exclusivo, sin
sobrescribir una copia existente. Si el sistema de archivos no admite enlaces
duros o no puede verificarse la ACL, la operación falla sin publicar el archivo.
La copia parcial privada se elimina al terminar o fallar el proceso; tras un
corte de luz puede quedar un `.partial` cifrado en la carpeta de destino.
Nunca se imprime la frase ni la conexión.

Se recorren todas las tablas del esquema dentro de una transacción de lectura
repetible. `Tenant` se filtra por su `id`; todas las demás, por `tenantId`. El
inventario de tablas y columnas se compara con el cliente Prisma y falla si
aparece una tabla/columna no reconocida. La salida JSONL incluye metadatos,
filas en orden de dependencias y conteos; se cifra en flujo mediante el formato
NXBK existente (scrypt + AES-256-GCM). No se utiliza `pg_dump` completo.

La restauración es **sólo una comprobación local**, no una operación de
producción: `TENANT_RESTORE_DATABASE_URL` debe apuntar a `127.0.0.1` o `::1`,
la base debe tener un nombre que incluya un segmento `test`, `scratch` o
`disposable`, estar sin filas de negocio y el proceso no puede tener
`NODE_ENV=production`. Además requiere
`NEXORA_DISPOSABLE_RESTORE=RESTORE_TO_DISPOSABLE_TEST_DATABASE` y el comando
`pnpm --filter @fitstore/api tenant:backup restore <archivo.nxtb>`. Las
migraciones crean un tenant demo y datos iniciales: para probar la restauración
hay que usar una base exclusivamente descartable, migrarla y vaciar esas tablas
de muestra después de verificar que no contienen datos propios. **Nunca**
vaciar una base compartida o de tienda para esta prueba.

La restauración verifica el esquema y las etiquetas del cifrado; inserta todo
en una única transacción. Los triggers de aplicación se suspenden únicamente
en esa transacción para no duplicar almacenes, stock ni eventos, pero las
restricciones FK permanecen. Si hay corrupción, una fila ajena o una diferencia
de conteos, se revierte completamente. La prueba automatizada usa dos bases
PostgreSQL embebidas y comprueba aislamiento, centavos/decimales, JSON,
contraseña errónea, manipulación del archivo, esquema inesperado y rollback.

## Objetos externos (PC-08)

El formato cifrado `NXTB/2` incorpora los bytes de los comprobantes de pagos,
comprobantes de planes y facturas de proveedor que están fuera de PostgreSQL.
Cada objeto se coteja con las referencias de las filas, MIME, tamaño y SHA-256.
Si falta uno, se cancela el respaldo antes de publicar el archivo final.

La restauración sigue limitada a una base local desechable y vacía. Los objetos
se escriben sin sobrescribir claves existentes; un fallo de verificación o de
la transacción elimina los que esa restauración alcanzó a crear. No usar un
respaldo `NXTB/1` después de activar PC-08: sólo restaura filas, no objetos.

La exportación portátil PC-06 también incorpora estos bytes: `objects` en
JSON y la hoja `__objetos` (fragmentos Base64) en Excel. Ambos formatos
incluyen MIME y SHA-256 y se cancelan si falta cualquier archivo referenciado.
La exportación sirve para portabilidad y revisión; la única restauración
automatizada comprobada aquí es la del respaldo cifrado `NXTB/2`.
