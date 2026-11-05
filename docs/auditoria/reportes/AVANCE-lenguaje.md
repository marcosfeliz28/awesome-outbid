# Avance · lenguaje claro (A7) · 2-nov-2026

**Rama:** `claude-pc/aud-lenguaje`
**Commit de textos:** `e2e8124` (solo `apps/api/src/reportes/guia.ts`, textos; sin cambios de cálculo, campos ni estructura)

## Qué se hizo
- Se reescribieron los textos de margen, utilidad (ganancia), ticket promedio y rotación con un ejemplo en pesos. Se aplicó en 9 reportes.
- Pruebas: `tests/reportes-guia.test.ts` pasa con 120/120 en Node 24 (la prueba de guía completa está incluida en ese archivo). Formato con prettier en verde.
- Hallazgos registrados en `HALLAZGOS-lenguaje.jsonl`: 7 (1 corregido, 6 abiertos: 3 de lógica que necesitan decisión).

## Actualización (13:50, orden de Norexos 1)
- Se hizo `git merge origin/nexora-cloud` (trae el arreglo de `tests/portabilidad.test.ts:698`, causa del `verify` rojo: `no-unsafe-finally`).
- Se leyó el tramo final de `guia.ts` (1156–1449) y se añadieron ejemplos en pesos a «neta» (informe anual) y «promedio por venta» (informe mensual).
- `tests/reportes-guia.test.ts`: 120/120. Prettier: en verde.
- `pnpm check` local: typecheck y lint pasan. Fallan 14 archivos `-postgres` (11 pruebas) porque `initdb` no corre como root en este entorno (`Permission denied` sobre `/tmp/nexora-*`). No tienen relación con textos de guías. El build no llegó a correr localmente. El CI de la nube sí corre PostgreSQL real.

## Qué NO se hizo (y por qué)
- **Revisión completa de las 43 guías:** toda la guía quedó leída; el jargon pedido tiene ejemplo en pesos donde aplica. Los hallazgos de fondo (devoluciones, nombres «bruta/neta», fórmulas «por confirmar») siguen abiertos porque necesitan decisión de la dueña.
- **Muestra de PDF para Genesis: NO generada.** Las variables `NEXORA_CLAUDE_USER` y `NEXORA_CLAUDE_PASSWORD` están vacías en el entorno y en `/root/.nexora_claude`, así que `entrar.py` no puede iniciar sesión. No se inventaron datos para el PDF. Para hacerla hay que cargar las credenciales y repetir.
- **Reporte propuesto para la muestra:** `ventas-por-dia-semana`. Tiene pocas columnas, todas explicadas, no requiere cuadre de dinero y se entiende sin contabilidad. Falta validarlo con la dueña.

## Dudas abiertas (no inventadas)
- Regla de devoluciones por fecha (lenguaje-03) y «Bruta» en el resumen (lenguaje-02): la guía lo marca «por confirmar»; la decisión es de la dueña.
- Si el aviso «por confirmar» se muestra al lector final (lenguaje-07).

## Pendiente para el revisor (Sonnet)
- Confirmar que los ejemplos en pesos son correctos con la regla vigente (margen sin restar ITBIS).
- Leer el tramo 1156–1449 de `guia.ts`.
