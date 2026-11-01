# Decisión de animación y didáctica para Norexos 1

Fecha: 1-nov-2026. Base: propuesta de Claude nube, DeepSeek y Gemini (los dos últimos según el texto pegado por la dueña; el autor exacto de cada uno quedó por confirmar).

## Reglas que no se negocian

- Solo CSS, animando `transform` y `opacity`. Duración máxima 240 ms (tokens `--nx-dur-*`).
- `prefers-reduced-motion` apaga todo.
- Prohibido: POS, carrito, cobro, F2/F4/F8/F12, teclado, impresión, caja ciega, GV (`Gv.tsx`).
- Sin cambios de API, dinero ni claves de `localStorage`.

## Qué se toma (CSS sobre clases que ya existen en el código)

1. Pistas didácticas (`form-hint`, `login-hint`, `cod-hint`, `incentive-hint`): fade con retraso máximo de 120 ms al enfocar.
2. Estados vacíos (`empty-small`): fade sin movimiento de tamaño.
3. Hover de tarjetas y botones: elevación de 2 px, sin JS.
4. Avisos (`alert-row`): entran desde la derecha; `alert-counter` rebota una sola vez en ≤180 ms.
5. Incentivos: lista en escalón de máximo 15 filas.
6. Configuración: secciones entran una a una; sin animar `height`.
7. Inventario y Mercancía: pestañas y pasos con fade o desplazamiento corto, solo si las clases existen (verificar antes de aplicar).

## Qué se descarta

- **Todo lo de POS** (escaneo, pulso de línea, contador rodante, teclas F, ticket al cobrar, «Pista de primer turno»). Está prohibido.
- **Pista de primer turno** y cualquier uso nuevo de `localStorage`: prohibido.
- **`NxFileDropzone`, `useMotionPreference`, skeleton/shimmer, cajón del Asistente**: no existen en el código; requerirían JSX y JS nuevo, fuera de la regla de solo CSS.
- **Partición de bundle (`chunk-motion`, `check-bundle.mjs`) y cifra de 2,11 MiB**: no verificado; es un cambio de build, no de animación. Va a otra pieza con su propia medición.
- **Números que cuentan y gráficos que se dibujan**: requieren JS. Pendiente para una pieza aparte.
- **Parpadeo en fila guardada de inventario**: se quita.
- **Recorrido de primera vez**: requiere JS y almacenamiento; pendiente.

## Orden propuesto de ramas (una por pantalla, prueba antes y después)

Orden de la cola de `docs/coordinacion/COLA_PERMANENTE_CLAUDE_PC.md`:
- 5. Inventario (`claude-pc/anim-inventario`): pistas, estados vacíos, pestañas.
- 6. Configuración (`claude-pc/anim-configuracion`): secciones, sin altura.
- Después: Incentivos y avisos (`claude-pc/anim-avisos`).

## Pendiente de confirmar

- Qué texto fue de DeepSeek y cuál de Gemini (el documento de Gemini tiene encabezado propio y el otro no).
- Si `Management.tsx` y `Merchandise.tsx` tienen las pestañas y pasos descritos (no verificado).
