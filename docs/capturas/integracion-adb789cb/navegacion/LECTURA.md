# Comparación de foco en Punto de venta

Repetí la misma secuencia en Edge 157.0.4341.60 con la aplicación, API y base descartable de demostración. Comparé `e9a738bb` con `adb789cb` en 1440 × 900 y 390 × 844, en tema claro y oscuro. [Evidencia de la versión anterior](https://github.com/marcosfeliz28/awesome-outbid/tree/266be2e01b7fbf82d8a2a3554e4144cb016b2217/docs/capturas/integracion-e9a738bb/navegacion), [candidato actual](https://github.com/marcosfeliz28/awesome-outbid/commit/adb789cb43f950398d3ab6ecf4de0f29979eb3f1)

| Comprobación | `e9a738bb` | `adb789cb` |
|---|---|---|
| Primer Escape al abrir el buscador sobre Cuenta | Cuenta se cerró en 4/4 | Cuenta siguió abierta en 4/4. El foco cayó en `body`. |
| Primer Escape al abrir el buscador sobre el menú móvil | El menú se cerró en 2/2 | El menú siguió abierto en 2/2 y el contenido principal siguió inactivo. El foco cayó en `body`. |
| Escape con Cuenta como única capa | Devolvió el foco al botón en 4/4 | Devolvió el foco al botón en 4/4. |
| Escape con el menú móvil como única capa | Devolvió el foco al botón en 2/2 | Devolvió el foco al botón en 2/2. |
| Escape al cerrar el buscador abierto directamente | El foco cayó en `body` en 4/4 | El foco cayó en `body` en 4/4. |
| Cierre de Cobrar con Escape y con «Cerrar» | El foco cayó en `body` en 8/8 | El foco cayó en `body` en 8/8. Los tres artículos ficticios y el total se conservaron. |

En el candidato actual, un segundo Escape cerró la capa inferior y devolvió el foco al botón de Cuenta o «Abrir menú» en 6/6 intentos. El menú móvil sostuvo el foco en 37 pulsaciones de Tab y Shift+Tab por tema. El buscador enfocó su entrada, devolvió «Ventas» y mantuvo el foco dentro durante Tab y Shift+Tab en los diez recorridos. En escritorio probé el botón del buscador. A 390 px abrí el buscador con Ctrl+K desde el campo de producto.

El cambio registra la pulsación mientras el diálogo superior está abierto para que Cuenta y el menú la respeten. Queda pendiente devolver el foco al control anterior al cerrar el diálogo, tanto en el buscador como en Cobrar. [Gestión del teclado en App](https://github.com/marcosfeliz28/awesome-outbid/blob/adb789cb43f950398d3ab6ecf4de0f29979eb3f1/apps/web/src/App.tsx#L705-L756), [diálogo del buscador](https://github.com/marcosfeliz28/awesome-outbid/blob/adb789cb43f950398d3ab6ecf4de0f29979eb3f1/apps/web/src/App.tsx#L1319-L1348), [diálogo de Cobrar](https://github.com/marcosfeliz28/awesome-outbid/blob/adb789cb43f950398d3ab6ecf4de0f29979eb3f1/apps/web/src/POS.tsx#L2534-L2557), [componente Modal](https://github.com/marcosfeliz28/awesome-outbid/blob/adb789cb43f950398d3ab6ecf4de0f29979eb3f1/packages/ui/src/index.tsx#L119-L177)

Las seis capturas muestran los estados abiertos observados. `mediciones.json` contiene la comparación, el foco después de cada cierre y los hashes de los PNG. Se registraron cero solicitudes operativas y cero errores de página. Ambas ejecuciones terminaron con cero procesos de prueba y cero puertos activos.
