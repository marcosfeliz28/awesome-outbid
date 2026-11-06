# Plan de la app animada (Nexora 1, 29-oct-2026) — orden de la dueña

**Meta:** que la aplicación se sienta viva y rápida, sin gastar batería ni estorbar al cobrar. Movimiento **con sentido**: cada animación confirma una acción o guía la vista; ninguna retrasa una venta.

## Reglas duras
1. **CSS nativo primero** (`transition`, `@keyframes`, View Transitions si el navegador lo trae). Framer Motion solo si hace falta, con `LazyMotion` en un chunk aparte. Descartados: Three.js, GSAP, Lottie (Gemini y Nexora 1 de acuerdo).
2. **Presupuesto:** ninguna animación pasa de 240 ms (entradas 180 ms, salidas 120 ms); solo `transform` y `opacity` (sin animar ancho/alto/márgenes); sin pérdida visible de fotogramas en la laptop de la caja.
3. **`prefers-reduced-motion: reduce` apaga todo lo no esencial** (queda el cambio de estado, sin desplazamiento). Con prueba automática.
4. **La caja manda:** nada animado en F2/F4/F8/F12 ni en el teclado; el botón «Cobrar» no espera a ninguna animación. El dinero y la caja ciega no se tocan.
5. Tokens de movimiento en `packages/ui/src/tokens.css` (los de F2-01): `--nx-dur-fast: 120ms`, `--nx-dur-base: 180ms`, `--nx-dur-slow: 240ms`, `--nx-ease-out: cubic-bezier(.2,.8,.2,1)`. Nadie escribe duraciones sueltas.

## Qué se anima (en este orden de valor)
| # | Pieza | Movimiento | Aceptación |
|---|---|---|---|
| 1 | Cambio de vista | fundido + 8 px de desplazamiento, 180 ms | sin salto de scroll; sin movimiento reducido: solo fundido |
| 2 | Carrito (POS) | el contador «rebota» 1 vez al agregar; la línea nueva entra deslizando | no mueve el botón Cobrar |
| 3 | Cobro exitoso | check dibujado 400 ms y la factura «sube» | no bloquea imprimir ni F12 |
| 4 | Pestañas/menú | pastilla deslizante bajo la opción activa | accesible por teclado, sin parpadeo |
| 5 | Carga | esqueletos (`nx-skeleton`) con brillo suave en vez de ruedas | un solo brillo, apagado con movimiento reducido |
| 6 | Asistente | apertura con escala 0.96→1 y fundido | no tapa el POS ni roba el foco |
| 7 | Alertas/avisos | `nx-toast` entra desde abajo; los errores no se ocultan solos | `role` correcto |
| 8 | Portada pública | revelado suave por secciones al hacer scroll (una vez) | no mueve el diseño (sin saltos de maquetación) |

## Cómo se construye (reparto)
- **F2-01 primero** (tokens y primitivos `Nx*`): ya está en marcha en `claude-pc/visual-f2-01`. Los tokens de movimiento de arriba se agregan allí.
- **Piezas 1 a 8:** Claude PC, una rama por pieza (`claude-pc/anim-0N`), prueba que falle antes y pase después, captura/clip corto, CI en verde. El modelo local solo redacta borradores de funciones puras (por ejemplo, cálculo del siguiente índice de una pestaña); lo que toca `App.tsx`, `styles.css` o el POS lo escribe Claude PC.
- **Revisión y despliegue:** Nexora 1 (o su relevo), solo en el producto; la tienda no se anima sin decisión de la dueña.
