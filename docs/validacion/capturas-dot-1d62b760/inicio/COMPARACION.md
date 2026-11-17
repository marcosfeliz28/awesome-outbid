# Comprobación de Inicio y del nombre Noxeros

Probé en la laptop el commit `1d62b760e5ea7707bfb8753cf4b60895094ace8b` de
`dot/correccion-marca-noxeros-17nov`. El recorrido terminó el 17 de noviembre de 2026 a las 19:48 UTC.
[Commit de Dot](https://github.com/marcosfeliz28/awesome-outbid/commit/1d62b760e5ea7707bfb8753cf4b60895094ace8b).

## Resultado en pantalla

En el recorrido anterior a 1440 px, el menú decía «Noxeros» y el cuadro se titulaba «Acerca de Norexos».
Ahora el menú muestra «Noxeros» y el cuadro «Acerca de Noxeros» tanto a 1440 como a 390 px. Abrí el cuadro
desde el menú y lo cerré con Escape en ambos tamaños. [Evidencia de la comprobación anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/a1390bb0e9900ee506577e658d892523e855611c/docs/validacion/capturas-dot-a1c18c66/inicio/COMPARACION.md).

| Pantalla y ventana | Claro | Oscuro | Tamaño de archivo en píxeles |
| --- | --- | --- | --- |
| Inicio a 1440 × 900 | [Captura](inicio-1440-claro.png) | [Captura](inicio-1440-oscuro.png) | 1440 × 4023 |
| Inicio a 390 × 844 | [Captura](inicio-390-claro.png) | [Captura](inicio-390-oscuro.png) | 390 × 7751 |
| Acerca de a 1440 × 900 | | [Captura](acerca-de-1440.png) | 1440 × 900 |
| Acerca de a 390 × 844 | | [Captura](acerca-de-390.png) | 390 × 844 |

A 390 px, el título del banner quedó completo y su botón mostró los 44 px de alto en los dos temas.
«Explorar mis reportes» abrió Reportes a 1440 y 390 px. Las dos consultas de Inicio respondieron HTTP 200.
El navegador no registró errores de JavaScript. [Mediciones y huellas de los seis PNG](comprobacion-integrada.json).

## Entorno y controles

Se compiló la web del commit probado y se reutilizó la compilación de la API, cuyo código no cambió
respecto a la comprobación anterior. Edge usó una base temporal con datos ficticios. Al terminar,
quedaron cerrados el navegador y los tres servicios de prueba. Comprobé que sus puertos quedaron libres.

GitHub a las 19:53 UTC para el commit de Dot.

| Control | Estado |
| --- | --- |
| `verify` | en curso |
| `windows-installer` | aprobado |
| `render-images` | aprobado |

[Ver los tres controles](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44160697064).

## Siguiente entrega

Dot confirmó que el ajuste de nombre precede a la implementación de la segunda lámina de Higgsfield.
La comprobación de sus efectos y animaciones queda pendiente de la rama de ese rediseño.
