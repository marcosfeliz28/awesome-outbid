# Ventas · aviso de caja y formulario de anulación

Se probó el commit `0ed250e501bb04c13156776973fb1c446906f9e7` con un perfil administrativo de demostración, PostgreSQL descartable, la API y la aplicación reales en la PC. El tema claro se comprobó en español e inglés. La lista cargó con HTTP 200.

- **Caja cerrada.** Al elegir «Devolver» apareció «Abre tu caja para procesar devoluciones.» o su equivalente inglés. El aviso se pudo leer a 1440 y 390 px.
- **Anulación directa.** «Anular» abrió el diálogo con el folio, la explicación y el campo Motivo obligatorio. «Cancelar» lo cerró. En inglés se comprobaron el título, el campo y los botones.
- **Alcance.** Cero solicitudes operativas, cero errores JavaScript y procesos de prueba cerrados. Quedan pendientes el formulario «Solicitar anulación» del perfil de caja, el aviso de abonos y ambos avisos en oscuro.

| Vista | Anulación | Aviso de caja |
| --- | --- | --- |
| 1440, español | [PNG](anulacion-es-1440.png) | [PNG](caja-cerrada-es-1440.png) |
| 1440, inglés | [PNG](anulacion-en-1440.png) | [PNG](caja-cerrada-en-1440.png) |
| 390, español | [PNG](anulacion-es-390.png) | [PNG](caja-cerrada-es-390.png) |
| 390, inglés | [PNG](anulacion-en-390.png) | [PNG](caja-cerrada-en-390.png) |

[Mediciones del recorrido](mediciones.json)
