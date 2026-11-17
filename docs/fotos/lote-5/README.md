# Lote 5: archivos de imagen para revisión

La orden de evidencia del 17 de noviembre asigna las filas 241–261 a `chatgpt-pc/fotos-lote-5`. La revisión del 17-nov amplía la entrega anterior `66c3bb7c` con tres archivos.

## Conteo exacto

| Resultado | Productos |
|---|---:|
| Recibidos y trabajados, filas 241–261 | 21 |
| Con archivo WebP y coincidencia visual con los datos especificados | 16 |
| Con archivo WebP y observación de submarca pendiente | 2 |
| Sin archivo que cumpla la presentación solicitada | 3 |
| Suma de resultados | 21 |
| Archivos WebP reales en esta carpeta | 18 |
| Aprobados para aplicar a la tienda | 0 |

La hoja reúne las **18 imágenes** y señala los tres faltantes en el orden del maestro. Cada casilla identifica su fila y SKU. [Hoja de contacto](contacto.png)

[manifest.csv](manifest.csv) contiene los 21 productos, sus fuentes, campo `licencia/uso`, coincidencia de marca/presentación, fechas originales, dimensiones y SHA-256. [validacion.json](validacion.json) registra el conteo, los hashes y las comprobaciones efectuadas sobre los archivos finales.

## Qué se comprobó

- Los 21 pares `n`/SKU y nombres coinciden con `docs/fotos/suplementos.csv`; no se modificó el maestro.
- Se abrieron y compararon las candidatas locales. Catorce imágenes seleccionadas proceden de originales descargados el 15-nov; sus hashes se volvieron a verificar. Se conserva esa fecha en el CSV y no se presentan como descargas nuevas.
- La candidata nueva de **INV-1029 / n 242** muestra Flowing Health y glicinato, malato y citrato. Sustituye en esta entrega las candidatas descartadas BioEmblem/Quiet Mood, sin cambiar el sistema. La ficha de NutriCity contiene cantidades discordantes; no se trasladan al maestro, que tampoco indica cantidad.
- Los 18 archivos finales se decodificaron como WebP y conservan sus dimensiones originales, de al menos 800 px en ambos ejes.
- La conversión es sin pérdida: los píxeles RGB de cada WebP coinciden con el original sobre fondo blanco. No se generaron fotos ni se reescribieron etiquetas. Se conservaron los envases completos sobre su fondo limpio; no se aplicaron recortes innecesarios.
- Se inspeccionó visualmente la hoja de contacto final. **INV-1075 / n 257** conserva la composición original de caja y frasco; no es una botella aislada.
- Se comprobaron los dominios y fichas de referencia accesibles. Los HTTP 403/429 encontrados se registraron y no se intentaron eludir.

## Tres archivos añadidos

| n | SKU | Etiqueta visible | Dimensiones de origen | Fuente |
|---|---|---|---|---|
| 243 | INV-1050 | Puritan’s Pride Turmeric 800 mg, 100 cápsulas | 1001 × 1788 | [Puritan’s Pride Taiwán, artículo 51441](https://www.puritantw.com/products/turmeric-extract-800mg-100-capsules) |
| 250 | INV-1637 | BioSteel Vitamin C 500 mg, naranja, 90 tabletas masticables | 2048 × 2048 | [Vitamart](https://www.vitamart.ca/products/biosteel-vitamin-c-90-chewable-tablets) |
| 253 | INV-1051 | Puritan’s Pride Vitamin E 450 mg, 50 softgels | 1080 × 1080 | [Al Ain Pharmacy](https://alainpharmacy.ae/puritans-pride-e-1000-iu-softgels-50-s.html) |

El renglón INV-1637 del maestro solo identifica marca y producto. Vitamart etiqueta su ficha como descontinuada. El tamaño y el envase de la tienda requieren cotejo. [Ficha de la presentación fotografiada](https://www.vitamart.ca/products/biosteel-vitamin-c-90-chewable-tablets)

## Observaciones que impiden aprobar dos candidatas

| n | SKU | Observación |
|---|---|---|
| 254 | INV-1052 | La foto dice Bronson, frasco blanco y 120 cápsulas; el maestro dice Bronson Basics. No se declara coincidencia completa de submarca. |
| 255 | INV-1211 | La foto dice Bronson, frasco blanco y 60 cápsulas; el maestro dice Bronson Basics. No se declara coincidencia completa de submarca. |

Se incluyen como evidencia para cotejo físico, identificadas en naranja en la hoja y como `candidata_con_observacion` en el CSV. Los respaldos que mostraban tabletas o cantidades distintas quedaron excluidos.

## Los tres faltantes

| n | SKU | Por qué no hay archivo entregable |
|---|---|---|
| 245 | INV-1058 | El original del fabricante, 2000 × 2000 px, muestra un frasco rosa de 60 cápsulas. La referencia anterior muestra una caja. Falta cotejar el envase físico. [O Positiv](https://opositiv.com/products/uro-vaginal-probiotic-capsules) |
| 247 | INV-1175 | La fuente oficial denomina al producto Vanille y la candidata dice Vanilla Flavour. Queda por confirmar si es el Vanilla Milkshake del maestro. [Alpha Foods](https://alphafoods.de/products/vegan-protein-600-txpl8) |
| 256 | INV-1059 | La ficha de 120 tabletas muestra un frasco blanco con etiqueta oscura. Falta confirmar a cuál se refiere el maestro con «envase oscuro». [Bronson Basics](https://www.bronsonvitamins.com/products/bronson-basics-vitamin-k2-plus-d3-mk7-120-tablets-1) |

## Reparto y límites

Reparto confirmado por ChatGPT Nube: lote 3 (121–180), Nube; lote 4 (181–240), ChatGPT PC del chat `01a15b07`; lote 5 (241–261), ChatGPT PC de este chat `01a1147f`. No se reanudaron los lotes 1–2 ni se modificaron los archivos activos del lote 4. El reparto se anota también en `docs/coordinacion/RESULTADOS_CHATGPT.md`.

La disponibilidad pública no acredita licencia comercial. El CSV separa los archivos entregados de los derechos pendientes, el inventario físico no cotejado y la aprobación para la tienda. La revisión de Claude Nube y el sí de Marcos o Dot siguen pendientes. Estos archivos no se incorporan al producto vendido ni al catálogo operativo.

No hay cambios de aplicación, precios, existencias, base de la tienda, credenciales, Render ni despliegues. No se iniciaron navegadores, Node, PostgreSQL ni servidores de la aplicación para este lote. La captura real de Caja, Inicio, Productos y GV depende de que Dot publique una rama `dot/rediseno-*`; ninguna estaba publicada al comprobar las referencias remotas en esta entrega.
