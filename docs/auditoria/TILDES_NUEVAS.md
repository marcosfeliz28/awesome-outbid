# Tildes rotas (solo informe)

Borrador verificado por script.

| archivo:línea | tipo | texto |
|---|---|---|
| apps/web/src/App.tsx:627 | ? en palabra | queryFn: () => api<any[]>("/alerts?status=new"), |
| apps/web/src/CreditAccounts.tsx:55 | ? en palabra | `/credit-accounts?search=${encodeURIComponent(search)}&sort=${sort}&page=${page}&view=${view}`, |
| apps/web/src/Dashboard.tsx:52 | ? en palabra | queryFn: () => api("/dashboard/summary?from=" + date + "&to=" + date), |
| apps/web/src/Dashboard.tsx:124 | ? en palabra | queryFn: () => api("/dashboard/summary?from=" + from + "&to=" + to), |
| apps/web/src/Dashboard.tsx:131 | ? en palabra | queryFn: () => api("/void-requests?status=pending"), |
| apps/web/src/Dashboard.tsx:206 | ? en palabra | "/reports/sales?format=xlsx&from=" + from + "&to=" + to, |
| apps/web/src/Incentives.tsx:296 | ? en palabra | queryFn: () => api<Report>("/incentives?month=" + month), |
| apps/web/src/Incentives.tsx:345 | ? en palabra | "/incentives/export.xlsx?month=" + month, |
| apps/web/src/Incentives.tsx:419 | ? en palabra | `/incentives/receipt.pdf?month=${month}&userId=${r.userId}`, |
| apps/web/src/Management.tsx:763 | ? en palabra | queryFn: () => api("/inventory/movements?variantId=" + variantId), |
| apps/web/src/Management.tsx:3017 | ? en palabra | queryFn: () => api("/alerts?status=" + status), |
| apps/web/src/MonthReport.tsx:36 | ? en palabra | queryFn: () => api<any>("/dashboard/breakdown?from=" + from + "&to=" + to), |
| apps/web/src/QuickQuestions.tsx:458 | ? en palabra | path="/void-requests?status=pending" |
| apps/web/src/Tienda.tsx:592 | ? en palabra | queryFn: () => api<any[]>("/cod/pending?state=" + state), |
| apps/web/src/VoidRequests.tsx:26 | ? en palabra | queryFn: () => api("/void-requests?status=" + status), |
| apps/web/src/YearPie.tsx:41 | ? en palabra | queryFn: () => api<any>("/dashboard/year?year=" + year), |
| apps/web/src/YearPie.tsx:52 | ? en palabra | go(`month-report?from=${range.from}&to=${range.to}`); |
| apps/web/src/api.ts:414 | ? en palabra | "/products?limit=" + limit + "&page=" + page, |
| docs/DECISIONES.md:50 | ? en palabra | - **Pantalla «Créditos pendientes»** (Caja, sólo administración; `GET /cod/pending?state=pending/closed/all`): |
| docs/INCENTIVOS.md:56 | ? en palabra | - Endpoints: `GET /incentives?month=AAAA-MM` (`sale:manage`), `GET /incentives/me` (`sale:write`, sólo lo prop |
| docs/INSTRUCCIONES_ARQUITECTURA.md:373 | ? en palabra | POST /products/import  GET /products/search?q=&barcode= |
| docs/PRUEBA_RESTAURACION.md:58 | ? en palabra | export DATABASE_URL='postgresql://nexora@127.0.0.1:5733/nx_a?options=-c%20TimeZone%3DUTC' |
| docs/coordinacion/COLA_LOTE_LOCAL.md:175 | mojibake | / 91 / Texto con tildes rotas (mojibake «Ã», «â€») en el repo / `docs/auditoria/TILDES_ROTAS_CONTEO.md` / arch |
| docs/coordinacion/INSTRUCTIVO_ENVIO_MENSAJERO.md:28 | ? en palabra | - `GET /courier/pending?from&to`: ventas con `courierFee > 0` y `courierPaidAt` nulo, con factura, cliente, fe |
| docs/coordinacion/MEMORIA_NEXORA_1_27OCT.md:42 | ? en palabra | `docs/coordinacion/claude-nube/entrar.py` (lee NEXORA_CLAUDE_USER/NEXORA_CLAUDE_PASSWORD del entorno o su arch |
| docs/coordinacion/MODULO-GV.md:81 | ? en palabra | - `GET /api/gv/transfers/pending`, `GET /api/gv/reports?from=AAAA-MM-DD&to=AAAA-MM-DD` (ingresos verificados,  |
| docs/coordinacion/ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md:31 | ? en palabra | / 4 / `detalle_factura(numero o cliente)` / `GET sales?q&date` / `sale:write` / |
| docs/coordinacion/RESULTADOS_CHATGPT.md:51 | ? en palabra | / FIN-01 · Alta / `apps/api/src/reports.ts:1536-1554,1626-1652`; rechazo en `apps/api/src/sales.ts:2373-2419`  |
| docs/coordinacion/TEXTO_DEEPSEEK_28OCT.md:47 | mojibake | - **D24** `scripts/check-i18n-tildes.mjs`: revisa que los textos visibles no tengan caracteres rotos (Ã, â€) n |
| docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:45 | ? en palabra | / Productos (con variantes, existencia, precio, costo) / `GET /products?limit=200&page=N` → `items`            |
| docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:47 | ? en palabra | / Historial de una variante                            / `GET /inventory/movements?variantId=…&limit=50`       |
| docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:53 | ? en palabra | / Ventas del día                                       / `GET /sales?date=AAAA-MM-DD&limit=200`                |
| docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:55 | ? en palabra | / Cajas                                                / `GET /cash-sessions?limit=40`, `GET /cash-sessions/:i |
| docs/coordinacion/TRASPASO_CHATGPT_NUBE.md:58 | ? en palabra | / Bitácora                                             / `GET /audit-log?limit=300`                            |
| docs/coordinacion/auditoria-2026-10-10/01-dinero.md:39 | ? en palabra | / D-09 / BAJO / (sigue abierto) El cierre ciego revela si el conteo es exacto, y `GET /sales?date=` permite re |
| docs/coordinacion/auditoria-2026-10-10/01-dinero.md:349 | ? en palabra | **Escenario:** `GET /dashboard/summary?from=2026-10-09&to=2026-10-09` daba 20,250. Se anula FS-0000857 (venta  |
| docs/coordinacion/auditoria-2026-10-10/01-dinero.md:374 | ? en palabra | - **D-09 [VERIFICADO]:** `cash.ts:105-118` sigue igual. Cerrar con 499 sin nota da `400 «agrega una nota»`; co |
| docs/coordinacion/auditoria-2026-10-10/04-infraestructura.md:240 | ? en palabra | - Logs de la web del 2026-10-08 02:27:50: 4 peticiones simultáneas a `GET /api/alerts?status=new` terminaron e |
| docs/coordinacion/auditoria-2026-10-10/06-datos-concurrencia-v2.md:164 | ? en palabra | export DATABASE_URL="postgresql://postgres@127.0.0.1:55616/aud?options=-c%20TimeZone%3DUTC" SEED_DEMO_PASSWORD |
| docs/coordinacion/auditoria-2026-10-10/06-datos-concurrencia.md:344 | ? en palabra | export DATABASE_URL="postgresql://postgres@127.0.0.1:55606/aud?options=-c%20TimeZone%3DUTC" |
| docs/coordinacion/claude-nube/LEEME_CLAUDE_NUBE.md:8 | ? en palabra | 4. Verifica con un dato real (p. ej. `GET /sales?limit=50`, `GET /products?limit=200&page=1`). |
| docs/diseno/MAPA_PANTALLAS.md:8 | ? en palabra | / `/void-requests?status=pending` / apps/web/src/QuickQuestions.tsx:458 / |
| docs/validacion/ronda9-revision-adversarial.json:109 | ? en palabra | "scenario": "loadCatalog pide /products?limit=200&page=N ordenado por nombre y sin cursor. El catálogo se reca |
