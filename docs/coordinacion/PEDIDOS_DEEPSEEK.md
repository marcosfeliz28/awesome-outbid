# Pedidos de DeepSeek (herramientas, skills, plugins)

Regla: si DeepSeek necesita una herramienta, skill o plugin, lo anota aquí (qué, para qué, riesgo). Claude PC lo reenvía a la dueña. Nadie instala nada sin orden de la dueña.

Formato de cada entrada: `- [fecha] Qué · Para qué · Riesgo · Estado (pendiente / reenviado / aprobado / rechazado)`

## Pedidos

- (ninguno todavía)

## Revisiones de entregas

- **D46 · benchmark de 20 plataformas** (`docs/venta/BENCHMARK_20_PLATAFORMAS.md`, carpeta de trabajo de la sesión «Benchmark 20 plataformas»): NO subido. Pendiente de corrección antes de entrar a `deepseek/d46`:
  1. La fila «Nexora POS (asumido)» de la matriz marca como S funciones que el propio documento dice no estar verificadas. Deben quedar como NC o como supuesto declarado.
  2. Las rutas de la sección (e) (`src/modules/pos/offline.ts`, `src/modules/reports/dgii/606.ts`, etc.) no existen en este repo, que usa `apps/api/src`, `apps/web/src` y `packages/shared`. Hay que reemplazarlas por rutas reales o marcarlas como hipotéticas.
  3. La sección (d) afirma huecos de Nexora sin documentación verificable: debe indicar en cada punto qué fuente lo sostiene o marcarlo como opinión.
  4. Los precios deben llevar URL y fecha (la metodología lo exige); revisar que cada precio cite su fuente.
  Cuando DeepSeek corrija, Claude PC revisa el diff y decide.
