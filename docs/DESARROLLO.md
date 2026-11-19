# Desarrollo de Nexora POS

## Requisitos
- Node.js y pnpm 11 (el repo fija `pnpm@11.19.0` en `packageManager`).

## Estructura del monorepo
- `apps/api`: API (NestJS con Prisma).
- `apps/web`: interfaz (React con Vite).
- `packages/shared`: lógica compartida entre api y web.
- `packages/ui`: componentes compartidos.
- `scripts/`: utilidades de verificación y build.
- `tests/`: pruebas del proyecto.

## Comandos principales
Los comandos de la tabla son scripts de `package.json`, salvo `pnpm install`, que es un comando propio de pnpm y no un script del proyecto.

| Comando | Para qué |
|---|---|
| `pnpm dev` | Levanta el entorno de desarrollo. |
| `pnpm build` | Compila web y api. |
| `pnpm typecheck` | Revisa tipos en todos los paquetes. |
| `pnpm lint` | Revisa estilo y errores con ESLint. |
| `pnpm test` | Pruebas unitarias con Vitest. |
| `pnpm test:e2e` | Pruebas de extremo a extremo. |
| `pnpm check` | Typecheck, lint, test y build juntos. |
| `pnpm verify` | Verificación completa del proyecto. |
| `pnpm test:integration` | Pruebas de integración con base de datos. |
| `pnpm db:generate` | Genera el cliente de Prisma. |
| `pnpm db:migrate` | Aplica migraciones. |
| `pnpm db:seed` | Carga datos de prueba. |

## Flujo recomendado
1. Instala dependencias con `pnpm install`.
2. Haz el cambio en tu rama.
3. Corre `pnpm check` antes de subir.
4. Abre el PR según `CONTRIBUTING.md`.
