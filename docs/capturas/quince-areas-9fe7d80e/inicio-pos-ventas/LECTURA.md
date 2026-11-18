# Revisión de Inicio, Punto de venta y Ventas

Verifiqué `9fe7d80ee3eb8aeef4264059d98809e80943e741` de `dot/15areas-integracion-18nov` en Edge 157.0.4341.60. Usé una API local y PostgreSQL descartable con datos ficticios. Recorrí los tres módulos a 1440 × 900 y 390 × 844 en claro y oscuro. Las seis imágenes son capturas directas del navegador. [Mediciones y hashes](mediciones.json)

| Área | Resultado en las cuatro combinaciones | Captura de escritorio | Captura móvil |
| --- | --- | --- | --- |
| Inicio | El acceso «Ir a Punto de venta» abrió el módulo y el menú permitió volver a Inicio. | [Claro](inicio-1440-claro.png) | [Oscuro](inicio-390-oscuro.png) |
| Punto de venta | «Cobrar» abrió y cerró el diálogo. Los tres artículos y su total se conservaron al cambiar a inglés y al volver desde Ventas. | [Oscuro](punto-de-venta-1440-oscuro.png) | [Claro](punto-de-venta-390-claro.png) |
| Ventas | Se seleccionó el folio y se pudo abrir y cerrar la ficha al llegar a la previa. Al elegir el folio, el desplazamiento automático fue de 0 px y la previa quedó fuera del cuadro. | [Claro](ventas-1440-claro.png) | [Oscuro](ventas-390-oscuro.png) |

En Ventas, la vista previa siguió debajo del listado de 20 filas. A 1440 px empezó en y=2.531,83 px, **1.631,83 px** más abajo del borde inferior visible. A 390 px empezó en y=10.133,44 px, **9.289,44 px** más abajo del borde. Ambos temas dieron las mismas medidas. La zona sí se anuncia como «Sale preview» en inglés. [Mediciones](mediciones.json)

En Punto de venta con `lang=en`, el botón muestra «Charge», mientras el lector recibe «Cobrar». El panel «Carrito y cobro», la región «Artículos del carrito», los controles «Aumentar» y «Reducir» y el acceso móvil «Ver carrito (3 artículos)» también conservan español. [Controles](https://github.com/marcosfeliz28/awesome-outbid/blob/9fe7d80ee3eb8aeef4264059d98809e80943e741/apps/web/src/POS.tsx#L1101)

Se observaron 0 px de desbordamiento horizontal de página, 0 errores de página y 0 solicitudes operativas. El navegador, la aplicación, la API y la base de prueba quedaron cerrados.
