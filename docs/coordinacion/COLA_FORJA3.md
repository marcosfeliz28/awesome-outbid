# Forja 3 — 10 funciones puras más (29-oct 22:15 UTC, Norexos 1)
Mismo método y reglas que `COLA_FORJA2.md`: `packages/ui/src/nx-<nombre>.ts` + `tests/f2-01-nx-<nombre>.test.ts` (rojo antes, verde después, en `vitest.config.ts`), un commit por función, 3–4 por rama `claude-pc/forja3-grupo-N` desde `origin/producto-nexora` (d6adc554 o más nuevo), **empujar UNA vez por grupo**. Probar siempre 0, 1, negativos, vacío, NaN, Infinity, Unicode. **Solo FORMATO y utilidades; nada de dinero del negocio (margen, ITBIS, descuentos, totales), caja ni inventario.** Antes de escribir una función, `grep` en `packages/shared/src` por si ya existe (p. ej. `weekStart`, `businessDate`): no duplicar.
| # | Función | Qué hace | Casos que NO pueden faltar |
|---|---|---|---|
| F3-01 | `formatearFechaLarga(fecha, idioma)` | «29 de octubre de 2026» / «October 29, 2026», zona America/Santo_Domingo | cambio de día RD vs UTC, fecha inválida → «—» |
| F3-02 | `formatearHora(fecha, idioma)` | «10:20 a. m.» / «10:20 AM», zona RD | medianoche, mediodía, inválida |
| F3-03 | `formatearPorcentaje(n, decimales)` | «15 %» (es) / «15%» (en); decimales 0–4 | 0, negativos, NaN, decimales fuera de rango se ajustan |
| F3-04 | `formatearCantidad(n)` | hasta 3 decimales sin ceros finales: «1.5» (punto decimal, coma de miles: convención de República Dominicana, igual que RD$ 1,234.50) / «12» | 0, -0, 1e9, 0.0004 → «0», NaN |
| F3-05 | `abreviarNumero(n)` | «1.2 mil», «3.4 M» (es, punto decimal) / «1.2K», «3.4M» (en) | 999, 1000, 999999, negativos, NaN |
| F3-06 | `rangoDeDias(inicio, fin)` | lista de días `aaaa-mm-dd` inclusive; tope de 366, si pasa → error claro | inicio > fin, mismo día, fechas inválidas |
| F3-07 | `esMismoDia(a, b)` | mismo día calendario en zona RD | 23:30 RD vs 00:30 UTC siguiente, inválidas |
| F3-08 | `compararNatural(a, b)` | orden natural en español: «item2» < «item10», sin distinguir acentos ni mayúsculas | vacíos, números largos, acentos |
| F3-09 | `parecEmail(s)` | solo forma (algo@algo.algo), sin red | espacios, dos @, sin punto, vacío |
| F3-10 | `quitarEmojis(s)` | quita emojis y símbolos pictográficos, conserva acentos y ñ | solo emojis → «», parejas sustitutas partidas, ZWJ |
Auditoría de Norexos 1: diff completo + bordes + 3 CI del SHA del grupo. Cuando llegues a la 10, repongo otra lista.
