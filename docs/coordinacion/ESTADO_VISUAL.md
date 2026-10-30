# Estado visual · Norexos 10 (obrero visual)

Una rama por tarea desde `origin/producto-nexora`; solo `claude/visual-f2-NN`. No se despliega, no se mezcla.

| Tarea | Rama | SHA | Estado |
|---|---|---|---|
| F2-01 tokens + 12 primitivos `Nx*` | claude/visual-f2-01 | a2a469f8 | hecho |
| F2-02 franja de 4 KPIs del tablero | claude/visual-f2-02 | 51878b25 | hecho |
| F2-03 POS (miniaturas, `+`, Cobrar F12) | claude/visual-f2-03 | 2ea769c0 | hecho |
| F2-04 Inventario 3 pestañas + Mercancía por pasos | claude/visual-f2-04 | ver `git log` | hecho |

## F2-04
- Inventario: pestañas «Stock actual», «Conteos físicos» y «Almacenes y traspasos» (el panel de almacenes ya no cuelga debajo). `Management.tsx`.
- Mercancía: lista de pasos (Tipo → Productos → Revisar y confirmar) que se deriva del estado ya existente (`merchandiseSteps.ts`); no cambia el flujo ni las etiquetas.
- **e2e editado sin poder correrlo**: `tests/e2e/almacenes.spec.ts` ahora pulsa «Almacenes y traspasos» antes de buscar «Dónde está la mercancía»; en el caso del conteo espera el botón «Stock actual». Revisar en el CI.

## Pendientes / bloqueos
- Capturas Playwright 390 y 1280 px de las 4 tareas: no hechas (no se levantó API + base local en esta pasada).
- Faltan en la rama `AUDITORIA_GEMINI_VISUAL_27OCT.md` y `LEVANTAMIENTO_Y_CARRILES_27OCT.md`; se trabajó con `PLAN_VISUAL_GEMINI_27OCT.md`.
- Entorno: Node 24 y pnpm 11 instalados a mano. `pnpm test` falla solo en suites con PostgreSQL embebido (`initdb` no corre como root); typecheck, lint, build y el resto de pruebas pasan en las 4 ramas.
- El plan dice utilidad «con ITBIS»; se siguió la orden y CLAUDE.md (sin restar ITBIS).
- Los 3 CI (`verify`, `windows-installer`, `render-images`) no se han visto aún.
