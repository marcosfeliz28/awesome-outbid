# Antetítulo de Reportes y ensayos de capturas · f5cb900a

Candidato `f5cb900a82cabbd81b66420714994600eec9dd94` de `dot/15areas-sobre-prod-18nov`. Su cambio de interfaz está en el antetítulo de Reportes. Verifiqué el SHA exacto en una copia local aislada con datos de ejemplo.

## Reportes

En Chromium, con la aplicación y la API simulada en esta PC, el antetítulo se mantuvo en una línea en 8/8 combinaciones a 1440 y 390 px, en claro y oscuro, español e inglés. Apareció «TU NEGOCIO, CON CLARIDAD» en español y «YOUR BUSINESS, WITH CLARITY» en inglés. La navegación al reporte de Cierres y diferencias cargó el panel en cada idioma. Ninguna combinación produjo un desbordamiento horizontal. [Cuatro capturas y mediciones](reportes/LECTURA.md)

El recorrido de foco al cerrar Cobrar y el buscador sigue abierto. Este cambio de Reportes conserva los archivos que gobiernan esos diálogos. [Informe y capturas del recorrido de foco](https://github.com/marcosfeliz28/awesome-outbid/blob/3786dfab2151cf019590ca2c86d62e29f05d1668/docs/capturas/integracion-2832ad4e/LECTURA.md)

## Ensayos de capturas

- `26b7bf1d` configura 120 casos de 15 pantallas y falla en el paso de captura. Pasaron la compilación y la instalación del navegador. GitHub muestra código 1 tras 241 segundos. La duración coincide con el límite de 240 segundos de la configuración. Falta el primer error concreto del registro. [Ensayo general](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44359056840)
- `a296ccd6` acota a 32 casos de Asistente, GV, Incentivos y Configuración, con dos tamaños, temas e idiomas. Pasó el control visual. El código de la aplicación coincide con `f5cb900a` en ambos ensayos. La verificación cubre la carga y el aspecto inicial con datos simulados. [Ensayo de cuatro pantallas](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44360521170)
- GitHub registró los artefactos de ambos ensayos. Los registros por pantalla y las capturas de esos artefactos quedan pendientes de revisión con acceso autenticado. Las capturas de Reportes adjuntas a este informe provienen del recorrido local independiente.

## Fotos y controles del candidato

Pasaron 5/5 pruebas focales de presentación en una copia del mismo SHA. En GitHub pasaron instalador, imágenes y `pnpm check`. GitHub canceló `verify` cuando Dot empujó `81f31094` a la misma rama. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44358877340) · [CI de la base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44362984444)

La base `dcf61af2` tiene 318 WebP. El candidato conserva las 316 compartidas byte por byte. Le faltan `adidas-samba-blancos-real.webp` y `adidas-campus-gris-real.webp`, añadidas después en la base. El árbol de API coincide. [Comparación con la base](https://github.com/marcosfeliz28/awesome-outbid/compare/f5cb900a...dcf61af2)

Para la próxima entrega, Dot debe conservar las fotos de la base, documentar el resultado por pantalla y el primer error concreto del ensayo general, resolver el retorno de foco y adjuntar el SHA, sus tres controles y la demostración privada.

Los procesos y navegadores del recorrido se cerraron. La validación se limitó a datos ficticios y acciones de lectura.
