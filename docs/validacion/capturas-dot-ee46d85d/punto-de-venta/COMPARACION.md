# Punto de venta de Dot · evidencia del 17 de noviembre

Evalué `dot/caja-higgsfield-fase2-17nov` en `ee46d85d5e97d8edade4d10bd82aefdfbe018ddb`. El recorrido cubre Punto de venta, desde el catálogo hasta abrir y cerrar el cobro. Las seis capturas se obtuvieron en Edge para Windows con la API local y datos de demostración. Se conservaron sus bytes y comprobé la decodificación, dimensiones y SHA-256 de cada PNG. [Mediciones y hashes](comprobacion-integrada.json)

Marcos aprobó el concepto de Punto de venta y posteriormente indicó el nombre **Norexos**. Estas capturas conservan el texto **Noxeros** que mostraba la aplicación en `ee46d85d`. El cambio posterior de marca y del texto accesible «Ir a» corresponde al commit `2e75ca92`. [Versión posterior de Dot](https://github.com/marcosfeliz28/awesome-outbid/commit/2e75ca92bb6ab397b937131e512671e3be397635)

## Capturas en Edge

| Pantalla | Dimensiones | Claro | Oscuro |
| --- | --- | --- | --- |
| Punto de venta en escritorio | 1440 × 900 | [PNG](pos-1440-claro.png) | [PNG](pos-1440-oscuro.png) |
| Punto de venta en móvil | 390 × 844 | [PNG](pos-390-claro.png) | [PNG](pos-390-oscuro.png) |
| Carrito móvil después de «Ver carrito» | 390 × 844 | [PNG](carrito-390-claro.png) | [PNG](carrito-390-oscuro.png) |

En ambos temas se midieron **0 px de desbordamiento horizontal** en las cuatro vistas iniciales. Los límites siguientes corresponden a la posición inicial, en píxeles CSS, como `[izquierda, arriba, derecha, abajo]`. [Mediciones](comprobacion-integrada.json)

| Elemento en la vista inicial | 1440 × 900, ambos temas | 390 × 844, ambos temas |
| --- | --- | --- |
| Primera tarjeta de producto | `[267, 510, 496, 920]` | `[29, 756, 190, 1111]` |
| Botón «Cobrar» de escritorio | `[1043, 846, 1419, 910]` | Barra móvil |
| Carrito | `[1022, 216, 1440, 1020]` | `[14, 11278, 376, 12000]` |
| Barra fija móvil | Vista de escritorio | `[12, 766, 378, 832]` |

En escritorio, el borde inferior de la primera tarjeta, de «Cobrar» y del carrito queda a 20, 10 y 120 px por debajo del área visible inicial, respectivamente. En móvil la barra fija entra completa y «Ver carrito» lleva a un carrito visible en ambos temas. [Mediciones](comprobacion-integrada.json)

## Comprobaciones

- **API local.** En ambos tamaños, F2 enfocó la búsqueda, F4 abrió el selector y se eligió un cliente, ingresar el SKU agregó una unidad y el diálogo de cobro abrió y cerró. Al cambiar a inglés el carrito se mantuvo. Se observaron **0 solicitudes POST de venta y 0 errores JavaScript de página**. Los servicios de prueba quedaron detenidos. [Mediciones](comprobacion-integrada.json)
- **Navegación móvil desde Inicio.** La búsqueda exacta distinguió el acceso «Abrir Punto de venta» y encontró una única opción del menú llamada «Punto de venta». Al pulsarla abrió la pantalla. [Mediciones](comprobacion-integrada.json)
- **Movimiento en escritorio.** Al pasar el puntero la tarjeta subió 2 px con dos transiciones de `0.15s`. Con movimiento reducido la traslación fue `0 px` y la duración `0s`. [Mediciones](comprobacion-integrada.json)
- **API simulada.** El conjunto de Dot pasó **8 de 8 casos en 15,2 s**, con alturas de 1000 px en Edge sin ventana. Cubrió las cuatro combinaciones de ancho y tema, cantidad, descuento e ITBIS del carrito, atajos de cliente, búsqueda y cobro, movimiento reducido, y conservación de artículo y total con cambios de tema e idioma. No quedaron procesos ni un puerto de escucha de esa prueba. [Pruebas de Dot en este commit](https://github.com/marcosfeliz28/awesome-outbid/blob/ee46d85d5e97d8edade4d10bd82aefdfbe018ddb/tests/visual-caja-higgsfield.spec.ts#L197)

## Hallazgos y estado

- **Visibilidad inicial.** A 1440 × 900 se recorta el borde de «Cobrar» y el carrito requiere desplazamiento para verse completo. En 390 × 844, la primera tarjeta también queda parcial en el primer cuadro. [Captura de escritorio](pos-1440-claro.png) · [Captura móvil](pos-390-claro.png)
- **Idioma de los controles.** Con el idioma inglés, la etiqueta accesible de «Cobrar» seguía en español en ambos tamaños. En móvil también seguía en español «Ver carrito». [Código de los controles en este commit](https://github.com/marcosfeliz28/awesome-outbid/blob/ee46d85d5e97d8edade4d10bd82aefdfbe018ddb/apps/web/src/POS.tsx#L1325)
- **CI de `ee46d85d`.** Al consultar la ejecución `44174462030`, `windows-installer` y `render-images` habían terminado correctamente y `verify` figuraba cancelado. La ejecución completa quedó cancelada. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44174462030)
