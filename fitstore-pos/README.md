# FitStore POS

Aplicación de demostración de facturación e inventario para República Dominicana. React/TypeScript/Vite, NestJS, Prisma y PostgreSQL, con paquetes compartidos, PWA y cola de ventas en IndexedDB.

**Estado:** funciona localmente y compila para producción. La matriz de cobertura y las funciones todavía pendientes están en [docs/ENTREGA.md](docs/ENTREGA.md). No se ha publicado un servidor externo ni emitido un comprobante fiscal oficial.

## Ejecutar

Requiere Node.js 24 y pnpm 11.19.0. Desde la raíz:

```bash
pnpm install
cp .env.example .env
```

Reemplaza `JWT_SECRET` con un valor aleatorio de al menos 32 caracteres. La contraseña incluida en `.env.example` es sólo para datos ficticios.

En una terminal, inicia PostgreSQL local sin Docker:

```bash
pnpm db:local
```

En otra terminal:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abre **http://localhost:5173**. API: http://localhost:3001/api. Swagger: http://localhost:3001/api/docs.

También puedes usar un PostgreSQL existente y cambiar `DATABASE_URL`, omitiendo `db:local`. El seed no borra ni reemplaza datos existentes.

## Usuarios ficticios

Contraseña de todos: `FitStore-Demo-2026!`, salvo que cambies `SEED_DEMO_PASSWORD` antes del primer seed.

| Rol           | Correo                 | PIN de demostración |
| ------------- | ---------------------- | ------------------- |
| Administrador | admin@fitstore.demo    | 123456              |
| Gerente       | gerente@fitstore.demo  | 234567              |
| Vendedor      | vendedor@fitstore.demo | 345678              |
| Almacén       | almacen@fitstore.demo  | 456789              |

Incluye 60 productos, 228 variantes, cinco categorías, tres proveedores, 20 clientes y 848 ventas históricas ficticias. Las pruebas crean registros QA adicionales identificados y conservan los registros financieros.

Consulta también [las correcciones de Claude](docs/REVISION_CLAUDE.md).

## Verificar

```bash
pnpm check
pnpm test:integration # con la API y PostgreSQL iniciados
pnpm exec playwright install chromium
pnpm verify
```

`check`: TypeScript, ESLint, pruebas de fórmulas y compilación. `verify`: pruebas de API y navegador; inicia la API local cuando hace falta. Playwright inicia la PWA compilada en preview (4173) para verificar recargas offline; ejecuta `pnpm check` antes. `FITSTORE_WEB_URL` permite usar otro servidor de la PWA compilada. Los resultados y trazas aparecen en `test-results/` y `playwright-report/`. Los registros de la entrega están en `docs/validacion/`.

Para regenerar el ZIP fuente: `pnpm package:source`.

Para probar la PWA con su service worker, utiliza una compilación de producción:

```bash
pnpm build
pnpm --filter @fitstore/api start
pnpm --filter @fitstore/web preview
```

Abre http://localhost:4173. La cola de ventas en IndexedDB funciona durante una sesión sin conexión también en desarrollo; recargar completamente sin red requiere la PWA instalada/precargada.

## Estructura

```text
apps/web          React, PWA, pantallas y adaptadores nativos
apps/api          NestJS, permisos, operaciones financieras y reportes
apps/api/prisma   Esquema, migración versionada y datos ficticios
packages/shared   Contratos Zod y fórmulas con Decimal
packages/ui       Componentes accesibles con Radix
tests             Aceptación de API y Playwright
docs              Arquitectura, decisiones, mockups, manual y cobertura
scripts           PostgreSQL local, verificación y respaldos
deploy            Configuración de Nginx
```

Consulta [el manual](docs/MANUAL.md), [las decisiones](docs/DECISIONES.md) y [el despliegue](docs/DESPLIEGUE.md).

La ronda 3 incorpora stock por SSE, Configuración > Equipos, Mercancía móvil/offline e importación de facturas con revisión. Consulta [el manual](docs/MANUAL.md) y [la revisión](docs/REVISION_CLAUDE_RONDA3.md). Para empaquetarla: `node scripts/package.mjs ../fitstore-pos-ronda3.zip`.

**Ronda 4 (Claude):** corrige los hallazgos de la auditoría de ChatGPT (compras sin orden, equipos aprobados, lotes) y de la revisión propia, rediseña Mercancía y Equipos y actualiza la lectura de facturas con Claude. Detalle y evidencia en [docs/RONDA4_CLAUDE.md](docs/RONDA4_CLAUDE.md). Para empaquetarla: `node scripts/package.mjs ../fitstore-pos-ronda4.zip`.
