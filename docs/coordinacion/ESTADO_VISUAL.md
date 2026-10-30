# Estado visual · Norexos 10 (obrero visual)

Rama por tarea desde `origin/producto-nexora`; solo `claude/visual-f2-NN`. No se despliega.

| Tarea | Rama | Estado | SHA |
|---|---|---|---|
| F2-01 tokens + 12 primitivos | claude/visual-f2-01 | hecho (ver notas) | ver `git log` de la rama |

## Notas F2-01
- Tokens: capa 3b en `packages/ui/src/tokens.css` (pares texto/fondo ≥ 4,5:1, claro y oscuro); estilos en `packages/ui/src/nx-primitivos.css`; ambos se importan en `main.tsx`. `styles.css` y `App.tsx` no se tocan.
- 12 primitivos en `packages/ui/src/nx-primitivos.tsx` (NxButton, NxCard, NxField, NxBadge, NxEmpty, NxSkeleton, NxToast, NxTabs, NxPageHeader, NxProgress, NxMoney, NxAppShell), envolviendo los helpers `nx-*` ya probados. Prueba: `tests/f2-01-primitivos.test.tsx`.
- Aún sin usar en pantallas (F2-02..04 los consumen). Sin Storybook (Fase 3).

## Bloqueos / pendientes
- Faltan en esta rama `docs/diseno/AUDITORIA_GEMINI_VISUAL_27OCT.md` y `docs/coordinacion/LEVANTAMIENTO_Y_CARRILES_27OCT.md`; se usó `PLAN_VISUAL_GEMINI_27OCT.md`.
- Entorno: Node 24 y pnpm 11 instalados a mano. `pnpm test` falla solo en las suites con PostgreSQL embebido (`initdb` se niega como root, "Permission denied" en /tmp); typecheck, lint, build y el resto de pruebas pasan.
- Capturas Playwright 390/1280 de F2-01: sin pantalla que las use todavía; se hacen en F2-02+.
- Conflicto de documentos: el plan dice KPI de utilidad «con ITBIS»; se sigue la orden y CLAUDE.md: margen = (precio − costo)/precio sin restar ITBIS.
