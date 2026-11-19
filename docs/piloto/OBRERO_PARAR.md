# Obrero en pausa (17-nov-2026)

Interruptor de parada del obrero del panel de operador (`docs/piloto/COLA_OBRERO_PANEL.md`, paso 2 de su rutina).

- Motivo 1: Dot (con autorización de Marcos) rehace la pieza 1 en su propia rama desde `producto-nexora` `50563e46`. Pidió no duplicarla.
- Motivo 2: el push del obrero falla con 403 porque `marcosfeliz28/awesome-outbid` no está entre las fuentes de su rutina. Cada ciclo rehacía la pieza 1 y la perdía, costando cerca de US$1 contra el tope de US$20.
- Las piezas 2 a 8 dependen de la 1: no hay pieza independiente que pueda tomar.

Para reanudar: borrar este archivo (lo decide Marcos o Dot) y, si se quiere que empuje, agregar el repositorio a las fuentes de la rutina desde su configuración.
