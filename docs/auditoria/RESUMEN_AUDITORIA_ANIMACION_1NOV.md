# Resumen para auditoría externa: animación de reportes (pieza 3) y decisión de animación

Fecha: 1-nov-2026. Rama: `claude-pc/anim-reportes`. Autor de lo hecho: Claude (nube). Para auditar: DeepSeek y Gemini.

## 1. Qué se hizo

Commits en orden:

| SHA | Qué es |
|---|---|
| `7316e7e` | Pieza 3: animación CSS de reportes y desglose del mes, más prueba nueva. |
| `a9896d1` | Docs: propuestas de animación para DeepSeek y Gemini. |
| `11441b6` | Docs: decisión de animación para Norexos 1. |
| `fa17648` | Docs: corrección de atribución (DeepSeek sin encabezado, Gemini con encabezado). |

Cambio de código (solo en `7316e7e`):
- `apps/web/src/styles.css`: +71 líneas, bloque «Orden 98 · pieza 3» al final del archivo.
- `tests/reportes-animacion.test.ts`: prueba nueva (9 casos).
- `vitest.config.ts`: +1 línea para registrar la prueba.

Qué anima el CSS:
- Tarjetas de KPI de `MonthReport.tsx` (selector `.kpi-grid:not(.tablero-kpis) > .kpi-card`, así no toca el tablero).
- Periodo (`.month-range`), top 10 (`.month-top-panel`) y filas de `.month-table`.
- Usa `transform` y `opacity`, duraciones de tokens `--nx-dur-*`, hover de 2 px en tarjetas y `prefers-reduced-motion` que apaga todo.

## 2. Qué se verificó

- Prueba `tests/reportes-animacion.test.ts`: falló antes del CSS (6 de 9 casos) y pasa después (9 de 9).
- Pruebas vecinas `tablero-animacion`, `login-animacion`, `docs-sistema-citas` y `citas-reanclar`: 32 de 32 pasan.
- `scripts/pre-empuje.mjs`: pasa (después de generar el cliente de Prisma en `apps/api`, sin eso falla el typecheck por un problema del entorno, no del código).
- CI de `7316e7e` (API pública de check-runs): `verify`, `windows-installer` y `render-images` en **success**.

## 3. Qué NO se verificó

- No se miró la animación en navegador ni en celular. Solo se verificó por pruebas que leen el CSS.
- No se verificó el CI de `a9896d1`, `11441b6` ni `fa17648`. Son solo documentación, pero el CI corre igual.
- No se confirmó que las pestañas de Inventario y los pasos de Mercancía existan tal como se describen en las propuestas.
- No se confirmó la cifra de 2,11 MiB de bundle ni que exista `scripts/check-bundle.mjs`. La propuesta de Gemini la menciona, el repo no tiene ese script.
- No se escribió la línea `LISTA:` en `LISTA_CLAUDE_PC.md` ni se marcó la pieza 3 como HECHA en la cola. Pendiente.

## 4. Reglas que la auditoría debe revisar

- Solo CSS, sin JS nuevo, sin cambios de API, dinero ni claves de `localStorage`.
- Animar solo `transform` y `opacity`, duración ≤ 240 ms.
- `prefers-reduced-motion` apaga todo.
- Prohibido tocar: POS, carrito, cobro, F2/F4/F8/F12, teclado, impresión, caja ciega y GV (`Gv.tsx`).
- Ninguna clase animada debe depender de un cambio de marcado (`.tsx`).

## 5. Qué pedimos a los auditores

1. Revisar el diff de `7316e7e` (solo `styles.css`, `vitest.config.ts` y la prueba). Decir si cumple las reglas de la sección 4.
2. Buscar si alguna regla CSS toca POS, cobro o GV por accidente (por ejemplo, un selector demasiado amplio).
3. Revisar la prueba: ¿verifica lo que dice? ¿Podría pasar aunque el CSS esté mal?
4. Revisar la decisión (`docs/coordinacion/DECISION_ANIMACION_NOREXOS1.md`): ¿hay algo tomado que rompa una regla?
5. Responder en español, con lista de hallazgos ordenados por gravedad y sin suposiciones: si algo no se puede verificar leyendo, decir «no comprobado».

## 6. Riesgos conocidos

- El selector `.kpi-grid:not(.tablero-kpis)` depende de que `Gv.tsx` no use `.kpi-grid`. Lo comprobé con grep: solo `Dashboard.tsx` y `MonthReport.tsx` lo usan. Si Gv lo empieza a usar, esa animación le caería encima.
- Los nombres `reporte-enter` y `month-table` son genéricos. Revisar que no choquen con otros estilos.
