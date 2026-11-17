# Segunda comprobación de Inicio y Resumen

ChatGPT PC probó en la laptop el commit `a1c18c66a45458fe8ed666d5d9042fcd0e47c9e1` de `dot/inicio-correccion-ci-17nov`. El recorrido terminó el 17 de noviembre de 2026 a las 19:06 UTC. La comparación conserva las mismas dos ventanas, los dos temas y la prueba con datos ficticios del informe anterior. [Commit de Dot](https://github.com/marcosfeliz28/awesome-outbid/commit/a1c18c66a45458fe8ed666d5d9042fcd0e47c9e1), [evidencia anterior en 4e4bb76f](https://github.com/marcosfeliz28/awesome-outbid/blob/c741c929b7eedaedf643b9eedae9d6e0b8a02661/docs/validacion/capturas-dot-4e4bb76f/inicio/COMPARACION.md).

## Correcciones comprobadas

| En Inicio a 390 px | `4e4bb76f` | `a1c18c66` |
| --- | --- | --- |
| Título del banner | 17 px recortados en claro y oscuro | Completo en ambos temas |
| Botón «Explorar mis reportes» | 0 de 44 px visibles | 44 de 44 px visibles en ambos temas |
| Valores de «Ventas del período» y «Ganancia bruta» | 3 px fuera de sus tarjetas | 0 px fuera de sus tarjetas |

El botón abrió Reportes desde las ventanas de 1440 y 390 px. La barra de idioma y apariencia se retiró al entrar en Reportes y Punto de venta. A 1366 × 768, el catálogo, «Cobrar» y el carrito completo de Punto de venta quedaron a la vista sin desplazamiento. A 320 × 800, la barra superior y el documento de Punto de venta midieron 0 px de desbordamiento horizontal. El menú móvil, los cambios de acento y el cambio de idioma también funcionaron. [Registro de mediciones](comprobacion-integrada.json).

## Pendiente de presentación

El menú muestra **Noxeros** y el cuadro «Acerca de» se titula **Acerca de Norexos**. La diferencia se comprobó al abrir el cuadro por el menú a 1440 px. [Nombre en el menú](https://github.com/marcosfeliz28/awesome-outbid/blob/a1c18c66a45458fe8ed666d5d9042fcd0e47c9e1/apps/web/src/App.tsx#L1031), [título de Acerca de](https://github.com/marcosfeliz28/awesome-outbid/blob/a1c18c66a45458fe8ed666d5d9042fcd0e47c9e1/apps/web/src/App.tsx#L166).

## Cuatro capturas reales

| Ventana | Claro | Oscuro | Dimensiones de cada PNG |
| --- | --- | --- | --- |
| 1440 × 900 | [Captura](inicio-1440-claro.png) | [Captura](inicio-1440-oscuro.png) | 1440 × 4023 |
| 390 × 844 | [Captura](inicio-390-claro.png) | [Captura](inicio-390-oscuro.png) | 390 × 7796 |

El navegador Edge 157.0.4341.60 se conectó a una API local y a PostgreSQL temporal. Las consultas de resumen y ventas del año devolvieron HTTP 200 en ambos tamaños. La ejecución no registró errores de JavaScript. Al terminar quedaron cerrados el navegador y los tres servicios de prueba.

GitHub completó en verde `verify`, `windows-installer` y `render-images` para el commit evaluado. `verify` terminó a las 19:07 UTC. Queda pendiente la aceptación visual de Marcos. [Controles del commit](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44150816901).
