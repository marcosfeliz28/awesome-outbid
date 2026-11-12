# Pendientes de la noche (30-oct-2026) — lista viva de Norexos 1
Orden de la dueña: todo lo planeado se hace de principio a fin; si algo falla se arregla, y si no, se detiene ESA tarea y se vuelve cada hora. Skill `noche-autonoma`. Estados: HACER · EN CURSO · BLOQUEADA(motivo) · LISTA.

| # | Tarea | Quién | Estado | Siguiente paso |
|---|---|---|---|---|
| 1 | Herramientas de cobros (FS-328, FS-288, FS-304) | Norexos 2 | LISTA (30-oct 02:38 UTC) | Aplicados y en bitácora. Queda la nota 14 |
| 2 | T32 bug «Ver detalle del mes» (63128b91, rama claude/desglose-mes) | Taller | LISTA para CI | Esperar los 3 CI; auditar; mezclar en nexora-cloud; desplegar (autorizado) |
| 3 | T32 (pruebas de suma con devoluciones verdes, 8a259ea5; falta banco, línea/top 10 y mes anterior/siguiente) desglose por cobro/banco/línea + top 10 unidades y monto + mes anterior/siguiente | Taller | EN CURSO | Pruebas de suma con devoluciones (D-05); luego implementar |
| 4 | T33 IA de ventas en la tienda (solo lectura, tope 30/día, cajera solo lo suyo) | Taller | HACER (tras 3) | Rama claude/ia-ventas-linea desde nexora-cloud |
| 5 | Docs verificados de Taller (rama claude/taller-docs-verificados cf66ae14) | Taller/N1 | HACER | Verificar CI; mezclar en nexora-cloud |
| 6 | Landing inglés completa (rama claude/taller-landing-en 5a3f5fe5) | Taller/N1 | HACER | CI verde; mezclar en producto-nexora |
| 7 | Cola local N34–N41 y bloque 15 (NOCHE_CLAUDE_PC_30OCT.md) | Claude PC | EN CURSO | LISTA de claude-pc/cola-n-nueva 579e249e (docs): mezclar tras CI |
| 8 | Reparto local (REPARTO_LOCAL_PC.md de Claude PC) | N1 | HACER | Confirmar reparto en COLA_LOTE_LOCAL.md |
| 9 | Forja 3 resto (F3-01, F3-02, F3-04, F3-05) | fork | BLOQUEADA(no puedo escribirle) | Está en RESPUESTA_CLAUDE_PC orden 75; revisar su LISTA |
| 10 | Pedidos del Consultor (Norexos 6) | Consultor | EN CURSO | Repartir cada PEDIDO nuevo a Taller/Claude PC |
| 11 | Revisión diaria (reportes.py) | N1 | BLOQUEADA(faltan NEXORA_CLAUDE_USER/PASSWORD en el entorno) | La dueña debe configurarlas |
| 12 | Cambio de nombre Norexos en código (E1) | por asignar | HACER | Esperar decisiones de E3 de la dueña |
| 14 | Cuadre de Wendy tras FS-328: transferencia esperada 9,700 vs contada 2,200 (−7,500) y caja temporal de Claude con +2,600 tarjeta contada sin esperado | dueña | Espera conteo/decisión suya | No tocar lo contado sin conteo nuevo de la dueña (CLAUDE.md). Posible mejora: reporte con marca «ajustado» |
| 15 | Tildes: refinar scripts/tildes-nuevas.mjs (ignorar URLs/código) | Claude PC (fork) | EN CURSO: rama claude-pc/tildes-urls ef0c1b08 (43→6 hallazgos + prueba de 4 casos 4/4; CI pendiente) | Mezclar tras CI; si choca con claude/taller-bloque15 (mismo script), conservar la versión de tildes-urls y re-generar el informe |
| 16 | Bloque 15 canónico = claude/taller-bloque15; claude-pc/bloque15 y claude-pc/bloque15-norexos4 solo referencia | Taller | CI en curso (5b7fd6d2) | Mezclar en nexora-cloud con CI verde |
| 17 | Desglose del mes (renglones no cobrados, banco, top 10, mes ant./sig.) + T33 IA de ventas | Norexos 8 (session_01CjMpH4UeCp2AuCD8Jei7Bq) desde 06:39 UTC; Norexos 7 (session_01CjMpH5C7JcGB28H1vGM9qp) hizo el paso 1 (c91ae77d) y quedó bloqueado en un permiso de Send Message | EN CURSO: pasos 2–4 y T33 | Taller (Norexos 3) quedó BLOQUEADO desde 05:38 esperando permiso de «Send Message»; no puedo interrumpirlo (el clasificador lo negó). Cuando la dueña despierte: aprobar o descartar ese permiso en la sesión de Taller |
| 13 | Verificar si alguna sesión alcanza a Claude PC | N2/N5/Taller | HACER | Pregunta enviada |

## Decisiones de la dueña pendientes (no frenan el trabajo)
Dominio de la portada y casilla de soporte; qué es «la Lacto»; 4 decisiones E3; correo/banco de Mercancía (FS-24, 12 transferencias del 25-oct, 65 sin verificar = 242,540); countedCard de Lizbeth (117000 vs 11,700).

## Registro
- 30-oct 02:32 UTC: API y web de la tienda desplegados (e47a557d) con herramientas de cobros.

- 30-oct 09:17 UTC: desglose del mes DESPLEGADO en la tienda (API 09:12, web 09:17, commit 1e25909f; 3 CI verdes; 0 cajas abiertas leídas por Norexos 2 a las 07:58). T33 IA de ventas: Norexos 9 sobre la base de Norexos 8 (claude/ia-ventas-linea-obrero2). Pendiente de CI y mezcla: claude/desglose-css, claude/docs-sistema-actualizar, claude/docs-venta-acciones. Auditoría de seguridad T39 (claude/seguridad-20) en curso por Taller.

## Dueño único por pieza (N1, 30-oct 09:50 UTC) — nadie toca lo que es de otro
| Pieza | Dueño | Rama canónica | Otros |
|---|---|---|---|
| T33 IA de ventas | Norexos 9 | claude/ia-ventas-linea (ya fusiona la de Norexos 8) | claude/ia-ventas-linea-obrero2 CERRADA: Norexos 7 y 8 no la tocan |
| Desglose CSS 390 px | Norexos 8 (terminado) | claude/desglose-css | desglose-mes y desglose-notas: solo referencia |
| Fase 2 visual (producto) | Norexos 10 | claude/visual-f2-NN | nadie más |
| T39 auditoría 20 puntos | Taller | claude/seguridad-20 | solo lee; no cambia código |
| Dependencias vulnerables (body-parser, multer, qs) | Taller | claude/deps-seguridad | zod 4: tarea aparte, sin dueño todavía |
| Docs de sistema y venta (T37, T38) | Taller | docs-sistema-actualizar, docs-venta-acciones | — |
| Mercancía, cobros, cajas | Norexos 2 | — | solo él lee/aplica |
| Cola local, tanda 4 R1–R8, N54–N57 | Claude PC | claude-pc/cola-n-nueva | el fork solo Forja 3/4 |
| Control del cronograma | Norexos 5 | control/norexos | no ejecuta tareas de código |
| Pedidos de la dueña a revisar | Consultor (Norexos 6) | — | solo reparte; no construye |
Norexos 7: terminado, sin tareas. Regla: antes de empezar algo, ver esta tabla; si no tiene dueño, escribir «Tomo: …» en PENDIENTES.

## Registro 30-oct 13:00 UTC (N1, por orden de la dueña: decidir, gastar menos, terminar)
- Lote único mezclado en un solo push: desglose-e2e-estable (con citas de merchandise.ts), seguridad-bajo, ui-cobros-admin, seguridad-zod-limites, seguridad-20-auditoria; citas de docs/sistema movidas a sus líneas nuevas; vitest.config con todas las pruebas. Nada se despliega hasta que este CI termine verde.
- Siguiente en orden: (1) CI verde del lote → lectura de cajas (Norexos 2) → desplegar solo web del desglose; (2) T33 (claude/ia-ventas-linea 62720b17, rojo solo por cuatro-cajas.spec.ts:185, intermitente ajeno a la IA) tras rebase sobre el lote; revisar que las 2 migraciones sean aditivas; (3) Fase 2 visual (producto-nexora) sin desplegar.
- Reducción de gasto: Norexos 7 y 8 archivadas (terminadas); rutina del Director apagada; sesiones activas máximas = N1, Taller, Mercancía (N11), Claude PC. docs-citas-fix (Taller) y claude/ia-ventas-linea-obrero2 quedan obsoletas.

## Registro 31-oct 00:55 UTC (N1)
- DESPLEGADO en la tienda (commit f656cefa, 3 CI verdes; 0 cajas abiertas leídas por Norexos 2 a las 00:39 UTC; sí de la dueña para API y web): API en vivo 00:45:35 UTC, web en vivo 00:54:07 UTC. /api/health ok, web 200; único error en logs: corte esperado de /api/events al reiniciar la API. Incluye: GV anular pago verificado, GV tarjeta sin banco (GvPayment.destination aditiva), deps de seguridad (body-parser, multer, qs), SQL con Prisma.sql y CORS, topes zod, tope 30/día lecturas IA de facturas, botones admin de cobros, desglose 390 px, reanclado de citas.
- Primer cobro tras el despliegue: FS-66 Ginette (19,800, transferencia Popular) por Norexos 2 a las 00:51 UTC con la API nueva.
- NO desplegado aún: T33 IA de ventas (claude-pc/t33-rebase 182e2278, auditada: migraciones aditivas, sin texto de consultas); espera ver la dueña. Pendientes de Claude PC: órdenes 94 (pruebas intermitentes) y 95 (precios, contrato, dominio).

## 31-oct 12:40 UTC · Web con rediseño EN VIVO (ae63fb6d, desplegada 12:10; 0 cajas a las 10:41)
- Auditoría pública (Agente C, Haiku): sin hallazgos altos. Pendientes bajos: 400 en /api/auth/refresh sin sesión (¿esperado?), 14 px en el login, foco visible de campos. Con sesión: NO COMPROBADO hasta que estén NEXORA_CLAUDE_USER/PASSWORD en el entorno (la dueña).
- Skill nuevo: auditoria-usuario. Agentes A, B, C archivados. Pendiente: orden 98 (animaciones), zod4, T33, dominio/precios (dueña).

## 31-oct 22:15 UTC · GV (decisiones de la dueña)
- Incentivos GV: agente Haiku en `claude-pc/gv-incentivos` (bfd0844; CI en curso). Nuevas reglas: pagos en USD se registran con opción de moneda + equivalente en pesos con tasa capturada; devolución quita el incentivo; cada curso es un ítem (docs/operacion/GV_CATALOGO_CURSOS.md).
- **GV debe tener CIERRE desde ahora** (abrir caja, cerrar caja, factura del día; decisión: la dueña dijo «deben hacerle un cierre»). Diseño (A: misma caja con área GV / B: caja propia) por decidir; asignar a un agente cuando termine el de incentivos (máx. 4 sesiones activas).
- Reporte de ventas de octubre por área para Génesis: pedido a Norexos 2 (docs/operacion/REPORTE_VENTAS_OCT2026_POR_AREA.md en claude/bitacora-n2).

## 1-nov 10:45 UTC · CI ROJO EN TODAS LAS RAMAS (prueba de dinero del día 1 del mes)
- Causa 1 (confirmada por el agente de diagnóstico): `/dashboard/year` resta `SaleReturn.total` y `/dashboard/breakdown` solo líneas devueltas; la devolución heredada de 500 (sin líneas) que crea la prueba N-3 solo la ve el año. Fix A (desglose resta devoluciones sin detalle como fila explícita) en `claude-pc/fix-ci-mes` 4f994d7b.
- 4f994d7b AÚN FALLA en CI: `tests/dinero-auditoria.test.ts:902` y `:942`, diferencia de 118 (89439.5 vs 89557.5). Hay una segunda causa en la suite completa. Pendiente de devolver al agente (session_01CjMpH6i9MQ46RPz1qbGhSG): reproducir la suite de dinero completa en orden CI y hallar los 118 con SQL. El canal send_message de N1 estuvo caído a las 10:45.
- Producción: N2 no ve devoluciones en 381 ventas (8–31 oct); la BD de Render bloquea consultas externas (allowlist vacía), la dueña decide si abrirla.
- Bloqueadas por este CI (no mezclar hasta que pase): gv-incentivos c227d6b (por pago), anim-reportes, fix-dinero, fix-seg-menor, pq-23-parches, pq-23-28, pq-25-indices, pq-39, pq-37, pq-11, zod4.

## 1-nov (dueña, antes de dormir): decisiones
- Reembolsos GV en pesos (orden 106). GV con caja propia, opción B (orden 106; falta asignar agente: send_message de N1 caído a las 10:45 UTC).
- La dueña reactivará el Relevo de Claude PC con el repo como fuente y pondrá NEXORA_CLAUDE_USER/PASSWORD en el entorno (pidió instrucciones).
- Pendiente: H-19 (pagos a proveedores con caja registrada) sin respuesta; agente a6682e08 arreglando el CI rojo de dinero en mi entorno.

## Decisión de la dueña (1-nov-2026) — margen mínimo del 15 %
**No se bloquea la venta por debajo del 15 %.** La cajera puede vender con cualquier porcentaje; la dueña lo revisa y maneja al final, con el cobro. El 15 % sigue siendo el piso de referencia para fijar precios y para los avisos/reportes de margen bajo, pero **no es un bloqueo en caja, ni en promociones, ni al editar precios**. Ninguna IA debe agregar bloqueos por margen. Cierra el punto #8 del informe de revisión pesada (25-oct): fórmula única (ya hecha, commit 1fda5880) + esta decisión.

## 1-nov 13:50 UTC · Hallazgo del agente de guías: «Rentabilidad» del cierre de caja resta ITBIS
`apps/api/src/cash.ts` (~l.474): la rentabilidad del cuadre se calcula como Σ(total − taxTotal − costTotal) menos devoluciones, es decir **resta el ITBIS**; la regla de la dueña es margen = (precio − costo)/precio **sin restar ITBIS** (el commit 1fda5880 ya unificó el tablero, el reporte por producto y la alerta, pero este cálculo del cuadre sigue distinto). Solo lo ve quien tiene `profit:read`. **Decisión pendiente de la dueña:** ¿dejarlo como está (utilidad neta de ITBIS, que es dinero que no es de la tienda) o alinearlo con la regla? No se cambia sin su respuesta. También por confirmar en las guías: nombres «Bruta/Neta» del informe anual/mensual y la fórmula de «Diferencia total».

## 1-nov 13:55 UTC · Más hallazgos del agente de guías (reportes viejos de Management)
1. **Costo visible con permiso equivocado (seguridad, orden 110):** `kardex`, `stock bajo` (low-stock) y `sin movimiento` (no-movement) muestran costo a quien tiene `reports:read`; la regla del sistema pide `profit:read`. Se corrige sin cambiar cifras (ocultar costo sin `profit:read`), con prueba.
2. **ITBIS en la ganancia (decisión de la dueña, junto con la «Rentabilidad» del cuadre):** `estado de resultados`, `ABC` y `utilidad por producto` restan el ITBIS en la ganancia; la regla es sin restar. No se cambia sin su respuesta.

## 1-nov 14:45 UTC · Revisión N1 (CI rojo, opción A)
- `claude-pc/fix-ci-mes` 62d78b65 (opción A: devoluciones por fecha de la venta original; diff auditado, correcto): verify AÚN ROJO — dinero-auditoria:861 (dif 118), :903/:943/:1013 (dif 60), api.test:2243 (profit vs dashboard, dif 100). El agente tiene orden (13:55) de aplicar el mismo criterio a /reports/profit y demás informes, un solo push. Regla de costo de devolución sin reingreso: sin cambios (decidido).
- ChatGPT nube (ci-fecha-1nov, 13:25): segunda opinión coincide con unificar por fecha de venta; no hay aprobación de CI para mezclar nada.
- Otras ramas en juego (reportes-export a7e47a16, reportes-guia 270a22de, instalador-sin-internet 2035206, recuento-decisiones f68cc9f0, fix-costo-permiso d5f4d455): windows-installer y render-images verdes, verify rojo por la base roja. No se mezcla nada hasta el CI verde.
- NO desplegado. Producción sigue en 2e87d8b7. Al desplegar la opción A hay que mostrar a la dueña la tabla antes→después (prometido).

## 1-nov 16:55 UTC · Decisión de la dueña: dominio **norexos.net** (en vez de norexos.ai)
Cloudflare (cuenta 875b3a7f…): `norexos.net` registrable a US$11,86/año (`.com` 11,17; `.ai` 80). Intentos de registro por API (x2) fallaron SIN cobrar: «No registrant contact provided and no default address book entry». Falta que la dueña deje un contacto **predeterminado** en `dash.cloudflare.com/<cuenta>/domains/registrations` (puede que ya exista el de `nexorapos.net` y solo haya que marcarlo como predeterminado) y confirme tarjeta en facturación; o que dé nombre, dirección, teléfono (+1…) para enviarlo en la solicitud. Tras registrar: DNS a la landing, certificado, `soporte@norexos.net` (Email Routing, como en nexorapos.net), 301 desde nexorapos.net. Landing: agente en `claude-pc/landing-norexos-net`. Se actualizan las menciones de norexos.ai en `docs/venta/` cuando el dominio exista.

## 5-nov 04:50 UTC · Orden de la dueña (se fue a dormir): «procede a hacer todo lo que falte, venta y no venta, hasta mañana»
- Agentes en marcha (sin desplegar): landing norexos.net (`claude-pc/landing-norexos-net`, session_01CjMpH79rw2VkFCZiqy8GaB), reportes bajos + HALLAZGOS_TOTAL (`claude-pc/aud-pendientes-bajos`, session_01CjMpH86z4UQ77hBJSbqkLp), control de GV (`claude-pc/gv-control-vendedora` 58212243, CI verde, esperando visto bueno).
- NO se despliega nada que cambie caja, cobros, precios o inventario (GV caja/recibos/cupo/PIN) sin su respuesta a los 5 puntos de RESULTADOS_GV_CONTROL.md; sí docs, landing estática y reportes de solo texto con 3 CI verdes y 0 cajas (N2).
- Esperan a la dueña: ganancia de octubre y devoluciones heredadas (dinero-seguridad-final, aud-sincronia), rol de la gerente de GV (A o B), regla de permiso `git push` de N2 (claude/bitacora-n2), vouchers de tarjeta (Lizbeth 17:03/17:06; Wendy FS-0000425), dominio/precios.

## 5-nov · DESPLEGADO control de GV (1868b1b4; API 05:56 UTC, web 08:06 UTC)
- Autorizado por la dueña («cerrar y aplicarle más control a GV; autorización de todo hasta las 6 AM»). 3 CI verdes en el SHA exacto; N2 confirmó sin cobros en curso; única caja abierta: 8a61d2c1 de la dueña (0 ventas) = excepción anotada.
- Vivo: caja propia de GV (abrir/cerrar con arqueo ciego), recibo GV-0000001 por pago, bloqueo con caja del día anterior abierta, cupo bloqueado, PIN de la dueña para anular/devolver, alerta de abonos >15 días. Migración aditiva 202611040001. Verificado: health ok, /gv/cash/current 200, logs de error vacíos.
- Defaults que la dueña puede cambiar: cobrar SIN caja GV abierta sigue permitido; reembolsos en efectivo aún no restan de la caja GV.
- Landing norexos.net lista en su rama (881f6a5, CI verde), sin publicar: faltan planes/precios, buzón, destino app, dominio.
- Levantamiento solo lectura: 82 transferencias sin verificar (RD$ 331,030), 561 productos bajo mínimo, 16 créditos por antigüedad, 37 descuadres, 6 ventas con margen bajo; 0 cajas abiertas salvo la de la dueña.

## 5-nov 11:36 UTC · DESPLEGADO reportes de Ventas (0a17101b; API 11:25, web 11:35)
- Solo exportación/texto: fila de total en PDF/Excel, fecha legible, «Facturas que la incluyen». Sin cambios de cifras. 3 CI verdes en el SHA; N2 sin cobros en curso (10:39 UTC). Verificado: health ok, logs vacíos, PDF de ventas-por-marca 200 con fila de total.
- HALLAZGOS_TOTAL.jsonl y RESUMEN.md ya en docs/auditoria/reportes/: listos para la contra-auditoría de ChatGPT PC/nube.
- Producción = 0a17101b (+ docs posteriores). Pendientes de la dueña sin cambio.

## 6-nov 06:40 UTC · EN VIVO: GV exige caja abierta, foto de voucher y cierre diario (a3b1b19c)
- Render: API (dep-dbmig66k1f9s73b3q200) y web (dep-dbmig6dg1s2s73f2uc40) con a3b1b19c desde 01:06 UTC (9:06 PM RD), disparados por API de Render (trigger «api»). Este turno solo lo VERIFICÓ: health ok, web 200, `/api/gv/cash/current` devuelve `{"open":false}` (arreglo de la pestaña «Caja GV»), 0 cajas abiertas, última venta 21:52 UTC del 5-nov, logs de error vacíos.
- N2 no contestó la lectura previa pedida a las 02:11 y 02:37 UTC; lectura propia en solo lectura (/cash-sessions, /sales, /gv/cash) = sin cajas ni cobros. Anotado como excepción a la regla «comprobado por N2».
- Falta por comprobar en navegador: modal de pago con tarjeta y cierre con foto de lote (primer día de uso de Clary), seguridad-20 puntos 8 y 10–15.

## 7-nov 01:13 UTC — despliegue API+web (N1)
- API desplegada con commit 1a4c9bd7 (3 CI verdes); web desplegada sobre 3743f7ec (solo 3 archivos de docs más que 1a4c9bd7, código idéntico).
- Condiciones: 0 cajas tienda y 0 GV abiertas, 0 ventas/cobros en 15 min (lectura de N2 00:46 UTC, solo lectura; mis credenciales de lectura no estaban en ese contenedor y la BD no admite consulta externa).
- Incluye: G9 closeOwn, vista de celular, rol gerente_gv, alerta GV que se apaga al cerrar, cierre de GV con «registrado / declarado / diferencia» y recibos.
- Verificado en vivo: /api/health ok, web 200 con bundle nuevo, /gv/cash/current → {"open":false}, rol gerente_gv existe, sin errores en logs.
- Quitar la nota de «excepción N2 no respondió» de 6-nov: N2 confirmó 0 cajas.
- Abierto: claude-pc/ia-medidor (corrección 0d176e79, esperando CI), claude-pc/ia-ventas-rescate (en curso), colas 7-nov de ChatGPT Nube/PC y Claude PC.

## 7-nov 06:40 UTC — medidor de IA en vivo (N1)
- API y web desplegadas con 3606676a (medidor AiUsage + GET /ai/usage + tarjeta en Configuración). Migración aditiva 202611070001 aplicada.
- CI: verify falló una vez en tests/password-account.test.ts («dos cambios simultáneos de la propia contraseña», esperaba 400/401 y llegó 404; ajena al medidor); al relanzar pasó. Vigilar: si reaparece, buscar la causa de carrera, no saltarla.
- Condiciones: 0 cajas abiertas y GV sin caja (lectura propia 04:38 UTC; tienda cerrada de noche).
- Verificado: /api/health ok, /api/ai/usage responde (aún sin filas), bundle con la tarjeta, /gv/cash/current {"open":false}, sin errores en logs.
- Pendiente del medidor: precios de modelos en ai-prices.ts (hoy costo = null), medir IA de ventas (rama claude-pc/ia-ventas-rescate, CI verdes en 8954a099; falta auditarla).

## 7-nov 14:40 UTC — IA de ventas desplegada, APAGADA (N1)
- API desplegada 12:38 UTC con dda476be (0 cajas abiertas, 0 ventas desde 21:50 UTC del 6-nov; 3 CI verdes sobre ese SHA). Web desplegada 14:32 UTC (solo frontend; con cajas ya abiertas, sin reinicio de API).
- Contiene: asistente «Preguntar a Norexos» (apps/api/src/assistant.ts) tras auditoría independiente de N1 (sin hallazgos altos) y correcciones H1–H6 (límite 6/min por usuario, máx 4 herramientas por ronda, rango ≤366 días, datos entre <datos>, errores genéricos, contrato 04 ajustado).
- Verificado: /api/health ok, web 200 con el bundle nuevo, POST /assistant/ask sin plan/llave → 503 (apagada), sin errores en logs.
- Para encenderla (solo la dueña): clave ANTHROPIC_API_KEY en Render (sync false) y IA_VENTAS_PLAN=medio|completo. Precios de modelos en ai-prices.ts siguen null (costo no calculado): pedido a ChatGPT Nube verificar en la página oficial.
- Falla intermitente reincidente en CI: tests/password-account.test.ts («dos cambios simultáneos», 404 en vez de 400/401) y tests/telegram.test.ts (purga por tiempo). Pasan al relanzar. Pendiente: causa raíz de la carrera (no saltar).

## 9-nov 01:37 UTC — ganancia con ITBIS en vivo + rama de costos mezclada (N1)
- API y web desplegadas con 467de531 (3 CI verdes; 0 cajas abiertas, última venta 17:48 UTC del 8-nov). Incluye aud-sincronia (ganancia con ITBIS según regla de la dueña, autorizada el 8-nov), landing (sin publicar), docs de ChatGPT Nube y auditoría de contraseñas.
- Verificado en vivo (dashboard/summary octubre): revenue 1,459,804.50 − costTotal 775,914.04 = profit 683,890.46 (margen 46.85 %); grossProfit fiscal sin ITBIS 461,208.47 se conserva en el estado de resultados. Health ok, web 200, /ai/usage responde, sin errores en logs.
- Avisar a la contable: la ganancia del panel (con ITBIS) ya no es la fiscal.
- Observación: Render despliega el último commit de la rama aunque se pase commitId; confirmar siempre el commit en vivo con get_deploy.
- Mezclada a nexora-cloud claude-pc/venta-sin-costo (bc1c95b9): bloqueo de venta sin costo APAGADO (blockZeroCostSales), lista /inventory/without-cost, recálculo /reports/cost-recalc (solo lectura), corrección auditada POST /sales/:id/items/:itemId/cost (PIN, expectedUnitCost, operationId). NO desplegada: esperar a que la dueña cargue costos y confirme.
- Pendientes de la dueña: Excel de costos (69 productos, 52 con existencia), contacto para comprar norexos.net (US$11.86), clave del script de arranque (camino A o B), datos legales, abogado, 3–5 nombres para piloto.

## 9-nov 14:40 UTC — mezclas sin desplegar
- Mezclada a nexora-cloud claude-pc/instalador-ci-baja (62d1b436): baja de cliente con `main` protegida, piso fijo de 30 días, paquete verificado por SHA-256, credenciales fuera del paquete; migración aditiva 202611090001 (BranchTermination) NO aplicada hasta el despliegue.
- Mezclada a nexora-cloud claude-pc/dinero-gv-usd-ajustes (cbd72c93; incluye devoluciones heredadas): GV en US$ solo efectivo (CHECK NOT VALID, 409 explicado para pagos antiguos), migración 202611010001 con lock_timeout. NO desplegada: falta cumplir las condiciones (cajas cerradas, sin ventas recientes, migraciones revisadas).
- Ambas con 3 CI verdes sobre el SHA exacto, avance directo (sin mezcla nueva). Agentes terminaron; cerrar sus sesiones.
- Aprendido: si dos ramas de agentes tocan docs/sistema/CAMBIOS.md, la segunda queda atrás tras fusionar la primera; fusionar en serie y pedir una sola mezcla final al segundo agente.
- Observación: procesos playwright-mcp de agentes consumían la RAM de la PC de la dueña; pedir a los agentes de PC cerrar su navegador de pruebas al terminar.

## 9-nov 22:37 UTC — revisión de media hora (N1)
- `confirm_repository_trust` FALLÓ con `[refused_log_too_long]` tras el "sí autorizo" de la dueña: la aprobación no se contó por exceso de historial en esta sesión. No puedo escribirle a sus sesiones de PC todavía; le informé y le di el camino de copiar-pegar como respaldo. Para activarlo de verdad se necesita una sesión NUEVA que vuelva a pedirlo.
- `diseno-impacto` (PR #17, 1dbfd28d) quedó bloqueada pidiendo mezcla+despliegue: su base está 42 commits detrás de nexora-cloud (ya no es fast-forward, conflicto esperado en docs/sistema/CAMBIOS.md). Le pedí que remezcle origin/nexora-cloud, resuelva, un solo push y reporte el SHA final con los 3 CI verdes; yo decido mezcla/despliegue después. NO desplegado.
- `asistente-analista` (9d419f30, eval 100/100, CI verde): pendiente de que la dueña apruebe el tope de US$0.40/usuario/día. No es bloqueo urgente, sigue en la lista.
- Ramas `chatgpt-nube/calidad-9nov` y `chatgpt-pc` (si ya empezó) con las órdenes de brecha-competencia/auditoría de calidad: aún no reportan: revisar en el próximo ciclo.
- Aprendido: cuando una sesión queda con `needs_action` de "¿mezclo y despliego?" sin que yo haya verificado que sigue siendo fast-forward, hay que comprobar `git merge-base --is-ancestor origin/nexora-cloud <sha-rama>` ANTES de responder; si falla, pedir remezcla al agente en vez de forzar.

## 10-nov 00:37 UTC — revisión de media hora (N1): prueba de intrusión en curso
- Gemini entregó 6 hallazgos (paquete de 5 archivos); verifiqué los 6 contra el código: 4 reales (arquitectura multi-tienda G-01, lock sin branchId en editableSale G-03, SupplierPayment.amount sin filtrar en safe() G-04, login de cajera sin exigir equipo aprobado G-06), 2 falsos (POST brands/categories ya tienen catalog:write; cupo diario de IA ya existe en ai-daily-limit.ts).
- Le di a Gemini y a ChatGPT el paquete completo (apps/api/src + apps/web/src + packages/shared/src + schema.prisma, orden directa de la dueña 10-nov: "libertad mayor para que hackee el sistema completo").
- ChatGPT reportó 8 hallazgos; verificados: el más urgente es REAL y afecta dinero — `Sale.number`/`SaleReturn.number` son `@unique` GLOBAL pero el contador (`counter: "sale:"+branchId`) es por sucursal: dos sucursales que lleguen al mismo número de factura el mismo día, la segunda venta falla. No hace falta SaaS multi-cliente: pasa el día que la dueña abra una segunda sucursal física en la misma base. Pendiente de la dueña: orden para corregirlo (agregar branchId a la clave única o prefijo de sucursal en el número) antes de abrir una segunda sucursal.
- También confirmado: bug real en `scripts/rutas-permisos.mjs` (busca @Permit hacia atrás pero el código lo pone después del decorador de ruta) — explica por qué RUTAS_Y_PERMISOS.md decía mal los permisos de brands/categories y por qué Gemini reportó falsos positivos con ese mismo dato. Corregir el generador es la forma barata de evitar más falsos positivos en las próximas rondas.
- Categorías/marcas visibles entre sucursales (GET sin filtro branchId) y GET /settings devolviendo el JSON completo a cualquiera con catalog:read (incluye seller): confirmados, reales, sin fix aplicado.
- NADA EJECUTADO todavía (orden de la dueña: esperar su visto bueno de orden de corrección). Pendiente: que ella decida el orden de arreglo; candidato de arranque: numeración FS/NC (afecta dinero el día que haya 2 sucursales).

## 10-nov 06:37 UTC — revisión de media hora (N1)
- `claude-pc/seguridad-correcciones-10nov` (56ef61b4): 3 CI verdes confirmados en el SHA exacto. NO mezclado todavía: toca dinero (numeración FS/NC en sales.ts), fuera de la autorización permanente de despliegue/mezcla de la skill. Pendiente confirmación directa de la dueña antes de mezclar a nexora-cloud.
- Hilo de auditoría con Gemini/ChatGPT/DeepSeek (coordinado por dot) sigue activo y extenso: EXEC-01 (diferencia de caja en venta offline revaluada, 5 escenarios documentados) y EXEC-02 (PIN/issue/terminalId) registrados SOLO en local (`/tmp/.../scratchpad/REGRESION_EXEC01_CAJA.md`, `RETRACTACIONES_GEMINI_EXEC.md`), sin comitear por instrucción explícita de la dueña. Plan de solución de EXEC-01 pendiente de que ella elija entre conservar precio de venta offline cerrada o permitir revaloración con cobro/devolución explícitos.
- Fixtures de DeepSeek (`apps/api/scripts/fixtures-deepseek.ts`): probado localmente, idempotente, lint/typecheck limpios. Sigue sin commit/push/CI por instrucción explícita.
- Render: sin provisionar, sin cargos.

## 11-nov 20:59–23:18 UTC — reimprimir facturas (N1)
- Orden directa de la dueña con foto de pantalla ("agrega la opción de reimprimir facturas ya hechas"): agregado botón "Reimprimir" en Ventas (Management.tsx) junto a Ver/Descargar, abre receipt.pdf en pestaña nueva en vez de forzar descarga a disco. Push 7628f01c: CI `verify` falló en `pnpm check` — rompí sin querer `tests/seguridad-menor.test.ts` H-15 (revisa el CÓDIGO FUENTE de `download()` buscando literalmente su propia línea de reintento) al compartir un `fetchBlob()` entre `download()` y `printPdf()`. Corregido en 478c78f5: `download()` vuelve a su forma original exacta; `printPdf()` tiene su propia implementación independiente con el mismo patrón acotado (tope de encabezados + 1 reintento). `pnpm check` en verde en 478c78f5.
- Aprendido: cualquier refactor que toque `download()` en `apps/web/src/api.ts` debe revisar primero `tests/seguridad-menor.test.ts` (H-15) — es una prueba de caja blanca sobre el texto fuente, no solo sobre el comportamiento; compartir código entre funciones puede pasar el comportamiento pero romper la prueba igual.
- `node scripts/verify.mjs` (e2e) en 478c78f5 falló en las MISMAS 4 pruebas que `docs/coordinacion/HALLAZGO_CI_4_PRUEBAS_11NOV.md` ya documentó como ajenas a mis cambios (causa raíz aún sin investigar): caja-web, cuatro-cajas, incentivos, stock-en-vivo. No es nuevo, no bloquea esta rama.
- Orden directa de la dueña (texto, sin foto): anuladas FS-0000573 y FS-0000574 (ventas de prueba de Jade De Jesús entrenándose, RD$1,450 y RD$1,700 en efectivo, cash session abierta) vía `POST /sales/:id/void` con `claude` admin. Verificado: ambas `voided`, inventario y caja se autoajustaron.
- BLOQUEADO (reintentar cada hora): PR #18 (etiqueta de método de pago) — sus 2 runs de CI (push 43097364901 y pull_request 43097370526, SHA 173fa636) llevan ~4h en `status: queued` sin arrancar; `cancel_workflow_run` da 409 "Cannot cancel a workflow run that has not been queued yet" en ambos, contradictorio con su propio status. No tengo acceso a administración de runners/Actions para forzarlo. `mergeable_state` ya es `clean`. Reintentar: revisar si arrancó solo, o pedir a esa sesión un nuevo push vacío/remezcla para generar un run nuevo si sigue atascado en el próximo ciclo.
