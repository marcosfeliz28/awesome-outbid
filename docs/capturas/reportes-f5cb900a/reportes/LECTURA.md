# Validación visual local · cabecera de Reportes

## Alcance y condiciones

- Candidato exacto: `f5cb900a82cabbd81b66420714994600eec9dd94`.
- Su padre directo es `2832ad4e0a884efa2496718b6b970368ce5a0966`; el estado visual de Caja validado anteriormente queda incluido por ascendencia.
- UI real del candidato en Chromium local y API simulada únicamente en loopback.
- Datos de usuario, terminal, reporte e importes totalmente ficticios.
- Hosts externos bloqueados y cualquier escritura de negocio rechazada. Resultado: **0 escrituras**.
- Se validó 1440×1000 y 390×844, claro/oscuro, español/inglés: ocho combinaciones.

## Resultado

**8/8 escenarios aprobados en 9.8 s. Sin hallazgos dentro del alcance.**

1. Español muestra exactamente `TU NEGOCIO, CON CLARIDAD` y el título `Reportes`.
2. Inglés muestra exactamente `YOUR BUSINESS, WITH CLARITY` y el título `Reports`.
3. Ambos rótulos ocupan una sola línea en los ocho escenarios. Medidas: 249.83 px en español y 277.62 px en inglés, fuente de 14 px.
4. En móvil el rótulo empieza en x=80 px y el inglés termina en x=357.62 px, dentro de los 390 px disponibles. En escritorio empieza en x=351.19 px.
5. El ancho del documento coincide con el viewport en todos los casos; no hubo desbordamiento horizontal.
6. Navegación de lectura: se abrió el segundo grupo y se seleccionó su primer reporte. El panel cambió a `Cierres y diferencias` en español y `Closings and discrepancies` en inglés.
7. No se descargó, exportó, guardó ni envió nada.

## Evidencia representativa

- `1440-light-es-reportes.png`
- `1440-dark-en-reportes.png`
- `390-dark-es-reportes.png`
- `390-light-en-reportes.png`
- `RESUMEN_SANEADO.json`
- Ocho archivos `*-metricas.json` con las medidas crudas.

## Límites

- Validación visual y de navegación básica; no certifica permisos, seguridad, exportaciones, exactitud financiera ni servidor.
- No se usó API real, producción, Render, credenciales ni datos de clientes.
