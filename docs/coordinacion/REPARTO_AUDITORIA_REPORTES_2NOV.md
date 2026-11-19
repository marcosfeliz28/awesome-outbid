# Reparto de la auditoría de reportes · ChatGPT PC, ChatGPT nube y Claude PC (2-nov, orden de la dueña)

Contexto y reglas: `docs/auditoria/reportes/PLAN_AUDITORIA_REPORTES_2NOV.md` (rama `claude-pc/plan-auditoria-reportes`). Los agentes Claude de la nube ya auditaron con datos reales (solo lectura); los hallazgos están en `docs/auditoria/reportes/HALLAZGOS-<grupo>.jsonl` en las ramas `claude-pc/aud-*` (y consolidadas en `claude-pc/aud-consolidado`). Ustedes **contra-auditan y construyen**. Nadie recibe credenciales de Render, base de datos ni producción. Un solo push por rama; informe corto de avance en `docs/auditoria/reportes/AVANCE-<su nombre>.md`.

## ChatGPT nube (datos de PRUEBA, PostgreSQL local)
1. **Contra-auditoría técnica:** para cada hallazgo Alto/Medio de `HALLAZGOS-dinero`, `-margen`, `-sincronia`, reprodúcelo con una base de prueba y llena `contra_audit` (confirma / discrepa / no reproducible) con evidencia.
2. **QA de la pantalla de exportación** (Playwright, base de prueba): botones «Descargar PDF/Excel» en cada uno de los 43 reportes, permisos (cajera sin `reports:read`, gerente sin `profit:read` en reportes con costo), límite de 20,000 filas, error amable.
3. **Prueba de estrés del exportador:** 20,000 filas en PDF y Excel (tiempo, memoria, archivo abre bien).
Rama: `chatgpt-nube/contra-auditoria`.

## ChatGPT PC (tu PC, puedes imprimir)
1. Termina `AUDITORIA_PUNTO1_2NOV.md` (orden anterior) y entrégala primero.
2. **Impresión real:** imprime (o simula impresión A4 y Carta, color y blanco/negro) el PDF de muestra para Genesis (`docs/auditoria/reportes/lenguaje/muestras/`) y 5 reportes más; revisa cortes, márgenes, gráficas legibles, letra mínima legible y total al final. Reporta con fotos/PNG.
3. **Lectura 18–70:** lee las guías reescritas (`apps/api/src/reportes/guia.ts`) como una persona de 18 y otra de 70 sin estudios contables; marca cada frase confusa con propuesta.
4. **Instalador sin internet:** sigue pendiente de que la dueña te dé su «sí» por escrito; sin ese «sí» NO pruebes.
Rama: `chatgpt-pc/auditoria-reportes`.

## Claude PC (laptop; la dueña presente, solo cuando ella reactive tu rutina)
Orden 113: abre la web en vivo (https://nexora-pos-web.onrender.com) con tu sesión, y con Playwright descarga PDF y Excel de 8 reportes clave (formas de pago, margen por producto, créditos por antigüedad, ventas por hora, valor de inventario, utilidad bruta por mes, devoluciones por producto, descuadres), toma capturas de la pantalla y del PDF y compara las cifras con la pantalla. Reporta diferencias en `docs/auditoria/reportes/AVANCE-claude-pc.md`. Mantén pendientes las órdenes 106–112 (incluye el plugin Codex, con ella presente). Nunca escribas credenciales en chats.
