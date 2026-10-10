# 07 · Calidad de pruebas y de código, mantenibilidad y deuda técnica

**Repositorio:** `marcosfeliz28/awesome-outbid` («Nexora POS»), rama `origin/nexora-cloud`.
**Commit auditado:** `3e5521c` («docs: orden 3j, 3i NO se mezcla…»). Durante la auditoría la rama avanzó a `e7b07dd` (17 commits más: contraseñas, guía del primer día, arreglo de la regresión R9-caja-5); esos cambios **no** se auditaron salvo donde se indica.
**Modo:** solo lectura. Worktrees desacoplados en el scratchpad (`aud-quality`, `aud-quality-mut`), PostgreSQL 16 propio en `/var/lib/postgresql/audq-calidad` (puerto 5434), Node 24.21 y pnpm 11.19. Nada se empujó, nada se tocó en Render. Las mutaciones se aplicaron solo en los worktrees y se revirtieron (verificado con `git status` tras cada una).
**Fecha:** 2026-10-10.

---

## 0. Resumen ejecutivo

<<RESUMEN>>

---

## 1. Qué se ejecutó (evidencia)

| Comprobación | Resultado en este equipo | Nota |
|---|---|---|
| `pnpm typecheck` (4 paquetes) | Verde | `tests/` **no** está en ningún `tsconfig`: compilándolo aparte salen ~96 errores (41 `any` implícitos en `api.test.ts`, tipos de `invoice.test.ts` desfasados). |
| `pnpm lint` | Verde | `@typescript-eslint/no-explicit-any` está **apagado** (`eslint.config.mjs:35`). |
| `pnpm test` (unitarias, 35 archivos) | 371/377 verdes; 5 fallan por entorno | Las 4 pruebas con PostgreSQL embebido (`embedded-postgres@18.4.0-beta.17`) fallan como root con `EACCES` y **cuelgan 120–240 s cada una** antes de fallar (el `onError: () => undefined` de la prueba traga el error de arranque). `K2` pasa con `NEXORA_TEST_PG_URL` contra el PG16 propio. `customer-anonymization-postgres` y `lot-migration-postgres` **no aceptan servidor externo**: no verificadas aquí (en CI sí corren). |
| Integración (`vitest.integration.config.ts`, 209 pruebas) | **209/209** con base recién sembrada | 1.ª corrida sin `apps/api/dist`: 16 pruebas omitidas/fallidas (TZ, K4, Telegram y «secretos de producción» arrancan la API **compilada**; el README no dice que hay que compilar antes). |
| Integración repetida sobre la **misma** base | **208/209** | Falla `D-05` (`tests/api.test.ts:11679`): fecha fija `2023-03-15` + totales del día completo; la 2.ª corrida suma las ventas de la 1.ª (1000 ≠ 500). Prueba no hermética. |
| Navegador (Playwright, 78 casos) | **77/78** | Falla `R9-caja-5 regresión` (`tests/e2e/store.spec.ts:1356`) con «Route is already handled!» — mismo fallo que el CI de `3e5521c`; corregido después en `e7b07dd`. |
| Cobertura de la API durante la integración (V8/c8) | 87,8 % líneas, 81 % ramas | `sales.ts` 96,5 %, `cash.ts` 97 %, `notifications.ts` 31 %, `security.ts` 73 %. Alta cobertura de líneas **no** implica pruebas que detecten roturas: ver mutaciones. |
| Mutaciones (§3) | <<MUTRESUMEN>> | |
| CI de GitHub en `nexora-cloud` | **9 de las últimas 12 corridas en rojo** | `gh run list`: 3e5521c rojo (R9-caja-5), e7b07dd rojo (nueva prueba concurrente de contraseñas), 23:15 rojo (`pg_dump` versión), etc. |
| `pnpm audit --prod` | Sin vulnerabilidades conocidas | |
| `pnpm outdated -r` | 33 paquetes detrás; varios a una versión mayor | Ver §5.4. |

---

## 2. Pruebas

### 2.1 Pirámide real

| Nivel | Cantidad | Qué es en realidad |
|---|---|---|
| Unitarias (`vitest.config.ts`) | 377 casos en 35 archivos | Solo ~38 son fórmulas puras (`packages/shared/src/business.test.ts`) y ~17 de incentivos. **~70 casos leen el código fuente o los manuales como texto** y buscan cadenas (`toContain("receivableNeedsApproval(")`, `toMatch(/\.\.\.\(showExpected\s*\?/)`); 4 archivos arrancan PostgreSQL. No hay pruebas de componentes React. |
| Integración HTTP | 209 casos (176 en un único `tests/api.test.ts` de **12 203 líneas**) | API real + PostgreSQL real. Es la capa que de verdad protege el dinero. Estado compartido entre `it` (variables `sale`, `session`, `clothing` que asigna un caso y usa el siguiente): no se puede correr un caso aislado con `-t`. |
| Navegador | 78 casos (69 `test()`), solo Chromium escritorio | `store.spec.ts` de 2 819 líneas. 83 `getByText` y 144 selectores CSS frente a 349 `getByRole`; 2 `data-testid`. |

La pirámide está invertida por diseño del código: la lógica de negocio vive dentro de los controladores Nest (`SalesController.complete`, 600 líneas, `sales.ts:419-1025`) con Prisma dentro, así que la única manera de probar una regla es levantar API y base.

### 2.2 Mapa de cobertura por módulo (regla → ¿hay prueba que FALLA si se rompe?)

Elaborado con la cobertura V8 de la API durante la integración y con las mutaciones de §3. «Pasa por encima» = el código se ejecuta pero ninguna aserción depende del resultado, o la única prueba es de texto.

| Módulo / regla | Protección | Evidencia |
|---|---|---|
| Venta: total > 0 | **Sí** (integración) | M01 → falla `minors.test.ts:287`. |
| Venta: descuento sobre el límite pide PIN | **Sí** | M02 → fallan 2 casos de `api.test.ts`. |
| Venta: descuento global en el cálculo del PIN | <<X04>> | X04. |
| Venta: descuento por monto mayor que la línea (`sales.ts:544`) | <<X06>> | Línea 545 nunca se ejecuta en integración. |
| Venta: tarjeta sin aprobación/últimos 4, transferencia sin banco (`sales.ts:632-635`) | <<X11>> | Líneas nunca ejecutadas en integración. |
| Promociones 2×1, segundo a mitad, precio especial, monto (`sales.ts:323-344`) | <<X12>> | `sales.ts:333-343` **0 ejecuciones**; ninguna prueba en todo el repo usa `nxm`, `second_half`, `special_price` ni `amount`. Lógica triplicada (API, `POS.tsx:78`, `pendingSales.ts:13`). |
| Idempotencia offline (UUID y huella) | **Sí** | M09a/M09b. |
| Ventas offline: plazo de 48 h | <<X10>> | X10. |
| Caja: cierre ciego (respuesta sin esperado) | **Sí** | M03a → 5 casos. |
| Caja: nota obligatoria al cerrar con diferencia | **Solo unitaria del helper** | M03b la detecta `claude-round2.test.ts` (C2) llamando a la función; el `bad()` del endpoint (`cash.ts:855-858`) **nunca se ejecuta** en integración. Ver X14. |
| Caja: auditoría `close_difference` | **Bug vivo, no detectado** | `cash.ts:878` usa `Decimal` como booleano → se audita en **todos** los cierres (59/59; 47 con diferencias 0,00 en la base de prueba). La prueba `api.test.ts:1153` solo comprueba presencia. |
| Caja: salidas acumuladas sobre el límite | **Sí** | M07. |
| Caja en otro equipo (`cashLock`) | <<X05>> | X05. |
| Devolución: reembolso no mayor que lo pagado | **Sí** | M04a → 3 casos. |
| Devolución: más unidades que las vendidas | <<M04b>> | M04b. |
| Devolución: plazo (`returnDays`) | <<X01>> | `sales.ts:1556-1557` nunca ejecutadas. |
| Devolución: lote vencido no vuelve a stock | <<X02>> | `sales.ts:1675` nunca ejecutada. |
| Devolución: abierto/dañado no vuelve a stock | <<X03>> | X03. |
| Devolución de venta anulada | <<X07>> | X07. |
| Abonos/cobros mayores que la deuda (`sales.ts:2128`) | <<X08>> | `sales.ts:2136` nunca ejecutada. |
| Crédito: límite del cliente | <<X09>> | X09. |
| Contraentrega sin PIN (API) | <<M08>> | M08. |
| Códigos únicos (SKU/barras) | <<M05>> | M05. |
| Vendedora sin costos | <<M06>> | M06. |
| Incentivo a la mitad en mayoreo | **Sí (unitaria)** | M10. |
| Avisos Telegram (`notifications.ts`, 31 %) | Parcial | Las pruebas arrancan la API compilada aparte; dependen de esperas fijas de 6 s. |
| Secretos de arranque (`security.ts:9-39`) | Solo con `dist` | Se prueban arrancando la API compilada (no cuentan en la cobertura de la API en marcha). |

### 2.3 Pruebas débiles o vacías

1. **Pruebas de texto sobre el código fuente (~70 casos)** — `tests/claude-round2.test.ts:37-86`, `tests/u-credit-cleanup.test.ts:14-20`, `tests/compliance.test.ts:225-275`, `tests/auth-username.test.ts:144-170`, `tests/customer-display.test.ts`, `tests/accessibility-contract.test.ts`. Ejemplos: «A07 oculta esperado» exige que `cash.ts` contenga `...(showExpected ?`; «A06» exige que `tests/api.test.ts` contenga la palabra `Promise.all` (una prueba que prueba el texto de otra prueba); «G5» corta `sales.ts` por índices de cadena para buscar `business.phone`. Un renombrado inocuo las rompe y un cambio de comportamiento con el mismo texto las pasa (M03a no las hizo fallar).
2. **Prueba vacía que siempre pasa** — `tests/compliance.test.ts:85-86`: `if (process.env.NEXORA_CAPTURE_THERMAL !== "1") return;` cuenta como «verde» sin aserciones. Debe ser `it.skipIf(...)` para que figure como omitida.
3. **Aserciones de un solo lado** — `api.test.ts:1153-1174` comprueba que hay `close_difference` cuando hay diferencia, nunca que no lo hay cuando no la hay; por eso vive el bug de `cash.ts:878`.
4. **Solo estado HTTP** — 32 aserciones `.status).toBe(4xx)` sin mensaje en `api.test.ts` (p. ej. `:886` «25 % requiere PIN»): un 400 por otra causa (motivo faltante, stock) también las pasa.
5. **Ventana de «no pasó nada» con espera fija** — `telegram.test.ts:380,454` (6 s), `e2e/privacidad-sesion.spec.ts:297` (1,5 s), `e2e/store.spec.ts:2104`: si la máquina va lenta la prueba pasa sin haber observado nada.
6. **Ruta privada fija** — `tests/inventario.test.ts:101-103` apunta a `/root/.claude/uploads/<sesión>/…INVENTARIO_2026….xlsx`: se omite en cualquier otro equipo; la «prueba del inventario real» no la puede correr nadie más.

### 2.4 No determinismo (además de Tienda-4cajas y R9-caja-5)

| Caso | Causa | Archivo |
|---|---|---|
| D-05 | Fecha fija + totales globales del día; falla en la 2.ª corrida sobre la misma base (reproducido: 1000 ≠ 500). | `tests/api.test.ts:11679-11790` |
| R9-caja-5 regresión | `route.continue()` sobre una ruta ya resuelta al recargar; falla en CI y aquí con `3e5521c`. | `tests/e2e/store.spec.ts:1356-1377` (corregido en `e7b07dd`) |
| PIN con contador propio | 10 peticiones simultáneas con distribución exacta de errores; documentado como intermitente 1 de 3 (`docs/RONDA9_CLAUDE.md:195`). | `tests/api.test.ts:1453` |
| Cambio simultáneo de contraseña | Nuevo en `e7b07dd`; ya rojo en CI (`password-account.test.ts`). | fuera del commit auditado |
| SSE: cupo liberado | `setTimeout(300)` y se espera que el servidor ya haya liberado los 2 flujos. | `tests/api.test.ts:3851`, `:4387` |
| Telegram | Esperas de 150 ms–6 s para que el trabajador procese. | `tests/telegram.test.ts:137,219,380,454,605` |
| Postgres embebido | Arranque fallido no se reporta; la prueba espera hasta el timeout (120–240 s). | `tests/*-postgres.test.ts` (`onError: () => undefined`) |
| Día de negocio | «hoy» y «ayer» calculados con `Date.now()` en momentos distintos; cerca de medianoche (UTC-4) puede cruzar el día. | `tests/api.test.ts:2115-2130`, `:3453` |

Patrón común: los casos comparten una base que se ensucia, comparten tokens/cajas entre `it`, y comprueban concurrencia con `Promise.all` + aserción exacta.

### 2.5 Pruebas omitidas o «heredadas»

- `it.skipIf(!WINDOWS)` (`portabilidad.test.ts:233`), `describe.skipIf(!enabled)` en respaldo (`backup-restore.test.ts:83`, necesita `BACKUP_TEST_ADMIN_URL` y `pg_dump`), `it.skipIf(!existsSync(realFile))` (inventario real), `test.skip` en `e2e/repetible.spec.ts:17` (solo al refrescar capturas) y `celular-http.spec.ts:95` (sin red). Todas justificadas, pero ninguna se reporta como pendiente en CI.
- «Heredadas»: no son pruebas omitidas sino compatibilidad de datos antiguos (`normalizeLegacyOfflineDiscount`, cajas con nombre libre, ventas con fracción de combo). Esa compatibilidad tiene fecha fija en código (`sales.ts:194`, `2026-10-09T04:00:00.000Z`) y nadie la retira.
- Las listas de `vitest.config.ts` y `vitest.integration.config.ts` son **listas blancas**: un archivo de prueba nuevo que no se añada no corre y nadie se entera (hoy todos están incluidos).

### 2.6 Qué falta antes de abrir al público

1. Pruebas de integración para **cada tipo de promoción** y para que el total de la caja (`POS.tsx`) y de la cola offline (`pendingSales.ts`) coincidan con la API (una sola implementación compartida, probada una vez).
2. Pruebas de rechazo de los `bad()` de dinero que hoy no se ejecutan nunca (§2.2) — o borrarlos si son inalcanzables.
3. Base hermética por archivo (plantilla `CREATE DATABASE … TEMPLATE`) para que la suite sea repetible y paralelizable; dividir `api.test.ts` por dominio.
4. CI como puerta: rama protegida, sin `push` directo a `nexora-cloud`, y cuarentena explícita (no «se reintenta hasta que pase») para casos intermitentes.
5. Pruebas de migración sobre **PostgreSQL 17** (producción) y no solo sobre el 18 beta embebido.
6. Pruebas de componentes de la caja (React Testing Library) para la lógica de `POS.tsx` que hoy solo se cubre con Playwright o con `grep`.
7. Type-check de `tests/` en `pnpm check`.

---

## 3. Prueba de mutaciones

Método: cada regla se rompió con un cambio mínimo en el worktree, se recompiló `apps/api/dist`, se reinició la base desde una plantilla recién sembrada (para no confundir con D-05), y se corrieron unitarias (sin las 2 que exigen PG embebido) e integración completa. Para las que sobrevivieron se corrió además la suite de navegador. Después se revirtió y se comprobó `git status` limpio. Los parches exactos están en `scratchpad/mut/mutaciones.json`.

<<TABLAMUT>>

---

## 4. Hallazgos

Formato: **ID · severidad · título** — archivo:línea — por qué importa — arreglo / prueba propuesta.

<<HALLAZGOS>>

---

## 5. Código

### 5.1 Tamaño y responsabilidades

| Archivo | Líneas | Observación |
|---|---|---|
| `apps/api/src/sales.ts` | 2 342 | `complete()` 600 líneas (`:419-1025`): idempotencia, permisos, PIN, cliente, bloqueos, promociones, combos, totales, pagos, crédito, NCF, stock, FEFO, incentivos, auditoría y avisos. `returnSale()` 310 líneas (`:1491-1803`). PDF de recibo y nota de crédito en el mismo archivo. |
| `apps/web/src/Management.tsx` | 3 598 | 19 componentes, 53 `useState`. |
| `apps/web/src/POS.tsx` | 2 264 | Componente `POS` de ~1 100 líneas (`:149-1266`), `Checkout` ~800 (`:1411-2209`). |
| `apps/web/src/styles.css` | 5 210 | |
| `tests/api.test.ts` | 12 203 | Un archivo, estado compartido. |
| `apps/api/src/invoice.ts` | 1 715 | |

### 5.2 Duplicación y reglas repartidas

- **Descuento efectivo de línea × global**: `POS.tsx:111-124`, `sales.ts:367-386` (aprobación) y `sales.ts:546-551` (cobro). Tres fórmulas, dos variantes (la web limita a 0-100, la API no).
- **Promociones**: `sales.ts:323-344`, `POS.tsx:78-107`, `pendingSales.ts:13-46`. Ya divergen: la de `POS.tsx` no tiene el `if (scope.lotId) return 0`.
- **Verificación del PIN de gerente** (buscar gerentes activos, filtrar `sale:manage`, `compare` en bucle): `sales.ts:406-417`, `cash.ts:536-545`, `:660-674`, `:743-758`, `realtime.ts:~280`.
- **Valores por defecto de Ajustes** repetidos sin esquema: `sellerDiscountLimit ?? 10` (`sales.ts:358`, `POS.tsx:1506`), `cashMovementApprovalLimit ?? 1000` (`cash.ts:684`, `admin.ts:119-122`), `cashDifferenceLimit ?? 100` (`cash.ts:851`, `alerts.ts:221`), `creditApprovalThreshold ?? 1000` (`shared/index.ts:397`), `returnDays ?? 30` (`sales.ts:1555`). `Settings.data` es `Json` y se lee con `(settings?.data as any)` en 20 sitios.

### 5.3 Manejo de errores, `any`, código muerto, constantes

- `any`: 226 en `apps/api/src`, 220 en `apps/web/src`, 644 en `tests` (regla de ESLint apagada). Datos de dinero en columnas `Json` sin tipo (`SaleItem.stockAllocations`, `SaleReturn.items`, `CashSession.closeDetails`, `Promotion.scope`) y leídos con `as any[]`.
- Excepciones tragadas: `sales.ts:1071-1138` (sync offline convierte cualquier excepción, incluidos errores de programación, en «conflicto» sin log ni Sentry); `realtime.ts:133` (`catch {}` en el sondeo de eventos, sin log); 8 `.catch(() => {})` en la web (IndexedDB, registro de equipo).
- Log crudo: `common.ts:735` `console.error(exception)` para todo 500; los errores de Prisma incluyen los argumentos de la consulta (posibles datos de clientes) — Sentry sí se sanea (`monitoring.ts:42`), el log de Render no.
- Código muerto o inalcanzable: `markup`, `breakEven`, `turnover`, `inventoryDays`, `reorderPoint` (`shared/index.ts:411-431`) solo se usan en pruebas; la rama de método `credit` con `creditDueDate` (`sales.ts:682-686`) ya no la envía la caja (U-crédito); `scope.lotId` de promociones (`sales.ts:330`) no se puede crear porque `admin.ts:1013-1020` lo descarta.
- Constantes mágicas: `48 * 3600000` (`sales.ts:504`), corte legado `2026-10-09T04:00Z` (`sales.ts:194`), `86400000` repartido, `7 * 86400000` del refresco (`auth.ts:171,181`).
- No hay TODO/FIXME ni `@ts-ignore`/`eslint-disable` (bien).
- La API no maneja `SIGTERM` (`main.ts`): un despliegue corta flujos SSE y peticiones en curso sin drenar.

### 5.4 Acoplamiento web ↔ API y tipos compartidos

- `packages/shared` comparte el esquema de **entrada** de la venta (`saleSchema`) y fórmulas, pero ninguna **respuesta** está tipada: la web usa `api<T = any>` (`api.ts:312`) con 44 rutas como cadenas.
- La web decide flujos por el **texto** del error: `POS.tsx:1770` (`/precios o promociones cambiaron/`), `POS.tsx:1774` (`/UUID ya corresponde/`), `pendingSales.ts:11`, `realtime.tsx:108`. El filtro global ya admite `code` (`common.ts:701`) pero `bad()` (`common.ts:61`) nunca lo envía.

### 5.5 Dependencias

- Detrás por versión mayor: Prisma 6.19 → 7, NestJS 11 → 12, Zod 3 → 4, Vitest 3 → 5, TypeScript 5.9 → 7, ESLint 9 → 10, Vite 7 → 8, Capacitor 7 → 8, lucide-react 0.468 → 1.x, pdfkit 0.17 → 0.20.
- `exceljs@4.4.0`: último publicado en 2023 (registro modificado 2024-12); es el lector de todas las importaciones XLSX (hay un guardián propio, `xlsx-guard.ts`).
- Pruebas sobre `embedded-postgres@18.4.0-beta.17` (beta, fijada) mientras producción es PostgreSQL 17 (`render.yaml:70`) y el CI de integración también 17.
- Versiones fijadas exactas solo en Prisma y Sentry API; el resto `^`. El lockfile congela; bien.
- `pnpm audit --prod`: sin vulnerabilidades.

---

## 6. Documentación y operación del repo

- **README desactualizado y contradictorio** (`README.md:1-5,46`): se titula «FitStore POS», dice «Aplicación de demostración» y «No se ha publicado un servidor externo», mientras `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` (§3e) dice «YA ESTÁ EN PRODUCCIÓN». Anuncia 848 ventas de semilla (la semilla crea 846), usuarios por correo (el login ya es por usuario), «deploy: Configuración de Nginx» (hoy es Render), y no avisa de que la integración necesita `pnpm build` antes.
- **`docs/DEPLOY-RENDER.md:3`** «no se ha creado, comprado ni desplegado ningún recurso» — contradice el estado real. `docs/DESPLIEGUE.md` (Docker/Nginx, «no se han ejecutado») y `DEPLOY-RENDER.md` conviven sin decir cuál manda.
- **`docs/ENTREGA.md`** describe la ronda 3 («57 pruebas de integración», «6 escenarios Chromium»); hoy son 209 y 78.
- 43 archivos en `docs/`; ~25 son actas de rondas de auditoría (`RONDA*`, `AUDITORIA_*`, `REVISION_*`). No hay un documento de arquitectura vigente (el `INSTRUCCIONES_ARQUITECTURA.md` es el encargo original), ni un «runbook» de incidentes (qué hacer si la API cae, si una migración falla a medias, cómo restaurar en Render — `DEPLOY-RENDER.md:369-383` lo lista como pendiente).
- **Bus factor**: 278 commits en 4 días; autores «Marcos Feliz» (174, en su mayoría trabajo de un asistente) y «Claude» (103). La coordinación (`AGENTS.md`, `docs/coordinacion/*`) son órdenes entre dos asistentes de IA. No hay ninguna persona desarrolladora que conozca el sistema; la dueña depende de que una IA lo opere. Una persona nueva necesitaría leer ~6 000 líneas de actas para reconstruir el porqué de las reglas.

---

## 7. No verificado

<<NOVERIF>>
