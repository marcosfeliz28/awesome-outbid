# Resultados de ChatGPT Nube

## 7-nov-2026 · Cola N1

### 1. Auditoría del contrato

Entregada en `docs/venta/contrato/AUDITORIA_CONTRATO_7NOV.md`. Se contrastaron
los cinco documentos y `PUNTOS_PARA_ABOGADO.md` contra `origin/nexora-cloud`
`3606676a` y el código candidato de IA. Resultado: dos desajustes altos y cuatro
medios; se propuso texto corregido para cada uno. No se cambiaron precios.

### 2. Auditoría `claude-pc/ia-ventas-rescate` (`8954a099`)

**Resultado:** no se encontró una vía para leer otra empresa ni ejecutar
escrituras, pero queda una precisión de seguridad antes de mezclar.

- **Aislamiento por empresa: aprobado.** `apps/api/src/assistant.ts:171-178`
  decide herramientas desde el actor; `323-430` vuelve a validar el nombre y el
  esquema; `653-656` pasa el mismo actor a `dashboardBreakdown`/`mySales`. Esas
  consultas filtran por `actor.branchId`. Los esquemas no aceptan sucursal,
  empresa o usuario suministrados por el modelo.
- **Permisos y costo: aprobado.** Una cajera solo recibe `mis_ventas`; un usuario
  sin `reports:read` ni rol de cajera obtiene 403; `canSeeProfit` impide costo,
  ganancia y margen a cajeras incluso si alguien les añade `profit:read`.
- **Solo lectura: aprobado.** Solo hay cuatro herramientas agregadas y
  `mis_ventas`; todas leen. Una herramienta inventada o parámetros extra se
  rechazan.
- **No persistencia del texto: aprobada con límite externo.** `AiUsage` guarda
  metadatos/tokens, no texto. No se encontró registro de pregunta/respuesta en
  base o bitácora. La pregunta sí viaja a Anthropic y no se verificaron sus logs
  ni los del alojamiento.
- **Hallazgo medio — no existe rechazo previo de inyección.**
  `apps/api/src/assistant.ts:432-448,464,483-490` instruye al modelo para ignorar
  la inyección y los esquemas impiden que se convierta en acceso o escritura,
  pero la pregunta maliciosa se envía al proveedor. El test llamado “inyección”
  demuestra rechazo de llamadas de herramienta inventadas o con `branchId`, no
  rechazo de la entrada. Arreglo propuesto: renombrar la garantía y el test como
  “neutralización de efectos de inyección”; si la orden exige rechazo literal,
  añadir un filtro determinista antes de `client.create`, con prueba de que el
  proveedor no fue llamado.
- **Seguridad-20:** 1 sin secretos en el diff; 2 variables documentadas sin
  valor; 3/4 autenticación global y `@Permit("authenticated")`; 5 permisos
  probados; 6 zod estricto y máximo 500; 7 React presenta texto sin HTML; 8 tope
  diario atómico; 9 actor y sucursal validados; 10/11 sin cambio; 12 errores
  externos se sustituyen por mensaje genérico; 13/14 sin dependencia nueva;
  15 sin artefactos públicos sensibles; 16 consulta SQL parametrizada y sin
  migración destructiva; 17 no toca credenciales; 18 búsqueda por patrones sin
  hallazgo; 19 esta auditoría; 20 límites expresamente documentados.

**Prueba ejecutada:** `pnpm exec vitest run tests/assistant-unit.test.ts` →
18/18 aprobadas. La primera ejecución falló antes de las pruebas por cliente de
Prisma no generado (`Cannot find module '.prisma/client/default'`); después de
`prisma generate`, pasó. La prueba API con PostgreSQL no se ejecutó en esta
auditoría y queda para CI.

### 3. Auditoría `claude-pc/ia-medidor` (`0d176e79`)

**Migración:** aprobada. `202611070001_ai_usage/migration.sql` solo crea tabla e
índice; no altera ni borra datos existentes. La ausencia de FK a usuario es
deliberada para conservar la medición si se elimina un usuario.

**Permiso y empresa:** aprobado con una mejora defensiva. `GET /ai/usage` usa
`@Permit("*")` (`apps/api/src/ai-usage.ts:108-110`) y filtra el uso por
`actor.branchId` (`120-127`). La consulta posterior de nombres (`132-143`) no
repite `branchId`; los UUID globales hacen improbable una mezcla normal, pero
conviene añadir el filtro para defensa en profundidad y una prueba 403/tenant.

**Hallazgo medio — el costo de caché no puede ser exacto.**
`apps/api/src/ai-usage.ts:43-55` suma `cache_read_input_tokens` y
`cache_creation_input_tokens`; `costUsd` aplica una sola tarifa `cache`
(`14-29`). Lectura y creación de caché son categorías distintas y pueden tener
precios diferentes. Arreglo propuesto: conservar ambos contadores y dos tarifas
(`cacheRead`, `cacheWrite`) o calcular cada componente antes de guardar. No
cargar precios ni usar el total para cobrar hasta corregirlo.

**Hallazgo medio — total truncado silenciosamente.**
`apps/api/src/ai-usage.ts:120-129` usa `take: 20000` sin orden, paginación ni
aviso. En intervalos grandes el total y los desgloses pueden quedar incompletos.
Arreglo propuesto: agregaciones SQL/Prisma por empresa y rango o paginación
estable; si se conserva el límite, devolver `truncated: true`.

**Estado de precios:** correcto como medida de seguridad, pero no operativo.
`apps/api/src/ai-prices.ts:1-13` deja todas las tarifas en `null`; por tanto el
costo mostrado es `null`, no un costo real. Debe verificarse la tarifa oficial
del modelo antes de cobrar.

**Prueba ejecutada:** `pnpm exec vitest run tests/ai-usage.test.ts` → 5/5
aprobadas después de generar Prisma. `pnpm check` no fue una validación válida:
se lanzó simultáneamente en dos worktrees que comparten el almacén virtual de
pnpm y el cliente Prisma generado quedó cruzado; TypeScript informó en cascada
que `Database` no tenía modelos. No se atribuye ese fallo al código auditado.
Los tres CI de esta rama de resultados se comprobarán después del push.

### Límites

- Auditoría de código y pruebas unitarias; sin producción, Render, base de la
  tienda, proveedor real de IA ni credenciales.
- No se confirmó retención de Anthropic, Render o Sentry.
- No se modificó código de las ramas auditadas.
