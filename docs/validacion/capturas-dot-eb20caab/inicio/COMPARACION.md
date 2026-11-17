# Inicio con los accesos móviles arriba · revisión eb20caab

Probé `eb20caabff932de4f523e0190a1a8df087227036` de `dot/inicio-accesos-movil-17nov` en Windows con Edge,
una API local y PostgreSQL temporal con datos ficticios. La prueba terminó el 17 de noviembre de 2026
a las 20:32 UTC. [Entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/docs/diseno/higgsfield-fase1/ENTREGA_17NOV.md).

## Resultado en la aplicación

| Comprobación | Resultado |
| --- | --- |
| Accesos de Inicio a 390 × 844 px | El panel pasó de 2309 px a 681 px desde arriba. Su título aparece en la primera pantalla. El primer botón ocupa de 812 a 890 px y quedan 46 px por debajo de la ventana inicial. |
| Indicadores a 1440 y 390 px | Los cuatro valores de cada una de las cuatro capturas quedaron completos en una línea, sin salirse de sus tarjetas. |
| Orden al cambiar el tamaño | Al pasar de 1440 a 390 y volver, hubo un solo panel de accesos. En móvil aparece antes de los indicadores. En escritorio queda junto a la gráfica. |
| Reportes y movimiento | Reportes abrió con Enter en ambos tamaños. En escritorio el acceso subió 3 px al pasar el puntero y bajó 1 px al pulsarlo. Con movimiento reducido, la duración y el desplazamiento quedaron en cero. |
| Saludo y conexión | El encabezado «Hola,» volvió a estar visible en los dos tamaños. Las dos consultas de Inicio respondieron HTTP 200 y el navegador no registró errores de JavaScript. |

Se cerraron el navegador y los servicios de prueba. Comprobé que los tres puertos locales quedaron
libres. [Mediciones y huellas de las capturas](comprobacion-integrada.json),
[medición anterior del panel a 2309 px](https://github.com/marcosfeliz28/awesome-outbid/blob/e993260cbf2cb209055f4818cbd94b9780b93f51/docs/validacion/capturas-dot-46ae8830/inicio/COMPARACION.md).

## Cotejo con la segunda lámina de Higgsfield

Dot volvió a adjuntar en «Your dot» la segunda lámina aprobada. Revisé el PNG
`noxeros-inicio-higgsfield-02.png`, de 2688 × 1520 px, con huella SHA-256 `159dc72e708a71cbeb505ba7c0bb12e34b7e38435e25af4d44c0e79fe3aa31dc`.
El cotejo de composición se hizo con la captura de escritorio en Oscuro y Esmeralda.

| Elemento | Lámina aprobada | Aplicación medida |
| --- | --- | --- |
| Color y relieve | Fondo verde oscuro, luces verdes y detalle dorado. La gráfica se coloca a la izquierda de los accesos. | Coinciden el acento, el relieve de los paneles y la relación gráfica y accesos en escritorio. |
| Identidad y altura de la cabecera | «Noxeros» con símbolo dorado y controles en una sola banda. | «Noxeros» con icono verde en el lateral. Idioma y apariencia ocupan una banda superior y la navegación contextual otra. |
| Primer encuadre | Cuatro indicadores en una sola fila y los tres accesos en el mismo encuadre. | La app conserva la tira de tres indicadores operativos y después sus cuatro tarjetas. A 1440 × 900 px el panel comienza a 807 px y el primer botón a 913 px. |
| Contenido bajo la gráfica | Miniaturas de productos y actividad reciente. | La app conserva las alertas, la tabla de favoritos de la tienda y la mezcla por categoría. |

La compactación del primer encuadre sigue siendo la diferencia principal. En móvil, acercar el panel
deja su título a la vista y todavía requiere desplazar la pantalla para ver el primer botón completo.

## Capturas reales

| Ventana | Claro | Oscuro | Tamaño de cada PNG |
| --- | --- | --- | --- |
| 1440 × 900 | [Captura](inicio-1440-claro.png) | [Captura](inicio-1440-oscuro.png) | 1440 × 4274 |
| 390 × 844 | [Captura](inicio-390-claro.png) | [Captura](inicio-390-oscuro.png) | 390 × 8758 |

## Controles de GitHub

En `1d0d0dcd`, 105 pruebas de navegador fallaron al esperar el encabezado «Hola,» tras entrar.
El ajuste lo restablece junto al título «Resumen» y la comprobación local ya lo encuentra visible.
[Registro del fallo](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44163007730/job/134321547814),
[espera en el flujo existente](https://github.com/marcosfeliz28/awesome-outbid/blob/1d0d0dcdfcbb1bf45cfd3164f8145d337a7419a4/tests/e2e/store.spec.ts#L75),
[saludo restaurado](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/apps/web/src/Dashboard.tsx#L211).

A las 20:34 UTC, en `eb20caab`, `verify` estaba en curso, `windows-installer` aprobado
y `render-images` aprobado. [Controles de la versión probada](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44169472399).


## Seguimiento de la revisión

Marcos dio su visto bueno a la vista de prueba de Inicio y pidió continuar por fases con Higgsfield.
Dot mostró el primer concepto de Punto de venta. La comprobación de esa fase queda pendiente de la
lámina que Marcos apruebe y de una rama funcional con capturas de la aplicación.

El control `verify` de `46ae8830` también terminó con 105 pruebas esperando el saludo «Hola,».
La restauración del saludo se comprobó en la aplicación de `eb20caab`. Su ejecución de GitHub
se conserva como antecedente de esta revisión.
[Control anterior](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44164527303/job/134326932194),
[controles de la revisión capturada](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44169472399).

Al probar `eb20caab`, la lámina y la pantalla de Inicio mostraban «Noxeros». En ese mismo commit,
la auditoría ubicó «Norexos» en el nombre visible al instalar la web y en el aviso compartido de
actualización.
[Auditoría actualizada](https://github.com/marcosfeliz28/awesome-outbid/blob/03593f280c038cf96e0dcebbeea97f53ae969594/docs/diseno/inicio-integrado/AUDITORIA_CLAUDE_4e4bb76f.md#L35),
[nombre de la web](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/apps/web/vite.config.ts#L46),
[aviso de actualización](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/apps/web/src/pwaUpdatePolicy.ts#L43).


A las 20:51 UTC, `verify` de `eb20caab` terminó con 154 de 155 casos de navegador aprobados.
La prueba de `store.spec.ts:185` abre el menú móvil y encuentra dos botones llamados «Punto de venta».
La búsqueda abarca el menú y el panel de accesos rápidos. Pasaron 1087 pruebas unitarias y 656 de
integración, además de `windows-installer` y `render-images`.
[Log del caso restante](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44169472399/job/134344378836),
[búsqueda del botón](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/tests/e2e/store.spec.ts#L185).

En `eb20caab`, cuando el asistente está disponible, el menú dice «Preguntar a Noxeros» y la pantalla abre con
el encabezado «Preguntar a Norexos». El nombre de instalación «Norexos» también se comprobó en
el manifiesto generado por la compilación local de ese SHA.
[Entrada](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/apps/web/src/App.tsx#L298),
[encabezado](https://github.com/marcosfeliz28/awesome-outbid/blob/eb20caabff932de4f523e0190a1a8df087227036/apps/web/src/AssistantPanel.tsx#L46).

## Decisión de marca vigente

Cerca de las 21:02 UTC del 17 de noviembre, Marcos indicó en «Your dot» que la marca se queda
**Norexos** y pidió alinear las pruebas y los accesos. Dot publicó el ajuste en `0641409`.
[Rama de Dot](https://github.com/marcosfeliz28/awesome-outbid/tree/dot/norexos-marca-canonica-17nov), [commit exacto](https://github.com/marcosfeliz28/awesome-outbid/commit/0641409cc82f81df01337a72cded4061f1f560a5).

A las 21:07 UTC, `render-images` y `windows-installer` de ese commit habían pasado. `verify`
seguía en curso. [Controles del ajuste](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44175161578).
