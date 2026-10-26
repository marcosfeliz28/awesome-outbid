# Obsidian Lumina · fase 3 · pruebas de aceptación

Archivo: `tests/e2e/lumina-f3.spec.ts` (82 pruebas: 5 pantallas × 2 tamaños
[1366×768 y 390×844] × criterios; cada una repite en tema claro y oscuro con
el botón real de la barra superior). Pantallas por hash: `products`,
`inventory`, `customers`, `reports`, `settings`. Caja: `vendedor@fitstore.demo`.

Reglas elegidas (las del código): área táctil >= 44 px en celular y >= 40 px en
escritorio (`.heading-actions .button` mide 40). Contraste calculado con colores
reales (no hay `@axe-core/playwright`): texto 4.5:1, bordes de controles 3:1;
el fondo ignora degradados e imágenes.

## Resultado sobre la base (antes del rediseño): 54 pasan, 28 fallan

| # | Criterio | Base | Detalle |
|---|----------|------|---------|
| 1 | h1 = nombre de ruta, sin eslogan | FALLA (10/10) | h1 es «Tu catálogo, con personalidad» etc. y existe `.eyebrow` |
| 2 | Sin scroll horizontal | pasa (10/10) | |
| 3 | Área táctil | FALLA en 8/10 | Productos/Inventario/Clientes: buscador 39 px y botones de fila 28×36; celular: más controles < 44. Pasan Reportes y Configuración en escritorio |
| 4a | Una sola acción principal por cabecera | pasa (10/10) | |
| 4b | «Más» con Enter/Espacio/Escape, `aria-expanded`, foco | FALLA (10/10) | no hay botón «Más» en ninguna cabecera (existe `MoreMenu` pero ninguna pantalla lo usa) |
| 5 | Anillo de foco tras Tab (12 paradas) | pasa (10/10) | |
| 6 | Contraste texto 4.5:1 / bordes 3:1 | pasa (10/10) | |
| 7 | `tabular-nums` en cifras de tabla (Productos, Inventario, Reportes) | pasa (6/6) | |
| 8 | Movimiento reducido: `.skeleton` sin animación | pasa (5/5) | |
| 9 | Caja del vendedor intacta, sin «Más» ni admin-ui | pasa (1/1) | |

Nota: 8 inserta un `<span class="skeleton">` y lee su CSS (el esqueleto real
dura milisegundos). 7 reconoce celdas de cantidad (dígitos, `RD$`, `%`).

## Cómo repetirlo desde otro worktree

Puertos propios (no tocar 3001, 4173 ni 5432 del equipo real):

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
export FITSTORE_DB_PORT=55187 FITSTORE_DB_DIR="$PWD/.lumina-f3-db"
node scripts/local-db.mjs &                      # esperar "PostgreSQL listo"
export DATABASE_URL='postgresql://fitstore:fitstore_local@127.0.0.1:55187/fitstore?options=-c%20TimeZone%3DUTC' \
  SEED_DEMO_PASSWORD='FitStore-Demo-2026!' JWT_SECRET=clave-de-prueba-de-32-caracteres-o-mas \
  PORT=3187 WEB_ORIGIN=http://127.0.0.1:4187
pnpm db:migrate && pnpm db:seed
pnpm --filter @fitstore/api start &              # API en 3187
FITSTORE_WEB_PORT=4187 FITSTORE_API_PROXY=http://127.0.0.1:3187 \
  pnpm exec playwright test tests/e2e/lumina-f3.spec.ts --reporter=list
```

Al terminar: detener la API y la vista previa (puertos 3187 y 4187),
`node scripts/local-db.mjs --detener` y borrar `.lumina-f3-db` (no está en
`.gitignore`: no lo agregues al commit). Tarda unos 5 minutos.
