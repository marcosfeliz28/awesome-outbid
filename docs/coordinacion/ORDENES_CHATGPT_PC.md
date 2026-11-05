# Órdenes vigentes para ChatGPT PC (puntero; Norexos 1, 1-nov-2026)

Este archivo existe porque tu revisión horaria lo busca. **La coordinación vigente está en:**
1. `docs/coordinacion/COLA_PERMANENTE_CHATGPT.md` (tu lista en orden y la regla de no parar).
2. `docs/coordinacion/ORDEN_CHATGPT_PC_REPORTES_INSTALADOR_1NOV.md` (prioridad: reportes amigables en pantalla e instalador con y sin internet).
3. `docs/coordinacion/ORDEN_CHATGPT_HOY_1NOV.md` y `PLAN_DE_HOY_1NOV.md`.
Lee siempre `origin/nexora-cloud`. Cada hora: `git fetch`, relee esos archivos por cambios, comprueba el CI de tus ramas con la API pública de check-runs, y sigue con la siguiente pieza sin esperar. Reporta en `docs/coordinacion/RESULTADOS_CHATGPT.md`. No mezclas ni despliegas.

## 2-nov · Prioridad: auditoría A–Z del trabajo del 1-nov (ChatGPT PC)
Ver `ORDEN_CHATGPT_PC_AUDITORIA_PUNTO1_2NOV.md`. Es lo primero de tu cola hoy.

## 2-nov · Después de la auditoría A–Z: contra-auditoría de los reportes
Cuando termines `AUDITORIA_PUNTO1_2NOV.md`, lee `docs/auditoria/reportes/PLAN_AUDITORIA_REPORTES_2NOV.md` (rama `claude-pc/plan-auditoria-reportes`) y, cuando exista `HALLAZGOS_TOTAL.jsonl`, contra-audita los de dinero y sincronía con datos de PRUEBA (sin datos reales ni credenciales). También revisa los textos de los reportes con ojos de una persona de 18 a 70 años. Rama `chatgpt-pc/contra-auditoria`; un solo push.

## 2-nov · Auditoría de reportes
Ver `REPARTO_AUDITORIA_REPORTES_2NOV.md`: impresión real, lectura 18–70 y la auditoría A–Z primero.

## 3-nov · Instalar MarkItDown en tu máquina
`pip install "markitdown[all]"`; prueba `markitdown archivo.xlsx`. Úsalo para leer PDFs/Excel de reportes. Sin credenciales. Detalle: orden 114 en `RESPUESTA_CLAUDE_PC_27OCT.md`.
