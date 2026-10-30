
## Arreglo CSS del Top 10 por categoría a 390 px (claude/desglose-css)
- Cabecera `.month-top-panel .panel-heading` con `flex-wrap`; `.month-top-panel .table-scroll` con `overflow-x:auto` (la clase `table-scroll` no tenía CSS y el panel recortaba la tabla).
- Prueba en `tests/e2e/desglose-mes-movil.spec.ts`: cabecera y página sin desborde (scrollWidth ≤ clientWidth). Falla sin el CSS y pasa con él.
- Captura: `docs/coordinacion/capturas-desglose/5-top10-corregido.png`.
