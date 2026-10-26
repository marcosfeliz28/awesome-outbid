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
