# Matriz de contraste con la propuesta potente

Comparación documental posterior a las maquetas. Fuentes leídas completas:

- `docs/diseno/maquetas-15nov-REVISION.md`, integrada en `origin/nexora-cloud`
  por `6369cdd39c2178c204dd2565092e82c0ca0c852c`.
- `docs/coordinacion/potente-14nov/PROPUESTA_VERSION_POTENTE.md`, integrada por
  `4818c607` y disponible después de la entrega original.
- Maquetas `caja.html`, `direccion.html`, `mercancia.html` y `styles.css` del
  commit original `b48dc8b18efe8b1d48588ac4ff758aee7c8c57b5`.

Esta matriz no aprueba ni implementa las propuestas. «Coincide» significa que la
maqueta ya representa la idea visual; «parcial» registra diferencias concretas;
«no representado» evita atribuirle a la maqueta funciones que no tiene.

| Propuesta                                         | Caja                   | Dirección              | Mercancía              | Coincidencia o diferencia comprobada                                                                                                                               | Acción en esta revisión                                                                                                                       |
| ------------------------------------------------- | ---------------------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| PC-VIS-01 · papeles de color                      | Parcial                | Parcial                | Parcial                | Las tres comparten una paleta violeta y reservan verde, ámbar y rojo para estados. El botón Cobrar sigue violeta, mientras la propuesta reserva verde para Cobrar. | Sin cambio: Dot indicó conservar la paleta actual y el violeta reservado a Marcos. La decisión funcional sobre Cobrar sigue pendiente.        |
| PC-VIS-02 · oscuro con tres niveles               | Coincide               | Coincide               | Coincide               | Fondo, panel y superficie elevada tienen niveles oscuros diferenciados; no es una inversión automática.                                                            | Ninguna.                                                                                                                                      |
| PC-VIS-03 · montos legibles                       | Parcial                | Parcial                | No aplica              | Se usan cifras tabulares, jerarquía de total y `RD$`; no se separó `RD$` en tamaño/color ni se muestran cifras reales.                                             | Ninguna: cambiar formato de montos no es un defecto claro y la propuesta lo deja sujeto a decisión.                                           |
| PC-COM-01 / PC-VIS-04 · pestañas y caja adaptable | Parcial                | No aplica              | No aplica              | Hay categorías y tarjetas adaptables, pero no pestañas «Favoritos / Ofertas»; en móvil la cuadrícula usa una columna y no dos.                                     | Se documenta; no se amplía el diseño sin elección de la dueña.                                                                                |
| PC-VIS-05 · carrito como ticket                   | Parcial                | No aplica              | No aplica              | Hay venta actual, total y Cobrar como única acción primaria. El monto no está dentro del botón y no se añadieron Espera, Cotizar ni Limpiar.                       | Ninguna: no fue señalado como defecto y altera decisiones de flujo.                                                                           |
| PC-VIS-06 · estado de caja                        | Parcial                | No aplica              | No aplica              | La maqueta indica «Caja abierta» y «Lector listo», pero no inventa impresora, persona, hora ni pendientes por subir.                                               | Ninguna; se conserva el principio de no inventar estado.                                                                                      |
| PC-VIS-07 · hoy en una mirada                     | No aplica              | Parcial                | No aplica              | Dirección tiene saludo, cuatro indicadores, gráfico y tres señales accionables. No inventa vendido, margen, comparación ni número de ventas.                       | Se aclaró «Se comparará con el mismo día de la semana anterior» sin añadir cifras; ganancia ahora dice «Visible solo para roles con permiso». |
| PC-VIS-08 · tablas legibles                       | No aplica              | No aplica              | Coincide               | La tabla usa encabezado, filas separadas, números alineados y contenedor desplazable en móvil. No muestra estados financieros.                                     | Ninguna.                                                                                                                                      |
| PC-VIS-09 · carga, vacío y error                  | No representado        | No representado        | No representado        | Las maquetas son estados estáticos poblados; no presentan estados de carga, vacío o error.                                                                         | Ninguna; no se afirma cobertura.                                                                                                              |
| PC-VIS-10 · iconos con texto                      | Coincide en navegación | Coincide en navegación | Coincide en navegación | La navegación usa el mismo juego lineal, tamaño común y etiqueta visible, incluida la barra móvil.                                                                 | Ninguna.                                                                                                                                      |
| PC-VIS-11 · movimiento limitado                   | Coincide               | Coincide               | Coincide               | Solo existe transición corta de tema y `prefers-reduced-motion`; no hay movimiento en cobro ni contenido.                                                          | Ninguna.                                                                                                                                      |
| PC-VIS-12 · primer arranque                       | No representado        | No representado        | No representado        | No existe tarjeta de progreso de configuración.                                                                                                                    | Ninguna; está fuera de estas tres vistas.                                                                                                     |
| PC-PRIV-02 · ocultar cifras                       | No representado        | No representado        | No aplica              | Dirección usa guiones y datos de demostración, pero no incluye un control de privacidad.                                                                           | Ninguna; un ojo funcional requiere decisión y lógica futura.                                                                                  |
| PC-I18N-01/02 · administración bilingüe           | No aplica              | No representado        | No representado        | Todas las maquetas están en español; no simulan idioma por usuaria ni traducción.                                                                                  | Ninguna; la propuesta recomienda empezar por Administración y Reportes solo si la dueña lo autoriza.                                          |
| PC-VIS-14 · capturas reales vendibles             | No coincide            | No coincide            | No coincide            | Son maquetas y datos de demostración, no capturas de la aplicación funcionando.                                                                                    | Se mantiene la advertencia; no deben presentarse como evidencia del producto real.                                                            |

## Puntos de la revisión de Claude nube

| Punto                  | Resultado comprobado                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuente ausente         | Resuelto documentalmente: ya existe en `origin/nexora-cloud` desde `4818c607`.                                                                  |
| Barra inferior móvil   | Era un artefacto de captura de página completa. Las tres capturas móviles se rehacen como ventana 390 × 844; el CSS de la barra fija no cambia. |
| «Tendencia disponible» | Sustituido por el criterio explícito de la propuesta: comparación con el mismo día de la semana anterior. No se añadió porcentaje.              |
| «Solo con permiso»     | Sustituido por «Visible solo para roles con permiso», sin afirmar qué roles ni inventar un dato.                                                |
| Tono violeta           | Sin cambio, por la instrucción posterior de conservar la paleta actual y reservar el tono a Marcos.                                             |

## Límites

- No se abrió ni modificó `apps/**`; nada de esta revisión prueba la aplicación
  funcionando.
- No se añadió lógica, dinero, precios, permisos, DIS-02, EFI-01, producción,
  VM, Render, credenciales ni despliegues.
- Las diferencias no corregidas son decisiones de producto, no defectos
  confirmados de estas maquetas.
