# Órdenes vigentes para ChatGPT nube (puntero; Norexos 1, 1-nov-2026)

Este archivo existe porque tu revisión horaria lo busca. **La coordinación vigente está en:**
1. `docs/coordinacion/COLA_PERMANENTE_CHATGPT.md` (tu lista en orden y la regla de no parar).
2. `docs/coordinacion/ORDEN_CHATGPT_HOY_1NOV.md` (sección ChatGPT nube).
3. `docs/coordinacion/ORDEN_CHATGPT_HOY_1NOV.md` y `PLAN_DE_HOY_1NOV.md`.
Lee siempre `origin/nexora-cloud`. Cada hora: `git fetch`, relee esos archivos por cambios, comprueba el CI de tus ramas con la API pública de check-runs, y sigue con la siguiente pieza sin esperar. Reporta en `docs/coordinacion/RESULTADOS_CHATGPT.md`. No mezclas ni despliegas.

## PRIORIDAD INMEDIATA (1-nov 15:45 UTC, Norexos 1) — aprovechar tu PostgreSQL local
Eres el único (con ChatGPT PC) con base de pruebas real; los agentes de la nube de Claude no pueden correr las pruebas con PostgreSQL. Tareas, en orden, cada una en TU rama, sin empujar a ramas ajenas:
1. **Reproducir el CI rojo con base real** (`chatgpt-nube/ci-opcion-a-verifica`): haz checkout de `origin/claude-pc/fix-ci-mes` (opción A, `62d78b65`; si hay SHA nuevo, ese), corre la suite completa en base limpia DOS veces y reporta, con salida exacta, qué pruebas fallan y la causa de cada una: `tests/dinero-auditoria.test.ts` (líneas ~861, 903, 943, 1013 y «el círculo del año…»: diferencias de 118 y 60 y un residuo de 80 que parece carrera entre suites) y `tests/api.test.ts:2243` (costo/utilidad 100 entre `/dashboard/summary` y `/reports/profit`). Propón el parche mínimo como diff en `RESULTADOS_CHATGPT.md` (no lo empujes a `claude-pc/fix-ci-mes`: otra sesión lo trabaja; Norexos 1 decide cuál usar). Reglas: no cambiar cifras de dinero que ve la dueña; no debilitar pruebas; la devolución resta costo solo cuando reingresa; todo por fecha de la venta original (opción A, aprobada).
2. **Validar el exportador con base real:** checkout de `origin/claude-pc/reportes-export` y corre `tests/reportes-export-api.test.ts`, `tests/reportes-export.test.ts`, `tests/gv-reportes-export.test.ts`. Reporta qué pasa y qué falla (el agente que lo escribió no pudo correrlas). El 403 sin `profit:read` falla porque el usuario nace con `mustChangePassword = true` (`common.ts:665`); el arreglo es poner `false` en la prueba.
3. Después, tu cola (`COLA_PERMANENTE_CHATGPT.md`).
Reporta en `docs/coordinacion/RESULTADOS_CHATGPT.md`. Sin credenciales; no tocar Render ni la base de la tienda.

## 2-nov · Contra-auditoría de los reportes (después de la auditoría de los agentes Claude)
Plan y reglas: `docs/auditoria/reportes/PLAN_AUDITORIA_REPORTES_2NOV.md` (rama `claude-pc/plan-auditoria-reportes`). Cuando Norexos 1 publique `docs/auditoria/reportes/HALLAZGOS_TOTAL.jsonl`, contra-audita cada hallazgo con PostgreSQL de PRUEBA (nunca datos reales ni credenciales): reproduce, confirma o discrepa y llena el campo `contra_audit`. Mientras tanto, sigue tu cola. Rama: `chatgpt-nube/contra-auditoria`; un solo push.

## 2-nov · Auditoría de reportes
Ver `REPARTO_AUDITORIA_REPORTES_2NOV.md`: contra-auditoría con datos de prueba + estrés del exportador.

## 3-nov · Instalar MarkItDown en tu máquina
`pip install "markitdown[all]"`; prueba `markitdown archivo.xlsx`. Úsalo para leer PDFs/Excel de reportes. Sin credenciales. Detalle: orden 114 en `RESPUESTA_CLAUDE_PC_27OCT.md`.

## Cola 7-nov (N1, orden de la dueña: «úsame a ChatGPT Nube, ChatGPT PC y Claude PC»)
1. Auditar contrato: leer `docs/venta/contrato/01..05` y `PUNTOS_PARA_ABOGADO.md`; verificar contra el código real cada afirmación (IA «no guarda consultas», respaldos, retención, permisos). Salida: `docs/venta/contrato/AUDITORIA_CONTRATO_7NOV.md` con cada desajuste y el texto corregido propuesto. No cambies precios.
2. Auditar la rama `claude-pc/ia-ventas-rescate` cuando exista (seguridad-20 + aislamiento por empresa + rechazo de inyección).
3. Auditar la rama `claude-pc/ia-medidor` (migración AiUsage, cálculo de costo, permisos de GET /ai/usage).
Reporta en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md`. Sin desplegar.

## Cola 7-nov (2) — N1 tras tu auditoría del contrato (gracias: buenas las 6 observaciones)
1. **Aplica tus textos corregidos** en `docs/venta/contrato/01..05` (rama nueva `chatgpt-nube/contrato-correcciones`, solo docs). Ojo con el punto 1: la IA de ventas **ya está en nexora-cloud y desplegada, pero APAGADA** (dda476be; se enciende con ANTHROPIC_API_KEY + IA_VENTAS_PLAN). Redáctalo como «función opcional, activa solo si la Hoja de contratación lo indica». Puntos 2–6 tal como los propusiste. En 3 (supresión) deja los plazos como PENDIENTE y di claramente que hoy es procedimiento manual.
2. Revisa `02_POLITICA_PRIVACIDAD.md` y `03_ACUERDO_ENCARGADO_TRATAMIENTO.md` contra `apps/api/src/retention.ts` y `drive-backup*.ts` y completa el calendario de rotación SOLO con lo que el código hace; lo que no, «COMPLETAR».
3. Audita el arreglo `claude-pc/flaky-password-telegram` ya mezclado en nexora-cloud (security.ts: updateMany/upsert en verifyAttempt): ¿abre algún hueco en el bloqueo por intentos fallidos (fuerza bruta)? Reporta en RESULTADOS_CHATGPT_NUBE.md.
Sin desplegar.

## Cola 7-nov (3) — N1: producto «Asistente analista» (lo que la dueña hace con Norexos 2, para sus clientes)
La dueña quiere vender la IA: lo que hace con Norexos 2 (investigación, cuadre, conteos, auditoría de cifras) como asistente del cliente. Parte de la IA de ventas ya desplegada (apagada) en apps/api/src/assistant.ts.
1. Escribe `docs/ia/ASISTENTE_ANALISTA_SPEC.md`: qué preguntas debe poder responder el cliente (cuadre de caja del día, diferencias, top productos, productos sin ventas, transferencias sin verificar, mercancía bajo mínimo, comparar periodos, explicar un reporte), qué herramientas de SOLO LECTURA faltan sobre las 5 actuales (resumen_ventas, top_productos, cobros, comparar_periodos, mis_ventas), por rol (dueña/gerente/cajera), y cómo aplicar la regla «leer 3 veces por caminos distintos antes de dar una cifra» (skill informe-triple) dentro de la respuesta.
2. Arma un conjunto de evaluación de 100 preguntas con respuesta esperada y cálculo (formato de docs/coordinacion/IA_EVAL_26OCT.md) incluyendo preguntas trampa (pedir PIN, otra sucursal, anular facturas, inyección).
3. Estima costo por pregunta con los precios de apps/api/src/ai-prices.ts y propone tope por plan que mantenga margen ≥ 15 %.
Sin código; sin desplegar. Reporta en RESULTADOS_CHATGPT_NUBE.md.

## Cola 9-nov (N1): auditar lo que entregaron los agentes
1. `claude-pc/asistente-analista` (cuando entregue SHA final): contra `docs/ia/ASISTENTE_ANALISTA_SPEC.md` y `ASISTENTE_ANALISTA_EVAL_100.md`: ¿las herramientas nuevas cubren la spec?, ¿respetan permisos por rol, aislamiento por sucursal y caja ciega?, ¿la regla de leer la cifra por dos caminos está aplicada?, ¿el costo por pregunta cuadra con `apps/api/src/ai-prices.ts` y los topes con margen ≥ 15 %? Corre el arnés de 100 preguntas sin llamar a Anthropic y reporta aciertos/fallos.
2. `claude-pc/diseno-impacto`: ¿rompe accesibilidad (contraste AA, `prefers-reduced-motion`, teclado)?, ¿toca el POS/caja (F2/F4/F8/F12) o lógica de negocio?, ¿rendimiento (tareas largas, CLS)? Revisa el video promocional: no debe mostrar datos reales de clientes ni de la tienda.
3. `claude-pc/marketing-ventas` y `claude-pc/canva-ventas` (docs): que ningún texto prometa funciones inexistentes, «hoy/disponible ya», factura fiscal, soporte en inglés o precios distintos a `docs/venta/PROPUESTA_PRECIOS.md` («Propuesta de introducción 7-nov»).
Reporta en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md`. Sin desplegar.

## Cola 9-nov (2) — N1, orden de la dueña: «¿qué nos falta para vencerla? y mejorar la calidad de todo el software»
Trabaja en una rama nueva `chatgpt-nube/calidad-9nov`, solo documentos y pruebas nuevas; **no cambies código de dinero** (ventas, caja, devoluciones, reportes) ni precios. Sin desplegar.
1. **Brecha contra la competencia** (`docs/venta/BRECHA_COMPETENCIA.md`): compara Nexora POS con 3–5 POS que se vendan en República Dominicana (cobro con NCF/e-CF, ITBIS, caja ciega, inventario, multi-sucursal, instalado vs nube, soporte en español, precio). Para cada fila: qué tiene ya Nexora (con la ruta del código o doc que lo prueba), qué le falta y cuánto costaría cerrarlo (horas/costo). Solo afirma lo que puedas probar en el repo o en páginas públicas, con enlace. Termina con las 5 brechas que más impiden vender y el orden que propones.
2. **Auditoría de calidad del código** (`docs/calidad/AUDITORIA_CALIDAD_9NOV.md`): recorre `apps/api/src`, `apps/web/src`, `packages/shared`. Lista por severidad: pruebas faltantes en rutas de dinero, archivos demasiado grandes, código duplicado, manejo de errores que devuelve 500 en vez de mensaje claro, textos sin traducir, accesibilidad (contraste AA, teclado, `prefers-reduced-motion`), rendimiento de pantallas con listas largas. Cada hallazgo con archivo:línea, riesgo y arreglo propuesto (sin aplicarlo si toca dinero).
3. **Arreglos seguros** (puedes aplicarlos en tu rama, cada uno con prueba): textos, accesibilidad, mensajes de error claros, documentación desactualizada. Un commit por tema. Corre `pnpm check` antes de empujar y reporta SHA con los 3 CI verdes.
Reporta en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md`.

## Cola 12-nov (N1, orden de la dueña): mejoras de uso e IA
Ver `ORDEN_CHATGPT_NUBE_MEJORAS_12NOV.md` (pieza 1 urgente: causa raíz de 4 pruebas de navegador que bloquean los despliegues) y `REPARTO_MEJORAS_12NOV.md`. Reporta en `RESULTADOS_CHATGPT_NUBE.md`.

## Revisión de Norexos 1 a tu pieza 3 (D12, `chatgpt-nube/ayuda-contenido-12nov`, `7f1cfb21`) — 12-nov
CI verde, pero **no se integra todavía**: la ayuda es lo que leerá la cajera, y encontré pasos sin respaldo en el código. Comprobé 4 de las 14 páginas contra la pantalla:
- `cajera/solicitar-anulacion`: correcta («Solicitar anulación», «Tipo de motivo», «Explica el motivo», «Guardar» salen del código).
- `gerente/procesar-devolucion` y `gerente/autorizar-con-pin`: coinciden con la pantalla (devolución con su propia caja abierta; PIN por descuento, nota de crédito, crédito y vale de caja).
- `cajera/vender-a-credito`: **dos afirmaciones sin respaldo.** (1) Paso 3 «Confirma el acuerdo con gerencia»: el sistema solo pide aprobación cuando se cumple una regla (umbral de crédito, descuento sobre el límite, etc.; `POS.tsx` 1939-1960); no siempre. (2) «no tramites crédito sin internet»: no existe esa regla en `POS.tsx`, `offlinePolicy.ts` ni `pendingSales.ts`. Quítalas o respáldalas con archivo:línea.
**Qué hacer** (rama la misma, un solo push):
1. Corrige `vender-a-credito` (pasos: elegir cliente con F4; «Cobrar» y «Crédito»; si el sistema pide aprobación, gerencia escribe su PIN; el crédito no es dinero cobrado).
2. Para las otras 10 páginas, agrega al informe una tabla página → paso → archivo:línea que lo respalda. Un paso que no puedas respaldar con una línea de código se borra o se marca `[FALTA DATO]`. Sin esa tabla no se integra.
3. Quita frases de relleno que no dicen qué hacer («Comprueba el resultado antes de retirarte del equipo»).
Avisa en `RESULTADOS_CHATGPT_NUBE.md` con el SHA y los 3 CI.


## Cola 13-nov (N1, orden de la dueña): consulta de mejoras e implementos
Lee y ejecuta `docs/coordinacion/CONSULTA_MEJORAS_CHATGPT_13NOV.md` como **ChatGPT nube**. Es una segunda opinión, solo lectura y documentos: tu lista a ciegas (Paso 1), tu evaluación del catálogo de 82 propuestas (rama `consulta/catalogo-13nov`; no lo traigas antes de subir el Paso 1), tus propuestas y tu síntesis. Rama `chatgpt-nube/consulta-mejoras-13nov`. No se construye ni se despliega nada. Avisa en `RESULTADOS_CHATGPT_NUBE.md`.
Tu revisión nocturna del 12-nov (guías, criterios C1/C2/C3/C10 y contrato) ya está integrada en `nexora-cloud`.

## Cola 13-nov (2) — N1: especificaciones de construcción de la primera tanda
Tu consulta ya está integrada. Ahora, para que cada mejora se construya sin vueltas, escribe una especificación por mejora. Rama `chatgpt-nube/espec-tanda1-13nov`, solo documentos (`docs/coordinacion/espec-tanda1/`), sin cambiar código ni desplegar. Reporta en `RESULTADOS_CHATGPT_NUBE.md`.
Norexos 1 construirá estas siete, en este orden: **DIS-01, EST-03, COM-08, COM-03, MOD-08, DIS-02, EFI-01**. Por cada una, una página con: (1) archivos y funciones que toca, con `archivo:línea` en el `origin/nexora-cloud` actual; (2) el cambio más pequeño que resuelve el problema; (3) la prueba nueva que debe fallar antes y pasar después, con su archivo y qué comprueba; (4) pruebas existentes que lean esos archivos como texto y puedan romperse (revisa `tests/` buscando el nombre del archivo); (5) casos límite; (6) cómo dar marcha atrás. Con palabras y pseudocódigo corto; sin parches ni código completo.
Después, tres piezas de diseño para lo que toca dinero, que **no se construye** sin confirmación de la dueña:
8. **EST-02** (una sola regla de promociones): plan de pruebas de paridad entre caja, cola sin conexión y servidor, con los casos que hoy podrían dar totales distintos.
9. **COM-04** (cantidad editable en el carrito): reglas de límites (existencia, descuento por línea, mayoreo) y qué hace con precio, promoción e ITBIS.
10. **COM-03** parte de aviso de margen bajo: confirma que respeta (precio − costo) / precio sin restar ITBIS y el mínimo de 15 %.
Termina con una tabla con el orden de construcción que recomiendas y las dependencias entre las diez.
