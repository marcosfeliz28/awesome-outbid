# Acciones de revisión (T35)

Revisión de los hallazgos de `docs/auditoria/PROHIBIDOS_EN_BORRADORES.md` (23) y `docs/auditoria/TILDES_NUEVAS.md` (41). Solo se cuentan los archivos que existen en `origin/nexora-cloud` (todos los de prohibidos sí existen allí). Nada se aplica aquí: cada acción queda para revisión.

## 1. Términos prohibidos (23)

| archivo:línea | texto actual | texto propuesto | acción |
|---|---|---|---|
| `docs/venta/LANDING_EN_PLANES.md:1` | Borrador sin verificar, hecho por modelo local (sin publicar: solo con la orden escrita de la dueña). Fuente: … | (sin cambio: nota de fuente) | ninguna |
| `docs/venta/LANDING_EN_PLANES.md:33` | 5. **[RETIRADO]** Facturación DGII: fuera de la versión 1; pendiente de revisión legal (tarea 69). | (sin cambio: marca «[RETIRADO]») | ninguna |
| `docs/venta/LANDING_EN_PLANES.md:42` | / Facturación NCF (DGII) / [RETIRADO: pendiente, tarea 69] / No / No (otro país) / | (sin cambio: marca «[RETIRADO]») | ninguna |
| `docs/venta/LANDING_TEXTOS.md:6` | > **Revisión de Nexora 1 (28-oct):** antes de publicar, quitar toda mención a **e-CF** (está en pausa y no se … | (sin cambio: es la nota que pide quitar las menciones) | ninguna |
| `docs/venta/LANDING_TEXTOS.md:12` | Nexora POS reúne la caja, el inventario, los clientes y las facturas en un solo | Norexos reúne la caja, el inventario, los clientes y los comprobantes en un solo | cambiar nombre y quitar «facturas» |
| `docs/venta/LANDING_TEXTOS.md:18` | e-CF) pensados para la tienda dominicana. Empieza hoy; sin instalar nada. | Punto de venta, cierre de caja ciego, inventario y créditos pensados para la tienda dominicana. | quitar «facturación (NCF/e-CF)» |
| `docs/venta/LANDING_TEXTOS.md:32` | 5. **Facturación conforme a la DGII.** Emite tus comprobantes (NCF B01/B02/B14/ | 5. **Comprobantes NCF.** Emite comprobantes con las secuencias NCF que tú declaras; la numeración la controla tu contador. | quitar «Facturación conforme a la DGII» y e-CF |
| `docs/venta/LANDING_TEXTOS.md:33` | B15 y e-CF) y reportes 606/607/608. *(verificar con contador).* | (línea siguiente del mismo punto 5: quitar «B15 y e-CF» y «reportes 606/607/608»; dejar «*(verificar con contador).*») | quitar e-CF y reportes 606/607/608 |
| `docs/venta/LANDING_TEXTOS.md:39` | / / Nexora POS / POS globales (Square/Lightspeed) / Solo facturación (Facturama/Quipu) / | / / Norexos / POS globales (Square/Lightspeed) / Solo facturación (Facturama/Quipu) / | cambiar nombre |
| `docs/venta/LANDING_TEXTOS.md:42` | / Facturación NCF/e-CF (DGII) / Sí / No / No (otro país) / | / Comprobantes NCF (secuencias declaradas) / Sí / No / No (otro país) / | quitar «NCF/e-CF (DGII)» |
| `docs/venta/LANDING_TEXTOS.md:57` | 4. **¿Emite facturas con NCF?** Sí, los comprobantes de la DGII. *(verificar con | 4. **¿Emite comprobantes NCF?** Sí, con las secuencias que tú declaras. *(verificar con | quitar «de la DGII» |
| `docs/venta/META_DESCRIPCIONES.md:3` | Hechas a mano a partir de `docs/venta/LANDING_TEXTOS.md`. Largo medido con Python (`len`, caracteres Unicode).… | (sin cambio: es la regla, no una promesa) | ninguna |
| `docs/venta/META_DESCRIPCIONES.md:11` | **Aviso para quien edite la portada:** `docs/venta/LANDING_TEXTOS.md` todavía dice «Nexora POS», menciona e-CF… | (revisar: el aviso queda obsoleto cuando se mezcle la landing corregida; entonces quitarlo) | esperar a la mezcla |
| `docs/diseno/borradores-local/consistencia-marca.md:4` | - **línea 14:** Nexora POS reúne la caja, el inventario, los clientes y las facturas en un solo lugar, para qu… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/consistencia-marca.md:5` | - **línea 21:** Punto de venta, cierre de caja ciego, inventario, créditos y facturación (NCF/e-CF) pensados p… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/consistencia-marca.md:6` | - **línea 31:** Facturación conforme a la DGII. Emite tus comprobantes (NCF B01/B02/B14/B15 y e-CF) y reportes… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/consistencia-marca.md:8` | - **línea 53:** ¿Emite facturas con NCF? Sí, los comprobantes de la DGII. *(verificar con contador).* [REVISAR… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/consistencia-marca.md:13` | - **línea 31:** Facturación DGII: fuera de la versión 1; pendiente de revisión legal (tarea 69). [REVISAR] | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/consistencia-marca.md:18` | Listé todas las apariciones de 'Nexora', 'Norexos' y 'DGII'/'NCF' en los archivos proporcionados, marcando con… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/titulares-cortos.md:1` | **Borrador sin verificar** (modelo local, cola N17, orden 76). Límite <50 caracteres medido por script (`print… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/titulares-portada.md:1` | **Borrador sin verificar** (modelo local qwen-optimizado, cola N9–N16, orden 73). Fuente: `origin/nexora-cloud… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/titulares-portada.md:3` | Borrador sin verificar, hecho por modelo local. Español de República Dominicana, claro y corto. No inventes fu… | (sin cambio: registro de revisión o nota de fuente del borrador) | ninguna |
| `docs/diseno/borradores-local/titulares-portada.md:10` | / Simplifica tu negocio con Nexora POS. / 33 / | / Simplifica tu negocio con Norexos. / 33 / | cambiar nombre |

## 2. Tildes rotas (41)

Revisadas las 41 líneas: **ninguna es tilde rota**. Todas son consultas de URL (`?status=`, `?from=`, `?limit=`), rutas, strings de SQL o parámetros de código. Sin acción; el patrón del script marca cualquier «?» entre dos letras y esto es lo esperado en URLs. Se propone afinar el script para ignorar URLs (fuera de esta tarea).

| archivo:línea | texto actual | texto propuesto | acción |
|---|---|---|---|
| `docs/DECISIONES.md:50` | - **Pantalla «Créditos pendientes»** (Caja, sólo administración; `GET /cod/pending?state=pending/clo… | (sin cambio: URL o código) | ninguna |
| `docs/INCENTIVOS.md:56` | - Endpoints: `GET /incentives?month=AAAA-MM` (`sale:manage`), `GET /incentives/me` (`sale:write`, só… | (sin cambio: URL o código) | ninguna |
| `docs/INSTRUCCIONES_ARQUITECTURA.md:373` | POST /products/import  GET /products/search?q=&barcode= | (sin cambio: URL o código) | ninguna |
| `docs/PRUEBA_RESTAURACION.md:58` | export DATABASE_URL='postgresql://nexora@127.0.0.1:5733/nx_a?options=-c%20TimeZone%3DUTC' | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/INSTRUCTIVO_ENVIO_MENSAJERO.md:28` | - `GET /courier/pending?from&to`: ventas con `courierFee > 0` y `courierPaidAt` nulo, con factura, c… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/MEMORIA_NEXORA_1_27OCT.md:42` | `docs/coordinacion/claude-nube/entrar.py` (lee NEXORA_CLAUDE_USER/NEXORA_CLAUDE_PASSWORD del entorno… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/MODULO-GV.md:81` | - `GET /api/gv/transfers/pending`, `GET /api/gv/reports?from=AAAA-MM-DD&to=AAAA-MM-DD` (ingresos ver… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md:31` | / 4 / `detalle_factura(numero o cliente)` / `GET sales?q&date` / `sale:write` / | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/RESULTADOS_CHATGPT.md:51` | / FIN-01 · Alta / `apps/api/src/reports.ts:1536-1554,1626-1652`; rechazo en `apps/api/src/sales.ts:2… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:45` | / Productos (con variantes, existencia, precio, costo) / `GET /products?limit=200&page=N` → `items` | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:47` | / Historial de una variante                            / `GET /inventory/movements?variantId=…&limit… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:53` | / Ventas del día                                       / `GET /sales?date=AAAA-MM-DD&limit=200` | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:55` | / Cajas                                                / `GET /cash-sessions?limit=40`, `GET /cash-s… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:58` | / Bitácora                                             / `GET /audit-log?limit=300` | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/01-dinero.md:39` | / D-09 / BAJO / (sigue abierto) El cierre ciego revela si el conteo es exacto, y `GET /sales?date=` … | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/01-dinero.md:349` | **Escenario:** `GET /dashboard/summary?from=2026-10-09&to=2026-10-09` daba 20,250. Se anula FS-00008… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/01-dinero.md:374` | - **D-09 [VERIFICADO]:** `cash.ts:105-118` sigue igual. Cerrar con 499 sin nota da `400 «agrega una … | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/04-infraestructura.md:240` | - Logs de la web del 2026-10-08 02:27:50: 4 peticiones simultáneas a `GET /api/alerts?status=new` te… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/06-datos-concurrencia-v2.md:164` | export DATABASE_URL="postgresql://postgres@127.0.0.1:55616/aud?options=-c%20TimeZone%3DUTC" SEED_DEM… | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/auditoria-2026-10-10/06-datos-concurrencia.md:344` | export DATABASE_URL="postgresql://postgres@127.0.0.1:55606/aud?options=-c%20TimeZone%3DUTC" | (sin cambio: URL o código) | ninguna |
| `docs/coordinacion/claude-nube/LEEME_CLAUDE_NUBE.md:8` | 4. Verifica con un dato real (p. ej. `GET /sales?limit=50`, `GET /products?limit=200&page=1`). | (sin cambio: URL o código) | ninguna |
| `docs/diseno/MAPA_PANTALLAS.md:8` | / `/void-requests?status=pending` / apps/web/src/QuickQuestions.tsx:458 / | (sin cambio: URL o código) | ninguna |
| `docs/operacion/MEMORIA_NEXORA1.md:7` | - Solo Claude (nube, «Nexora 1») despliega en Render, con los 3 CI en verde (`verify`, `windows-inst… | (sin cambio: URL o código) | ninguna |
| `apps/web/src/App.tsx:627` | queryFn: () => api<any[]>("/alerts?status=new"), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/CreditAccounts.tsx:55` | `/credit-accounts?search=${encodeURIComponent(search)}&sort=${sort}&page=${page}&view=${view}`, | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Dashboard.tsx:52` | queryFn: () => api("/dashboard/summary?from=" + date + "&to=" + date), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Dashboard.tsx:124` | queryFn: () => api("/dashboard/summary?from=" + from + "&to=" + to), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Dashboard.tsx:131` | queryFn: () => api("/void-requests?status=pending"), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Dashboard.tsx:206` | "/reports/sales?format=xlsx&from=" + from + "&to=" + to, | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Incentives.tsx:296` | queryFn: () => api<Report>("/incentives?month=" + month), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Incentives.tsx:345` | "/incentives/export.xlsx?month=" + month, | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Incentives.tsx:419` | `/incentives/receipt.pdf?month=${month}&userId=${r.userId}`, | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Management.tsx:763` | queryFn: () => api("/inventory/movements?variantId=" + variantId), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Management.tsx:3017` | queryFn: () => api("/alerts?status=" + status), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/MonthReport.tsx:36` | queryFn: () => api<any>("/dashboard/breakdown?from=" + from + "&to=" + to), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/QuickQuestions.tsx:458` | path="/void-requests?status=pending" | (sin cambio: URL o código) | ninguna |
| `apps/web/src/Tienda.tsx:592` | queryFn: () => api<any[]>("/cod/pending?state=" + state), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/VoidRequests.tsx:26` | queryFn: () => api("/void-requests?status=" + status), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/YearPie.tsx:41` | queryFn: () => api<any>("/dashboard/year?year=" + year), | (sin cambio: URL o código) | ninguna |
| `apps/web/src/YearPie.tsx:52` | go(`month-report?from=${range.from}&to=${range.to}`); | (sin cambio: URL o código) | ninguna |
| `apps/web/src/api.ts:414` | "/products?limit=" + limit + "&page=" + page, | (sin cambio: URL o código) | ninguna |
