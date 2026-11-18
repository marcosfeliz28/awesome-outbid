# Punto de venta a 1280 × 720

Verifiqué `0ed250e501bb04c13156776973fb1c446906f9e7` en Edge 157.0.4341.60 con la API local y PostgreSQL descartable. Agregué por SKU cinco artículos de demostración con nombres de entre 20 y 22 caracteres. Las filas midieron 85 px. El recorrido mantuvo la ventana en `scrollY=0` para medir la vista inicial.

## Carrito y cobro

| Estado a 1280 × 720 | Alto útil de la lista | Desplazamiento interno | Filas completas |
| --- | --- | --- | --- |
| Tres artículos, claro | 209 px | 46 px automático | 2 y 3 |
| Cinco artículos, oscuro | 218 px | 207 px automático | 4 y 5 |
| Cinco artículos, lista devuelta al inicio | 218 px | 0 px | 1 y 2 |

En las tres mediciones se ven **dos filas completas**. Con tres artículos, lista y filas ocupan 209 y 255 px respectivamente. Con cinco, ocupan 218 y 425 px. La página tiene 0 px de desbordamiento horizontal. [Tres artículos](pos-1280-3-articulos-claro.png) · [Cinco artículos](pos-1280-5-articulos-oscuro.png)

El botón «Cobrar» mide **349,39 × 46 px** y queda entre y=615 e y=661, por completo dentro de la pantalla de 720 px. Su centro era alcanzable sin desplazar la página. Al pulsarlo abrió el diálogo «Todo listo para cobrar». Cerré el diálogo y comprobé que los cinco artículos y el total se conservaron. Hubo 0 solicitudes operativas y 0 errores de página. Los servicios y el navegador de prueba quedaron cerrados.

## Etiquetas al cambiar a inglés

Con `lang=en`, el texto visible del botón es «Charge». El nombre accesible de Cobrar, el del panel «Carrito y cobro» y el de la región «Artículos del carrito» siguen en español. Las cinco filas también exponen «Aumentar» y «Reducir». En 390 × 844, el acceso al carrito anuncia «Ver carrito (5 artículos)» y el botón de cobro conserva «Cobrar» como inicio de su nombre accesible. El acceso móvil abrió el carrito y el encabezado mostró «Current sale». [Escritorio en inglés](pos-1280-ingles.png) · [Móvil en inglés](pos-390-ingles.png) · [Controles en POS.tsx](https://github.com/marcosfeliz28/awesome-outbid/blob/0ed250e501bb04c13156776973fb1c446906f9e7/apps/web/src/POS.tsx#L1101)

## Integridad de las capturas

| Archivo | Dimensiones | SHA-256 |
| --- | --- | --- |
| [pos-1280-3-articulos-claro.png](pos-1280-3-articulos-claro.png) | 1280 × 720 | `b7fcbdeac5b5dfa9eaa81a5bbc76ec889f25dbac2bdb28fdff9855d5a219b9c7` |
| [pos-1280-5-articulos-oscuro.png](pos-1280-5-articulos-oscuro.png) | 1280 × 720 | `10a17764f4e30f06c99bb5f02c3831d94d5867e3df83ad88536a530c175ae8f9` |
| [pos-1280-ingles.png](pos-1280-ingles.png) | 1280 × 720 | `f941a4920c3cc8eb320e81a242bcb51bffa1e328ccbf64b4184c41c9c8a7506d` |
| [pos-390-ingles.png](pos-390-ingles.png) | 390 × 844 | `49a2d9281e0ba04e2c8bc698e2726e6f210c0ab2f6c0eca3fa83c0004158c792` |
