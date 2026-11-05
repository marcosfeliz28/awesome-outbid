# Avance · ChatGPT nube · contra-auditoría de reportes

Fecha: 2-nov-2026. Rama: `chatgpt-nube/contra-auditoria`.

Actualización 3-nov-2026: MarkItDown 0.1.9 quedó instalado conforme a la
orden 114. Se verificó en un XLSX temporal de prueba creado localmente: produjo
una tabla Markdown legible. No se procesaron exportaciones reales ni datos de
la tienda.

## Preparación y evidencia inicial

- Se usó exclusivamente PostgreSQL embebido temporal y una API local; no se usó Render, producción, datos reales ni credenciales.
- `graphify query "¿dónde se calcula el margen y cómo se exportan reportes PDF y Excel?" --budget 800` funcionó y localizó `apps/api/src/reportes/margen.ts`, `apps/api/src/reports.ts`, `apps/api/src/reportes/export.ts` y sus pruebas.
- `pnpm exec vitest run tests/reportes-export.test.ts tests/gv-reportes-export.test.ts`: **13/13 pasan** antes del ensayo de estrés.
- La prueba API real, con migraciones y seed en una base descartable, ejecutó 4/5 casos de exportación correctamente. Falla el quinto en `tests/reportes-export-api.test.ts:219`: `expected undefined to be close to +0, received difference is NaN, but expected 0.005`. El Excel de `creditos-por-antiguedad` no trae el total buscado cuando el seed no deja créditos abiertos en el rango. Es una prueba/fixture no determinista; todavía no hay evidencia de una cifra de negocio equivocada.

## Hallazgos prioritarios en curso

- `S-16` tiene respaldo directo en código: `apps/api/src/reportes/dinero.ts:16-17` filtra devoluciones por `r.createdAt`, y sus agregados las agrupan por esa fecha (`176-188`, `224-229`, `244-249`, `325-335`). Esto no aplica la opción A (fecha de la venta original) aprobada para los agregados comparables. Falta la reproducción aislada por cada reporte antes de clasificarlo definitivamente.
- `S-01`/`margen-01` requiere separar dos conceptos: el dashboard expone ganancia sin ITBIS (`apps/api/src/reports.ts:522-536`) y el margen sobre venta cobrada; otros reportes calculan utilidad por línea sin ITBIS pero margen sobre venta bruta (`1414-1417`). Hay inconsistencia semántica que requiere la decisión de la dueña sobre el rótulo/medida; no se cambiará dinero sin ella.

## Estrés de exportación y permisos

- Se añadió una regresión al test ya incluido por CI: construye **20.000 filas** (el límite público), produce PDF y XLSX, vuelve a abrir el XLSX con ExcelJS y confirma 20.001 filas (encabezado más detalle). `pnpm exec vitest run tests/reportes-export.test.ts` pasó **11/11**; el caso de 20.000 tomó **6,355 ms** en esta nube. El PDF tiene cabecera `%PDF` y el XLSX `PK`; no se obtuvo una medición fiable de memoria porque el entorno no ofrece `time -v`.
- Los endpoints de listado, guía y exportación requieren `reports:read` (`apps/api/src/reports.ts:760,819,833,842`). Los informes con costo/margen se bloquean sin `profit:read` antes de exportar (`777`, `207-208`). La prueba aislada API comprobó 200 en informe sin costo y 403 en margen e inventario sin `profit:read` (salvo el fallo de fixture anotado arriba).
- El conjunto local de exportación quedó en **16/16**: `reportes-export`, `gv-reportes-export`, `reportes-export-ui` y `reports-memory-postgres`. El último usa PostgreSQL embebido y comprueba que los informes y sus exportaciones no materializan el período completo ni comprobantes base64.

## Pendiente

1. La clasificación Alto/Medio quedó documentada en `CONTRA_AUDITORIA_CHATGPT_NUBE.md`; quedan las decisiones de dinero y la QA visual.
2. Ejecutar QA Playwright de 43 reportes y permisos (la revisión de código y API ya está iniciada).
3. Medir memoria en un entorno que exponga ese contador; generación y apertura de 20.000 filas ya comprobadas.

