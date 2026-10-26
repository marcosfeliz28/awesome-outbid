# Cola 2 del 26-oct-2026: más trabajo para ChatGPT nube y Claude PC

GV y el producto ya están en vivo. Todo se entrega con push a la rama de cada quien, sin desplegar. Claude nube lee las ramas cada 30 minutos.

## ChatGPT nube — rama `chatgpt-nube/cola2-26oct`, un archivo por tarea en `docs/coordinacion/chatgpt-nube-cola2/`

1. **N1 · Pruebas inestables (puedes tocar solo archivos de pruebas):** arregla `tests/pago-dolares-api` caso (h) «La venta offline no corresponde al horario de esta caja» (carrera de milisegundos entre abrir la caja y `capturedAt`) y la prueba de purga de `telegram` («Tiempo agotado esperando: aviso pendiente enviado»). Cada arreglo debe quitar la fragilidad, no aflojar la comprobación. Rama aparte `chatgpt-nube/pruebas-estables`, sacada de `nexora-cloud`.
2. **N2 · IA, los fallos de la evaluación en vivo:** la evaluación contra `aud-ia` dio 101 de 114 correctas hasta la mitad (resultados finales en el siguiente aviso de Claude nube). Cuando exista `docs/coordinacion/IA_EVAL_26OCT.md`, léelo y propone, sin implementar, la corrección de cada incorrecta o «por revisar» (herramienta del asistente, texto del sistema o datos).
3. **N3 · Anular con caja abierta:** audita el arreglo (`origin/nexora-cloud`, `voidSaleTx` en `apps/api/src/sales.ts`) y busca otros caminos que dejen el efectivo esperado negativo: devolución en efectivo, gasto, vale, traslado, reapertura, anulación por solicitud aprobada.
4. **N4 · Contenido de ayuda del producto:** escribe en español sencillo, para el celular, el contenido del botón «Ayuda» y 15 preguntas frecuentes de una dueña nueva (primera venta, abrir y cerrar caja, agregar productos, cajeras, NCF opcional, crédito, qué es el PIN y qué es la contraseña, a quién escribir). Ruta: `docs/producto/AYUDA_CLIENTES.md`.
5. **N5 · Acuerdo del piloto:** revisa `docs/piloto/ACUERDO_PILOTO.md` y `FORMULARIO_OPINION_PILOTO.md` contra lo que el sistema ya hace hoy (invitación con consentimiento, paquetes de IA, cobro manual, soporte de solo lectura) y lista lo que falta o no coincide, para llevárselo al abogado.
6. **N6 · Almacenamiento de archivos del producto:** plan sin implementar para pasar fotos y comprobantes de la base a un depósito externo (Cloudflare R2): variables, migración de lo que ya existe, respaldo y cómo probar que nada se pierde.

## Claude PC — rama `claude-pc/cola2-26oct`

1. **C1 · Termina la fase 3** (verify en verde). Sigue sin desplegar.
2. **C2 · Prueba como persona real el producto en vivo** (`https://nexorapos.net`, empresa `aud-caja`; nunca la tienda real): con el navegador de la PC, a 1366 y a 390 px, haz una empresa nueva por el inicio en 2 pantallas (con una invitación de prueba que te dará Claude nube si hace falta; si no, usa `aud-caja`), la primera venta, «Preguntas» y la encuesta, el tablero en «Hoy», y entra como cajera para confirmar que no ve ningún importe de su caja abierta (caja ciega). Cada fallo con captura, gravedad y cómo repetirlo en `docs/coordinacion/PRUEBA_VIVO_PRODUCTO_CLAUDE_PC.md`.
3. **C3 · Auditar PC-23 y PC-24** cuando ChatGPT PC los suba (cobro manual y paquetes de IA).
4. **C4 · Parche de Rust de PC-16** (`PC16_PENDIENTES_RUST.md`), en tu rama, sin instalar nada en la laptop.

## ChatGPT PC — rama `chatgpt-pc/cola2-26oct` (la laptop es suya para instalar; PC-18 y PC-22 siguen aplazados hasta que la dueña lo diga)

1. **P1 · Pruebas de navegador de GV (solo archivos nuevos):** en `chatgpt-pc/e2e-gv`, sacada de `origin/nexora-cloud`, escribe `tests/e2e/gv-clary.spec.ts` (y los apoyos que necesites en un archivo nuevo) con el flujo que ya probaste a mano: usuaria con rol `gv`, curso, 3 inscritas, separo y restante con banco y referencia, verificar y rechazar una transferencia, pendiente, asistencia y set de brochas, citas e interesadas, y comprobar que esa usuaria no ve Caja, costos, Configuración ni Reportes de Macgen; a 1366 y a 390 px. Debe correr en el CI (`playwright`) sin depender de datos reales. No toques los archivos existentes de pruebas.
2. **P2 · Guía de Clary con capturas reales:** reemplaza el texto de `docs/gv/GUIA_CLARY.md` (rama `claude/guia-clary`, léela primero) por una versión con una captura por paso, tomada en tu base local con datos ficticios. Sin datos reales de clientas. Entrega en `chatgpt-pc/guia-clary`.
3. **P3 · Manual corto para las cajeras de la tienda:** una página con capturas del botón «Preguntas» y de la encuesta de la caja (rama `claude/producto-mezcla-4`, funciones «Mis ventas de hoy» y «Preguntas»), y cómo contestar las 30 preguntas. En español sencillo, para el celular. Ruta: `docs/MANUAL-CAJERA-PREGUNTAS.md`.
4. **P4 · Ticket y cuadre en la térmica:** con la impresora de la laptop, si la hay conectada, imprime el cierre de caja de prueba y un ticket de venta con NCF a 80 mm y a 58 mm, y anota cualquier corte o desborde en `docs/coordinacion/PRUEBA_IMPRESION_26OCT.md`. Si no hay impresora, dilo.

## ChatGPT PC — cola 3 (para empezar ya; entrega en `chatgpt-pc/cola3-26oct`)

La dueña autorizó que ChatGPT PC use la laptop para instalar y probar (PC-18 y PC-22 dejan de estar aplazados). Nada de esto espera a Claude nube; si algo te bloquea, escribe BLOQUEADO y la causa en el tablero y sigue con la siguiente.

1. **Q1 · Instalador de Windows (PC-18 y PC-22), ya.** La laptop está limpia. Construye el instalador NSIS de la versión local del producto (`Nexora POS Local`, el que aísla del sistema de tienda), instálalo, pruébalo (arranque, primer inicio, venta de prueba, respaldo, desinstalar) y deja el documento «Listo para vender» con lo que pasó, con capturas y los registros del instalador. Sin tocar Render ni la tienda real.
2. **Q2 · Guía de inicio de una dueña nueva (material para vender):** con la versión del producto `origin/producto-nexora` (8ae06d8d) en tu base local, haz el inicio en 2 pantallas, la primera venta, el cierre de caja y el tablero «Hoy», con una captura por paso a 390 px y a 1366 px y textos en español sencillo. Ruta: `docs/producto/GUIA_INICIO_5_MINUTOS.md`. Datos ficticios.
3. **Q3 · Prueba de la tienda con lo nuevo (en tu base local, no en la real):** con `origin/nexora-cloud` (27ee0c3f), comprueba como cajera el botón «Preguntas», la encuesta, «Mis ventas de hoy» y que con su caja abierta no ve ningún importe (ni total, ni por forma de pago, ni transferencias pendientes), y que sí los ve después de cerrar. A 390 px. Cada fallo con captura y gravedad en `docs/coordinacion/PRUEBA_PREGUNTAS_TIENDA.md`.
4. **Q4 · Plantilla de importación de productos para el producto:** una hoja de Excel de ejemplo con las columnas que acepta el importador de `origin/producto-nexora` (nombre, código, precio, costo, existencia, categoría, lote y vencimiento donde aplique), con 10 filas ficticias y una pestaña de «cómo se llena». Pruébala importándola en tu base local. Ruta: `docs/plantillas/productos-ejemplo.xlsx`.
5. **Q5 · Impresión:** cuando conecten una térmica a la laptop, repetir `PRUEBA_IMPRESION_26OCT.md`. Mientras tanto, imprime a PDF el cierre de caja y el ticket a 80 mm y a 58 mm y revisa que no se corte nada.
