# Avance · lenguaje claro (A7) · 2-nov-2026

**Rama:** `claude-pc/aud-lenguaje`
**Commit de textos:** `e2e8124` (solo `apps/api/src/reportes/guia.ts`, textos; sin cambios de cálculo, campos ni estructura)

## Qué se hizo
- Se reescribieron los textos de margen, utilidad (ganancia), ticket promedio y rotación con un ejemplo en pesos. Se aplicó en 9 reportes.
- Pruebas: `tests/reportes-guia.test.ts` pasa con 120/120 en Node 24 (la prueba de guía completa está incluida en ese archivo). Formato con prettier en verde.
- Hallazgos registrados en `HALLAZGOS-lenguaje.jsonl`: 7 (1 corregido, 6 abiertos: 3 de lógica que necesitan decisión).

## Qué NO se hizo (y por qué)
- **Revisión completa de las 43 guías:** leí en detalle el bloque de ventas, dinero, margen, inventario y clientes (líneas 1–1155 de `guia.ts`). El resto (final del informe formal, resumen de ventas, cajas, productos, cobros de cursos) solo se revisó por búsqueda de palabras clave. Falta lectura completa de ese tramo.
- **Muestra de PDF para Genesis: NO generada.** Las variables `NEXORA_CLAUDE_USER` y `NEXORA_CLAUDE_PASSWORD` están vacías en el entorno y en `/root/.nexora_claude`, así que `entrar.py` no puede iniciar sesión. No se inventaron datos para el PDF. Para hacerla hay que cargar las credenciales y repetir.
- **Reporte propuesto para la muestra:** `ventas-por-dia-semana`. Tiene pocas columnas, todas explicadas, no requiere cuadre de dinero y se entiende sin contabilidad. Falta validarlo con la dueña.

## Dudas abiertas (no inventadas)
- Regla de devoluciones por fecha (lenguaje-03) y «Bruta» en el resumen (lenguaje-02): la guía lo marca «por confirmar»; la decisión es de la dueña.
- Si el aviso «por confirmar» se muestra al lector final (lenguaje-07).

## Pendiente para el revisor (Sonnet)
- Confirmar que los ejemplos en pesos son correctos con la regla vigente (margen sin restar ITBIS).
- Leer el tramo 1156–1449 de `guia.ts`.
