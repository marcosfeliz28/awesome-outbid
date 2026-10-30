# Estado visual · Norexos 10 (obrero visual)

Una rama por tarea desde `origin/producto-nexora`; solo `claude/visual-f2-NN`. No se despliega. Cada rama trae su propia nota; el cuadro completo está en la última.

| Tarea | Rama | Estado |
|---|---|---|
| F2-01 tokens + 12 primitivos | claude/visual-f2-01 | hecho (a2a469f8) |
| F2-02 franja de 4 KPIs | claude/visual-f2-02 | hecho (51878b25); falta captura |
| F2-03 POS | claude/visual-f2-03 | hecho; falta captura |

## F2-03
- Solo CSS (bloque `F2-03` al final de `styles.css`): miniaturas sobre superficie translúcida, botón `+` de 44 px (en oscuro con texto negro para AA), `Cobrar F12` más grande con `kbd` legible. `POS.tsx` intacto: etiquetas `Cobrar …` y `F12` sin cambio (prueba `tests/f2-03-pos-visual.test.ts`).
- Cajeras siguen en claro (no se tocó el reparto de temas).

## Bloqueos
- Faltan en la rama `AUDITORIA_GEMINI_VISUAL_27OCT.md` y `LEVANTAMIENTO_Y_CARRILES_27OCT.md`; se usó `PLAN_VISUAL_GEMINI_27OCT.md`.
- `pnpm test` falla solo en suites PostgreSQL embebido (`initdb` no corre como root); el resto, typecheck, lint y build pasan.
- Capturas Playwright 390/1280 pendientes (no se levantó API+base local).
