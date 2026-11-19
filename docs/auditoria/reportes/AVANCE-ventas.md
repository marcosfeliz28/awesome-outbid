# Avance auditoría · Ventas (A1) · 2-nov-2026
- Reportes revisados: 10 de 10 (pantalla y guía). PDF y Excel: revisados (abren bien, cifras iguales a pantalla).
- Cifras: **todas correctas** (RD$ 1,465,804.50 / 356 facturas, cuadra con /sales y dashboard).
- Hallazgos: 0 Alto · 4 Medio (3 corregidos, 1 abierto: 65 % «Sin marca») · 4 Bajo (abiertos, el nuevo: sin fila de total en PDF/Excel).
- Código: `apps/api/src/reportes/guia.ts` + prueba en `tests/reportes-guia.test.ts`. Detalle: `HALLAZGOS-ventas.jsonl` y `ventas/*.md`.
