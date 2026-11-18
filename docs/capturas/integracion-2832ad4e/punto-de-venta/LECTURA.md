# Categorías de Punto de venta · `2832ad4e`

Comparé `adb789cb` con `2832ad4e` en la aplicación real con Edge 157.0.4341.60 y base local descartable. Probé 1440 × 900 y 390 × 844, en tema claro y oscuro, con acento verde. [Cambio evaluado](https://github.com/marcosfeliz28/awesome-outbid/commit/2832ad4e0a884efa2496718b6b970368ce5a0966)

| Estilo calculado de la categoría activa | Claro | Oscuro |
|---|---|---|
| Fondo y borde en `adb789cb` | Violeta `#7c3aed` | Violeta `#7c3aed` |
| Fondo en `2832ad4e` | Verde `#cbecdc` a `#d5e0d7` | Esmeralda `#063f28` a `#030c08` |
| Borde en `2832ad4e` | Dorado oscuro `#79530f` | Dorado claro `#f0d291` |
| Contraste del texto sobre los extremos del degradado | 10.77:1 a 11.53:1 | 10.84:1 a 17.89:1 |

Los colores coincidieron a ambos anchos. «Suplementos» midió 127.11 × 44 px a 1440 y 123.94 × 44 px a 390 en los dos candidatos. Su centro respondió al clic y el documento tuvo 0 px de desborde horizontal. El carril de categorías conserva su desplazamiento horizontal propio. Al seleccionar «Suplementos», quedó un único botón con `aria-pressed=true` y el catálogo pasó de 60 a 12 productos de demostración en cada variante. El punto violeta que se ve junto a «Suplementos» es el marcador de color del catálogo. [Estilo activo](https://github.com/marcosfeliz28/awesome-outbid/blob/2832ad4e0a884efa2496718b6b970368ce5a0966/apps/web/src/fusion-caja-higgsfield.css#L193-L212), [botones y marcador de categoría](https://github.com/marcosfeliz28/awesome-outbid/blob/2832ad4e0a884efa2496718b6b970368ce5a0966/apps/web/src/POS.tsx#L1045-L1070)

En una comprobación adicional a 390 px en oscuro con colores forzados y movimiento reducido, el navegador aplicó un fondo y borde de sistema `rgb(55, 0, 110)` y texto blanco, con contraste 15.13:1. El degradado desapareció y el botón conservó sus 44 px de alto. [Regla para colores forzados](https://github.com/marcosfeliz28/awesome-outbid/blob/2832ad4e0a884efa2496718b6b970368ce5a0966/apps/web/src/fusion-caja-higgsfield.css#L958-L963)

Repetí el cierre con Escape de Cobrar y del buscador en oscuro a ambos anchos. Los dos controles siguieron perdiendo el foco, que quedó en `body`. Cobrar dejó intactos los tres artículos de demostración y el total en ambos casos.

Las cuatro capturas son del candidato `2832ad4e` y muestran «Suplementos» seleccionado. `mediciones.json` recoge los datos de ambos candidatos y los hashes de las imágenes. Hubo cero solicitudes operativas y cero errores de página. Cerré el navegador, la aplicación, la API y la base de prueba tras cada ejecución.
