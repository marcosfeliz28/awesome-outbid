# Auditoría de accesibilidad (D18)

Alcance: `apps/web/src`. Solo se listan hallazgos; no se edita nada.
Fecha: 2026-10-27.

## Resumen

El código base es consciente de accesibilidad: hay anillos de foco visibles
propios, `alt` correcto en imágenes, `aria-label` en botones de icono y sin
manejadores de clic sobre elementos no interactivos. Queda un punto de mejora
(regiones de tabla sin `role`/`aria-label`) y un par de notas a verificar.

## Hallazgos

### 1. Contenedores de tabla enfocables sin `role` ni `aria-label`
`<div className="table-wrap" tabIndex={0}>` se hace enfocable para permitir
desplazamiento con teclado (buena práctica), pero al no tener `role` ni
`aria-label`, el lector de pantalla lo anuncia como elemento genérico.

- `apps/web/src/Dashboard.tsx:522`
- `apps/web/src/Management.tsx:130`
- `apps/web/src/WarehousesPanel.tsx:83`, `:235`, `:273`
- `apps/web/src/Gv.tsx:380`, `:872`, `:937`, `:970`
- `apps/web/src/IncomeByDay.tsx:200`, `:272`
- `apps/web/src/FormalReports.tsx:118`
- `apps/web/src/POS.tsx:1056`

Propuesta: añadir `role="region"` y un `aria-label` descriptivo (p. ej.
`aria-label="Tabla de productos, desplazable"`), o envolver con un título
asociado por `aria-labelledby`.

### 2. Foco del buscador de productos depende del contenedor
`apps/web/src/styles.css:4256` quita `outline` y `box-shadow` al `input` de
`.goods-search-input`; el indicador de foco lo da el contenedor con
`.goods-search-input:focus-within` (`styles.css:4261`, borde + sombra). Es
aceptable si el anillo del contenedor tiene contraste AA frente al fondo;
**verificar** que ese anillo sea lo bastante visible en tema claro y oscuro.

## Resultados positivos (verificados, sin incidencia)

- **Foco visible**: `styles.css:208-236` define `input/select/textarea:focus` y
  `:focus-visible` para `button` y `a`; los tres `outline: none` del CSS
  (líneas 198, 3044, 4256) están acompañados de un indicador de foco visible
  (borde/sombra), no de la eliminación del foco.
- **Imágenes**: con `alt` descriptivo (`Management.tsx:541` `alt={detail.name}`,
  `Tienda.tsx:835` `alt="Evidencia del pago"`) o `alt=""` decorativo con el
  nombre en texto adyacente (`POS.tsx:1072`, `Management.tsx:384`).
- **Botones de icono con nombre accesible**: `helpers.tsx:121`
  `aria-label="Cerrar aviso"`, `POS.tsx:1114` `aria-label="Descuento de …"`;
  los botones con icono + texto incluyen el texto visible (`Dashboard.tsx`
  «Exportar», «Nueva venta»).
- **Sin clic sobre elementos no interactivos**: 0 coincidencias de
  `onClick` sobre `div`/`span`/`li`/`p`/encabezados.

## Pendiente de medición (no evaluado aquí)

- **Contraste AA** de `--text`, `--muted` y `--primary-soft` frente a `--surface`
  y `--background` en tema claro y oscuro. Requiere medir los tokens en
  `styles.css` (o los de F2-01) con una herramienta de contraste; se recomienda
  hacerlo al cerrar D47–D50.
