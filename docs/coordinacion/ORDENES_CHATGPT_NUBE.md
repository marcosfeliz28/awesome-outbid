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
