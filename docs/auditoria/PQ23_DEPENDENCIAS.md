# PQ23: dependencias desactualizadas (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 23 de `docs/coordinacion/COLA_PERMANENTE_CLAUDE_PC.md`.

Alcance: esta pasada no cambia `package.json` ni `pnpm-lock.yaml`. No se abrió ninguna rama de actualización. Cada parche propuesto necesita su propia rama con CI, como pide la cola.

## Cómo se midió

- `pnpm install --frozen-lockfile` en el worktree: correcto (1 m 13 s), sin cambios en el lockfile.
- `pnpm outdated -r`: 45 filas (dependencias directas de la raíz, `apps/api`, `apps/web` y `packages/*`).
- Fechas de publicación de los candidatos: `pnpm view <paquete> time --json`.
- Rangos declarados: leídos de los `package.json` de cada workspace.

Las cinco versiones que la orden citaba coinciden con las del registro: react 19.3.1, zustand 5.0.16, dexie 4.4.7, prettier 3.9.10 y @types/pdfkit 0.17.7.

## Resultado: parches seguros (5)

Todos quedan dentro del rango ya declarado, así que basta con actualizar el lockfile. No hace falta tocar ningún `package.json`.

| Paquete | Actual | Destino | Rango declarado | Dónde | Publicado |
|---|---|---|---|---|---|
| dexie | 4.4.6 | 4.4.7 | ^4.2.0 | apps/web | 19-oct-2026 |
| prettier (dev) | 3.9.9 | 3.9.10 | ^3.6.0 | raíz | 10-oct-2026 |
| react | 19.3.0 | 19.3.1 | ^19.1.0 | apps/web, packages/ui | 14-oct-2026 |
| react-dom | 19.3.0 | 19.3.1 | ^19.1.0 | apps/web | 14-oct-2026 |
| zustand | 5.0.15 | 5.0.16 | ^5.0.0 | apps/web | 22-oct-2026 |
| @types/pdfkit (dev) | 0.17.6 | 0.17.7 | ^0.17.0 | apps/api | 22-oct-2026 |

Recomendación: una rama por paquete (o por par react/react-dom), con `pnpm check` y CI verde en el SHA exacto. React es el de mayor riesgo visual, así que la prueba de regresión de pantallas debe correr sobre la rama.

## Resultado: actualizaciones dentro del mismo mayor (esperar, una a una)

Hay versión nueva dentro del rango declarado o en una menor pequeña. No son parches; cada una necesita revisión de cambios antes de subirla.

| Paquete | Actual | Último | Motivo para esperar |
|---|---|---|---|
| express (api y raíz) | 5.2.1 | 5.3.0 | Afecta a toda la API. Requiere CI completo y prueba de rutas. |
| @sentry/node, @sentry/react | 11.4.0 | 11.10.0 | Cambia la captura de errores; confirmar eventos en Sentry tras subir. |
| @radix-ui/react-dialog | 1.1.23 | 1.3.1 | Salto menor en la librería de modales de packages/ui; revisar foco y cierre. |
| @tanstack/react-query | 5.104.1 | 5.105.0 | Menor; revisar caché de la caja (consultas de venta). |
| typescript-eslint (dev) | 8.71.0 | 8.72.1 | Menor de lint; puede aparecer nueva regla en `pnpm lint`. |
| @playwright/test (dev) | 1.63.0 | 1.64.1 | Menor de e2e; puede cambiar la estabilidad de pruebas (pieza 10). |
| embedded-postgres (dev) | 18.4.0-beta.17 | 18.6.0-beta.19 | Versión beta; no subir sin pasar las pruebas de Postgres. |

## Resultado: saltos de versión mayor (no tocar en esta cola)

| Paquete | Actual | Último | Motivo |
|---|---|---|---|
| zod (api, shared) | 3.25.76 | 4.6.7 | Cambia la API de esquemas. Ya es la pieza 9 y arregla el aviso GHSA de PQ26/PQ27. Ver PQ27. |
| @nestjs/core, common, platform-express, swagger, jwt | 11.x | 12.x | Mayor del framework de la API; cambios de decoradores y pipes. |
| @prisma/client, prisma (dev) | 6.19.0 (fijado exacto) | 7.10.1 / 8.0.0-rc.29 | Mayor de ORM y generador; el rc de la 8 no es estable. Cambia migraciones y cliente. |
| @anthropic-ai/sdk | 0.131.0 | 1.3.0 | Mayor; `invoice.ts` usa `betaZodOutputFormat`. Revisar la extracción de facturas con IA. |
| lucide-react (ui, web) | 0.468.0 | 1.65.0 | Mayor; cambian nombres de iconos. Está fijado en ^0.468.0. |
| pdfkit (api) | 0.17.2 | 0.20.2 | Versión 0.x con salto menor; cambia el maquetado de facturas PDF. |
| @zxing/browser (web) | 0.1.5 | 0.2.1 | Versión 0.x con salto; afecta al escáner de código de barras. |
| vite (web), vite-plugin-pwa | 7.3.6 / 1.3.0 | 8.3.5 / 2.0.0 | Mayor del empaquetador y del service worker; cambia el precache. Ver PQ24. |
| @vitejs/plugin-react (web) | 5.2.0 | 6.1.2 | Mayor. |
| vitest (dev) | 3.2.7 | 5.0.5 | Mayor de pruebas; hay avisos de seguridad en 3.x (PQ27). |
| eslint, @eslint/js (dev) | 9.39.5 | 10.14.0 / 10.0.1 | Mayor; el formato de configuración puede cambiar. |
| typescript (dev) | 5.9.3 | 7.0.2 | Mayor; el paso a la versión 7 cambia el compilador. Los rangos declarados son `~5.9.3`. |
| @types/node | 24.19.1 | 26.6.6 | Mayor de tipos; alinear con la versión de Node de Render antes de subir. |
| @types/supertest (dev) | 6.0.3 | 7.2.1 | Mayor de tipos. |
| concurrently (dev) | 9.2.4 | 10.0.6 | Mayor; también arrastra `shell-quote` (PQ27). |
| dotenv (api) | 17.4.2 | 18.0.9 | Mayor; cambia el manejo de variables al cargar `.env`. |
| @capacitor/core, android, ios, cli | 7.6.9 | 8.6.0 | Mayor. Además, no encontré `import` de `@capacitor` en `apps/web/src`; confirmar si se usa. |

## Hallazgo extra

- `apps/web/package.json` declara `@capacitor/*` pero `grep -rn "@capacitor" apps/web/src` no encuentra importaciones. Solo aparece en `capacitor.config.ts` y en `package.json`. Podría ser una dependencia muerta (control de paquetes sin uso, punto 14 de seguridad-20). Pendiente de confirmar por la dueña antes de quitarla.
- `@prisma/client` y `prisma` están fijados exactos a 6.19.0 (sin `^`). Esto es correcto para evitar desajustes, pero hay que subirlos juntos.

## Recomendación

1. Subir en orden: dexie, zustand, prettier, @types/pdfkit, react y react-dom (cinco ramas o una por par), cada una con CI verde.
2. Después, las menores de la tabla del segundo bloque, una a una, empezando por typescript-eslint y @playwright/test (son solo de desarrollo).
3. Las mayores no entran en esta cola. Se abren como piezas propias con plan de migración. Zod 4 ya está en la pieza 9.

## No cambiado

- `package.json` de la raíz y de los workspaces: sin cambios.
- `pnpm-lock.yaml`: sin cambios (la instalación fue con `--frozen-lockfile`).
- No se instaló ni se actualizó ningún paquete. No se tocó Render ni se desplegó nada.
- No se subió ninguna rama de actualización; esta pieza solo entrega el informe.
- Comprobación de la pasada: `docs/sistema/*` no se regeneró (no se ejecutó `pnpm check`).
