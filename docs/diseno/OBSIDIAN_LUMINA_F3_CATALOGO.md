# Obsidian Lumina · fase 3 · Productos (Catálogo)

## Qué cambió y por qué
- Cabecera: `h1` «Productos» (igual a la ruta), subtítulo útil, sin etiqueta en
  mayúsculas (`eyebrow={false}`). Una sola acción primaria, «Nuevo producto»;
  «Plantilla», «Importar Excel» e «Importar inventario» van dentro de «Más».
  Nombres accesibles y manejadores sin cambios.
- «Importar inventario»: `MoreMenu` desmonta sus botones al elegir, y el
  diálogo vivía dentro de `InventoryImportButton`. Se exportó
  `InventoryImportModal` (mismo diálogo) y el estado `importing` vive en
  `Catalog`. `InventoryImportButton` (Onboarding) sigue igual de cara afuera.
- Carga: `TableSkeleton` mientras `query.isLoading`; el resto sigue por `QueryState`.
- Números con `tabular-nums` (variantes, precio, stock, costo, cantidad).
- Insignia de stock bajo: color + texto («· bajo»).
- Pestañas del detalle: `aria-current`, subrayado violeta y negrita.
- Táctil: botones de fila, filtros, cabecera y paginación a 44 px; foco esmeralda.
- Estilos nuevos en `apps/web/src/lumina-catalogo.css` (una importación nueva).

## Archivos
`Management.tsx` (solo `Catalog` + import), `InventoryImport.tsx`,
`lumina-catalogo.css`, e2e: `importar-inventario`, `accesibilidad`,
`product-onboarding` (primero se abre «Más»; aserciones intactas).

## Pruebas (puertos 4181/3181/55181, base desechable)
typecheck, lint, build: OK. Vitest `accessibility-contract`, `catalogo-web`,
`management-messages`: 56/56. e2e `importar-inventario`: 4/4;
`accesibilidad`: 9/9. Comprobación a 390 px: sin desbordamiento horizontal.

## No verificado
- `product-onboarding.spec.ts` (necesita modo multi-negocio): solo se ajustó el
  clic en «Más»; no se ejecutó.
- Contraste medido por axe (spec de accesibilidad), no a mano.

## Riesgos
- «Importar Excel» ya no existe en el DOM hasta abrir «Más».
- La regla `.page-heading:has(+ .catalog-panel)` depende de que el panel siga
  inmediatamente después de la cabecera.
