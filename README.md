# Nexora POS

Sistema interno de caja e inventario para República Dominicana, con datos de demostración para pruebas. React/TypeScript/Vite, NestJS, Prisma y PostgreSQL, con paquetes compartidos, PWA y cola de ventas en IndexedDB.

**Estado:** funciona localmente y compila para producción. La matriz de cobertura y las funciones todavía pendientes están en [docs/ENTREGA.md](docs/ENTREGA.md). Esta versión no emite comprobantes fiscales (NCF/e-CF) válidos ante la DGII; sus recibos y notas son documentos internos. La emisión fiscal requiere un mecanismo autorizado.

**Alcance de las revisiones:** la revisión automatizada con IA de este repositorio no es una auditoría independiente ni una certificación profesional de seguridad, cumplimiento o integridad contable. Los informes y pruebas describen escenarios y versiones concretos, no garantizan ausencia de fallos. Cuando el código habla de registro de auditoría, significa la bitácora de usuario, motivo y operación, no una aprobación externa.

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

Escucha en `127.0.0.1:5434`, en UTC, y guarda los datos en `.local-db/`; `FITSTORE_DB_PORT` y `FITSTORE_DB_DIR` los cambian (ajusta entonces `DATABASE_URL`). Se detiene con Ctrl+C o, desde otra terminal, con `node scripts/local-db.mjs --detener`.

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

`check`: TypeScript, ESLint, pruebas de fórmulas y compilación. `verify`: pruebas de API y navegador contra la API de `FITSTORE_API_URL` (por defecto `http://127.0.0.1:3001/api`, o el puerto de `PORT`); si no responde, inicia PostgreSQL local y la API, y los detiene al terminar. Playwright inicia la PWA compilada en preview (4173) para verificar recargas offline; ejecuta `pnpm check` antes. `FITSTORE_WEB_URL` permite usar otro servidor de la PWA compilada. `FITSTORE_WEB_PORT` cambia el puerto de ese preview cuando hay varias copias del proyecto probándose a la vez (con un puerto propio no se reutiliza un servidor ya abierto). Las capturas de las pruebas se guardan en `test-results/capturas/`; sólo con `FITSTORE_ACTUALIZAR_CAPTURAS=1` se reescriben las imágenes de `docs/` (usa una base nueva). Los resultados y trazas aparecen en `test-results/` y `playwright-report/`. Los registros de la entrega están en `docs/validacion/`.

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

**Ronda 6 (Claude):** cierra los 9 hallazgos de la auditoría completa de ChatGPT a la ronda 4 (equipos y compras anteriores, precisión de cantidades, facturas contra orden, tiempo real concurrente, variante única, API compilada y pestañas en celular). Detalle y evidencia en [docs/RONDA6_CLAUDE.md](docs/RONDA6_CLAUDE.md). Para empaquetarla: `node scripts/package.mjs ../fitstore-pos-ronda6.zip`.

**Ronda 7 (Claude):** cierra R6-01/02/03 de la auditoría de ChatGPT (combos enteros con consumo y costo exactos, tallas en facturas, recuperación de compras con líneas incompletas), adapta el sistema al inventario real de la tienda (importador del Excel, caja por código + Enter y búsqueda por palabras) y deja el emparejamiento de facturas conservador tras tres revisiones adversariales. Detalle en [docs/RONDA7_CLAUDE.md](docs/RONDA7_CLAUDE.md). Para empaquetarla: `node scripts/package.mjs ../fitstore-pos-ronda7.zip`.

**Ronda 8 (Claude):** corrige R7-01 a R7-04 de la auditoría de ChatGPT (códigos contra la base, números en texto, controles de categoría y costo del reporte en devoluciones parciales). Detalle en [docs/RONDA8_CLAUDE.md](docs/RONDA8_CLAUDE.md).

**Ronda 9 (Claude):** corrige R8-01 a R8-03 de la auditoría de ChatGPT y 43 hallazgos de una revisión adversarial propia, y agrega lo que pidió la tienda: cuadre de caja con su formato, reportes del día, factura e impresión térmica de 80 mm, contraentrega con evidencia, cuatro cajas a la vez y control de mercancía (factura del proveedor, dañados, historial y vencidos). Detalle en [docs/RONDA9_CLAUDE.md](docs/RONDA9_CLAUDE.md).
