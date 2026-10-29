# Reparto del bloque 9 tras el dictamen de Claude PC (29-oct-2026)
Estado: **PENDIENTE de verificación por Norexos 4 (Revisor) y de la preaprobación de la dueña.** Fuente: `claude-pc/cola2-26oct` commit 457f9450, `docs/coordinacion/DICTAMEN_PC.md`. Análisis de Norexos 1.

Conclusión del dictamen: el modelo local (qwen2.5-coder 14B, laptop Ryzen 7 con 31 GB y gráfica integrada) escribe funciones puras y pruebas, pero no ejecuta, no ve pantallas y a veces inventa. Hoy le tocan funciones y pruebas; el resto va a quien tiene navegador o conoce el negocio. La PC aporta más trabajo cuando exista el bucle «aplicar → probar → devolver el error».

| # | Tarea | Quién construye | Quién audita | Nota |
|---|---|---|---|---|
| bucle | Script que aplica un parche, corre `vitest`/`pnpm check`, rechaza archivos prohibidos y >5 archivos | Claude PC (no el modelo) | Norexos 1 lee el script | Primero esto; habilita lo demás |
| 50 | 11 funciones pendientes de COLA_FORJA | modelo local + revisión Claude PC | Norexos 1 (diff + 3 CI) | 3 ya hechas (`nx-brand`, `nx-plural`, `nx-fecha`) |
| 56 | Pruebas de casos límite de funciones puras | modelo local | Norexos 1 | Solo `tests/` |
| 49 | `t()` con respaldo | modelo local si 25–27 existen; si no, Claude PC | Norexos 1 | Claude PC confirma antes que 25–27 estén |
| 51 | Selector ES/EN | Taller (tiene navegador) | Norexos 1 + captura | Depende de 49 |
| 53 | Animaciones CSS | Taller con navegador y «reducir movimiento» | Norexos 1 + captura | Plan ya escrito |
| 55 | Vista de impresión de factura | Taller con captura | Norexos 1 | Sin tocar cálculos |
| 54 | Textos de ayuda de GV | **modelo local, educado con `EDUCACION_MODELO_LOCAL.md`** (orden de la dueña, solo textos) | Norexos 1 (diff + pruebas de GV + 3 CI) | Cero cambios de lógica |
| 52 | «Pedir un cambio» | **Taller construye (API + migración + formulario) bajo especificación de Norexos 1; se instala en el producto** (orden de la dueña) | Norexos 1 + Norexos 4 | Ruta nueva: se audita línea por línea |

Reglas que siguen vigentes: nada se publica sin los 3 CI en verde del SHA exacto; prohibido para el modelo: dinero, mercancía, claves/permisos, migraciones, `.github/`, `render.yaml`, `CLAUDE.md`.

**Orden de la dueña (29-oct):** lo que el modelo local pueda hacer, que lo haga; se le educa con `docs/coordinacion/EDUCACION_MODELO_LOCAL.md` para sacarle el mayor provecho. Una vez Norexos 4 verifique este reparto, el envío sale con su preaprobación.
