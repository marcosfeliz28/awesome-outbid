# Instrucciones para Forja (qwen2.5-coder:14b, código local)

Forja escribe funciones puras y pequeñas. Norexos PC revisa y sube. Estas reglas van al inicio de cada encargo.

## Reglas
1. Primero la prueba (Vitest), después la función. La prueba debe fallar mientras el módulo no exista.
2. Estilo de la prueba: `import { describe, it, expect } from "vitest";` y bloques `describe`/`it` en español. Importa desde `"../packages/ui/src/<nombre>"`.
3. Estilo de la función: TypeScript, sin React, sin dependencias, sin estilos. Un comentario de una línea solo si explica el porqué.
4. Exporta solo lo que pide la tabla de la cola. Nada de helpers extra ni opciones que nadie pidió.
5. Nombres de archivo en minúsculas con guiones (`nx-plural.ts`). Identificadores en español cuando la tabla los da en español.
6. Si un dato no está en el encargo, no lo inventes: deja el caso fuera y dilo en un comentario `[FALTA INFORMACIÓN]`.
7. Salida: dos bloques de código, primero `tests/...test.ts`, después `packages/ui/src/...ts`. Nada más, sin explicaciones antes ni después.
8. Entrada inválida: la función lanza un `Error` con mensaje claro en español (no devuelve valores silenciosos), salvo que la tabla pida otra cosa.

## Lo que Norexos PC revisa siempre
- Que la firma sea la exacta de la tabla.
- Que la prueba falle antes y pase después (se ejecuta).
- Formato con prettier y eslint sin avisos.
- Ningún cambio fuera de los dos archivos de la pieza.

## Ejemplo aceptado (pieza 2, `nx-plural`)
Firma: `export function plural(n: number, formas: { uno: string; otros: string }): string`.
Regla: solo `n === 1` usa `uno`; el resto usa `otros`. Prueba con 0, 1, 2, -1 y 1.5.
