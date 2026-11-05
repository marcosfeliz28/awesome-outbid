# Resultados — landing norexos.net (rama `claude-pc/landing-norexos-net`)

- Mezcla de `origin/nexora-cloud` (merge, sin conflictos). Lint y typecheck en verde en local; `pnpm test`: 904 pasan; 11 fallos son solo las pruebas con Postgres embebido (`initdb` no corre como root en este contenedor; CI no es root).
- Landing revisada a 390 y 1366 px (ES y EN): sin desbordes, sin enlaces `#` rotos, sin peticiones externas, contrastes AA, foco visible, ES primero.
- Quitado: «Probar gratis / Try it free» (promesa de prueba sin decidir) y «vendas más / sell more» (cifra/promesa no medida).
- Marcadores `DECIDE-DUEÑA` en `apps/landing/index.html` y `en/index.html`.

## Falta decidir la dueña
1. Planes y precios (la sección Planes dice «Próximamente»).
2. Contacto público (`soporte@norexos.net`: ¿existe el buzón?).
3. Destino del botón «Entrar a la aplicación» (`app.norexos.net`: ¿existe y es el correcto?) y si habrá prueba gratis.
4. Dominio `norexos.net` (DNS/publicación: no tocado, ver `docs/venta/PUBLICAR_LANDING_NOREXOS_NET.md`).

## SHA y CI
Ver abajo (se completa tras el push).
