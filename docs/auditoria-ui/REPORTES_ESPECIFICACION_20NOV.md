# Especificación de diseño de reportes — 20-nov-2026

## Estado y alcance

Contrato C2 para la pantalla y las salidas Pantalla, Excel, PDF y CSV de los reportes de Nexora. Este documento **no certifica resultados visuales**: define qué debe implementar Claude en los generadores del servidor y qué debe comprobarse después. Toda combinación sin artefacto reproducible permanece `PENDIENTE` en `REPORTES_DISENO_20NOV.md`.

La fuente de verdad revisada es el código de este repositorio:

- tokens base y tipografía mínima: `packages/ui/src/tokens.css:1-78`;
- tema claro/oscuro: `apps/web/src/styles.css:60-106`;
- tipografías cargadas y base de la aplicación: `apps/web/src/styles.css:4-55,81-116`;
- superficie premium de reportes: `apps/web/src/premiumWorkspace.css:1-49,62-99`;
- explorador, filtros y descargas: `apps/web/src/Management.tsx:2981-3160`;
- registro real servido por `GET /api/reportes`: `apps/api/src/reportes/index.ts:1-14` y sus cinco módulos;
- PDF/Excel del registro: `apps/api/src/reports.ts:866-923`;
- exportación heredada: `apps/api/src/reports.ts:1593-1648`;
- Ingresos por día, única pantalla especial que hoy pide CSV/Excel/PDF: `apps/web/src/IncomeByDay.tsx:90-106,206-216`;
- Informe mensual, cuyo CSV actual se genera en pantalla: `apps/web/src/MonthReport.tsx:74-115`.

No se modifican API, datos, dinero ni generadores en esta entrega.

## 1. Sistema visual obligatorio

### 1.1 Tokens de color

| Uso                                 | Claro                   | Oscuro                                | Exportación impresa | Fuente                                                                               |
| ----------------------------------- | ----------------------- | ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Fondo de página                     | `#f8f9fc` (`--bg`)      | `#0b0f19` (`--bg`)                    | `#ffffff`           | `styles.css:60,89`                                                                   |
| Superficie                          | `#ffffff` (`--surface`) | `#151b2b` (`--surface`)               | `#ffffff`           | `styles.css:61,90`                                                                   |
| Superficie secundaria               | `#f9fafc`               | `#1b2235`                             | `#f5f3ff`           | `styles.css:62,91`                                                                   |
| Texto principal                     | `#1b2134`               | `#e2e8f0`                             | `#1b2134`           | `styles.css:63,92`                                                                   |
| Texto secundario                    | `#54627a`               | `#aab4c6`                             | `#54627a`           | `styles.css:64,93`                                                                   |
| Bordes                              | `#eaeaf2`               | `#293247`                             | `#d8d3e6`           | `styles.css:65,94`                                                                   |
| Violeta de marca para exportaciones | `#6d28d9`               | `#a78bfa`                             | `#6d28d9`           | orden C2; el código actual usa `--primary` `#7c3aed`/`#a78bfa` en `styles.css:66,95` |
| Éxito                               | `#047857`               | texto legible sobre superficie oscura | `#047857`           | `styles.css:72,100`                                                                  |
| Advertencia                         | `#92400e`               | `#fbbf24`                             | `#92400e`           | `styles.css:75,103`                                                                  |
| Error                               | `#c92e43`               | `#f87171`                             | `#991b1b`           | `styles.css:74,102`                                                                  |

El violeta `#6d28d9` es el color contractual de encabezados y acentos de PDF/Excel. No se sustituye por el verde/dorado premium; esos colores pueden seguir en la navegación de pantalla, pero el contenido exportado debe tener una marca única, estable y legible. Ningún color será el único indicador de estado.

### 1.2 Tipografía

- Familia de cuerpo y tablas: **Inter**, con alternativas `Arial, Helvetica, sans-serif` en archivos exportados.
- Títulos: **Plus Jakarta Sans**, con alternativa `Inter, Arial, sans-serif`.
- Base: `16 px`; interlineado `1.5`; peso regular `400`; etiquetas `600`; títulos `700`.
- Mínimo absoluto: `14 px`, derivado de `--fs-min`; nunca reducir texto para hacer caber una tabla.
- PDF: cuerpo mínimo `9 pt`, encabezados `9 pt/700`, título `16 pt/700`, metadatos `9 pt`. Si una tabla no cabe, cambiar orientación o repetir columnas clave; no bajar de `9 pt`.
- Excel: cuerpo `11 pt`, encabezados `11 pt/700`, título `16 pt/700`.
- Números y fechas: cifras tabulares (`font-variant-numeric: tabular-nums`) en pantalla; alineación derecha en importes, cantidades y porcentajes.

## 2. Encabezado y jerarquía

Todas las salidas, salvo CSV por ser texto plano, deben presentar en este orden:

1. logo configurado del negocio; si no existe, reservar el espacio sin inventar imagen;
2. **nombre del negocio**;
3. nombre del reporte en el idioma elegido;
4. rango aplicado, inclusivo, y alcance/filtros activos;
5. fecha y hora de generación en `America/Santo_Domingo` y nombre de quien genera cuando el servidor lo entregue;
6. aviso de permiso o sensibilidad cuando corresponda (costos, margen, caja), sin revelar columnas no autorizadas.

En pantalla el encabezado usa la jerarquía existente de `ReportEmblem`, `Heading`, filtros y acciones. En PDF/Excel el logo no puede deformarse: caja máxima de `120 × 40 px` equivalentes, `object-fit: contain`, fondo transparente y texto alternativo fuera de la imagen.

## 3. Formato de datos

- Moneda dominicana: `RD$ 1,500.00` en ES y EN; signo negativo antes de la moneda: `−RD$ 125.50`; cero: `RD$ 0.00`.
- Porcentajes: máximo dos decimales, espacio antes de `%`; las distribuciones deben mostrar el método de ajuste cuando el redondeo deba sumar `100 %`.
- Enteros: separador de miles del idioma; decimales monetarios siempre con dos posiciones.
- Fechas visibles ES: `20/11/2026`; EN: `11/20/2026`. Fechas ISO permanecen `2026-11-20` cuando son identificadores o datos para intercambio.
- Hora visible: formato de 12 horas con `a. m./p. m.` en ES y `AM/PM` en EN, siempre calculada en `America/Santo_Domingo`.
- Valores ausentes: raya `—`; nunca `undefined`, `null`, `NaN` o códigos internos.
- Los códigos de método/acción deben pasar por los traductores existentes; identificadores internos no sustituyen una referencia legible.
- CSV: UTF-8 con BOM, separador coma, RFC 4180, salto CRLF, cabecera localizada y protección contra fórmulas. No tiene color, tipografía, logo ni tema; la marca se limita a nombres de columnas y metadatos solo si el contrato de datos los permite.

## 4. Pantalla

### 4.1 Viewports y estructura

- Escritorio contractual: `1280 × 900`; móvil contractual: `390 × 844`.
- Probar cada uno en claro/oscuro y ES/EN: ocho combinaciones por reporte.
- A `1280 px`: explorador de `220–260 px` y contenido `minmax(0, 1fr)`, conforme a `premiumWorkspace.css:37`.
- A `390 px`: una columna; grupos verticales plegables; botones y campos de al menos `44 px`; sin desborde horizontal de la página.
- Una tabla ancha puede desplazarse dentro de una región nombrada y enfocada, pero no puede ensanchar `body`. La primera columna debe conservar contexto; encabezado fijo durante el desplazamiento vertical.
- Los filtros muestran el rango realmente aplicado incluso si un campo queda vacío o es normalizado por el servidor.
- Orden de foco: título → grupos → reporte activo → filtros → descargas → guía → tabla → paginación. Foco visible de `3 px`, ya especificado en `premiumWorkspace.css:33`.

### 4.2 Estados obligatorios

Cada pantalla debe tener evidencia independiente para:

- **cargando**: esqueleto o indicador con nombre accesible, sin borrar el título ni los filtros;
- **vacío**: explicación localizada y acción útil para cambiar período/filtros;
- **error**: mensaje localizado, detalle no sensible y botón **Reintentar** que repite la consulta;
- datos: columnas, totales, paginación, permisos y descargas coherentes;
- preparando descarga: botón deshabilitado con texto localizado, sin bloquear la navegación completa.

## 5. Excel

- Hoja `Reporte` con título, negocio, rango, filtros y generación antes de la tabla.
- Congelar filas de metadatos más encabezado y activar autofiltro solo en la fila de columnas.
- Encabezado con fondo `#6d28d9`, texto blanco, negrita; filas alternas `#f5f3ff`; totales con borde superior doble.
- Anchos calculados con mínimo `12` y máximo `45` caracteres; texto largo con ajuste, no truncado silencioso.
- Formatos nativos: moneda `[$RD$-es-DO] #,##0.00;[Red]-[$RD$-es-DO] #,##0.00`, porcentaje `0.00 %`, fecha localizada y hora RD.
- Logo anclado sin tapar celdas. Nombre de archivo sin datos personales y con reporte/rango.
- Validar en Excel real o visor equivalente: captura al `100 %`, filtros, congelación, impresión y ausencia de fórmulas inyectadas.

## 6. PDF

- Página `A4`; orientación vertical hasta seis columnas cortas, horizontal para más columnas o encabezados largos.
- Márgenes mínimos `24 pt`; pie a `18 pt` del borde; encabezado repetido en cada página.
- Tabla con encabezado `#6d28d9`/blanco, filas alternas muy claras, bordes `#d8d3e6`, totales destacados.
- Pie: nombre corto del reporte, rango, `Página X de Y`, generación en hora RD y aviso «Documento no fiscal» cuando aplique.
- No dividir una fila entre páginas; repetir encabezados; no dejar título aislado al final de una página.
- Fuente incrustada o alternativa métrica estable. Verificar glifos `áéíóúñÑ`, `RD$`, `−`, `%` y textos EN.
- Evidencia: captura de primera página y de una página intermedia/final si existe, más conteo de páginas.

## 7. Matriz de verificación y criterio de estado

La matriz está en `REPORTES_DISENO_20NOV.md`.

- `PENDIENTE`: no hay artefacto reproducible de esa combinación; incluye salidas todavía no expuestas.
- `OK`: requiere comando/URL, datos de demostración, captura o archivo, viewport/tema/idioma y SHA del código probado.
- `FALLA`: requiere la misma evidencia y el resultado esperado/observado; se clasifica `pantalla` o `servidor`.
- Una captura de otro reporte, viewport, tema o idioma no sirve por sustitución.
- PDF/Excel/CSV no heredan un `OK` de pantalla. Claro/oscuro no aplica al archivo impreso, pero ES y EN sí deben comprobarse.
- La revisión debe usar únicamente datos de demostración; nunca datos reales de tienda.

## 8. Responsabilidad de corrección

| Hallazgo                                                                               | Responsable técnico en esta orden            |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| distribución, foco, traducción visible, tabla, filtros, estados y desborde de Pantalla | ChatGPT, en una rama de pantalla separada    |
| contenido/columnas/traducción/formato/estilo de PDF o Excel                            | Claude, generadores del servidor             |
| contrato y generación CSV del servidor                                                 | Claude                                       |
| CSV generado en navegador por Informe mensual                                          | ChatGPT, sin cambiar API                     |
| validación final y evidencia de cada salida                                            | ChatGPT después de recibir la implementación |
