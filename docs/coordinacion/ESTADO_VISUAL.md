# Estado visual · Norexos 10 (obrero visual)

Una rama por tarea desde `origin/producto-nexora`; solo `claude/visual-f2-NN`. No se despliega. El estado de F2-01 está en su propia rama.

| Tarea | Rama | Estado |
|---|---|---|
| F2-01 tokens + 12 primitivos | claude/visual-f2-01 | hecho (a2a469f8) |
| F2-02 franja de 4 KPIs | claude/visual-f2-02 | hecho; falta captura Playwright |

## F2-02
- `apps/web/src/KpiStrip.tsx` + lógica pura `kpiStrip.ts` (prueba `tests/f2-02-kpi-strip.test.ts`), insertada solo en el tablero ejecutivo, antes de `ExecutiveMetrics`.
- Datos, solo lectura: `/dashboard/summary` de hoy (misma clave de caché que `DayFigures`), `/cash-sessions` (solo con `cash:write`) y las alertas `low_stock`/`out_of_stock` del resumen. Utilidad solo con `profit:read`; el margen es el que devuelve la API: (venta − costo)/venta, sin restar ITBIS. La cajera no tiene `reports:read`, así que no ve importes.
- Etiquetas nuevas; no se cambió ninguna que busquen las pruebas.

## Bloqueos
- Faltan en la rama `docs/diseno/AUDITORIA_GEMINI_VISUAL_27OCT.md` y `LEVANTAMIENTO_Y_CARRILES_27OCT.md`; se usó `PLAN_VISUAL_GEMINI_27OCT.md`.
- Node 24 y pnpm 11 instalados a mano. `pnpm test` falla solo en suites PostgreSQL embebido (`initdb` no corre como root); typecheck, lint, build y el resto pasan.
- Capturas Playwright 390/1280: pendientes (no se levantó API+base local en esta pasada).
- El plan dice utilidad «con ITBIS»; se sigue la orden y CLAUDE.md (sin restar ITBIS).
