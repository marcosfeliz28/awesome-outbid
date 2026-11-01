# PQ24: peso del JavaScript de la web y carga diferida (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 24 de la cola.

Alcance: no se cambió lógica ni configuración. La propuesta de carga diferida queda para una pieza aparte.

## Cómo se midió

- `pnpm --filter @fitstore/web build` (`tsc --noEmit && vite build`): terminó bien en 56 s. Vite 7.3.6, PWA 1.3.0. Advierte que hay trozos mayores de 500 kB.
- Tamaños leídos de la salida del build y de `apps/web/dist/assets/`. Los tamaños son los que muestra Vite: minificado y gzip.
- Qué módulos quedan dentro de cada trozo: `grep` de cadenas en los `.js` generados (por ejemplo `recharts`, `Dexie`, `sentry`, `BrowserMultiFormatReader`).
- Peso de código fuente por pantalla: script de Node en una carpeta temporal que sigue los `import` relativos desde `main.tsx`. Mide el tamaño de los `.ts`/`.tsx` sin minificar. No es el peso final en el navegador; sirve para ordenar las pantallas.

## Tamaños medidos

| Trozo | Minificado | gzip | Contenido verificado |
|---|---|---|---|
| `index-DTdCDnHo.js` | 1 211,7 kB | 377,9 kB | Aplicación principal, React, TanStack Query, Dexie, Sentry (`monitoring.ts`), todas las pantallas. |
| `index-iPjrJSYw.js` | 416,0 kB | 108,7 kB | Lector de códigos `@zxing/browser`. Ya es carga diferida (`import()` en `POS.tsx` y `Merchandise.tsx`). |
| `charts-DCde1Tpj.js` | 394,8 kB | 115,4 kB | `recharts`. Se precarga con `<link rel="modulepreload">` en `index.html`. |
| `workbox-window...js` | 5,8 kB | 2,4 kB | Registro del service worker. |
| `index-Yo21MIBw.css` | 132,4 kB | 25,2 kB | Estilos. |
| 4 fuentes `.woff2` | 182,4 kB en total | | Inter y Plus Jakarta Sans (latín y latín extendido). |
| `react-vendor-*.js` | 0,0 kB | | Trozo vacío: la regla `manualChunks` de React no hace nada. |

Total de JavaScript de la web: 2 028,2 kB minificado y 604,3 kB gzip.

Service worker: `precache 27 entries (2298.45 KiB)`. Incluye todo el JS, CSS, HTML, SVG y fuentes, porque `globPatterns` cubre `js,css,html,svg,woff2`.

## Hallazgos

### 1. recharts se descarga siempre, en la primera carga (alto)

- `vite.config.ts` fuerza `charts: ["recharts"]` como trozo propio.
- `index.html` lo precarga con `modulepreload`, así que se baja en cada arranque, incluso si la cajera entra a la caja.
- Lo usan `Dashboard.tsx` (importado de forma estática en `App.tsx:73`), `YearPie.tsx` (desde Dashboard), `MonthReport.tsx` y `PaymentMixPie.tsx`.
- Ruta por defecto: `App.tsx:634`, `useState(location.hash.slice(1) || "dashboard")`. Por eso, para el usuario que entra sin hash, el panel sí se necesita al arrancar. Cargarlo de forma diferida ahorra descarga solo en las sesiones que empiezan en POS u otra pantalla.
- Costo: 394,8 kB minificado (115,4 kB gzip) en cada arranque.

### 2. Todas las pantallas van en el trozo principal (alto)

`App.tsx` importa de forma estática todas las pantallas, y el objeto `pages` (`App.tsx:925-955`) las referencia todas. Medido con el script (fuente sin minificar, exclusivo de cada rama):

| Módulo | Fuente exclusiva | Observación |
|---|---|---|
| `Management.tsx` y su subárbol | 278,9 kB | Arrastra 9 archivos: `Tienda.tsx`, `CreditAccounts.tsx`, `DriveBackup.tsx`, `FormalReports.tsx`, `IncomeByDay.tsx`, `SaleEditPanel.tsx`, `WarehousesPanel.tsx`, `InventoryImport.tsx`. Exporta 12 pantallas (Catálogo, Inventario, Compras, Gastos, Caja, Clientes, Promociones, Reportes, Alertas, Historial, Configuración, StyleGuide). |
| `POS.tsx` | 107,3 kB | Pantalla de caja. Es la que más usa la cajera; la carga temprana puede ser razonable. |
| `Gv.tsx` | 59,4 kB | Ruta `gv`. Candidata clara. |
| `Merchandise.tsx` | 56,6 kB | Ruta `merchandise`. Candidata clara. |
| `Purchases.tsx` | 24,1 kB | Usado por Management y Merchandise. |
| `Incentives.tsx` | 19,2 kB | Ruta `incentives`. |
| `TransferReconciliation.tsx` | 15,1 kB | Ruta. |
| `MonthReport.tsx` + `PaymentMixPie.tsx` | 15,7 kB | Ruta `month-report`. |
| `Dashboard.tsx` + `YearPie`, `KpiStrip` | 31,8 kB | Ruta por defecto. |

`Management` es el mayor bloque de fuente y agrupa secciones que casi no se usan en caja.

### 3. Sentry va en el trozo principal (medio)

- `main.tsx:2` importa `./monitoring`, que a su vez importa `@sentry/react`.
- Las 207 apariciones de «sentry» están en `index-DTdCDnHo.js`.
- Cargarlo de forma diferida haría que los errores de arranque no se capturen. Antes de tocarlo hay que decidir qué errores deben llegar siempre.

### 4. La carga diferida del lector ya existe (correcto)

`@zxing/browser` (416 kB) no se descarga hasta abrir el escáner. Esto no requiere cambios.

### 5. Limitación importante: la precarga del service worker

El precache de Workbox baja los 27 archivos (2,3 MB) en la primera instalación del service worker, sin importar si la pantalla se usa. Cargar pantallas de forma diferida reduce el JS que se evalúa al arrancar, pero no reduce los bytes que se bajan del precache, salvo que se cambie `globPatterns` o la estrategia de caché. Conviene decirlo a la dueña para no prometer un ahorro de descarga que no existe.

### 6. Trozo `react-vendor` vacío (bajo)

La entrada `"react-vendor": ["react", "react-dom"]` produce un archivo de 0,0 kB. React queda dentro del trozo principal. No rompe nada, pero la configuración no sirve para nada y confunde.

## Recomendación (propuesta, sin aplicar)

1. Cargar con `React.lazy` y `Suspense`: `Management`, `Gv`, `Merchandise`, `Incentives`, `TransferReconciliation`, `MonthReport`. Debe ser una pieza propia con prueba de navegación.
2. Quitar `charts` de `manualChunks` y cargar `Dashboard` de forma diferida. Esto solo ayuda si la ruta por defecto no es el panel; decidirlo antes con la dueña.
3. Quitar la entrada `react-vendor` vacía, o dejarla y documentarlo.
4. Medir de nuevo después de cada cambio con `rollup-plugin-visualizer` en una rama de medición. No se instaló porque no es dependencia del proyecto y la regla es no añadir paquetes sin justificarlos.
5. Confirmar con la dueña si el precache debe bajar todo al instalar, o solo lo de la pantalla de entrada.

Ahorro esperado (no medido): hasta 394,8 kB minificados de `recharts` en la carga de cajeras que no entran al panel, y la parte de `Management` que no se usa en caja.

## No cambiado

- `apps/web/src/*`, `vite.config.ts` y `index.html`: sin cambios.
- No se midió el tiempo de carga en navegador (no se levantó el servidor ni se usó la pestaña del navegador). Las cifras son tamaños de archivo del build, no tiempos.
- No se activó ningún cambio de ruta por defecto.
- `dist/` se generó en el worktree de la pieza; no está en git.
