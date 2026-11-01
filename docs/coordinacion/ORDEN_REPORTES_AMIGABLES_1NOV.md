# Orden: reportes amigables con PDF y Excel (pedido de la dueña, 1-nov-2026)

**Pedido textual (resumen):** todos los reportes que da el sistema deben ofrecer sacar un informe para imprimir en **PDF o Excel**, con los datos bien organizados, bonito, detallado y con **gráficas**. Los reportes de hoy tienen información que ella no entiende: hay que llevarlos a un ambiente amigable, que cualquier persona entienda **de qué se trata** cada reporte y **cada sección** (qué es, para qué sirve, cómo se lee). Si un reporte tiene subsecciones, **cada una debe explicarse**.

## Qué existe hoy
`apps/api/src/reportes/` (40 reportes; grupos Ventas, Dinero, Margen, Inventario, Clientes y crédito; se piden por `/reports/:id`, pantalla `Management.tsx` ~l.2842). Exportación suelta: `income-report.ts` (csv/xlsx/pdf), `FormalReports.tsx` (PDF formal), `MonthReport.tsx` (CSV). Ya hay `pdfkit` y `exceljs` en la API y `recharts` en la web. No hay un exportador común ni textos explicativos por reporte.

## Resultado esperado (por cada uno de los 40 reportes y los informes formales)
1. **Botones «PDF» y «Excel»** en cada reporte, con el mismo periodo y filtros que se ven en pantalla.
2. **PDF para imprimir (A4):** portada con nombre del negocio, título claro, periodo, fecha y quién lo generó; recuadro **«De qué trata este reporte»** (2–3 líneas, sin tecnicismos); **resumen con las cifras clave**; **gráficas** (barras, líneas o pastel según el reporte; con título, ejes rotulados y leyenda); tablas con **columnas con nombre amigable** y debajo/aparte la **explicación de cada columna**; totales y subtotales; **notas «cómo leerlo»** y avisos (p. ej. «las devoluciones se restan en el mes de la venta original»); pie con paginación y marca. Letra legible, tildes y ñ correctas, montos en RD$ (y US$ cuando aplique), colores con buen contraste que también se vean en blanco y negro.
3. **Excel:** una hoja «Resumen» (qué es + cifras clave + gráficas) y una hoja por sección de detalle, con encabezados congelados, anchos, formato de moneda/fecha, totales con fórmulas y una hoja «Guía» con el significado de cada columna. Gráficas: nativas si la librería lo permite, o imágenes; sin dependencia nueva sin revisar licencia y `pnpm audit`.
4. **Catálogo de explicaciones** (`apps/api/src/reportes/guia.ts` o JSON): para cada reporte, `queEs`, `paraQueSirve`, `comoSeLee`, y para cada columna y sección `nombreAmigable` y `significa`. En español claro, verificado contra el código que calcula cada cifra (si no puedes confirmar una definición en el código, márcala «por confirmar», no la inventes).

## Reglas que no cambian
- Solo lectura: el exportador no cambia datos. Mismos **permisos** que la pantalla: costo y margen solo con `profit:read`; la cajera con caja abierta no ve importes (arqueo ciego); nada de datos de costo en reportes que hoy no los muestran.
- **Seguridad** (`seguridad-20`): límite de filas y de tamaño del archivo, neutralizar fórmulas inyectadas en Excel (celdas que empiecen por `=`, `+`, `-`, `@`), nombres de archivo seguros, sin rutas ni datos de otros negocios, registro en auditoría de quién exportó qué.
- Margen = (precio − costo)/precio sin restar ITBIS; no se bloquea ninguna venta por margen. Las cifras del PDF/Excel deben ser **idénticas** a las de la pantalla (una sola fuente de datos).
- Prueba que falle antes y pase después; 3 CI verdes del último SHA; sin debilitar pruebas. Nadie mezcla en `nexora-cloud` ni despliega: espera la autorización de Norexos 1.

## Reparto
- **Pieza A (API, motor de exportación):** `GET /reports/:id/export?format=pdf|xlsx&from&to&…` con un motor común (portada, resumen, gráficas, tablas, guía), empezando por los 5 reportes más usados y dejando el resto por catálogo. Rama `claude-pc/reportes-export`. Dueño: agente de la nube + revisión de Claude PC.
- **Pieza B (catálogo de explicaciones):** `guia` de los 40 reportes y de los informes formales, en español claro. Rama `claude-pc/reportes-guia`. Dueño: agente de la nube; IA local puede ayudar con borradores «sin revisar».
- **Pieza C (pantalla):** botones «PDF» y «Excel» en cada reporte de `Management.tsx`/`FormalReports.tsx`/`MonthReport.tsx`, con vista previa del «De qué trata» y accesibilidad a 390 px. Rama `chatgpt-pc/reportes-botones`. Dueño: ChatGPT PC (después de que la pieza A tenga el endpoint; mientras tanto diseña la maqueta).
- **Pieza D (diseño del informe):** maqueta visual del PDF (portada, gráficas, estilo Obsidian Lumina en versión clara para imprimir) en `docs/diseno/informes/`. Dueño: ChatGPT nube.
- **Orden de mezcla (Norexos 1):** B → A → C (D es insumo).
