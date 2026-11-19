# Informes: pendientes del motor de exportación

Estado de la rama `claude-pc/reportes-export`.

## Hecho

- Exportación PDF y Excel de los 43 reportes del registro (`GET /reports/:name/export`), con la guía de `guia.ts`.
- Gráficas revisadas en PNG (`docs/diseno/informes/muestras/`).
- Reportes de GV (`GET /gv/reports/export`), con la guía `GUIA_GV`.
- Pruebas: unitarias (`tests/reportes-export.test.ts`, `tests/gv-reportes-export.test.ts`) y de API con PostgreSQL (`tests/reportes-export-api.test.ts`: 403 sin profit:read y cifras iguales a la pantalla).

## Pendiente, fuera de esta entrega

- **Informe mensual**: vive en la web (`web/src/FormalReports.tsx`, `web/src/MonthReport.tsx`), no en la API. Para exportarlo hay que llevar sus datos a un endpoint y usar el motor. Lo trabaja una pieza aparte.
- **Informe anual**: mismo caso que el mensual; no lo localicé como endpoint propio.
- **Informe formal** (`apps/api/src/formal-report.ts`): ya tiene su PDF propio en streaming (`renderFormalPdf`). Pasarlo al motor común cambia una exportación que hoy funciona, así que se deja para una pieza aparte con sus pruebas.
- **Ingresos por día** (`apps/api/src/income-report.ts`): tiene CSV, Excel y PDF propios, y `GUIA_INFORMES` ya lo describe. Conectarlo al motor sin romper esas exportaciones requiere pruebas de paridad.
- **Idioma de las pruebas PostgreSQL**: `tests/reportes-export-api.test.ts` solo corre en el CI (necesita la API y la base de datos).

## Por confirmar

- En el registro hay 43 reportes; la documentación habla de 40.
- Formas de pago por mes: la pantalla no aplica el bloqueo de caja abierta fuera de `run`, pero la exportación lo hereda de `openCashGuard`.
