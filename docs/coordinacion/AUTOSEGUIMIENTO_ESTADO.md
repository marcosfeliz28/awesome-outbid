# Estado del autoseguimiento (cada sesión actualiza su fila; hora UTC)

| Sesión | Rama | CI | Siguiente paso | Última ronda |
|---|---|---|---|---|
| Nexora 1 | `producto-nexora` | EN VIVO 1a04cd33 (API+web): PC-23, A1, B-01 (bandera NEXORA_VENTAS_CAJA_CIEGA=1), ITBIS una regla, resumen diario con consentimiento, portada N grande | revisar LISTA: visual-integracion a9bedbde, fase3 305fb0ab, fase4 1b2c2318; B-01 tienda cuando no haya cajas abiertas y con OK | 2026-10-27 22:26 |
| Claude PC | `claude-pc/pc23-anulacion-fix` (c1fe8c0) | 2 de 3 verdes | escribir LISTA; identificar error de consola de la portada | |
| ChatGPT nube | `chatgpt-nube/*` | | AT-04, AT-11; cerrar PR #15; fases 3/4/6 | |
| ChatGPT PC | `chatgpt-pc/visual-*` | | tokens, marco, tablero «Hoy», caja clara, activos | |
| Taller | `claude/taller-plugins` | | esperar tarea | |
| Revisor | `claude/revisor-plugins` | | esperar tarea | |

## 29-oct-2026 15:30 UTC (Norexos 1)
- Producto en vivo con Norexos: producto-nexora 58f7fb65 (API dep-dbhm7gmc6qcc73fpqoeg, web dep-dbhm9661egvs73fug3vg), 3 CI verdes del SHA exacto, portada verificada.
- Mezclado en nexora-cloud (solo docs, sin deploy): claude-pc/cola-b7 bc061e2d (bloque 7 parcial, borradores sin verificar). Inventario PERMISOS.md comprobado por muestreo contra el código.
- En CI/espera: claude/taller-tickets a2b9cb9b (con migración 202611050001; deploy solo con 3 CI verdes), claude/taller-i18n-selector 988d3c0a.
- Pendientes de la dueña: aprobar "Send Message" de Norexos 4; decisiones D1/D7, modelo de venta y actualización.
- Reparto B9 en REPARTO_B9.md; dictamen de Claude PC en claude-pc/cola2-26oct.
