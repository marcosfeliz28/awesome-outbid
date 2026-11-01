# Cola permanente de ChatGPT (nube y PC) — regla de no parar (1-nov-2026, Norexos 1)

La dueña se ausenta. **Nunca te quedes sin trabajo ni esperando una respuesta mía para empezar la siguiente pieza.** Mezclar y desplegar sigue siendo solo de Norexos 1; todo lo demás sigue sin esperar.

## Cómo trabajas en bucle
1. `git fetch`; lee este archivo, `ORDEN_CHATGPT_HOY_1NOV.md` y `PLAN_DE_HOY_1NOV.md`. Consulta el mapa (`docs/sistema/mapa/INSTRUCTIVO_SESIONES.md`).
2. Toma la primera pieza no terminada de tu lista. Una a la vez, una rama por pieza, prueba que falle antes y pase después, 3 CI verdes del último SHA.
3. Al terminar o bloquearte: entrada corta en `RESULTADOS_CHATGPT.md` (qué hiciste, rama, SHA, 3 CI, qué falta, qué decide la dueña) y **pasa a la siguiente sin esperar**. Una pieza bloqueada por una decisión de la dueña o mía se anota como BLOQUEADA y sigues con otra.
4. Cada hora: `git fetch` y relee `origin/nexora-cloud` por órdenes nuevas de Norexos 1 (archivos `ORDEN_*` y `PLAN_DE_*` con fecha más reciente) y por cambios en el mapa.
5. **Reposición:** si te quedan menos de 3 piezas, añade al final de tu lista las siguientes que veas necesarias (deuda del rediseño, accesibilidad a 320/390 px, rendimiento, pruebas que faltan) y avisa en `RESULTADOS_CHATGPT.md`.

## ChatGPT nube — lista en orden
1. Segunda opinión del CI (`chatgpt-nube/ci-fecha-1nov`): la causa quedó acotada a que el informe del año y el desglose restan devoluciones con fechas distintas; la dueña aprobó unificarlas por fecha de la venta (opción A) y otra sesión lo implementa en `claude-pc/fix-ci-mes`. Tu parte: revisar ese diff cuando exista y reportar hallazgos (archivo:línea); no empujes a esa rama.
2. `qa-medios-1nov` (terminar y 3 CI verdes). 3. CI de `lumina-adentro-b`. 4. `f1-01-bundle`.
5. Auditoría de los últimos 7 días de Norexos 1 (solo lectura): `docs/auditoria/AUDITORIA_CHATGPT_A_N1_<fecha>.md`.
6. Pantallas pendientes del diseño interior: Reportes, Configuración, Mercancía/Equipos, Asistente.
7. `ventas-ciego` preparada sin mezclar.
8. **Reportes amigables, pieza D** (`ORDEN_REPORTES_AMIGABLES_1NOV.md`): maqueta visual del informe imprimible (portada, recuadro «De qué trata», gráficas, tablas) en `docs/diseno/informes/`, versión clara para imprimir. Prioridad ALTA (pedido de la dueña, 1-nov).
9+. Reposición.

## ChatGPT PC — lista en orden
**PRIORIDAD (1-nov, dueña): `ORDEN_CHATGPT_PC_REPORTES_INSTALADOR_1NOV.md` completo (bloques 1 y 2, piezas 1 a 11) va ANTES de lo demás; luego lo de abajo.**
1. Animación futurista y dura (`chatgpt-pc/animacion-futurista`): login y Tablero «Hoy» primero; después Reportes, Configuración, Asistente y la pantalla de cierre de caja (solo al terminar). Nada de movimiento en la caja durante el cobro; apagable (reducción de movimiento y control «Efectos»); 60 fps; capturas a 390 y 1366 px.
2. Imágenes y activos de marca. 3. PC-16 (Rust). 4. **Prueba real del instalador SIN internet** (`ORDEN_INSTALADOR_SIN_INTERNET_1NOV.md`, parte 2) cuando la dueña dé el «sí» en la laptop; usa el plan que deje el agente de auditoría en `docs/auditoria/INSTALADOR_SIN_INTERNET_1NOV.md`. 5. **Reportes amigables, pieza C:** botones «PDF» y «Excel» en cada reporte (`Management.tsx`, `FormalReports.tsx`, `MonthReport.tsx`) con vista previa de «De qué trata», 390 px, accesible; rama `chatgpt-pc/reportes-botones`. Diseña la maqueta ya; conecta al endpoint `/reports/:id/export` cuando la pieza A (rama `claude-pc/reportes-export`) lo tenga. Prioridad ALTA.
6+. Reposición.

## Límites que no cambian
Sin credenciales; sin tocar Render ni la base de la tienda; sin cambiar flujos, teclas F2/F4/F8/F12, permisos, caja, pagos, NCF ni API de dinero; sin bloquear ventas por margen; no debilitar pruebas; no relajar contraste ni accesibilidad.
