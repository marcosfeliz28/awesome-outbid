# Fase 0 del producto Nexora — aislamiento inicial (19 de octubre de 2026)

Esta rama parte de `origin/nexora-cloud` y se destina **solo a una base nueva del producto**. No aplicar su migración a la base de la tienda ni copiar datos de Grupo Macgen. El blueprint `render.producto.yaml` es una propuesta separada; no se ha sincronizado con Render.

## Esquema y activación

- La migración `202610260001_product_tenant` crea `Tenant` y agrega `tenantId` a 58 tablas preexistentes. Las filas ya presentes en **la base nueva de pruebas** quedan asociadas al tenant demo con ID `00000000-0000-0000-0000-000000000001`.
- Antes del **primer** `preDeployCommand`, un administrador de la **base nueva del producto** ejecuta una sola vez `psql -X -v ON_ERROR_STOP=1 -f scripts/producto-bootstrap.sql` con su conexión administrativa local a esa base. El script crea `nexora_tenant_runtime` sin login, concede su membresía a `nexora_saas_migrator` y devuelve una fila de verificación. No copiar la conexión ni ejecutar el script contra la base de la tienda. La configuración exacta está en `render.producto.yaml`; este paso queda para Claude y no se ha aplicado en Render.
- Cada consulta de `Database` usa una transacción, cambia con `SET LOCAL ROLE nexora_tenant_runtime` y fija `app.tenant_id` con `set_config(..., true)`. RLS compara esa variable con `tenantId`; el valor no sobrevive al fin de la transacción. La guardia de autenticación exige que el tenant firmado en el JWT corresponda al de la consulta y al usuario.
- Las altas anidadas usan un trigger que asigna el tenant de la transacción; los triggers de referencias cruzadas rechazan enlaces de una empresa a filas de otra. La tabla `Tenant` solo permite lectura de la empresa actual con el rol de ejecución.
- La API debe arrancar con `PRODUCT_TENANCY=required`. Así verifica el rol RLS al iniciar y rechaza toda consulta de negocio sin `tenantScope`. El login recibe el **código público** de la empresa en `x-tenant-id`, que resuelve al UUID interno; el refresh usa una cookie de selección y la identidad sigue dependiendo de credenciales/sesión y firma válida. El producto todavía no tiene registro público de empresas (fase 1).
- Las claves funcionales, incluidos números de factura y recibo, quedan limitadas por empresa mediante índices compuestos. Los trabajos de notificación, recordatorio de crédito y retención recorren las empresas activas con contexto aislado. El respaldo completo con `pg_dump` sigue deshabilitado: un respaldo por empresa es trabajo de fase 1.

## Límites que impiden lanzar el producto aún

1. La orden exige una matriz de aislamiento con **cada ruta**, informes y exportaciones. La prueba actual verifica el esquema completo y rutas representativas, y ejercita los 40 informes JSON, pero falta cubrir todas las rutas de escritura, archivos y exportaciones. Una respuesta 400/404 de un cuerpo inválido no se contará como cobertura.
2. Falta definir copias de seguridad y restauración **por tenant**, registro/alta de empresa y manejo de plan/estado.
4. Validar migración y arranque con el usuario real de una **base nueva y vacía** de Render; aquí se usó PostgreSQL embebido. El blueprint no se aplica hasta que Claude lo revise. No existe validación sobre una base de producción.

## Cómo repetir la prueba local

`pnpm check` ejecuta `tests/product-tenants-postgres.test.ts`. La prueba levanta PostgreSQL descartable, aplica todas las migraciones y verifica RLS en las 58 tablas; crea dos tenants ficticios y llama a una API Nest de prueba. No usa contraseñas ni información de la tienda.

El siguiente incremento debe ampliar la matriz con casos válidos por endpoint y exigir **0 fugas** antes de declarar la puerta de fase 0 superada. El aislamiento SQL estructural ayuda a proteger las rutas restantes, pero no reemplaza esa matriz.
