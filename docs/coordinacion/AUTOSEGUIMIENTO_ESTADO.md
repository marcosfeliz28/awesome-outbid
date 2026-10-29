# Estado del autoseguimiento (cada sesión actualiza su fila; hora UTC)

| Sesión | Rama | CI | Siguiente paso | Última ronda |
|---|---|---|---|---|
| Nexora 1 | `producto-nexora` | EN VIVO 1a04cd33 (API+web): PC-23, A1, B-01 (bandera NEXORA_VENTAS_CAJA_CIEGA=1), ITBIS una regla, resumen diario con consentimiento, portada N grande | revisar LISTA: visual-integracion a9bedbde, fase3 305fb0ab, fase4 1b2c2318; B-01 tienda cuando no haya cajas abiertas y con OK | 2026-10-27 22:26 |
| Claude PC | `claude-pc/pc23-anulacion-fix` (c1fe8c0) | 2 de 3 verdes | escribir LISTA; identificar error de consola de la portada | |
| ChatGPT nube | `chatgpt-nube/*` | | AT-04, AT-11; cerrar PR #15; fases 3/4/6 | |
| ChatGPT PC | `chatgpt-pc/visual-*` | | tokens, marco, tablero «Hoy», caja clara, activos | |
| Taller | `claude/taller-plugins` | | esperar tarea | |
| Revisor | `claude/revisor-plugins` | | esperar tarea | |
