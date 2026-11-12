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

## Cola 6-nov (Norexos 1 → ChatGPT PC) · entorno confirmado: Node, pnpm, PostgreSQL embebido, Graphify
Reglas fijas: solo código, CI y bases descartables; sin producción, Render, base de la tienda, credenciales ni secretos; sin desplegar ni mezclar en `nexora-cloud`; una rama tuya por pieza (`chatgpt-pc/<pieza>`); no debilites ni saltes pruebas; cita archivo:línea y di lo que NO pudiste comprobar. Reporta cada pieza en `docs/coordinacion/RESULTADOS_CHATGPT.md` (rama, SHA, comando exacto, resultado). Fraseo de arranque si hace falta: «lee ORDENES_CHATGPT_PC.md y sigue tu cola».
1. **Línea base completa con PostgreSQL embebido (tu ventaja: el contenedor de la nube no puede correr `initdb` como root y ahí fallan ~11 pruebas):** en `origin/nexora-cloud` corre la suite completa (`pnpm test` y las de integración con Postgres), anota qué pasa y qué falla, y repite en `claude-pc/movil-todo` y `claude-pc/landing-norexos-net`. Entrega una tabla rama → pasa/falla → prueba.
2. **Pruebas nuevas de GV, en base descartable:** `tests/gv-caja-api.test.ts`, `tests/gv-vigilante-api.test.ts` y `tests/gv-modulo-api.test.ts` en `nexora-cloud` (caja GV obligatoria, foto de voucher, cierre con 3 montos). Intenta romperlas con casos adversarios (doble apertura, pago sin caja, foto falsa con tipo engañoso, cierre sin foto de lote con tarjeta, día anterior abierto). Solo reporta lo que logres romper, con la prueba que lo demuestra.
3. **Contra-auditoría de `docs/auditoria/reportes/HALLAZGOS_TOTAL.jsonl` (37 hallazgos) y su `RESUMEN.md`:** por cada hallazgo, ¿se confirma en el código actual? ¿el arreglo declarado existe en el commit que dice? ¿hay una cifra de dinero mal sincronizada entre reportes? Salida: `docs/auditoria/reportes/CONTRA_AUDITORIA_CHATGPT_PC.md` con tabla id → confirmado / no confirmado / ya corregido / nuevo, y severidad propia.
4. **Auditoría A–Z (punto 1):** continúa `docs/coordinacion/ORDEN_CHATGPT_PC_AUDITORIA_PUNTO1_2NOV.md`; entrega `docs/auditoria/AUDITORIA_PUNTO1_2NOV.md` (aún no existe).
5. **Prueba intermitente `tests/e2e/privacidad-sesion.spec.ts:155` (G9):** córrela 30 veces con `--repeat-each` y con CPU cargada en `nexora-cloud`; guarda la tasa de fallo y el mensaje exacto. No la arregles: un agente en la rama `claude-pc/flaky-g9` ya busca la causa; compara después con su arreglo.

## Cola 7-nov (N1)
1. Instalador de venta: bajar el `.exe` del CI `windows-installer` en verde del head de nexora-cloud y probarlo en Windows 11 limpio: instalar, abrir, crear dueña, vender, cerrar caja, respaldo, desinstalar/actualizar. Evidencia en `docs/validacion/instalador-7nov.md` (pasos, capturas, fallos).
2. Revisar `docs/INSTALADOR.md` contra lo que de verdad pasa; corregir lo que no coincide (solo docs).
3. Lista de lo que falta para vender el instalador (firma de código, aviso de SmartScreen, manual de 1 página).
Sin desplegar ni tocar Render.

## Cola 7-nov (2) — N1
Además de la Cola 7-nov (instalador en Windows 11 limpio, evidencia en docs/validacion/instalador-7nov.md):
1. Con el instalador ya probado, simula una **actualización** (instalar versión N y luego N+1) y un **rollback**: ¿se conservan base, usuarios y respaldos?
2. Prueba el **respaldo local** diario y la **restauración** en una laptop limpia (el contrato promete respaldo; hay que demostrarlo).
3. Anota cuánto pesa el instalador y cuánto tarda la primera instalación; son datos para el manual de venta.
Reporta en el mismo archivo. Sin desplegar ni tocar Render.

## Cola 7-nov (3) — N1: salir a vender (punto 7)
Después de la prueba del instalador:
1. **Landing:** revisar `apps/landing` contra `docs/venta/PROPUESTA_PRECIOS.md` («Propuesta de introducción 7-nov») y `docs/venta/PUBLICAR_LANDING_NOREXOS_NET.md`; dejar lista una versión con los precios nuevos (rama `chatgpt-pc/landing-precios`, sin publicar). Español primero.
2. **Manual de 1 página** para el cliente nuevo (instalar, entrar, vender, cerrar caja, respaldo) con capturas; `docs/venta/MANUAL_1_PAGINA.md`.
3. **Mensajes de soporte por WhatsApp** (plantillas: bienvenida, no puedo entrar, cierre de caja no cuadra, cómo restaurar respaldo, cómo activar la IA) en `docs/venta/WHATSAPP_PLANTILLAS.md`.
4. **Guion de demo de 10 minutos** (`docs/venta/DEMO_10_MIN.md`) con datos demo; qué mostrar y en qué orden.
5. Lista de lo que la dueña debe decidir o comprar (dominio, correo de soporte, número de WhatsApp Business, certificado de firma de código) con costo aproximado de cada uno.
Sin desplegar ni publicar.

### Punto 2 (instalador): paso previo, aclaración de N1 (7-nov)
El CI NO publica el `.exe` (solo prueba). Hay que compilarlo en Windows 11: `git pull` de nexora-cloud, `pnpm install`, `pnpm instalador:compilar` → `instalador/dist/Nexora-POS-Setup-<versión>.exe`. Anota la versión, el tamaño y el SHA-256 (`Get-FileHash`) en docs/validacion/instalador-7nov.md y prueba ESE archivo en una máquina limpia (o máquina virtual). Si falta algo para compilar (herramienta, certificado), lista exactamente qué.

## Cola 9-nov (2) — N1, orden de la dueña: mejorar la calidad de todo el software (tu parte: Windows real)
Rama `chatgpt-pc/calidad-9nov`; sin desplegar y sin tocar la base de la tienda. Al terminar cada prueba **cierra los navegadores y procesos que abriste** (playwright, node, postgres de prueba): la PC de la dueña se quedó sin RAM por procesos que quedaron abiertos.
1. **Instalador de punta a punta** en Windows 11 limpio o máquina virtual: compilar (`pnpm instalador:compilar`), instalar, entrar, vender, cerrar caja, hacer respaldo y restaurarlo, actualizar a una versión nueva y volver atrás. Registra versión, tamaño y SHA-256 en `docs/validacion/instalador-9nov.md`, con capturas y la lista exacta de lo que falló.
2. **Recorrido de pantallas** a 1366 px y 390 px (teléfono) de cajera, gerente y dueña: lo que se vea cortado, lento, sin traducir o confuso, con captura. Mide la carga de las 5 pantallas más usadas. `docs/validacion/RECORRIDO_PANTALLAS_9NOV.md`.
3. **Prueba de uso real sin conexión**: vender sin internet, volver a conectar y comprobar que no se duplica ni se pierde ninguna venta. Resultado en el mismo documento.
Todo lo que encuentres va como lista priorizada; no arregles nada de dinero tú mismo.

## Cola 12-nov (N1, orden de la dueña): mejoras de uso e IA
Ver `ORDEN_CHATGPT_PC_MEJORAS_12NOV.md` (pieza 1: línea base de pantallas antes de las mejoras) y `REPARTO_MEJORAS_12NOV.md`. Reporta en `RESULTADOS_CHATGPT.md`. Cierra los navegadores y procesos que abras al terminar cada prueba.

## Cola 12-nov (2) — N1: instalación limpia y comprobación de C6/C15
Rama `chatgpt-pc/instalacion-limpia-12nov`; sin desplegar, sin Render, sin gastar. Cierra navegadores y procesos al terminar cada prueba.
1. **Instalación gráfica limpia en Windows 10 u 11 sin Node ni el repositorio** (VM o PC limpia): instalar el `.exe` del CI de `nexora-cloud` (HEAD actual), entrar, vender, cerrar caja, hacer respaldo y restaurarlo. Anota versión, tamaño, SHA-256, tiempos y si Windows avisó de «editor desconocido» (firma). Esto NO se sustituye con el smoke de GitHub.
2. **C6:** solicita una anulación como cajera con pago en efectivo; debe decir «Efectivo», no `cash`. Captura.
3. **C15:** con existencia 1, intenta aumentar a 2; el aviso debe decir producto y cuántas quedan. Captura.
4. C14 sigue bloqueada sin webcam física: no la repitas.
5. La revisión D12 local queda sin publicar hasta que Marcos autorice.
Reporta en `RESULTADOS_CHATGPT.md`.
