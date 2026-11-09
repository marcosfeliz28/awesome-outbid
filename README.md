# Norexos POS

Punto de venta, caja, inventario y reportes para comercios. El monorepo combina
React/TypeScript/Vite, NestJS, Prisma y PostgreSQL, con PWA y cola de operaciones
sin conexión.

## Estado y límite fiscal

El producto tiene rutas de despliegue web y de servidor local para Windows. La
documentación operativa está en [docs/MANUAL.md](docs/MANUAL.md) y la instalación
local en [docs/INSTALADOR.md](docs/INSTALADOR.md).

Esta versión **no emite NCF/e-CF** válidos ante la DGII. Los tickets son recibos
internos y muestran la leyenda de documento no fiscal. El alcance y los pasos
pendientes están documentados en
[docs/fiscal/REQUISITOS_FISCALES_RD.md](docs/fiscal/REQUISITOS_FISCALES_RD.md).

## Requisitos

- Node.js 24
- pnpm 11.19.0
- PostgreSQL para desarrollo e integración

## Desarrollo local

Desde la raíz:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Genera un `JWT_SECRET` aleatorio de al menos 32 caracteres y usa únicamente
credenciales locales de prueba. No copies secretos a commits, documentos ni
mensajes.

Inicia la base local descartable:

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

La web de desarrollo abre en `http://localhost:5173` y la API en
`http://localhost:3001/api`. Swagger solo está disponible cuando la configuración
del entorno lo permite.

El `seed` crea datos ficticios para desarrollo. **No uses el `seed` sobre datos
reales** ni reutilices sus usuarios de demostración fuera de una base descartable.

## Verificación

```bash
pnpm check
pnpm test:integration
pnpm verify
```

- `pnpm check`: tipos, lint, pruebas unitarias y compilación.
- `pnpm test:integration`: API compilada contra PostgreSQL de prueba.
- `pnpm verify`: comprobación completa, incluida la PWA con Playwright.

Las pruebas nunca deben apuntar a producción. Usa una base nueva o descartable y
puertos propios si hay varios worktrees ejecutándose a la vez.

Para probar la PWA de producción localmente:

```bash
pnpm build
pnpm --filter @fitstore/api start
pnpm --filter @fitstore/web preview
```

La vista previa abre en `http://localhost:4173`. La cola de IndexedDB funciona en
una sesión sin conexión; una recarga completa sin red requiere que la PWA ya se
haya cargado o instalado.

## Estructura

```text
apps/web          PWA React y pantallas
apps/api          API NestJS y operaciones de negocio
apps/api/prisma   Esquema y migraciones
packages/shared   Contratos Zod y fórmulas Decimal
packages/ui       Componentes compartidos
tests             Pruebas unitarias, integración y navegador
docs              Manuales, arquitectura, fiscal y coordinación
scripts           Verificación, respaldo y herramientas locales
instalador        Instalador y utilidades para Windows
```

## Documentos principales

- [Manual](docs/MANUAL.md)
- [Instalador de Windows](docs/INSTALADOR.md)
- [Prueba de aceptación de caja](docs/PRUEBA_ACEPTACION_CAJA.md)
- [Requisitos fiscales de República Dominicana](docs/fiscal/REQUISITOS_FISCALES_RD.md)
- [Índice documental](docs/INDICE.md)

Los documentos `RONDA*`, `AUDITORIA_RONDA*` y entregas antiguas son historial;
no sustituyen el manual, las migraciones ni las órdenes vigentes de coordinación.
