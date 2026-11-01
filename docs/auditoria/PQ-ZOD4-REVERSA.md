# PQ-ZOD4: reversa de la migración a zod 4

Rama: `claude-pc/zod4`. Base: `origin/claude/zod4-estudio` (fe912af7), con la
fusión de `origin/nexora-cloud` (4b6dfbfe). Estudio: `docs/auditoria/ZOD4_ESTUDIO.md`.

## Commits de la migración (en orden)

| Paso | Commit | Módulo | Contenido |
|---|---|---|---|
| 1 | b3e494f0 | packages/shared | zod 3.25 a 4.6.7; `.strict()` a `z.strictObject` (2 sitios) |
| 2 | 1180e1c7 | apps/api (más un cambio en packages/shared) | zod 4.6.7 en api; errorMap reescrito; `z.string().uuid()` a `z.guid()` (api y shared); `z.record` con 2 argumentos (3 sitios); `.passthrough()` a `z.looseObject`; `invoice.ts` importa `"zod"` en lugar de `"zod/v4"`; `fieldLabel` acepta `PropertyKey[]`; tipo de `valid()` en `gv-citas.ts` |
| — | (sin commit) | apps/web | No importa zod; sólo consume `@fitstore/shared`. No requiere cambio. |
| 3 | (commit de este documento) | docs | Este archivo. |

Nota: el cambio de `uuid` en `packages/shared/src/index.ts` quedó dentro de
1180e1c7, no en b3e494f0. Se revierte con el mismo commit de api.

## Cómo revertir

Revertir siempre **los dos** commits de código, del más nuevo al más viejo:

```
git revert --no-edit 1180e1c7
git revert --no-edit b3e494f0
```

Si también se quiere quitar este documento: `git revert --no-edit <sha-del-documento>`.

Lockfile: `git revert` restaura el hunk de `pnpm-lock.yaml` de cada commit.
Para comprobar que quedó igual a la base:

```
git diff 4b6dfbfe -- pnpm-lock.yaml   # debe salir vacío
```

Si no sale vacío, restaurar a mano: `git checkout 4b6dfbfe -- pnpm-lock.yaml`.
Después: `pnpm install`, luego `pnpm typecheck` y `pnpm test`.

Sin impacto en datos: zod sólo valida. La migración no incluye cambios de
base de datos. Los ids que antes se aceptaban siguen aceptándose (z.guid
conserva el criterio anterior) y no se escribe nada distinto.

## Qué se rompe si se revierte parcialmente

- **Sólo 1180e1c7 (api):** api vuelve a zod 3, pero `@fitstore/shared` queda en zod 4. Los esquemas de api son de zod 3 y reciben `z` y `ZodError` de zod 4 a través de shared. El typecheck de api falla. No usar.
- **Sólo b3e494f0 (shared):** shared vuelve a zod 3, pero api queda en zod 4. Su errorMap, `z.guid`, `z.record` de 2 argumentos y `z.looseObject` dejan de existir en la copia de zod 3 de shared. El typecheck falla. No usar.
- **Reversión completa:** sin efectos colaterales conocidos.

El commit b3e494f0 por sí solo **no** pasa el typecheck de apps/api. Es el estado esperado del orden de la orden 105: api se corrige en el paso 2.

## Estado de las verificaciones (al cierre)

- `pnpm typecheck`: exit 0 (después de `pnpm --filter @fitstore/api db:generate`; sin el cliente de Prisma falla también en la línea base).
- `pnpm lint`: exit 0.
- `pnpm test` (vitest, incluye pruebas de base real con Postgres embebido): 103 archivos pasan, 1 omitido; 799 pruebas pasan, 11 omitidas; exit 0. Antes del cambio a `z.guid` fallaban 3 pruebas de `warehouses-postgres`, porque los ids de almacén generados con md5 (migración 202610240401) no tienen los bits de variante RFC.
- `pnpm check` en la línea base falla en `test` por dos suites de Postgres con EBUSY al borrar la carpeta temporal (ocurre sin estos cambios); en esta rama la corrida completa de `test` pasó.
- e2e / integración (`pnpm verify`, API en 3101, PWA en 4273, base en 5435, base nueva): **no pasa**. Se ejecutó sobre `claude-pc/zod4` y sobre la base `4b6dfbfe`:
  - Base (4b6dfbfe): 16 pruebas fallan (15 de `drive-backup`, 1 de `dinero-auditoria`). Esa línea base viene del entorno local, no de zod.
  - Rama: 20 pruebas fallan: las 16 de la base más 4 nuevas (abajo).

### Regresión de zod 4 no resuelta: `.default()` dentro de `.partial()`

En zod 4, `.partial()` sobre un campo con `.default(x)` aplica el valor por defecto cuando la clave no llega; en zod 3 se dejaba `undefined`. Los PATCH del código dependen del comportamiento de zod 3 (los comentarios de `gv-citas.ts` 414 y `gv.ts` 353 lo dicen). Consecuencia: un PATCH que no envía un campo lo sobrescribe con su valor por defecto.

- `tests/gv-citas-api.test.ts` («crea, edita, cobra…») falla: la edición deja `artists` en `[]`. Causa: `appointmentFields.artists` tiene `.default([])` y `gv-citas.ts` 416 usa `.partial()`. Lo mismo afectaría `afterHours` (false), `tip` (0) y `status` (`agendada`).
- Otros `.partial()` con campos que tienen `.default()` (riesgo, no probado por la suite): `admin.ts` 313 (`customerSchema.partial`, `notes`), `catalog.ts` 507 (`variantSchema.partial`, `attributes`), `catalog.ts` 418, `gv.ts` 236 y 350 (`courseInput` y enrollment), `gv-citas.ts` 539 (`leadFields.partial`).

Arreglo pendiente (no aplicado): quitar el valor por defecto de esos campos antes de `.partial()` (por ejemplo, un helper que sustituya `ZodDefault` por su interior), o aplicar los defaults al crear. Hasta entonces esta rama **no debe fusionarse**.

Otras 3 suites nuevas en la corrida de la rama, probablemente consecuencia de una caja que no quedó cerrada: `tests/desglose-suma-api.test.ts` («caja es obligatorio» y fallo en `afterAll`) y `tests/reportes-margen-api.test.ts` («El fondo es menor que lo dejado en el último cierre»). No se investigaron más.

## Riesgos de comportamiento (ver también ZOD4_ESTUDIO.md)

1. **uuid a guid:** el cambio es intencional. Si algún día se quiere la validación RFC estricta, antes hay que regenerar los ids de almacén de la migración 202610240401.
2. **email():** zod 4 usa una regex más estricta. Correos antiguos que zod 3 aceptaba pueden rechazarse al editarse (`admin.ts` 279, 313, 1059; `auth.ts` 428; `create-admin.ts` 21).
3. **Mensajes por defecto:** los errores sin texto propio dentro de `invalid_union` o `discriminatedUnion` salen en el texto por defecto de zod 4, en inglés. Sitios: `offline-sales.ts` 44, `gv.ts` 466, `courier.ts` 75.
4. **`.default()` sin validar:** zod 4 devuelve el valor por defecto sin pasarlo por el esquema. Revisar sobre todo `saleSchema` (sales.ts 1479), `cashCloseSchema` (cash.ts 1120), `configSchema` (admin.ts 849) y las importaciones de GV.
5. **`.catch([])` en importación de GV** (`gv.ts` 836): un arreglo inválido se vacía en silencio. Igual que en zod 3, pero es pérdida silenciosa de datos en importación.
6. **Mensajes del errorMap:** `invalid_enum_value` pasó a `invalid_value`, que también cubre `z.literal`. Esos literales ahora muestran «no es una opción válida» en lugar del texto en inglés de antes. `too_small` y `too_big` usan `origin` (string, array o number).
7. **`z.coerce.number()`:** un valor vacío o `null` se convierte en 0 (igual que antes); con `min(1)` falla. Sitios: `alerts.ts` 857, `sales.ts` 3666.
8. **`create-admin.ts`** importa zod directamente, sin el errorMap de `common.ts`: sus mensajes salen en el texto por defecto de zod 4.

## Llamadas parse() y safeParse()

Leyenda de notas:
- **G**: uuid pasó a `z.guid()` (ids md5 aceptados como antes).
- **D**: `.default()` no se valida (zod 4).
- **E**: `email()` con regex más estricta.
- **T**: `datetime()` sin cambio (sin `offset` no acepta zona).
- **F**: refine/superRefine conserva path y message.
- **M**: mensaje por defecto cambia (union sin mensaje propio).
- **C**: coerción de vacío/null.
- **-**: sin diferencia relevante.

Total: **11 llamadas directas** de `.safeParse`/`.parse` en `apps/api/src` y `packages/shared/src` (más el cuerpo del helper `parse()` en `common.ts`, línea 234), y **180 líneas** que llaman al helper `parse(schema, input)` de `apps/api/src/common.ts`. Ese helper llama a `schema.parse`, lanza ZodError, y el filtro global de `common.ts` responde 400 con los `issues`.
La auditoría devolvió 11 llamadas directas; el brief esperaba 13. Las otras dos no aparecieron en el alcance.

### Llamadas directas (método)

| Sitio | Esquema | Notas |
|---|---|---|
| apps/api/src/gv-citas.ts:179 | `schema.safeParse` genérico en `valid()` (appointment y lead) | T, D; el `issue.message` se muestra al usuario |
| apps/api/src/sales.ts:1501 | saleSchema | T, D(0) |
| apps/api/src/sales.ts:1628 | saleSchema | T, D(0) |
| apps/api/src/sales.ts:1648 | z.guid() (cashSessionId) | G |
| apps/api/src/invoice.ts:440 | aiInvoiceSchema | no revisado en detalle por la auditoría |
| apps/api/src/auth.ts:193 | terminalShape (id) | G |
| apps/api/src/offline-sale-review.ts:241 | saleSchema | T, D(0) |
| apps/api/src/gv.ts:821 | importSchema | D([]) |
| apps/api/src/gv.ts:836 | importKeys | catch([]): un arreglo inválido se vacía (riesgo 5) |
| packages/shared/src/index.ts:1096 | z.strictObject(shape) en surveyAnswers | ya migrado; - |
| apps/api/scripts/create-admin.ts:21 | z.object (email, password con refine) | E, M (zod directo, sin errorMap) |

### Llamadas al helper parse(schema, input)

Conteo por archivo: cash 12, alerts 4, admin 30, auth 6, courier 4, catalog 13, gv-citas 11, gv 13, income-report 1, incentives 4, invoice 1, merchandise 6, inventory 15, offline-sale-review 1, offline-sales 1, realtime 7, reports 6, sales 44, warehouses 1 (total 180).

Cada fila indica línea y notas. Sin nota de G, el sitio no usa uuid.

**cash.ts:** 845 (D), 957 (G), 985 (G), 1069 (-), 1087 (G), 1120 cashCloseSchema (D, F), 1149 (G), 1172 (G), 1180 (G), 1461 (G), 1476 (-), 1482 (G)

**alerts.ts:** 857 (D, C), 892 (-), 898 (G), 927 alertRulesBody (record de 2 argumentos)

**admin.ts:** 279 customerSchema (E, D), 302 (G), 313 customerSchema.partial (E, D), 358 (G), 359 (-), 590 (G), 650 (-), 661 (G), 662 (-), 678 (G, T, D), 729 (-), 732 (G), 752 (D), 806 (G), 849 configSchema (D, F), 942 (-), 957 (G), 1059 (E), 1074 passwordSchemaForRole (F), 1118 (-), 1132 (G), 1156 (-), 1236 (G), 1237 (-), 1253 (-), 1306 (-), 1311 (G), 1343 (T), 1393 (-), 1395 (G)

**auth.ts:** 428 login (E, F), 519 changePassword (F), 588 passwordSchemaForRole (-), 653 (F), 707 (-), 831 (G)

**courier.ts:** 44 rangeInput (-), 75 feeInput (M), 83 (G), 200 (G)

**catalog.ts:** 252 categoryBody (D), 270 (-), 286 (G), 351 (G), 381 productSchema (G, D), 415 productSchema.omit (G, D), 424 (G), 439 record de 2 argumentos (ya migrado), 451 (G), 506 variantSchema.partial (D), 512 (G), 622 productSchema (G, D), 658 (G)

**gv-citas.ts:** 302 (G), 309 (G), 319 (-), 368 createKeys/appointmentFields (G, T, D), 415 (T, D), 419 (G), 458 gvPaymentInput (G, F), 462 (G), 479 (-), 496 createKeys/leadFields (G, D), 539 leadFields.partial (D)

**gv.ts:** 147 (G), 206 courseInput (-), 236 (-), 298 enrollmentFields (G, D), 347 (G, D), 356 (G), 386 gvPaymentInput (G, D, F), 413 (-), 417 (G), 466 discriminatedUnion verified (M), 476 (G), 537 (-), 696 (-)

**income-report.ts:** 69 (G)

**incentives.ts:** 652 (-), 803 (-), 855 (-), 1029 (G)

**invoice.ts:** 39 extractedSchema (D, F)

**merchandise.ts:** 174 (G), 189 (G), 210 (G), 242 (-), 314 (-), 348 operationSchema (G, D)

**inventory.ts:** 626 (G), 639 (G, T, D), 967 (G, T), 1020 (-), 1023 (G), 1046 (G, D, T), 1127 (G), 1326 (G), 1348 (G), 1444 (G), 1458 (-), 1461 (G), 1496 (G), 1555 (G), 1557 (G)

**offline-sale-review.ts:** 94 discardSchema (G, D)

**offline-sales.ts:** 44 resolution discriminatedUnion (G, M)

**realtime.ts:** 162 (G), 260 (G), 270 (G), 272 (-), 330 (G), 337 (-), 420 (G)

**reports.ts:** 766 (G), 771 (G), 784 (G), 1375 (-), 1806 (G), 1823 (G)

**sales.ts:** 1479 saleSchema (G, T, D, F), 1488 z.looseObject (G), 1673 (-), 1829 (-), 1878 (G), 1879 (G), 1964 (G), 2015 (G), 2016 (-), 2072 (G), 2106 (G), 2107 (D), 2155 (G), 2156 (G), 2207 (G), 2208 (G), 2209 (-), 2420 (-), 2422 (G), 2442 (G), 2480 (G), 2680 (-), 2792 (G), 2857 (-), 2858 (G), 2950 (G), 2951 (G), 3046 (-), 3056 (G), 3119 (-), 3123 (G), 3227 (D), 3665 (G), 3666 (C, D), 3703 (G), 3761 (G), 3776 (G), 3841 (G), 3940 (G), 4091 (G), 4092 (G), 4415 (G), 4563 (G), 4685 (G)

**warehouses.ts:** 116 transferSchema (G, F)

## Cobertura de la auditoría

No se leyeron por completo: cash.ts 2209, sales.ts 2680, 3046, 3227 (sólo por grep), admin.ts 942, 1118, 1237, 1306, 1343, 1393, e invoice.ts 440. Esas filas se marcaron por revisión rápida y deben confirmarse antes de dar la reversa por cerrada.
