# Especificación visual de reportes — 20-nov-2026

Esta especificación se aplica a las salidas PDF y Excel que implementará
Claude. No altera las cifras, filtros, permisos, orden de filas ni cálculos.
CSV conserva texto plano para interoperabilidad y no se intenta convertirlo en
un documento de marca.

## Identidad y color

| Uso | Token | Valor |
| --- | --- | --- |
| Marca y énfasis | `report-brand` | `#6d28d9` |
| Texto principal | `report-ink` | `#111827` |
| Texto secundario | `report-muted` | `#4b5563` |
| Fondo de encabezado de tabla | `report-surface-subtle` | `#f5f3ff` |
| Bordes | `report-border` | `#d1d5db` |
| Positivo | `report-positive` | `#047857` |
| Advertencia | `report-warning` | `#b45309` |
| Error | `report-negative` | `#b91c1c` |

No se usa color como único indicador de estado: PDF y Excel incluyen una
etiqueta textual. Los valores monetarios conservan contraste suficiente sobre
blanco y se alinean a la derecha.

## Tipografía y jerarquía

- Fuente: `Plus Jakarta Sans`, con `Arial` como alternativa para exportación.
- Título de reporte: 18 pt (PDF) / 16 pt en la primera fila destacada (Excel),
  semibold, `report-ink`.
- Nombre del negocio: 10 pt, semibold; logo a la izquierda si está disponible.
- Metadatos (rango, zona horaria y fecha de emisión): 9 pt, `report-muted`.
- Cabecera de tabla: 9 pt semibold, fondo `report-surface-subtle` y borde
  inferior `report-brand` de 1.5 pt.
- Cuerpo: 9 pt; importes con cifras tabulares, dos decimales y prefijo `RD$`.

## Encabezado común

Cada PDF y libro Excel inicia con: logo, nombre del negocio, nombre del
reporte, rango realmente aplicado, zona horaria `America/Santo_Domingo` y la
fecha/hora de exportación. Si no existe logo, se mantiene el espacio y aparece
el nombre del negocio: no se inventa una imagen.

## Formatos

- Moneda: `RD$ 1,500.00`; negativos como `-RD$ 1,500.00`.
- Porcentaje: `15.0 %`; no transformar un porcentaje a moneda.
- Fecha: `dd/MM/yyyy`; fecha y hora: `dd/MM/yyyy HH:mm` en hora RD.
- Excel: congelar encabezado, aplicar autofiltro y ajustar columnas sin cortar
  el título ni la moneda. Las cifras deben conservar tipo numérico, no texto.
- PDF: A4 vertical; usar A4 horizontal si las columnas no caben sin recorte.
  Repetir encabezado de tabla en cada página, conservar el rango y pie con
  número de página.
- CSV: UTF-8, encabezados localizados ES/EN, cifras y fechas sin estilos;
  conservar los mismos datos que la pantalla y las otras salidas.

## Estados de pantalla que se deben comprobar

En claro y oscuro, a 390 px y 1280 px, y en ES/EN: título, rango aplicado,
encabezado fijo, columnas, moneda, carga, vacío, error y botón «Reintentar».
No se marca una salida como aprobada hasta tener captura o archivo generado
contra una base de prueba.
