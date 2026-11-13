# COM-08 · Buscar créditos pendientes

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/Tienda.tsx:585-600`: `CodPending` consulta por estado y conserva hasta 500 filas, pero no tiene búsqueda.
- `apps/web/src/Tienda.tsx:602-700`: las pestañas y filas se construyen sobre `rows` sin filtro textual.
- `apps/api/src/sales.ts:4588-4621`: el endpoint de créditos pendientes filtra estado/sucursal, ordena y limita a 500; no recibe búsqueda.
- `apps/web/src/CreditAccounts.tsx:204-214`: existe un patrón de búsqueda por nombre que sirve de referencia visual, no como fuente de datos.

## Cambio mínimo

Añadir un campo `Buscar por cliente, factura o teléfono` en `CodPending` y filtrar localmente las filas ya autorizadas por la API. Normalizar con minúsculas, espacios y acentos; no ampliar el endpoint ni descargar más datos. Mostrar conteo filtrado y «No hay coincidencias» sin confundirlo con «No hay pendientes».

Pseudocódigo: `needle = normalize(search); visible = rows.filter(customerName | saleNumber | phone includes needle)`.

## Regresión nueva

Crear `tests/cod-pending-search.test.tsx`: con tres créditos, buscar nombre con/sin acento, número de factura y teléfono; cambiar de pestaña conserva o limpia la búsqueda según una única regla documentada (recomendado: conservar); limpiar restaura todas las filas; ninguna coincidencia no llama otra API. Falla hoy por no existir el campo y pasa después.

Pruebas existentes que leen `Tienda.tsx`: `tests/claude-round2.test.ts`, `tests/credito-dias.test.ts` y `tests/management-messages.test.ts`. Flujo de navegador relacionado: `tests/e2e/credito.spec.ts:191-217`.

## Casos límite y marcha atrás

- Límite de 500: rotular la búsqueda como «en los resultados cargados» si el total indica más filas; no prometer búsqueda global.
- Campos nulos, guiones y espacios del teléfono; factura numérica o alfanumérica.
- No buscar notas internas ni revelar filas de otra sucursal.
- En móvil el campo no debe empujar acciones fuera de pantalla.
- Marcha atrás: retirar estado/campo/filtro; endpoint y filas originales quedan sin cambios.
