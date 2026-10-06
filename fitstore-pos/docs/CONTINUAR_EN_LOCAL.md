# Continuar FitStore POS en la computadora de la tienda

Guía para que una sesión de Claude Code en la computadora local (Windows, 16 procesadores lógicos, 32 GB) retome el trabajo de la sesión en la nube sin preguntar. Rama: `claude/facturacion-app-architecture-a3bz90`.

## Cómo trabajamos

- **Ciclo por ronda:** Claude desarrolla y ChatGPT audita. Cada ronda entrega:
  1. Las correcciones de la auditoría anterior (`docs/AUDITORIA_RONDAn.md`), cada una con una regresión que **falla con la ronda anterior** y pasa con la nueva.
  2. Un ZIP en `proyecto-facturacion/fitstore-pos-rondaN.zip` y el mensaje `proyecto-facturacion/MENSAJE_PARA_CHATGPT_RONDAN.txt`.
  3. `docs/RONDAN_CLAUDE.md` y `docs/validacion/rondaN-cierre.json`. Los registros de las suites van en `docs/validacion/rondaN-*.txt`.
- **Entrega al usuario, siempre de tres formas:**
  1. El texto del mensaje pegado en el chat.
  2. El enlace directo `https://github.com/marcosfeliz28/awesome-outbid/raw/claude/facturacion-app-architecture-a3bz90/proyecto-facturacion/<archivo>`.
  3. Los archivos adjuntos.
- **Idioma:** el usuario escribe en español. Los mensajes, la documentación y los comentarios del código van en español.
- **Datos del negocio:** el Excel real (`INVENTARIO_2026_Actualizado.xlsx`) y cualquier reporte con costos **no** van al repositorio ni al ZIP. Las pruebas usan `tests/fixtures/catalogo-tienda.json` (sólo ID, nombre y categoría).

## Entorno

- **PostgreSQL 16** en `localhost:5432`, rol `fitstore` / `fitstore_local` con `CREATEDB`. `.env` sale de `.env.example`; el ejemplo usa el puerto 5434, aquí es 5432.
- **API compilada**, como en producción (Docker usa `node dist/main.js`):
  1. `pnpm --filter @fitstore/api build`
  2. `cd apps/api && node dist/main.js` (puerto 3001)
- **PWA compilada:**
  1. `pnpm --filter @fitstore/web build`
  2. `vite preview` en el puerto 4173, con proxy de `/api` a `FITSTORE_API_PROXY`, por defecto `http://127.0.0.1:3001`.
- **Suites:**
  - `pnpm check`: tipos, ESLint, unitarias y compilación.
  - `pnpm test:integration`: `tests/api.test.ts` contra `FITSTORE_API_URL`, por defecto `http://127.0.0.1:3001/api`. Usa `DATABASE_URL` para la base de la API.
  - `pnpm test:e2e`: Playwright contra `FITSTORE_WEB_URL`, por defecto 4173.
- **Validación final:** siempre sobre una **base nueva** (DROP/CREATE, `prisma migrate deploy` y `pnpm db:seed`), con la API y la PWA compiladas. Antes de arrancar la API, comprueba que el puerto 3001 está libre. Si no, las pruebas hablan con una API vieja y "pasan" con código viejo.
- **Agentes en paralelo:** cada uno necesita su propia base (`fitstore_<área>`), su propio puerto de API (31xx) y de PWA (41xx), y su propio `--outDir` de compilación web. Nunca uses `pkill -f`; detén los procesos por PID.

## Inventario real

```
cd apps/api
pnpm inventory:import "RUTA\INVENTARIO_2026_Actualizado.xlsx" [--dry-run] [--sin-lotes] [--actualizar-precios]
```

- La semilla crea Suplementos y Maquillaje con lote obligatorio. Por eso la primera carga real lleva `--sin-lotes`, que queda en la bitácora.
- Resultado esperado: 616 productos y 3158 unidades. Por categoría: Fajas 40/186, Maquillaje 355/2062, Suplementos 221/910. La recarga da "616 ya cargados sin cambios".
- `revision-inventario.csv` se escribe en la carpeta actual y no debe subirse.

## Estado de la ronda 9

1. **Auditoría R8 de ChatGPT** (`docs/AUDITORIA_RONDA8.md`): R8-01, R8-02 y R8-03 corregidos. Las regresiones fallan con la ronda 8 (`docs/validacion/ronda9-regresiones-con-ronda8.txt`).
2. **Revisión adversarial propia** (`docs/validacion/ronda9-revision-adversarial.json`): 43 hallazgos confirmados por dos verificadores (2 P1, 22 P2, 19 P3), corregidos por área:

   | Área                            | Hallazgos | Estado                            |
   | ------------------------------- | --------- | --------------------------------- |
   | caja (POS.tsx)                  | 9         | Corregidos, revisados y reparados |
   | dinero (sales, reports, shared) | 11 (+2)   | Corregidos, revisados y reparados |
   | offline (App, api.ts)           | 5         | En curso en la nube               |
   | facturas (invoice, inventory)   | 8         | En curso en la nube               |
   | códigos (catalog, merchandise)  | 3         | Pendiente                         |
   | importador                      | 5         | Pendiente                         |
   | seguridad (common, main)        | 2         | Pendiente                         |

   La sesión en la nube actualiza esta tabla al terminar cada área.

3. **Falta para entregar la ronda 9:**
   1. Validación final sobre una base nueva: check, integración compilada, e2e e inventario real.
   2. Completar `docs/RONDA9_CLAUDE.md`, `docs/validacion/ronda9-cierre.json` y la línea del README.
   3. Armar el ZIP y el mensaje para ChatGPT, pidiendo una **auditoría grande** de todo el sistema.
