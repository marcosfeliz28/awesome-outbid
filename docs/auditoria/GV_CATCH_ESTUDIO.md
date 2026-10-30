# Estudio: los `.catch([])` de la importación de GV

Fecha: 30-oct-2026. Base: `origin/nexora-cloud` (rama `claude/gv-catch-estudio`). Solo lectura: no cambia la importación. Pendiente anotado en `docs/auditoria/SEGURIDAD_20_PUNTOS.md` (zod, tarea aparte) y en `claude/seguridad-zod-limites`.

## Qué hay

`apps/api/src/gv.ts`, endpoint `POST /gv/import` (permiso `*`):

- **Esquema principal** `importSchema` (líneas 97-122). Tiene topes: `courses` máximo 500 (línea 106), `enrollments` máximo 5000 (línea 118), `payments` por inscripción máximo 50 (línea 115), `appointments` y `leads` máximo 5000 (líneas 121-122).
- **Esquema de claves** `importKeys` (líneas 125-135). Solo sirve para revisar claves repetidas y referencias. Sus arrays tienen `.catch([])` (líneas 126, 132 y 135) y **no tienen tope**.
- **Uso de `importKeys`** (línea 721): solo se evalúa si `importSchema` ya falló. Sirve para que el informe de errores incluya también las claves repetidas, aunque falle otro campo.

## Qué pasa con un array enorme

Caso 1: `courses` con 501 elementos.
1. `importSchema.safeParse` falla por `.max(500)`. Sus issues entran en `errors` (líneas 706-710).
2. Como `parsed` falló, se usa `importKeys.safeParse(body)`. En `importKeys`, `courses` tiene `.catch([])`, así que el array grande se reemplaza por `[]` **solo para las revisiones de claves repetidas**.
3. Al final, `if (errors.length) bad(...)` (línea 818) rechaza la importación: «La importación tiene errores (no se guardó nada)».

Resultado: **la importación se rechaza**. No hay escritura parcial ni aceptación silenciosa. Lo único que cambia es el detalle del informe: si además hubiera claves repetidas en esa lista grande, no aparecerían en `errors`, porque esa lista se vació para la revisión de claves. El informe sigue listando el error de tope.

Caso 2: `enrollments` con 5001 elementos. Mismo razonamiento: `importSchema` falla con `.max(5000)`, `importKeys.enrollments` tiene `.catch([])`, y la importación se rechaza.

Caso 3: un array válido dentro de un objeto inválido. Sin cambio: se rechaza por el objeto, como hoy.

## Conclusión

- Los `.catch([])` de `importKeys` **no aceptan datos inválidos**. Solo afectan la calidad del informe de errores, y únicamente cuando la importación ya fue rechazada.
- Quitar esos `.catch` no cambiaría la aceptación: la importación seguiría rechazándose por `importSchema`.
- Los topes del esquema principal ya cubren la colección. El único hueco es que `importKeys` procesa cuerpos grandes antes de rechazar, lo que cuesta CPU, no seguridad de datos. El tope de cuerpo (100 kb, o 4 MB solo para `/api/gv/import`, `apps/api/src/main.ts:44-45`) limita ese costo.

## Recomendación

No cambiar nada en la importación por ahora. Si se quisiera un informe de errores más completo, bastaría con dar tope también a `importKeys` (por ejemplo `.max(500)` y `.max(5000)`) para que el procesamiento de un cuerpo grande se detenga antes. Eso es un cambio pequeño, pero no cambia qué se acepta, así que no es urgente.

## Lo que no se comprobó

- Las pruebas de integración de la importación (`tests/gv-adversarial*`) necesitan Postgres real y corren en CI. Este estudio se basa en leer el código, no en ejecutarlo.
- Que el informe de errores en el caso de claves repetidas dentro de un array sobredimensionado sea el esperado: no se probó con datos reales.

## Corrección a un mensaje anterior

En la nota a Norexos 1 sobre `claude/seguridad-zod-limites` escribí que un array enorme «se trata como vacío sin error». Es incorrecto: la importación se rechaza con error. El `.catch([])` solo vacía la revisión de claves, que ya no tiene efecto porque la importación falla.
