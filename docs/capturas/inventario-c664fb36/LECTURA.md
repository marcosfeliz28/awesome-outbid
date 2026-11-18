# Inventario · evidencia del candidato c664fb36

Código evaluado `c664fb36a8159e978824f33717e6bb976315150e`; esta rama de evidencia nace de `nexora-cloud` `0ed250e501bb04c13156776973fb1c446906f9e7`. PostgreSQL, API y web locales con migraciones y datos ficticios; dominios externos y escrituras operativas bloqueadas. Edge en 1440 × 900 y 390 × 844, claro/oscuro y ES/EN, con movimiento reducido. Se capturó la página completa y el diálogo Ajustar. Los servicios y el navegador se cerraron.

## Resultado observado

- Se accedió directamente a `/#inventory` y se recargó en ES y EN; encabezados y tabla aparecieron. Tras elegir en Inicio acento azul y superficie negra, ambos se restauraron en la ruta directa y tras recargar, en los dos tamaños.
- El diálogo Ajustar/Adjust abrió y cerró con Escape en ambos idiomas y tamaños; sus nueve campos y botones aparecen en el idioma seleccionado. No se enviaron ajustes.
- Cero escrituras operativas y errores JavaScript registrados; sin desbordamiento horizontal global en las ocho combinaciones.
- En las capturas del recorrido no aparecen tarjetas de indicadores de existencias, agotados o valor total como resumen; sí aparecen cantidades por producto, totales y valores de costo por fila. No se validaron KPIs agregados ni se inventaron datos. El documento del candidato reconoce que los indicadores de la lámina no están implementados.
- En inglés los encabezados y diálogo comprobados se traducen; las fechas visibles de vencimiento siguen con formato español, por ejemplo «11 feb de 2027». Los nombres de productos y almacenes son datos ficticios, no textos de interfaz traducibles.
- No se encontró el PNG original exacto en la carpeta de descargas; no se afirma fidelidad visual respecto a la lámina. No se evaluaron conteos, kardex, importación, todos los diálogos, accesibilidad completa ni contraste cuantitativo.

## CI informado por coordinación

El control `verify` del SHA exacto falló en `pnpm check`, `tests/docs-sistema-citas.test.ts:96`, por el rango invertido `WarehousesPanel.tsx:316-300` de `docs/sistema/FLUJO_MERCANCIA.md:61`. Coordinación confirmó que el historial de traspasos corresponde a `WarehousesPanel.tsx:316-348`. Solicitud a Dot: corregir la referencia y reenviar los tres controles. [Ejecución del trabajo fallido](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44236439161/job/134573641548). Esta ejecución visual no modifica el candidato ni sustituye el CI.

`comprobacion-integrada.json` contiene medidas, nombres de capturas y textos ficticios del recorrido.
