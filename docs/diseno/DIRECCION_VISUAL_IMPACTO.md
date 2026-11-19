# Dirección visual «Impacto» (9-nov-2026)

Pedido de la dueña: «que el software sea multimedia, con mucha calidad, mucho movimiento y animación, totalmente actualizado a la actualidad». Es un producto que se va a vender, así que la capa se luce donde se enseña el producto (entrada, resumen, reportes, administración, demostración) y **nunca en el cobro**.

## Cómo se enciende
- Configuración › **Apariencia** › «Activar el modo Impacto en este equipo». Solo la ve el administrador (`*`).
- Se guarda **por equipo** (`localStorage` `norexos-visual`), viene **apagada** y no toca la API: la laptop de la caja sigue en modo estándar aunque el administrador la encienda en la suya.
- Aunque esté encendida, la caja (`.pos-shell`) no recibe nada: toda regla de `impacto.css` cuelga de `.app-shell:not(.pos-shell)`, entrar o salir del POS no usa View Transition, y `CountUp` no se usa en `POS.tsx` (prueba `tests/impacto.test.ts`).
- Con `prefers-reduced-motion: reduce` no se anima nada de la capa (prueba automática en vitest y Playwright).

## Concepto: «vitrina viva»
Norexos vende suplementos, fajas, tenis y maquillaje: energía de gimnasio y brillo de estudio de belleza. La marca ya tiene violeta `#7c3aed`, rosa y cian sobre la entrada oscura con el cubo 3D. Impacto no cambia la marca; le da **profundidad** y **respuesta**:

1. **Un solo momento orquestado por pantalla**: en el resumen, las cifras cuentan y la gráfica se dibuja; en la entrada, la aurora respira detrás del cubo. Nada de entradas repetidas en cada tarjeta.
2. **El movimiento responde a la persona**: pestaña activa con barra que crece, botón que cede al pulsar, cambio de vista con fundido corto.
3. **Profundidad, no decoración**: sombras en capas teñidas de violeta en vez de la sombra gris plana.

### Tipografía
Se conservan las dos familias que ya viajan con la app (sin pedir nada a internet): **Plus Jakarta Sans** para títulos y cifras grandes, **Inter** para texto. Base 16 px, nada por debajo de 14 px (`--fs-*` de `tokens.css`). Cifras con `font-variant-numeric: tabular-nums` para que no bailen al contar.

### Color
| Nombre | Valor | Uso |
|---|---|---|
| Violeta marca | `#7c3aed` | acción, barra de pestaña, línea de la gráfica |
| Violeta suave | `#8b5cf6` (a 23–30 %) | relleno de gráficas, aurora |
| Cian | `#22d3ee` | aurora de la entrada, detalles de la marca oscura |
| Rosa | `#e879f9` | tercer foco de la aurora |
| Ámbar aviso | `--nx-alerta-fondo/-texto` | franja «datos de ejemplo» de la demostración (par ≥ 4,5:1 ya verificado en `tokens.css`) |

Claro/oscuro: se reusan `--surface`, `--primary`, `--nx-esqueleto` y los pares AA existentes; las sombras tienen su variante oscura (`--nx-prof-1/2` bajo `[data-theme="dark"]`). El cambio de tema usa View Transition (fundido) cuando Impacto está encendido.

### Profundidad y vidrio
- `--nx-prof-1` (reposo) y `--nx-prof-2` (cursor encima) en paneles y KPIs. Estáticas: no se anima `box-shadow`.
- Vidrio: solo en la tarjeta de entrada (ya existía) sobre la aurora. No se usa `backdrop-filter` en barras fijas: cuesta en laptops lentas y la barra superior no tiene contenido detrás.

### Iconografía e ilustración
- Íconos: `lucide-react` (ya instalado), trazo 2 px.
- Estados vacíos: SVG en línea (caja isométrica y dos destellos que flotan), `aria-hidden`, color `currentColor` → sigue el tema. Vive en `Empty` de `packages/ui` y solo se muestra en Impacto.

## Tokens de movimiento
Se reusan los de `packages/ui/src/tokens.css`: `--nx-dur-fast 120ms`, `--nx-dur-base 180ms`, `--nx-dur-slow 240ms`, `--nx-ease-out`. Nuevos, **solo en `impacto.css`** y solo para piezas de vitrina:

| Token | Valor | Dónde | Por qué pasa de 240 ms |
|---|---|---|---|
| `--nx-dur-cuenta` | 640 ms | cifras que cuentan | por debajo de ~500 ms no se lee la cuenta; nunca en la caja |
| `--nx-dur-dibujo` | 720 ms | velo que descubre las gráficas | se lee como «se dibuja»; no bloquea clics (`pointer-events: none`) |
| `--nx-dur-brillo` | 1400 ms | brillo del esqueleto de carga | un solo brillo suave, en bucle mientras carga |
| `--nx-dur-flota` | 3200 ms | destellos del estado vacío | ambiental y lento |
| `--nx-dur-aurora` | 18000 ms | aurora de la entrada | ambiental, casi imperceptible |
| `--nx-ease-entrada` | `cubic-bezier(.16,1,.3,1)` | velo de las gráficas | arranque rápido, final suave |

Excepción razonada al plan del 29-oct (≤ 240 ms): aplica **solo con Impacto encendido y fuera del POS**; todo lo que la persona dispara (pestañas, cambio de vista, botones) sigue en 120–180 ms.

## Qué se anima (todo con `transform`/`opacity`)
| Pantalla | Pieza | Movimiento |
|---|---|---|
| Entrada | aurora | 3 focos de color que derivan (capa propia, `translate/rotate/scale`) |
| Cambio de vista | View Transition | solo `.main-content`: sale con fundido 120 ms, entra con fundido + 8 px en 180 ms; menú y barra quietos |
| Resumen | KPIs y franja | cifras que cuentan de 0 al valor exacto (`CountUp`); el lector de pantalla oye solo el valor final |
| Resumen, Reportes, Demostración | gráficas (recharts) | velo del color del panel que se retira (`scaleX` 1→0) |
| Reportes | cambio de informe | View Transition (mismo fundido) |
| Configuración, Reportes, Inventario | pestañas/filtros | barra bajo la pestaña activa (`scaleX`), botón `scale(.97)` al pulsar |
| Todas (fuera del POS) | carga | esqueleto con un brillo en lugar de la rueda |
| Todas (fuera del POS) | vacío | ilustración SVG con destellos que flotan |
| Demostración (`#demo`) | vitrina | KPIs, gráfica, lo más vendido y un vacío ilustrado con **datos de ejemplo fijos** |

### Modo demostración
`apps/web/src/Demo.tsx`, ruta `#demo`, solo administrador, enlace en Configuración › Apariencia. Datos fijos en el archivo; **no llama a la API, no guarda nada y no se mezcla con las cifras reales**. Franja ámbar fija: «Modo demostración: datos de ejemplo…». Se ve con Impacto apagado también (sin movimiento).

## Librerías
Ninguna nueva. Se usa CSS nativo, View Transitions del navegador (si no existen, el cambio es directo) y `recharts`, que ya estaba. Siguen descartados Three.js, GSAP y Lottie: nada de lo pedido los necesita. Framer Motion tampoco hizo falta.

## Medidas (Playwright, Chromium sin GPU, vista previa de producción)
Prueba fija: `tests/e2e/impacto.spec.ts` (CLS 0 y ninguna tarea larga > 50 ms al montar la demostración animada). Medidas de apoyo (1366×768, 9-nov):

| CPU | Modo | Demostración | Ir a Reportes | Ir a Resumen |
|---|---|---|---|---|
| 1× | estándar | 0 tareas largas, peor cuadro 17 ms | 0, 17 ms | 0, 17 ms |
| 1× | Impacto | 0 tareas largas, 17 ms | 0, 33 ms | 0, 67 ms |
| 4× más lenta | estándar | 1 (72 ms) | 1 (50 ms) | 2 (84, 69 ms) |
| 4× más lenta | Impacto | 1 (92 ms) | 2 (64, 64 ms) | 2 (74, 68 ms), peor cuadro 217 ms |

Lectura: a velocidad normal Impacto no produce tareas largas. El peor cuadro de 67 ms al ir al Resumen es la foto de la View Transition mientras React dibuja el tablero (en estándar ese trabajo ocurre igual, sin foto). Con la CPU 4× más lenta, las tareas largas vienen de dibujar las pantallas (también en estándar); Impacto agrega entre 10 y 30 ms. CLS medido desde el primer cuadro de la vista: **0**. (El pie de página que baja al pasar a una página más corta da 0,046 en ambos modos; no es de la animación.)

## Capturas y clips
Antes (modo estándar) y después (Impacto), claro y oscuro, escritorio 1440×900 e iPhone 390×844, en `docs/diseno/capturas/antes-*.webp` y `despues-*.webp` (login, dashboard, reports, inventory, settings y demo). Clips: `docs/diseno/capturas/clips/impacto-escritorio.webm` (entrada → resumen → reportes → tema oscuro → demostración) e `impacto-iphone.webm`.

## Video promocional
`docs/diseno/capturas/clips/promo-norexos-16x9.mp4` (35 s, 1920×1080) y `promo-norexos-9x16.mp4` (25 s, 1080×1920, para Reels/TikTok/WhatsApp): grabaciones reales de la app en modo Impacto (entrada, resumen, reportes, demostración, tema oscuro, celular) con títulos en la tipografía y colores de la marca. Música original compuesta por código (`musica-promo.py`, sin derechos de terceros). Se rehacen con `grabar-promo.cjs` (Playwright + captura CDP + ffmpeg) sobre la base de prueba sembrada. No se usó Higgsfield: la cuenta tenía 0 créditos (≈96 por escena de 8 s).

## No comprobado
- Laptop lenta real de la tienda (solo CPU emulada 4× en Chromium) y Safari/iPhone real: Safari 18+ trae View Transitions; en versiones viejas el cambio es directo (sin efecto), no se probó en un equipo.
- Firefox: sin View Transitions en versiones viejas → cambio directo; no se probó.
- Lector de pantalla real (NVDA/VoiceOver): se verificó por código que la cifra animada es `aria-hidden` y el valor final va en `.sr-only`, no con un lector.
- La animación propia de recharts (ya existía) no se apaga con «reducir movimiento»; la capa sí se apaga.
