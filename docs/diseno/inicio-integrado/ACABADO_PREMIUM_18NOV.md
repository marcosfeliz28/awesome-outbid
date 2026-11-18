# Inicio · acabado premium, corte 18-nov

## Comparación observada

Se inspeccionaron los píxeles de la segunda lámina Higgsfield aprobada y la captura real de Inicio `fb119ff1` (1165 × 747, oscuro/azul, datos ficticios). La referencia es una dirección de materiales y profundidad, no una captura del producto. La captura real no corresponde al último candidato integrado.

La referencia ofrece medallones dorados consistentes sobre superficies verdes, iluminación fina de bordes y sombra de apoyo. En la app algunos medallones conservaban rosa/verde/azul del tema antiguo. Causa comprobada: `[data-theme="dark"] .metric-icon.pink` tiene más especificidad que `.fusion-inicio-integrado .metric-icon`; el estilo antiguo ganaba. No era un problema de transferencia de PNG.

## Cambios implementados

- Igualar la especificidad dentro del shell de Inicio para que los medallones reciban el metal dorado y el material de la referencia. No modificar badges semánticos, alertas ni otras áreas.
- Doble sombra de bisel interior y apoyo exterior en medallones. Relieve CSS real, sin rasterizar textos.
- Un filo inferior dorado de un píxel y sombra de apoyo en paneles/KPI. Brillo diagonal tenue encima de KPI mediante pseudo-elemento absoluto, no interactivo.
- Mantener intactos medidas, nombres, cifras, fuente monetaria, orden móvil, tema/acento, idioma, puntos de gráfica y animaciones existentes.
- No añadir bucles animados, WebGL, partículas, listeners, temporizadores, dependencias o imágenes. El coste añadido es únicamente CSS de pintura estática.
- Respetar alto contraste: eliminar filtros/sombras/brillo y usar Canvas/CanvasText. No se añade movimiento que necesite una preferencia adicional.

## Orden de dirección visual para siguientes cortes

1. Conservar la jerarquía del producto real: saldo/ventas legibles, controles identificables, nombres completos. La referencia no autoriza inventar indicadores.
2. Escoger un único lenguaje de material: cuerpo oscuro profundo, reflejo superior, borde metálico fino y sombra corta. No añadir neón a cada contorno ni colores saturados aleatorios.
3. Diferenciar acabado decorativo y semántica: medallones de navegación dorados; estados de error/éxito siguen semánticos. No usar dorado para ocultar una alerta.
4. Hover sólo con puntero fino, elevación breve ya existente; pulsación con sensación de hundimiento. Teclado mantiene foco visible; táctil no necesita hover. No prometer 3D geométrico: es relieve visual CSS.
5. Cotejar con capturas reales a 1440 y 390, claro/oscuro y verde/azul; además probar negro, ES/EN y movimiento reducido. Repetir navegación y clics, no validar únicamente imagen estática.
6. A 390 los accesos siguen antes del primer KPI y dentro del primer tramo visible; importes completos en una línea y sin scroll horizontal. No cambiar la altura de POS ni las dimensiones probadas W5.
7. Publicar sólo una rama con SHA identificable y controles aplicables, sin sustituir el candidato en revisión silenciosamente. No confundir build local, demo privada y tienda en producción.

## Límites del corte

Sólo Inicio. Sin cambios en POS, API, carrito, permisos, cobros, base, instalador, Render, guardia PWA ni fotografías. El resultado no constituye una promesa de equivalencia píxel a píxel con una imagen generada. La validación visual final y los controles completos del SHA integrado siguen siendo obligatorios.

## Corrección tras inspección PC

La primera demo aún conservaba colores antiguos en oscuro: el empate de especificidad no bastaba porque `main.tsx` carga el CSS base después del CSS importado por Dashboard. La regla ahora empieza con `:root[data-theme]` y continúa limitada al shell de Inicio. La barra móvil de Mercancía hereda únicamente el material/acento de Inicio, sin modificar posición, tamaño, etiqueta, permisos o acción. Se requiere repetir inspección en PC sobre la nueva versión de demo.
