# Evidencia visual: Productos de Dot

- Código examinado: `c6b75f070afd2f17de690ce703bac47cb95b34a3`.
- Datos ficticios en PostgreSQL temporal, migrado y sembrado localmente; API y web locales reales. Sin acceso a producción. Edge sin interfaz gráfica, movimiento reducido y conexiones externas bloqueadas.
- Las cuatro capturas corresponden a 1440 × 900 y 390 × 844, modos claro y oscuro. Son de página completa; la resolución es la del viewport, no la altura total de la imagen.
- Se verificó en ambos tamaños: búsqueda con resultado y sin resultado, filtro por categoría, paginación y apertura/cierre de ficha. Sin errores JavaScript de página observados. No se guardó ni modificó ningún producto.
- El documento no presenta desbordamiento horizontal global en las cuatro vistas. En escritorio la tabla tiene desplazamiento interno y las acciones aparecen parcialmente fuera de la zona visible inicial; revisar su descubribilidad. En móvil el botón fijo de Mercancía cubre parte del contenido en la posición de la captura; no se comprobó que impida llegar al contenido desplazándose.
- La ficha muestra valores de demostración. No se verificaron importación, edición, creación, lector de pantalla, contraste cuantitativo, otras resoluciones ni todos los controles. No se encontró la lámina aprobada original, por lo que la fidelidad visual frente a ella no está evaluada.
- Procesos propios de navegador, web, API y base finalizados al concluir. `comprobacion-integrada.json` conserva el detalle de la ejecución sin credenciales.

## Comprobación adicional

- A 390 px se desplazó hasta el botón final «Ver ficha»: ocupó las posiciones verticales 602–647 de un viewport de 844 px, recibió el puntero y abrió la ficha, que se cerró con Escape. En esta prueba la barra fija no impidió su uso; no se han probado todos los controles ni posiciones intermedias.
- A 1440 px se desplazó horizontalmente la tabla desde 22 hasta su máximo de 118 px y se abrió «Variantes de Bandas Resistance»; el diálogo se cerró con Escape sin guardar. El acceso funciona, aunque sigue pendiente evaluar si la barra de desplazamiento resulta suficientemente visible.
- La segunda ejecución repitió búsqueda, categoría, paginación y ficha en ambos tamaños y terminó los procesos de prueba. El JSON marca también como «pasa» las dos comprobaciones que no corresponden al otro tamaño: las mediciones válidas son `mobileHit` en 390 y `scroll` en 1440.
- Pasaron `verify`, `windows-installer` y `render-images` en el push del SHA `c6b75f07`. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44220894846).
