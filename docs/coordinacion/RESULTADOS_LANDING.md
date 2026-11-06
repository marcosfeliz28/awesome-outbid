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

## Correcciones tras la auditoría de ChatGPT nube (rama `nexora-chatgpt-nube`, d25b2a24)
- «Vende en segundos» / «Sell in seconds» → «Caja pensada para el mostrador» / «A register built for the counter» (sin tiempos).
- «Empieza hoy; sin instalar nada» → «Funciona en el navegador; para vender sin internet puedes instalarlo en tu PC.» (ES y EN).
- «escala a varias sucursales y bodegas» → «Maneja tienda y bodega (traspasos entre ellas).» (ES y EN).
- Soporte: la FAQ en inglés ya no promete soporte en inglés («Support is currently provided in Spanish»).
- El marcador `DECIDE-DUEÑA` suma: disponibilidad («hoy») y si habrá soporte en inglés.
- Nota: `verify` falló una vez en `ebcb245` (e2e `privacidad-sesion G9`, intermitente) y pasó al repetirlo.
