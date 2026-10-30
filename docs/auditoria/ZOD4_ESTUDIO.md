# Estudio: pasar de zod 3 a zod 4

Fecha: 30-oct-2026. Base: `origin/nexora-cloud` (rama `claude/zod4-estudio`). Solo lectura: no cambia código. Tarea aparte del aviso de zod (`docs/auditoria/SEGURIDAD_20_PUNTOS.md`, punto 13). El aviso se corrige solo con zod 4.6.6 o más.

## Situación actual

- `apps/api/package.json:35` y `packages/shared/package.json:12` declaran `"zod": "^3.25.0"`. La versión instalada es 3.25.76.
- `packages/shared` exporta `z` (lo re-exporta), así que casi toda la API lo usa a través de `@fitstore/shared`.
- `apps/api/src/invoice.ts:9` ya usa `import * as z4 from "zod/v4"` para el esquema de la IA, porque `@anthropic-ai/sdk/helpers/beta/zod` (`betaZodOutputFormat`) trabaja con zod 4. Esa parte ya es compatible.

## Conteo por script

Script de solo lectura sobre `apps/` y `packages/` (archivos `.ts`/`.tsx`, sin `dist`). No se añadió al repositorio. Resultado:

| Construcción | Usos | Archivos | Impacto en zod 4 |
|---|---:|---:|---|
| `z.string()` | 164 | 22 | Sin cambio de sintaxis. Los `.email()`, `.uuid()` y `.url()` se deprecian (ver abajo). |
| `z.object(` | 108 | 18 | Sin cambio de sintaxis. |
| `.default(` | 74 | 13 | Cambia la semántica: el valor por defecto se aplica antes de validar. Revisar los que tienen `.default({})` o `.default([])` (ver riesgos). |
| `.catch(` | 52 | 13 | Cambio menor de semántica en casos límite. Revisar los `.catch([])` de importación de GV (`gv.ts`). |
| `z.enum(` | 41 | 14 | Sin cambio. |
| `z.number()` | 40 | 11 | Sin cambio. |
| `.email()` / `.uuid()` / `.url()` / `.datetime()` / `.ip()` | 25 | 10 | Deprecados en favor de `z.email()`, `z.uuid()`, etc. Siguen funcionando. **uuid es más estricto** (ver riesgos). |
| `.refine(` / `.superRefine(` | 25 | 11 | `superRefine` está deprecado. Cambian el `path` y los parámetros de error. |
| `z.array(` | 16 | 8 | Sin cambio de sintaxis. |
| `.transform(` | 10 | 7 | Sin cambio sustancial. |
| `ZodError` / `.errors` | 7 | 2 | En zod 4 los errores están en `.issues`. La API ya usa `.issues` en el filtro (`common.ts`), así que el impacto está en los dos archivos que leen `.errors`. |
| `z.record(` (un argumento) | 3 | 2 | **Obligatorio cambiar**: zod 4 exige la clave: `z.record(z.string(), z.number())`. Ver lista abajo. |
| `z.preprocess` / `z.coerce` | 2 | 2 | Cambio menor en coerción. |
| `.strict()` | 2 | 1 | Deprecado: pasa a `z.strictObject(...)`. |
| `.passthrough()` | 1 | 1 | Deprecado: pasa a `z.looseObject(...)`. |
| `z.nativeEnum` / `.nonempty` / `errorMap` / `required_error` | 0 | 0 | No aplica. |

## Puntos que obligan a cambiar código

1. **`z.record` con un solo argumento** (3 usos):
   - `apps/api/src/alerts.ts:922`: `threshold: z.record(z.number())`.
   - `apps/api/src/catalog.ts:170`: `attributes: z.record(z.string()).default({})`.
   - `apps/api/src/catalog.ts:440`: `attributes: z.record(z.array(z.string().min(1)).min(1).max(30))`.
   En zod 4 cada uno pasa a `z.record(z.string(), ...)`. Es un cambio mecánico, pero cambia la firma.
2. **Importación desde `@fitstore/shared`**: `packages/shared` re-exporta `z` de zod 3. Hay que moverlo a zod 4 en un solo sitio, y después revisar los 22 archivos que lo usan.
3. **Dos caminos de zod**: `zod` (3.25) en la mayoría de archivos y `zod/v4` en `invoice.ts`. Al subir a zod 4 los dos deben apuntar a la misma versión, o `betaZodOutputFormat` y los esquemas de la API no encajan.

## Riesgos de comportamiento (hay que probar, no solo compilar)

- **`.uuid()` es más estricto en zod 4**: rechaza identificadores que no sean UUID RFC 9562 con bits de variante correctos. Los IDs de prueba con formato libre (`00000000-…`) pueden fallar. Los 25 usos de `.email()`/`.uuid()` deben revisarse con las pruebas de integración.
- **`.default()` antes de validar**: si un valor llega como `undefined`, zod 4 devuelve el default sin validarlo. Revisar `.default({})` y `.default([])` en `catalog.ts` y `gv.ts`.
- **`.catch([])` en importación de GV** (`gv.ts`, `importKeys`): con zod 4, un array que no pasa devuelve `[]` como hoy, pero los límites nuevos (`.max`) se aplicarían antes. Confirmar que la importación no cambia de resultado con un Excel normal.
- **Mensajes de error**: la API arma sus mensajes desde `issues` con `fieldLabel`, así que los textos en español no dependen del mensaje por defecto de zod. Aun así, las pruebas que comparen texto de error deben correrse.

## Propuesta de orden (si se decide)

1. Subir `zod` a 4.x en `packages/shared` y `apps/api` (lock), y unificar `zod/v4` → `zod`.
2. Cambiar los 3 `z.record` de un argumento.
3. Pasar `.strict()` → `z.strictObject` y `.passthrough()` → `z.looseObject`.
4. Correr `pnpm check` y las pruebas de integración contra Postgres en CI; revisar las que fallen por uuid.
5. Una rama por paso y CI verde antes del siguiente. Mientras tanto, mantener la mitigación actual (topes de cuerpo y de arrays de `claude/seguridad-zod-limites`).

## Lo que no se comprobó

- Que zod 4.6.6 sea compatible con `@anthropic-ai/sdk@0.131.0` en `betaZodOutputFormat`: se leyó el código, pero no se instaló ni se probó.
- Las pruebas de integración con Postgres: no corren en este contenedor.
- El conteo es por expresiones con regex. No detecta esquemas construidos en variables de otro archivo ni re-exports indirectos; por eso el número de archivos es una cota.
