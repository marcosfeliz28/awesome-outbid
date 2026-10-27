# Movimiento Obsidian Lumina · Nexora POS

Esta entrega usa movimiento como señal de calidad y transición. La operación diaria permanece quieta para que vender, cobrar y cerrar caja conserve rapidez y claridad.

## Aplicación en la interfaz

- El emblema de la cabecera aparece una sola vez y recibe un barrido de luz corto.
- El núcleo prismático entra con profundidad mínima y un solo barrido esmeralda/violeta.
- La iluminación ambiental responde al puntero sin provocar renders de React.
- `prefers-reduced-motion: reduce` elimina todas las animaciones nuevas y la línea luminosa existente.
- No se reproduce video automáticamente en la pantalla de acceso. El clip se reserva para una portada comercial o presentación.

## Clip reproducible

`nexora-prism-reveal-16x9.mp4` y `nexora-prism-reveal-16x9.webm` son una primera versión local, silenciosa, de seis segundos y 1280 × 720. Se regenera con:

```bash
python scripts/generate-nexora-motion.py
```

El generador solo usa el activo oficial `apps/web/public/nucleo-prisma.webp`, Pillow y FFmpeg. No altera letras ni inventa una variante del logo.

## Variante preparada para Open Higgsfield

Modelo recomendado: Seedance 2.5 en modo `omni_reference`, 1080p, 6 segundos, 16:9, audio desactivado.

Prompt:

> Preserve the supplied NEXORA POS prism logo, its exact geometry, spacing and every letter. A restrained emerald and violet light travels once across the beveled N, revealing subtle obsidian depth. Add a very slow two-percent camera push and refined reflections suitable for premium enterprise software. Keep the background clean black. No morphing, no extra symbols, no extra text, no particles over the wordmark, no camera shake, no lens distortion, silent.

Negativos operativos: no cambiar `NEXORA POS`, no deformar la N, no reemplazar la tipografía, no destellos repetitivos, no movimiento perpetuo y no mostrar controles de caja o credenciales.

## Uso recomendado

1. Portada comercial: clip 16:9 con imagen estática como respaldo.
2. Presentaciones: reveal de entrada de seis segundos.
3. Producto: animaciones CSS de una sola ejecución incluidas en esta rama.
4. Punto de venta: sin video de fondo y sin movimiento decorativo durante cobro.

Antes de publicarlo, Cloud debe revisar fidelidad del logo, legibilidad, tamaño transferido, contraste, reducción de movimiento y comportamiento en 390 px.

Evidencia incluida:

- `capturas/login-motion-desktop-1440.png`
- `capturas/login-motion-mobile-390.png`
- `capturas/login-reduced-motion-desktop-1440.png`
