Borrador sin verificar, hecho por script (solo lectura, origin/nexora-cloud). Fecha: 2026-10-29. Fuente: 5 package.json.

# Scripts npm (copia literal)

## package.json

| Script | Comando literal |
|---|---|
| `dev` | `concurrently -n api,web -c magenta,cyan "pnpm --filter @fitstore/api dev" "pnpm --filter @fitstore/web dev"` |
| `build` | `pnpm --filter @fitstore/web build && pnpm --filter @fitstore/api build` |
| `typecheck` | `pnpm -r typecheck` |
| `test` | `vitest run` |
| `test:e2e` | `playwright test` |
| `db:generate` | `pnpm --filter @fitstore/api db:generate` |
| `db:migrate` | `pnpm --filter @fitstore/api db:migrate` |
| `db:seed` | `pnpm --filter @fitstore/api db:seed` |
| `format` | `prettier --write .` |
| `lint` | `eslint .` |
| `check` | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` |
| `db:local` | `node scripts/local-db.mjs` |
| `verify` | `node scripts/verify.mjs` |
| `test:integration` | `vitest run --config vitest.integration.config.ts` |
| `cloud:validate` | `vitest run tests/cloud-deploy.test.ts` |
| `backup` | `node scripts/backup.mjs` |
| `admin:create` | `pnpm --filter @fitstore/api admin:create` |
| `package:source` | `node scripts/package.mjs` |
| `package:changes` | `node scripts/package-changes.mjs` |
| `instalador:validar` | `node instalador/tests/run-validation.mjs` |
| `instalador:preparar` | `powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1 -SoloPreparar` |
| `instalador:compilar` | `powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1` |

## apps/api/package.json

| Script | Comando literal |
|---|---|
| `dev` | `tsx watch src/main.ts` |
| `build` | `tsc -p tsconfig.json` |
| `typecheck` | `tsc --noEmit` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate deploy` |
| `db:seed` | `tsx prisma/seed.ts` |
| `start` | `node dist/main.js` |
| `admin:create` | `tsx scripts/create-admin.ts` |
| `admin:require-password-change` | `tsx --tsconfig tsconfig.json scripts/require-password-change.ts` |
| `inventory:import` | `tsx scripts/import-inventario.ts` |

## apps/web/package.json

| Script | Comando literal |
|---|---|
| `dev` | `vite --host 0.0.0.0` |
| `build` | `tsc --noEmit && vite build` |
| `typecheck` | `tsc --noEmit` |
| `preview` | `vite preview --host 0.0.0.0` |

## packages/shared/package.json

| Script | Comando literal |
|---|---|
| `typecheck` | `tsc --noEmit` |

## packages/ui/package.json

| Script | Comando literal |
|---|---|
| `typecheck` | `tsc --noEmit` |

Total de scripts: 38.
