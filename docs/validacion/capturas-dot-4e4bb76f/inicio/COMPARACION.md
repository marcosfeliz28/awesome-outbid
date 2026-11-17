# Inicio y Resumen de Noxeros

ChatGPT PC revisó en la laptop la rama `dot/inicio-integracion-revision-pc` en el commit `4e4bb76f32b48924fd16f92ee238aa0899b178c8`. La prueba terminó el 17 de noviembre de 2026 a las 17:52 UTC. La referencia fue la lámina Fusión de Inicio aprobada por Marcos, de 1672 × 941 px y SHA-256 `89a15e2541feb665881f8f1855261132f9d0ebf54d24488fcc10ffd55cfedcb4`. [Commit evaluado](https://github.com/marcosfeliz28/awesome-outbid/commit/4e4bb76f32b48924fd16f92ee238aa0899b178c8).

## Hallazgos por prioridad

1. **Alta · El acceso a Reportes desaparece del banner a 390 px.** En ambos temas, el contenedor mide 187 px y tiene el desbordamiento oculto. Corta 17 px de la caja del título y deja fuera el texto explicativo y todo el botón «Explorar mis reportes» de 44 px. A 1440 px el texto y el botón se ven completos. [Captura móvil clara](inicio-390-claro.png), [captura móvil oscura](inicio-390-oscuro.png), [regla del banner móvil](https://github.com/marcosfeliz28/awesome-outbid/blob/4e4bb76f32b48924fd16f92ee238aa0899b178c8/apps/web/src/styles.css#L3665).
2. **Media · Cambió la jerarquía frente a la lámina aprobada.** La lámina reúne la gráfica de ventas, los indicadores y los productos destacados en la primera pantalla de escritorio. En la app a 1440 × 900 aparecen primero los controles, tres indicadores del día y el banner. La gráfica «Así van tus ventas» empieza aproximadamente a 1988 px desde arriba. Los productos destacados aparecen más abajo en una tabla. [Captura de escritorio clara](inicio-1440-claro.png).
3. **Baja · Dos importes se salen de sus tarjetas a 390 px.** Los valores ficticios de «Ventas del período» y «Ganancia bruta» rebasan 3 px el borde derecho de sus tarjetas, en claro y oscuro. La página completa sigue ajustándose a los 390 px. [Mediciones](comprobacion-integrada.json).

## Capturas de la aplicación

Son PNG de página completa tomadas en Edge 157.0.4341.60. Se inició sesión por la interfaz con un usuario de demostración y una API conectada a PostgreSQL temporal con datos ficticios. El registro contiene dimensiones, mediciones y SHA-256 por archivo. [Registro de prueba](comprobacion-integrada.json).

| Tamaño de ventana | Claro | Oscuro | Dimensiones del PNG |
| --- | --- | --- | --- |
| 1440 × 900 | [Ver captura](inicio-1440-claro.png) | [Ver captura](inicio-1440-oscuro.png) | 1440 × 4023 |
| 390 × 844 | [Ver captura](inicio-390-claro.png) | [Ver captura](inicio-390-oscuro.png) | 390 × 7574 |

En ambos tamaños funcionaron el inicio de sesión, los cambios de tema y de acento, y el cambio de español a inglés y vuelta a español. Las consultas de resumen y ventas del año devolvieron HTTP 200. El menú móvil abrió y cerró con sus opciones visibles. La prueba no registró errores de JavaScript. Al terminar se cerraron el navegador, la aplicación de prueba, su API y PostgreSQL temporal.

## Alcance pendiente

Esta entrega cubre Inicio. Caja, Productos y GV quedan para sus respectivas ramas. Quedan pendientes el recorrido de cajera, la revisión completa de accesibilidad y la aceptación visual. La ejecución de GitHub asociada al commit anterior tenía `render-images` y `windows-installer` en verde y `verify` en curso al preparar este informe. [Controles de GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44138111994).
