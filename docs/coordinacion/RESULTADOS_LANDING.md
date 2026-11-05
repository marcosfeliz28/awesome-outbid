# Resultados — landing norexos.net (rama `claude-pc/landing-norexos-net`)

- Mezcla de `origin/nexora-cloud` (merge, sin conflictos). Lint y typecheck en verde en local; `pnpm test`: 904 pasan; los 11 fallos eran solo Postgres embebido (`initdb` no corre como root); repetidas sin root: 14 archivos, 43 pruebas, todas pasan.
- Landing revisada a 390 y 1366 px (ES y EN): sin desbordes, sin enlaces `#` rotos, sin peticiones externas, contrastes AA, foco visible, ES primero.
- Quitado: «Probar gratis / Try it free» (promesa de prueba sin decidir) y «vendas más / sell more» (cifra/promesa no medida).
- Marcadores `DECIDE-DUEÑA` en `apps/landing/index.html` y `en/index.html`.

## Falta decidir la dueña
1. Planes y precios (la sección Planes dice «Próximamente»).
2. Contacto público (`soporte@norexos.net`: ¿existe el buzón?).
3. Destino del botón «Entrar a la aplicación» (`app.norexos.net`: ¿existe y es el correcto?) y si habrá prueba gratis.
4. Dominio `norexos.net` (DNS/publicación: no tocado, ver `docs/venta/PUBLICAR_LANDING_NOREXOS_NET.md`).

## SHA y CI
Código verificado: `881f6a5`. Run 41969507184 en verde: `verify`, `windows-installer` y `render-images` (todos en ese SHA). `aaea0ea` (nota) también en verde, run 41978134784. El último commit solo cambia docs y unifica el marcador `DECIDE-DUEÑA`.
