# Nexora POS Local: instalación preliminar

Esta edición instala un servidor en una PC del negocio. Aún no está aprobada
para distribuir: falta el emisor cloud de licencias de PC-19, el respaldo externo (PC-20), la
firma del instalador (PC-17) y la prueba de compra y venta en Windows limpios
(PC-22).

## Para la persona que instala

1. Guarda los respaldos existentes de cualquier instalación anterior y cierra
   todas las cajas antes de actualizar.
2. Ejecuta `Nexora-POS-Local-Setup-<versión>.exe` como administrador.
3. Elige una contraseña nueva para la cuenta dueña y una carpeta de respaldos.
4. Al terminar, comprueba que la página abre desde la PC y desde un celular de
   la red. Haz una venta de prueba, imprímela y verifica el respaldo.

## Separación técnica

Esta edición usa `C:\Program Files\Nexora POS Local`,
`C:\ProgramData\Nexora POS Local`, servicios `NexoraLocalPostgreSQL`,
`NexoraLocalAPI` y `NexoraLocalWeb`, base y rol `nexoralocal`, PostgreSQL 5544,
API 4301 y web HTTPS 4473. El instalador heredado de la tienda utiliza otros
nombres, carpetas y puertos. La actualización guarda y verifica una copia antes
de migrar; si falla, intenta volver a la versión anterior. Los datos y respaldos
se conservan al desinstalar, salvo purga solicitada expresamente.

El código fuente de este perfil vive en `instalador/tools/product-local-profile.mjs`.
Se construye en Windows mediante `pnpm instalador:producto-local`. No se ha
probado aún una instalación real de este perfil.
