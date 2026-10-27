# Verificación de Fase 3 — 27-oct-2026

Base verificada: `producto-nexora` `c0945874`. Alcance de solo lectura y pruebas; sin desplegar ni modificar Render, bases compartidas o credenciales.

## Resultado

- **Registro público:** permanece cerrado por defecto. La API exige simultáneamente `PRODUCT_TENANCY=required` y `PRODUCT_PUBLIC_REGISTRATION=enabled`; la web exige el mismo doble opt-in mediante sus variables de compilación. Sin la bandera, el alta devuelve 404 y no crea una empresa.
- **Planes y límites:** siguen definidos los cuatro planes y se aplican límites de usuarios, equipos, cajas simultáneas, sucursales y consultas de IA por empresa. No se cambiaron precios ni reglas de cobro.
- **Respaldo por empresa:** el respaldo lógico cifra una sola empresa, incluye sus objetos externos, rechaza tablas desconocidas y se restaura únicamente en una base local desechable y vacía. El archivo se publica de forma atómica y privada.

## Pruebas ejecutadas

- `tests/product-login-build.test.ts`: 3/3.
- `tests/product-billing-plans.test.ts`: 2/2.
- `tests/product-tenant-backup-file.test.ts`: 1/1.
- `tests/product-tenant-backup-postgres.test.ts`: 1/1 sobre PostgreSQL desechable.

## Límites y pendientes

- No se abrió el registro ni se cambió ninguna bandera de infraestructura.
- No se probó ni configuró un procesador de cobro real.
- La restauración operativa y la infraestructura pública siguen requiriendo autorización separada de la dueña y ejecución por quien administra el despliegue.
