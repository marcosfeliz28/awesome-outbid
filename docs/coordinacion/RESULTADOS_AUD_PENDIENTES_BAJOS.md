# Resultados · pendientes bajos de Ventas (5-nov-2026)

Rama `claude-pc/aud-pendientes-bajos` (base `nexora-cloud`). No se desplegó, no se mezcló, sin migraciones.

**Pieza 1 (docs):** `docs/auditoria/reportes/HALLAZGOS_TOTAL.jsonl` (37 hallazgos, sin ids repetidos) y `RESUMEN.md`.

**Pieza 2 (solo reportes de Ventas, ninguna cifra cambió):**
- (a) Fila de total en PDF/Excel: `PRESENTACION` en `apps/api/src/reportes/export.ts` para ventas-por-hora, dia-semana, ranking-cajeras, top-clientes, categoria-mes y marca. `unidades-por-factura` ya trae su fila final. En top-clientes el total es de los 20 listados.
- (b) `ticket-promedio`: Período del día sale `11/10/2026` (`ventas.ts`). Prueba de API ajustada (`todayEs`).
- (c) Marca/categoría: columna «Facturas que la incluyen» con aviso de que no suma; esos totales no suman Facturas.
- (d) Comparativos de mes: aviso en pantalla (`Management.tsx`) y en la guía: «Desde» no cambia el resultado. No se alineó el cálculo (cambiaría el significado).

**Pruebas:** nueva en `tests/reportes-export.test.ts` (falló antes, pasa después); `reportes-export` + `reportes-guia`: 133/133. Typecheck y eslint en verde. Las pruebas `-postgres`/API no corren aquí (sin PostgreSQL como root); las cubre el CI.

**seguridad-20, puntos revisados:** sin endpoints ni permisos nuevos; textos fijos (sin entrada del usuario) en la pantalla; totales siguen pasando por `neutralizar` en Excel; sin dependencias nuevas; sin secretos; límite de filas de exportación intacto; sin cambios de base de datos.

**Pendiente:** CI verde de los 3 trabajos en el SHA final (ver aviso).
