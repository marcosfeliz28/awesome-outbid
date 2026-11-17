# Lote 5: archivos de imagen para revisión

Orden: `docs/coordinacion/ORDEN_EVIDENCIA_17NOV.md`, sección ChatGPT PC. Base: `32852bf046f499bc27bd369b1e5fc215a5d4912c`. Rama: `chatgpt-pc/fotos-lote-5`. Entrega del 17-nov-2026 UTC (noche del 16-nov en la PC).

## Conteo exacto

| Resultado | Productos |
|---|---:|
| Recibidos y trabajados, filas 241–261 | 21 |
| Con archivo WebP y coincidencia visual con los datos especificados | 13 |
| Con archivo WebP y observación de submarca pendiente | 2 |
| Sin archivo que cumpla resolución/identidad | 6 |
| Suma de resultados | 21 |
| Archivos WebP reales en esta carpeta | 15 |
| Aprobados para aplicar a la tienda | 0 |

La hoja [contacto.png](contacto.png) reúne las **15 imágenes** en una sola imagen y muestra además seis casillas de faltantes. Las casillas no se cuentan como fotos. Cada casilla identifica `n` y SKU; mantiene el orden del maestro. No es una captura de la aplicación.

[manifest.csv](manifest.csv) contiene los 21 productos, sus fuentes, campo `licencia/uso`, coincidencia de marca/presentación, fechas originales, dimensiones y SHA-256. [validacion.json](validacion.json) registra el conteo, los hashes y las comprobaciones efectuadas sobre los archivos finales.

## Qué se comprobó

- Los 21 pares `n`/SKU y nombres coinciden con `docs/fotos/suplementos.csv`; no se modificó el maestro.
- Se abrieron y compararon las candidatas locales. Catorce imágenes seleccionadas proceden de originales descargados el 15-nov; sus hashes se volvieron a verificar. Se conserva esa fecha en el CSV y no se presentan como descargas nuevas.
- La candidata nueva de **INV-1029 / n 242** muestra Flowing Health y glicinato, malato y citrato. Sustituye en esta entrega las candidatas descartadas BioEmblem/Quiet Mood, sin cambiar el sistema. La ficha de NutriCity contiene cantidades discordantes; no se trasladan al maestro, que tampoco indica cantidad.
- Los 15 archivos finales se decodificaron como WebP, con al menos 800 px en ambos ejes, conservando las dimensiones originales. No se amplió ninguna imagen.
- La conversión es sin pérdida: los píxeles RGB de cada WebP coinciden con el original sobre fondo blanco. No se generaron fotos ni se reescribieron etiquetas. Se conservaron los envases completos sobre su fondo limpio; no se aplicaron recortes innecesarios.
- Se inspeccionó visualmente la hoja de contacto final. **INV-1075 / n 257** conserva la composición original de caja y frasco; no es una botella aislada.
- Se comprobaron los dominios y fichas de referencia accesibles. Los HTTP 403/429 encontrados se registraron y no se intentaron eludir.

## Observaciones que impiden aprobar dos candidatas

| n | SKU | Observación |
|---|---|---|
| 254 | INV-1052 | La foto dice Bronson, frasco blanco y 120 cápsulas; el maestro dice Bronson Basics. No se declara coincidencia completa de submarca. |
| 255 | INV-1211 | La foto dice Bronson, frasco blanco y 60 cápsulas; el maestro dice Bronson Basics. No se declara coincidencia completa de submarca. |

Se incluyen como evidencia para cotejo físico, identificadas en naranja en la hoja y como `candidata_con_observacion` en el CSV. Los respaldos que mostraban tabletas o cantidades distintas quedaron excluidos.

## Los seis faltantes

| n | SKU | Por qué no hay archivo entregable |
|---|---|---|
| 243 | INV-1050 | Original 640×640; acceso directo a la ficha oficial HTTP 403. No se amplía. |
| 245 | INV-1058 | Caja URO 540×540; falta un original mayor de la presentación correcta. |
| 247 | INV-1175 | Etiqueta Vanilla Flavour frente a Vanilla Milkshake del maestro; equivalencia no comprobada. |
| 250 | INV-1637 | Original 600×600; consulta al catálogo del proveedor HTTP 429. No se amplía. |
| 253 | INV-1051 | Originales 540×600 y 386×386; ficha consultada redirige a Error404 y acceso directo HTTP 403. |
| 256 | INV-1059 | No hay candidata exacta del envase oscuro / 120 tabletas. No se sustituye por otra forma o cantidad. |

## Reparto y límites

Reparto confirmado por ChatGPT Nube: lote 3 (121–180), Nube; lote 4 (181–240), ChatGPT PC del chat `01a15b07`; lote 5 (241–261), ChatGPT PC de este chat `01a1147f`. No se reanudaron los lotes 1–2 ni se modificaron los archivos activos del lote 4. El reparto se anota también en `docs/coordinacion/RESULTADOS_CHATGPT.md`.

La disponibilidad pública no acredita licencia comercial. El CSV separa los archivos entregados de los derechos pendientes, el inventario físico no cotejado y la aprobación para la tienda. La revisión de Claude Nube y el sí de Marcos o Dot siguen pendientes. Estos archivos no se incorporan al producto vendido ni al catálogo operativo.

No hay cambios de aplicación, precios, existencias, base de la tienda, credenciales, Render ni despliegues. No se iniciaron navegadores, Node, PostgreSQL ni servidores de la aplicación para este lote. La captura real de Caja, Inicio, Productos y GV depende de que Dot publique una rama `dot/rediseno-*`; ninguna estaba publicada al comprobar las referencias remotas en esta entrega.
