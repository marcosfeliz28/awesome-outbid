# Auditoría Punto 1 — trabajo del 1-nov

**Resumen para la dueña:** se revisó el cambio completo de reportes/GV de la rama `nexora-cloud` en `6acf624b`, sin tocar producción. Hay **un hallazgo medio**: el límite de 20,000 filas de exportación se comprueba después de leer todo el informe, por lo que no protege memoria/CPU en informes grandes. Las 60 migraciones aplicaron en PostgreSQL descartable y 161 pruebas focales pasaron; la repetición completa de integración queda no comprobada en esta sesión.

## Alcance y método

- Base auditada: `c227d6b0..6acf624b` (cambios desde 1-nov, sin merges).
- Mapa consultado: `docs/sistema/mapa/INSTRUCTIVO_SESIONES.md`; consulta Graphify de reportes, exportación, devoluciones y GV.
- PostgreSQL aislado: migración desde cero de las **60** migraciones en `127.0.0.1:55434`, seguido de `pnpm db:seed` (60 productos, 228 variantes, 4 usuarios, 3 proveedores y 847 ventas de prueba). No se usó una base, cuenta ni dato real.
- Pruebas focales: `tests/reportes-export.test.ts`, `tests/gv-reportes-export.test.ts`, `tests/reportes-guia.test.ts`, `tests/gv-incentivos-unit.test.ts` y `tests/reportes-export-ui.test.ts`: **5 archivos / 161 pruebas aprobadas**.
- Seguridad: búsqueda en el diff de secretos, XSS (`dangerouslySetInnerHTML`/`innerHTML`) y `pnpm audit --prod --audit-level=high`: sin salida/hallazgo. No equivale a una auditoría del historial completo.

## Hallazgos

| ID | Severidad | Evidencia y reproducción | Parche propuesto |
|---|---|---|---|
| AZ-01 | Media | `apps/api/src/reports.ts:767-770` ejecuta `def.run(...)` y materializa `rows` antes de `comprobarLimite(rows.length)`. Un usuario con `reports:read` puede pedir un período que produzca más de 20,000 filas: el servidor hace la consulta, construye el arreglo y solo después responde con el límite. El contrato de `apps/api/src/reportes/export.ts:161` promete el límite, pero no evita el consumo previo de memoria/CPU. | Agregar límite/cursores SQL por definición de informe y una prueba con 20,001 filas que demuestre que la consulta no devuelve ni construye más de 20,001 filas. Mantener una respuesta 400 clara si excede el máximo. |

No se identificó un hallazgo Alto que pueda demostrarse por dos métodos independientes. Todo hallazgo no reproducido se marca como no comprobado abajo.

## Lista A–Z

| Punto | Veredicto | Evidencia |
|---|---|---|
| A. PDF/Excel | HALLAZGO Medio AZ-01 | Ruta protegida con `@Permit("reports:read")` y comprobación de permiso de margen: `apps/api/src/reports.ts:750-789`; sanitización de fórmulas y filtrado de columnas: `apps/api/src/reportes/export.ts:161-220`. |
| B. Guía | OK | Ruta protegida y valida reporte exportable: `reports.ts:822-829`; cobertura focal aprobada. |
| C. Gráficas/tildes PDF | NO COMPROBADO | Se revisó el generador local `export-pdf.ts`; no se inspeccionaron visualmente todas las muestras en Windows/impresora. |
| D. GV export | OK | `apps/api/src/reportes/gv-export.ts`; prueba focal aprobada. |
| E. Pantalla | OK | Prueba de interfaz de exportación aprobada; la ruta usa el nombre validado en servidor. No se observó `innerHTML` en el diff. |
| F. Devoluciones opción A | OK | Año atribuye devoluciones a la fecha de la venta: `reports.ts:566-609`; desglose documenta costo de merma: `reports.ts:625-683`. Casos de medianoche completos: NO COMPROBADO en integración. |
| G. Costo de merma | OK | Costo incorpora `wasteCost`: `reports.ts:625-629`; pruebas focales de exportación pasan. |
| H. Incentivo GV | OK | Prueba focal de incentivos aprobada; revisión de `gv-incentives.ts` no mostró un segundo reparto no determinista. |
| I. Pago GV anulado | OK | La lógica de estados cerrados está centralizada en `apps/api/src/gv-money.ts:22`; cobertura unitaria focal aprobada. |
| J. RD$/US$ GV | NO COMPROBADO | Migración limpia aplica correctamente; no se ejecutó un flujo HTTP completo de reembolso y pago con tasa. |
| K. Catálogo de cursos | OK | Comentario/contrato de opciones sin incentivo ni costo: `gv-money.ts:110`; cubierto por prueba unitaria focal. |
| L. CI opción A | NO COMPROBADO | El diff de `reports.ts` corrige la atribución, pero la ejecución completa de integración no terminó en esta sesión. |
| M. Margen | OK | `dashboard/year` calcula margen desde venta y costo, sin restar ITBIS: `reports.ts:590-608`. No se observó un bloqueo de venta por 15 % en el diff. |
| N. Seguridad-20 | OK parcial | Se revisaron controles 1, 3, 5, 6, 7, 9, 13, 16 y 18 aplicables al diff. Despliegue/CORS/HSTS no se probaron contra producción por alcance. |
| O. Pruebas | NO COMPROBADO | 161 focales pasan. El conjunto integración tiene lista explícita en `vitest.integration.config.ts`, pero no se completó la corrida total ni Playwright. |
| P. Sin internet | OK parcial | PDF/Excel se generan en módulos locales y las pruebas focales pasan. Instalación real sin red es una prueba separada pendiente. |
| Q. Rendimiento | HALLAZGO Medio AZ-01 | El límite no es preventivo; no se midieron 20,000 filas contra una base de volumen. |
| R. Documentación | OK parcial | `docs/sistema/CAMBIOS.md` y citas cambiaron en el diff; no se validaron visualmente los 551 documentos. |
| S. Migraciones | OK parcial | 60 migraciones aplicaron desde cero en PostgreSQL aislado. Upgrade desde una copia histórica real: NO COMPROBADO. |
| T. Español | OK | Guía revisada y pruebas focales aprobadas; hay textos «Por confirmar» que son explícitos y no inventan datos. |
| U. Coherencia de versiones | NO COMPROBADO | No se instaló ni navegó la aplicación PC/tienda en vivo, por alcance. |
| V. Accesibilidad | OK parcial | Prueba UI de exportación aprobada. Recorrido con lector de pantalla y 390 px: NO COMPROBADO. |
| W. Órdenes/colas | OK | La orden de auditoría identifica propietaria, rama y archivo únicos. La auditoría encontró que el plan está en `claude-pc/instalador-sin-internet`, aún no integrado en `nexora-cloud`; está anotado, no contradice esta revisión. |
| X. Mapa | OK parcial | Graphify generó consulta sin secretos de código; el reporte del grafo contiene nombres de variables, no valores. No se reextrajeron los 551 documentos. |
| Y. Secretos | OK parcial | Búsqueda del diff y de patrones de claves no devolvió valores. No se inspeccionó todo el historial remoto. |
| Z. Despliegue | NO COMPROBADO | No se desplegó. Recomendación: API primero, verificar migraciones/exportador y después web; reversa a la imagen previa si falla salud o exportación. |

## Límites de verificación

La corrida integrada `node scripts/verify.mjs` inicialmente quedó bloqueada por un entorno local sin `JWT_SECRET`, una base local sin migrar y una semilla sin `SEED_DEMO_PASSWORD`; se corrigieron **solo en variables y base desechables**. No se declara una corrida completa verde porque esta sesión no pudo mantener el proceso largo de API/Playwright. No se probó Render, producción, cuentas reales, correos, Telegram, Drive, licencia, firma de código, impresora ni el instalador real.
