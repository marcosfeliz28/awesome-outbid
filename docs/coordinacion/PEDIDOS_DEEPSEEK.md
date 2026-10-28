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

## Revisión de entregas de DeepSeek (28-oct, ~11:40 p. m. RD)

Subidas a origin (sin force, un commit por rama, CI disparado): deepseek/d6, d9, d10, d12, d15, d17, d18, d21, d22, d25, d33, d46, d47, d48, d49, d50, d51.

Retenidas, con motivo:
- **deepseek/d52**: `scripts/capturas-deepseek.mjs` lee `process.env` (`NEXORA_URL`, `SEED_DEMO_PASSWORD`, `NEXORA_CAPTURAS`) y trae una contraseña literal por defecto (`FitStore-Demo-2026!`). Rompe la regla de no leer variables de entorno sin pedirlo y la de no escribir credenciales. Pedido: quitar la contraseña literal y los `process.env`; usar rutas fijas y pedir la clave por la vía que la dueña indique.
- **deepseek/d34**: `estado.html` llama a `https://nexorapos.net/api/health` desde el navegador. Es red hacia producción desde una página pública. Pedido: decisión de la dueña antes de subir.
- **deepseek/d31** y **deepseek/d32**: la landing y `precios.html` publican precios (RD$ 1,500 y otros) que `docs/venta/precios.md` marca como PROPUESTA, no como precios definitivos. Pedido: quitar cifras o dejarlas como marcador, y decisión de la dueña.
- **deepseek/pedido-f2-01**: cambia `docs/coordinacion/PEDIDOS_DEEPSEEK.md`, que este archivo ya tiene. Se fusiona a mano; no se sube como rama separada.

Sobre D4/D26/D45 (bloqueadas por F2-01): siguen bloqueadas. Según la orden 26, DeepSeek recibe `App.tsx` y `styles.css` solo cuando la mezcla de Fase 1 esté en `producto-nexora`. Hoy `producto-nexora` está en `c78e7728`, sin la mezcla de `chatgpt-pc/visual-fase1-gemini` (`aab91c9a`, con `verify` en rojo). Quien decide cuándo se mezcla es Nexora 1.

Verificación hecha: D22 (RNC y cédula) se revisó contra el ejemplo del propio archivo (RNC 1-30-22250-9 da dígito 9, correcto). D46 ya no tiene rutas inventadas (`src/modules` = 0) y marca NO CONFIRMADO donde no hay fuente.
