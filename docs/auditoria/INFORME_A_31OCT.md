# Informe de auditoría de ramas · 31-oct-2026 (Agente A, solo lectura)

Base: `origin/nexora-cloud` (d10183b). Controles: `docs/auditoria/SEGURIDAD_20_PUNTOS.md` y skill `seguridad-20`. Método: `git fetch` de cada rama y `git diff origin/nexora-cloud...<rama>`; no se ejecutaron pruebas, build ni llamadas a producción. Lo no comprobado está marcado **NO COMPROBADO**.

## Alcance y ramas

| Rama | Estado | Notas |
|---|---|---|
| `claude-pc/rediseno-tienda` (8ad2c3c) | auditada | 45 archivos, +908/−34 |
| `claude-pc/t33-rebase` (182e227) | auditada | 23 archivos, +1619/−13. Incluye IA de ventas (`assistant.ts`) |
| `claude-pc/zod4` | **no existe** en origin | Se encontró `claude/zod4-estudio` (fe912af), fuera de la lista pedida; no auditada. Confirmar si es la que se quiere |

## Veredicto por rama

- **claude-pc/rediseno-tienda:** NO cumple la regla de alcance. Debe ser solo presentación y nombre Norexos, pero añade lógica de dinero (`KpiStrip.tsx`, `kpiStripModel.ts`: utilidad y margen calculados en el cliente). No toca ventas, caja, storage ni cola offline (verificado en el diff). **No mezclar** hasta quitar `KpiStrip` o reducirlo a presentación y corregir R1 y R2.
- **claude-pc/t33-rebase:** sin hallazgos altos ni medios. Cumple los controles revisados (permisos, solo lectura, privacidad, zod, migraciones aditivas). Hallazgos bajos. No toca dinero, caja, storage ni cola offline. Pendiente: pruebas con Postgres (NO COMPROBADO).

## claude-pc/rediseno-tienda

| ID | Gravedad | Archivo:línea | Hallazgo | Control |
|---|---|---|---|---|
| R1 | **media** | `apps/web/src/kpiStripModel.ts:39` y `apps/web/src/KpiStrip.tsx:29` | «Utilidad de hoy» = ventas − costo en el cliente, con `margin` por defecto 0. El servidor quita `costTotal` a la vendedora (`common.ts:368-370`). Si una cuenta tiene `profit:read` y no ve costos, la tarjeta muestra la venta como utilidad y «0 % de margen». Es información falsa de dinero. | 5 |
| R2 | **media** | `apps/web/src/KpiStrip.tsx:24` y `apps/web/src/Dashboard.tsx:305` | La consulta de ventas está desactivada sin `reports:read`, pero la franja se muestra igual: «Ventas de hoy RD$ 0.00 · 0 facturas» y «Sin faltantes». Son cifras que no se consultaron, presentadas como reales. | 20 |
| R3 | media (alcance) | `apps/web/src/kpiStripModel.ts`, `apps/web/src/KpiStrip.tsx` | Violación de la regla de alcance de la orden: el rediseño no debe tocar lógica ni dinero. Además, el cálculo de margen y utilidad duplica lo que devuelve la API. | — |
| R4 | baja | `apps/web/src/styles.css:1090` | La regla base `.kpi-card {` se renombró a `.kpi-strip .kpi-strip-card`. `Dashboard.tsx:348` y `MonthReport.tsx:112` siguen usando `.kpi-card`; pierden la base (quedan reglas en `styles.css:3124` y `:3616`). Efecto visual **NO COMPROBADO** en navegador. | — |
| R5 | baja | `packages/ui/src/nx-money.ts:3` | `formatDOP` no tiene usos fuera de su archivo (grep en `apps`, `tests`, `packages`). Código muerto, y su formato difiere de `formatMoney`. | 14 |
| R6 | baja | `apps/web/src/main.tsx:10-11` | Importa CSS con ruta relativa fuera de `apps/web` (`../../../packages/ui/src/...`). Funciona solo si el build lo resuelve. Build **NO COMPROBADO**. | 13 |
| R7 | baja | `docs/**/*.png` (capturas) | Se añaden 3 capturas PNG. Su contenido no se revisó; podrían mostrar cifras reales de la tienda. **NO COMPROBADO**. | 15 |

Comprobado sin hallazgo en rediseno:
- Nombre Norexos (`index.html`, `icon.svg`, `vite.config.ts` manifest, textos de `App.tsx`, `POS.tsx:2341`, `Prints.tsx`, `pwaUpdatePolicy.ts`, `realtime.tsx`): solo textos. No cambian claves de `localStorage` ni `sessionStorage` (grep sin coincidencias en `apps/web/src`).
- Secretos en el diff: 0 aciertos (patrones `sk-ant-`, `AKIA`, `ghp_`, `github_pat_`, `xox[bp]-`, bloques PEM).
- XSS: sin `innerHTML` ni `dangerouslySetInnerHTML` en las líneas añadidas.
- Pruebas: `afirmaciones.test.ts`, `acerca-de.spec.ts` y `caja-web.spec.ts` solo cambian el nombre. Se añaden `f2-01/02/03` a `vitest.config.ts`. **NO COMPROBADO** que pasen.

## claude-pc/t33-rebase (IA de ventas, «Preguntar a Norexos»)

| ID | Gravedad | Archivo:línea | Hallazgo | Control |
|---|---|---|---|---|
| T1 | baja | `apps/api/src/assistant.ts:29-30`; `.env.example`; `render.yaml` | `ASSISTANT_PRICE_IN_USD_PER_MTOK` y `ASSISTANT_PRICE_OUT_USD_PER_MTOK` se leen en código, pero no están en `.env.example` ni en `render.yaml`. Solo aparecen en `ESTADO_T33.md:21`. | 2 |
| T2 | baja | `apps/api/src/assistant.ts:607` (`@Post("ask")`), tope en `:23` | No hay límite por minuto en la IA. Solo el tope diario de 30 por usuario (`AssistantUsage`). Cumple lo que pide el skill (tope diario), pero una cuenta puede gastar 30 llamadas en segundos, hasta 4 rondas y 600 tokens cada una. Costo real **NO COMPROBADO**. | 8 |
| T3 | baja | `apps/api/src/assistant.ts`, función `ask`, bloque `try/catch` tras el bucle de rondas | El `catch {}` descarta el error original y solo devuelve 502. Sin registro, un fallo del proveedor no deja rastro. | 12 |
| T4 | baja | `apps/api/src/assistant.ts`, rama `top_productos` | Con `orden` = unidades, `sort` devuelve 0 y se usa el orden de `bd.top`, que no se verificó. **NO COMPROBADO**. | 20 |

Comprobado sin hallazgo en t33:
- **Permisos (3, 5, 9):** `ask` y `status` con `@Permit("authenticated")` (`:588`, `:607`). `toolsFor` niega sin `reports:read` (`:157-163`), y `runTool` revisa otra vez (`:318`). Las cajeras solo tienen `mis_ventas`.
- **Costos a quien no debe (5):** `canSeeProfit` excluye a la vendedora y `strip` quita `cost`, `profit`, `margin` y `unitCost` (`:153`, `:417`). `common.ts:539` añade `categories` a la lista de `safe()`. `RUTAS_Y_PERMISOS.md` suma las 2 rutas nuevas (189).
- **Entrada (6):** `z.object({question}).strict()`, mínimo 1 y máximo 500 caracteres (`ask`, controlador).
- **Inyección y XSS (7):** la respuesta se pinta como texto con `pre-wrap` (`AssistantPanel.tsx:75`). El prompt marca los resultados como datos y la IA es de solo lectura (`system`, `:420-428`). Ninguna herramienta escribe; el registro se limita a `AssistantQuery` y `AssistantUsage`.
- **SQL (16):** `$queryRaw` con plantilla etiquetada y parámetros (`usageStore.reserve`, `:552`).
- **Privacidad:** el texto de preguntas no se guarda. La migración `202611010002` pone en `NULL` el texto de `AssistantQuery` y el esquema lo documenta. Las herramientas no devuelven nombres ni teléfonos de clientes (solo totales, productos y bancos).
- **Secretos (1):** solo `ANTHROPIC_API_KEY` vacía en `.env.example:13`. Sin patrones de llave en el diff.
- **Migraciones (16):** `CREATE ... IF NOT EXISTS`, aditivas. No borran tablas ni datos de venta.
- **Dinero y caja:** ningún archivo de ventas, caja, reportes ni cola offline entra al diff.
- **Pruebas:** `caja-borrador.spec.ts` solo añade una espera (`draftSaved`), no debilita la aserción. Las pruebas nuevas (`assistant-api.test.ts`, `assistant-unit.test.ts`) **NO COMPROBADO** en este contenedor: las de Postgres no corren aquí.

## Tabla de controles para las dos ramas

| # | Punto | rediseno-tienda | t33-rebase |
|---|---|---|---|
| 1 | Llaves | OK | OK |
| 2 | Variables de entorno | n/a | T1 (baja) |
| 3 | Rutas con permiso | n/a | OK |
| 4 | Autenticación | n/a | n/a |
| 5 | Acceso por usuario | R1 (media) | OK |
| 6 | Formularios | n/a | OK |
| 7 | XSS | OK | OK |
| 8 | Límite de tasa | n/a | T2 (baja) |
| 9 | Endpoints | n/a | OK (**NO COMPROBADO** `audit`) |
| 10 | CORS | n/a | n/a |
| 11 | Cabeceras | n/a | n/a |
| 12 | Modo debug y registros | n/a | T3 (baja) |
| 13 | Dependencias | R6 (baja, build NO COMPROBADO) | sin cambio en `package.json` |
| 14 | Paquetes sin uso | R5 (baja) | OK |
| 15 | Archivos expuestos | R7 (baja) | OK |
| 16 | Base de datos | n/a | OK |
| 17 | Hashes | n/a | n/a |
| 18 | Secretos en git | OK | OK |
| 19 | Auditoría | este informe | este informe |
| 20 | Sin errores | R2, T4 | T4 (NO COMPROBADO) |

## Lo que no se hizo

- No se ejecutaron pruebas, `pnpm check`, build ni CI. No se llamó a Render, a la base ni a la API desplegada.
- No se revisó el contenido visual de las capturas PNG.
- No se usaron credenciales.
- No se tocó ninguna otra rama ni se abrió PR.
- Falta confirmar qué rama es la de zod 4 (`claude-pc/zod4` no existe; existe `claude/zod4-estudio`).

## Recomendación

1. **rediseno-tienda:** no mezclar. Quitar `KpiStrip` y `kpiStripModel.ts` del rediseño (o dejarlos fuera de esta rama) y restaurar la regla `.kpi-card` (R4). Con eso, queda solo presentación y nombre.
2. **t33-rebase:** se puede mezclar tras pruebas en verde con Postgres y tras corregir T1 (documentar las dos variables de precio). T2 a T4 son mejoras opcionales.
3. Confirmar la rama de zod 4 antes de auditarla.
