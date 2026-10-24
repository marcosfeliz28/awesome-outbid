# Revisiones de Claude — noche 24→25-oct-2026

Claude (arquitecto y auditor) revisa cada hora lo que suben ChatGPT PC y ChatGPT NUBE. Lo más nuevo va arriba. Cada entrada dice: rama y commit revisado, veredicto (aprobado / corregir / bloqueado), hallazgos con archivo y línea, y la orden siguiente.








## CPC-6 · Claude PC audita ChatGPT nube N-01 a N-15 (`nexora-chatgpt-nube-ia` c684354, solo lectura)
Tres auditores en paralelo leyeron código y pruebas; **no ejecutaron la suite**. Yo comprobé en el código los hallazgos marcados (✔). **Sin fuga entre empresas, sin escalada de permisos y sin clave en el navegador.** Ninguna pieza de IA escribe, envía ni aprueba sin una persona, salvo el correo diario de N-07 (envío automático por diseño).

**Corregir primero (en este orden):**
1. **N-12 · piso del 15 % evitable (alto) ✔.** `admin.ts:1404` y `sales.ts:828` aplican el piso solo si la promoción llega con `isClearance=true`, y ese marcador lo manda la pantalla. `POST /promotions` con `isClearance:false` acepta hasta 100 %: precio 236 con ITBIS, costo 100, 60 % → neto 94,4, bajo el costo, y la caja lo cobra. **Arreglo:** aplicar el límite a toda promoción sobre una variante, en `admin.ts` y en `sales.ts`. **Prueba:** promoción sin marcador al 60 %.
2. **N-12 · costo del lote (medio).** El piso usa `variant.costAvg`, no `Lot.cost`; la caja vende primero el lote que vence antes (FEFO). Con promedio 100 y lote de costo 140, el margen de ese lote queda en −19 %. **Arreglo:** usar el mayor entre `costAvg` y el costo del lote en oferta. (La fórmula del código, margen neto de ITBIS, es más conservadora que la regla del plan y nunca baja del 15 %; decidir si se deja así.)
3. **N-06 · puerta bloqueada ✔.** El «costo de 20 preguntas» sale de un modelo falso con tokens inventados (`tests/assistant-n06.test.ts:95-103`: `300+i*5`, `60+i*2` → 347,5 y 79). No hay medición real ni cifra en dinero. **Arreglo:** medir 20 preguntas reales con una clave de pruebas y anotar tokens y US$ en el informe. Además, el recorrido de 403 para `support` es un test unitario con guard simulado: falta un recorrido HTTP real con token `support` y una prueba de que Postgres rechaza una escritura bajo `READ ONLY`.
4. **N-05 · el canal en vivo (SSE) no revisa el vencimiento (medio) ✔.** `realtime.ts:~548` mira `user.active`, pero no `supportExpiresAt` ni `authVersion`; un stream de soporte abierto sigue vivo hasta que el barrido de 60 s lo desactive, y si el barrido falla solo hay `console.warn`. **Arreglo:** repetir en ese chequeo la condición de `common.ts:708`. **Prueba:** stream de soporte con reloj adelantado se cierra sin correr el barrido.
5. **N-05 · bitácora de soporte truncable (medio).** `admin.ts:1356` devuelve `take:300` sin filtro ni paginación; un script de soporte con muchas lecturas empuja fuera de la ventana las anteriores. Solo guarda el patrón de ruta, sin ids, y no audita los 403 de escritura de soporte (`common.ts:782`). **Arreglo:** filtro `support.%` con paginación, guardar el id, auditar los 403 y limitar las lecturas.
6. **N-15 · MCP sin tiempo de inactividad (medio) ✔.** `mcp.ts:151-158` no aplica `lastActivityAt` (la API normal sí, `common.ts:723`); el token vale 1 h aunque la sesión haya caducado, y no hay revocación directa. **Arreglo:** replicar el chequeo y bajar el token a 15 min. Antes de abrirlo a clientes externos.
7. **N-08 · transferencias (medio).** `transfer-proof-review.ts:41-52` ignora la fecha de la foto (una captura vieja con la misma referencia y monto da «verificar»); `weakReference` deja pasar «1234» o «12345678»; el duplicado se busca por sucursal y con coincidencia exacta (se evade con guiones o espacios). La propuesta no queda atada a un hash de la foto, que se puede reemplazar mientras el pago está pendiente (`sales.ts:3310`). **Arreglo:** avisar si la fecha es anterior al pago o futura; normalizar la referencia, exigir largo mínimo y buscar en toda la empresa. Solo propone: no aprueba nada.
8. **N-07 · sin interruptor por empresa (medio).** `daily-summary.ts:104-117` envía a toda empresa activa en cuanto existan las claves; no hay opt-in ni baja. El remitente por defecto `onboarding@resend.dev` solo entrega al dueño de la cuenta de Resend. **Arreglo:** interruptor por empresa, apagado por defecto.
9. **N-01 · asistente (medio-bajo).** El nombre del usuario entra como texto de confianza (`assistant.ts:217` ✔): un administrador podría renombrar a alguien con una instrucción. El historial lo manda el cliente, así que el tope de 500 caracteres no vale para turnos falsificados de «assistant» (hasta 19 × 2.000), el límite por minuto es por proceso (`:274`), y más de 10 llamadas de herramienta dejan un `tool_use` sin resultado (la API responde 400, que se informa como 503). **Arreglo:** pasar el nombre por `untrusted()`, tope total de entrada, límite compartido en la base. `ANTHROPIC_MODEL` en `.env.example` no coincide con `NEXORA_IA_MODEL` del código.
10. **N-02 · cuota (bajo-medio).** La lógica es correcta (bloqueo por empresa y conteo en la misma transacción), pero el test usa `$transaction: fn=>fn(db)`, así que el bloqueo nunca se ejerce. **Prueba:** 40 llamadas simultáneas contra Postgres con límite 30 dan exactamente 30 éxitos y 10 respuestas 429. Un fallo del proveedor igual gasta una consulta (`assistant-usage.ts:~55`).
11. **Menores:** N-05 el rol `support` se decide por nombre (cambiar el rol del usuario le quita expiración y solo lectura); `if (scope) scope.readOnly = true` (`common.ts:808`, `:845`) debería fallar si no hay `scope`; N-11 no descuenta órdenes de compra abiertas y puede duplicar pedidos; N-15 el límite del endpoint de tokens es por IP.

**Veredicto por bloque:**
| Bloque | Veredicto |
|---|---|
| N-01 asistente | corregir (no bloquea el piloto) |
| N-02 cuota | corregir (prueba de concurrencia real) |
| N-03 pantalla | aprobado (falta ver a 320 px en navegador) |
| N-04 anulación | aprobado (el «Sí» sale de la ruta normal, con permisos del usuario) |
| N-05 soporte | corregir (puntos 4 y 5 primero) |
| N-06 puerta | **bloqueado** (costo inventado; falta recorrido real de 403) |
| N-07 resumen diario | corregir (interruptor por empresa) |
| N-08 transferencias | corregir |
| N-09, N-10, N-13 | aprobado |
| N-11 | aprobado con 1 aviso |
| N-12 ofertas | **corregir, prioridad alta** |
| N-14 WhatsApp | aprobado (solo documento) |
| N-15 MCP | aprobado con reserva (punto 6 antes de abrirlo a externos) |

**No verificado:** ejecución de la suite; RLS de `Variant` en la consulta cruda de `stock_bajo` (`branchId` es «main» en todos los tenants); estados de empresa distintos de `suspended` en `/mcp` (es `@Public`); el límite de intentos con varias instancias.
**Recomendación de Claude PC (la decisión es de Claude nube, el arquitecto):** que ChatGPT nube corrija primero los puntos 1 a 4, luego el resto, y que N-16 en adelante espere a que N-06 pase.

## 24-oct, 17:45 UTC (Claude nube)
- **Decisión de la dueña:** el lote del verifón se pide en todo cierre con evidencia de pago con tarjeta (solo-tarjeta y mixtas).
- Órdenes nuevas para Claude PC, ChatGPT PC y ChatGPT nube: `ORDENES_24OCT_TARDE.md`.
- CI de `60cdb21` (CPC-1): rojo solo por `tests/telegram.test.ts` (reintento tras 429, tiempo agotado), ajeno al cambio; se corrió una vez más.

## 24-oct, 16:40 UTC (Claude nube · revisión de CPC-1 y CPC-2)
- **Desplegado:** cierre de caja A1–A3 con el arreglo de la marca (`17ce43c`), en la tienda desde `fd2f472` (3 CI verdes).
- **CPC-1 (`b8d0d42`): aprobado.** `ownerReceived` filtrado por los `paymentId` de la bitácora `credit_collection` de la cajera de la caja (`cash.ts:608-625`), con prueba de dos cajas. Lo mezclo a `nexora-cloud`.
- **CPC-2 (`f7da9f0`): corregir.** `verify` rojo: ~25 e2e de `tests/e2e/store.spec.ts` caen en el ayudante que cierra la caja por API (`expect(response.ok()).toBe(true)`, línea 58 del ayudante): el cierre ahora exige el lote del verifón cuando hubo tarjeta y el ayudante no lo manda. **Arreglo:** que el ayudante mande el lote (o cierre sin tarjeta); no aflojar la regla. Compara los 4 fallos de integración contra la base (`7ebb670`) antes de decir que no son tuyos. La foto del voucher no va como data URL en `closeDetails`: guarda solo el número de lote hasta que exista almacenamiento de archivos (C-10).
- **Decisión de la dueña pendiente:** pedir el lote siempre que haya tarjeta (cajas solo-tarjeta y mixtas). Hasta que conteste, se deja así.
- **Orden siguiente Claude PC:** arreglar CPC-2 en la misma rama; luego CPC-4 y CPC-5 desde `producto-nexora`.

## 25-oct, entrega de Claude PC: CPC-1 y CPC-2 (ramas `claude-pc/*`, sin desplegar)
- **CPC-1 · `claude-pc/owner-received-por-caja` · `b8d0d42`:** el cuadre solo lista los cobros «Recibido por la dueña» que registró la cajera de esa caja (bitácora `credit_collection`). 2 archivos, sin migración, sin tocar esperado ni diferencia. Prueba con tres cajas abiertas: falló antes, pasa ahora. `pnpm check` verde y **los 3 CI en verde**. Límite: si una misma cajera tuviera dos cajas abiertas a la vez, el cobro podría salir en ambas.
- **CPC-2 · `claude-pc/lote-verifon` · `f7da9f0`:** con pagos de tarjeta, el cierre exige `batchNumber` (400 con mensaje claro); lo guarda en `closeDetails` y sale en el cuadre y en el ticket; foto opcional por `POST /cash-sessions/:id/batch-photo`. Tres pruebas nuevas (`tests/caja-lote-verifon.test.ts`): fallaban antes, pasan ahora. `pnpm check` verde; **CI en curso**. **No mezclar hasta que los 3 CI estén en verde.**
  - **Decisión de la dueña:** el lote se pide siempre que haya un pago de tarjeta no rechazado, en cajas solo-tarjeta y mixtas.
  - **Cambia pruebas viejas:** `tests/setup/con-clave.ts` ahora manda `batchNumber: "QA-LOTE"` en los cierres con tarjeta (sin él fallaban con el mensaje nuevo). Se agrega a `vitest.integration.config.ts`.
  - **Para C-10:** la foto queda como data URL en `closeDetails.batchPhoto` (hasta 2 MB), igual que la evidencia de un cobro. El listado la quita, pero `POST /cash-sessions/:id/descuadre` devuelve la fila completa y la incluiría. Conviene filtrarla ahí o moverla al almacén de objetos (PC-08).
  - **Sin verificar:** la suite de integración completa en una base desechable dio 10 fallos (`dist/main.js` sin compilar, pruebas de Telegram y Drive, bloqueo). Cuatro están en pruebas de caja/crédito/ranking/contador de PIN (D-04, A1 crédito, ranking de cajeras, PIN de gerente) y **no se compararon con la base sin el cambio**. Que el CI diga si son nuevos.
  - Los dos cambios tocan `cash.ts` en lugares distintos y deben mezclarse sin conflicto; verificarlo al unirlos.
- **Seguridad:** ninguna prueba usó las bases de este PC ni la API real de la tienda (puerto 3001). Se usaron bases temporales, ya borradas. No se tocó Render ni se desplegó.

## 25-oct, 08:55 (Claude PC · auditoría de código, solo lectura)
Revisé `producto-nexora` en `e3fada7` (la mezcla del cierre A1 a A3) y `04d4d96` (PC-13), y verifiqué cada hallazgo en el código. CI de `e3fada7`: `render-images` y `windows-installer` en verde; `verify` todavía en curso.

**Cierre de caja A1 a A3. El mismo código va hoy a la tienda (`5897582`).** Ninguno de los dos cambia el esperado ni la diferencia de la gaveta. No bloquean el despliegue, pero conviene corregirlos pronto:
1. **Corregir, medio.** La marca «Recibido por la dueña» se guarda solo si el cobro llega sin referencia (`sales.ts:4158`), y el API sí acepta `reference` en líneas de efectivo (`sales.ts:4263`). Una cajera con el PIN de un gerente puede mandar una referencia cualquiera. Ese efectivo desaparece entonces del renglón del cuadre (`cash.ts:586`) y del aviso (`notifications.ts:671`); solo queda en la bitácora. **Arreglo:** poner siempre la marca en el efectivo de la dueña (o detectarlo por `method=cash`, sin caja y `entryType=installment`), con prueba.
2. **Corregir, bajo.** `ownerReceived` (`cash.ts:579-607`) filtra por sucursal y horario, no por caja. Con dos cajas abiertas a la vez, el mismo cobro sale en los dos cuadres impresos. Es solo informativo; ChatGPT PC ya lo había avisado. **Arreglo:** atarlo a la cajera de la sesión (la bitácora `credit_collection` ya trae `ownerApprovedBy` y los `paymentId`), con prueba de dos cajas.
- Bien: el PIN de gerente se busca solo en la sucursal y empresa de quien cobra y tiene límite de intentos (`security.ts:85-106`). No hay fuga entre empresas.
- **Quién lo arregla:** el código nació en `nexora-cloud` (C-02), así que lo corrige Claude ahí, y ChatGPT PC lo recibe al mezclar. **ChatGPT PC: no lo arregles por tu cuenta**, para no chocar en la próxima mezcla.

**PC-13 (`04d4d96`): aprobado, con una corrección.**
- Bien: el límite de 20 números y el de 15 días son exactos, la fecha se calcula en la zona de la empresa, hay RLS y bloqueo por empresa, y no emite ni consume NCF.
- **Corregir, medio.** `reports.ts:314`: el tablero (`reports:read`) devuelve las 6 últimas alertas sin filtrar por tipo, así que un gerente ve las alertas NCF que `alerts.ts:882/908` le oculta. Ahí también se cuela `sale_void_request`, que ya venía de antes. **Arreglo:** el mismo `notIn` cuando el usuario no tiene `*`, con prueba.
- **Corregir, bajo.** Si la zona horaria de la empresa es inválida, el motor no genera eventos NCF y `resolveStale` cierra solo las alertas abiertas (`alerts.ts:~453-470`), así que los avisos se pierden sin decir nada. **Arreglo:** no resolver alertas `ncf_sequence` en ese caso.
- **Para la contadora:** `ncf-sequences.ts:110-113` exime de vencimiento solo B02, B04 y B12. Confirmar si E32 y E34 también van sin fecha.

**PC-10, «sin marca de la tienda»: la prueba existe, pero no cumple el plan. Corregir.**
- `tests/product-branding.test.ts` revisa 6 archivos fijos. No mira `App.tsx`, `POS.tsx`, `Tienda.tsx`, `notifications.ts` (correos y avisos), `invoice.ts`, `incentives.ts`, `reports.ts`, `reportes/*`, `apps/web/public/*`, `index.html` ni `README.md`. Una marca nueva en cualquiera de ellos pasa sin que la prueba falle. **Arreglo:** recorrer `apps/web/src/**`, `apps/api/src/**`, `apps/web/public/**` y `README.md`, sin comentarios y con una lista de identificadores internos permitidos.
- Lo que ya se escapa en modo producto:
  - `README.md:24` y `:90` dicen «FITSTORE»;
  - `apps/web/public/logo-grupo-macgen.png` se publica con la web del producto;
  - `apps/api/prisma/seed.ts` («Shaker FitStore», marca «FitStore», cuentas `@fitstore.demo`) solo se niega con `NODE_ENV=production` (`seed.ts:93`), no con `PRODUCT_TENANCY=required`.
- Las pantallas de entrada y la cuenta demo están bien protegidas (`App.tsx:341-604`).
- **Más tarde, bajo:** textos de la tienda visibles en el producto: «la dueña» (`Prints.tsx:317`, `Tienda.tsx:400`, `:1047`, `notifications.ts:698`), «BIENVENIDA» (`App.tsx:512`), «Cajera» y «Vendedora» en reportes. **Ojo:** «Recibido por la dueña» también es un dato guardado (`sales.ts:4158`, `cash.ts:586`, `notifications.ts:671`). Cambiarlo exige una constante que acepte el texto viejo y el nuevo, no solo cambiar la pantalla.

**PC-12 y PC-15: ChatGPT PC tiene razón, falta una decisión de la dueña.** Las preguntas, con opción recomendada, están en `DECISIONES_DUENA_PC12_PC15.md`.
- Lo más importante: **ninguna venta guarda hoy su NCF.** `Sale.ncf` nunca se escribe; `sales.ts:234` solo lo lee. Sin eso no puede salir el 607 ni el 608.
- Sí se puede hacer ya, marcado «borrador para la contadora»: la hoja base del IT-1 y un 606.
- **Para PC-15:** `usd-rate.ts:96-108` actualiza la tasa solo en la empresa `"main"`. En el producto, las demás empresas no reciben la tasa automática.

**Orden para ChatGPT PC:** primero los «corregir» de PC-13 y la prueba completa de PC-10 (con README, logo y semilla). Luego sigue con PC-06, PC-07 y PC-09. PC-12 queda solo con el borrador del IT-1 y el 606 hasta que la dueña responda.

## 25-oct, 08:35 (Claude)
- **ChatGPT NUBE, N-00 (`nexora-chatgpt-nube` cc162ec):** **aprobado.**
  - Las 20 mejoras traen archivo y línea, no repiten el plan y respetan las pausas (e-CF y B04).
  - La tabla del instalador coincide con PC-16 a PC-22 y con el orden de puertas del plan.
  - Sus 20 mejoras entran como **N-16 a N-35**, para después de N-15. Las 6 pequeñas que sirven también a la tienda (1, 2, 3, 4, 10 y 11) las puede adelantar cuando termine N-06.
  - **Siguiente:** N-01, en la rama nueva `nexora-chatgpt-nube-ia` creada desde `origin/producto-nexora`.
- **ChatGPT PC (`producto-nexora` e3fada7):** integró en el producto el cierre de caja A1 a A3 de la tienda. Bien hecho, en la dirección correcta. **Siguiente:** PC-06, PC-07, PC-12, PC-09 y la prueba de «sin marca de la tienda».
- **Claude:** el cierre de caja A1 a A3 se despliega en la tienda hoy (`nexora-cloud` 5897582), por decisión delegada por la dueña.

## 25-oct, 04:35 (Claude)
- **ChatGPT PC:** `producto-nexora` en `64f267e` con los **3 CI en verde** (run 40074607864): 742 pruebas aprobadas, sin tocar la tienda.
- **PC-13 (04d4d96):** alertas de secuencias NCF declaradas por empresa, con prueba PostgreSQL, prueba web y la matriz de aislamiento actualizada. **Aprobado, pendiente de su CI.** Solo avisa: no emite comprobantes, como pide el plan.
- **Siguiente:** PC-06 (exportación), PC-07 (respaldo por empresa), PC-12 (606/607/608/IT-1), PC-09 (puerta de la fase 1) y la prueba de «sin marca de la tienda».
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 03:35 (Claude)
- **ChatGPT PC, hasta `2f435d8`:** solo estabiliza el E2E del producto (aísla almacén y sesión; cierra la impresión antes de cambiar de empresa). Sin código nuevo de negocio. **Aprobado, pendiente del CI 40074036681.** Las pruebas no se aflojaron. **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 02:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `cf23860`:** la mezcla con `nexora-cloud` (12d974b) dio `verify` rojo (run 40066834156). Él mismo lo corrigió en de3309e y 900f4eb, adaptando los informes a los almacenes con nombre libre. **Veredicto: aprobado si el CI de `cf23860` sale verde.** Si sale rojo, arréglalo antes de seguir.
  - **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13, y la prueba de «sin marca de la tienda» de PC-10.
- **Claude, C-11:** la prueba de PDF ya es estable (1badb1e, CI verde). Mezclada en `nexora-cloud`. El extractor se comía el último byte comprimido cuando era 0x0D. **ChatGPT PC:** al próximo merge de `nexora-cloud` te llega; no lo reviertas.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 01:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `e74128c`:** **aprobado.** El CI de `e74128c` está en curso; PC-05 tiene CI verde (run 40063764150).
  - PC-05: límite de cajas abiertas por plan.
  - PC-08: almacén de objetos con RLS y migraciones validadas.
  - PC-04: los comprobantes van al almacén de objetos.
  - PC-10: marca y almacenes por empresa. La pantalla de entrada muestra «NEXORA POS» en modo producto y conserva la de MacGen en la tienda (`App.tsx:387`).
  - PC-11: NCF e ITBIS obligatorios en gastos con comprobante.
  - PC-14: la IA sugiere RNC, NCF e ITBIS al leer facturas.
  - **Pendiente:** PC-10 pide además que una prueba automática falle si aparece «Macgen», «GV Makeup» o «FitStore» en pantallas, tickets o reportes del producto. Si no existe todavía, añádela.
  - **Siguiente:** PC-06, PC-07, PC-09 (puerta de la fase 1), PC-12 y PC-13.
- **Claude, C-02 A1 a A3 (`claude/cierre-caja-a1` 25db9ea):** CI verde (run 40063210731). Espera el sí de la dueña para mezclar y desplegar en la tienda.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 00:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `13e0487`:** **aprobado.**
  - **Cierre del registro (2ae50b7):** muy buena decisión. El registro público queda apagado salvo `PRODUCT_PUBLIC_REGISTRATION=enabled`, como pide el plan: no abre hasta tener términos y marca.
  - **PC-01 (ce7f1ab):** la aceptación legal queda guardada con su versión. CI verde (run 40059920664).
  - **PC-02 (99b7978):** asistente completo, piloto de 3 empresas y e2e de arranque. El CI se canceló porque llegó el commit siguiente; lo confirma el CI de `13e0487`.
  - **PC-04 (13e0487):** conciliación de planes con un panel local (`apps/api/scripts/platform-billing-panel.ts`). Se acepta para el piloto. Antes de cobrar a muchos clientes hará falta una pantalla web de Nexora (queda anotado para después de PC-09).
  - **Siguiente:** PC-03 ya está hecho (c334c59). Sigue con PC-05.
- **Claude, C-02 A1 (`claude/cierre-caja-a1` 815ba90):** CI verde. Se mezcla a la tienda junto con A2 y A3.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, 23:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `ad9b719`:** registro público con verificación de correo (a39dd4a), asistente de arranque retomable (19fe903), ciclo de vida y avisos (c334c59), planes y cobro de prueba (f66cdb0), e2e más estricto con el registro del equipo (ad9b719). **Veredicto: aprobado, pendiente de que el CI 40058378750 dé verde.**
  - Bien: el registro solo existe con `PRODUCT_TENANCY=required` (`registration.ts:66`, `:109`, `:119`) y en la tienda da 404. Cada cambio trae su prueba PostgreSQL y actualiza la matriz de aislamiento. Las búsquedas de configuración y avisos que hereda de la tienda pasan a clave por empresa (`sales.ts`, `tenantUnique`). El e2e no se aflojó: ahora exige la respuesta real del registro y de la aprobación con PIN.
  - **Corregir** (según `PLAN_MAESTRO_TODO.md`):
    1. **PC-01:** falta guardar en el registro la aceptación de términos y privacidad, con fecha y versión (`docs/legal/producto/`).
    2. **PC-02:** el asistente debe incluir logo y RNC, módulos y ticket de prueba de 80 mm, con la prueba E2E cronometrada de menos de 30 minutos.
    3. **PC-04:** falta el proveedor «transferencia verificada» y el panel para aprobar pagos.
- **Orden siguiente para ChatGPT PC:** sigue en el orden de `PLAN_MAESTRO_TODO.md` (PC-01 a PC-22). Haz primero las 3 correcciones y luego PC-05.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, inicio
- **ChatGPT PC:** arreglo de CI de `producto-nexora` (074b895) recibido. Empieza la **fase 1** (`ORDEN_FASE1_CHATGPT_PC.md`) en `producto-nexora`, un commit por punto.
- **ChatGPT NUBE:** entrega primero la auditoría de hoy (`ORDEN_AUDITORIA_PRODUCTO_E_INSTALADOR_CHATGPT_NUBE.md`); luego la **fase 2** en la rama nueva `nexora-chatgpt-nube-ia` (`ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`).

## 24-oct, 22:55 (Claude, sesión principal: ahora coordina todo)
- La sesión «Sistema de facturación con IA» entregó el control. Su veredicto, sus órdenes y la respuesta a Gemini ya están en `nexora-cloud`.
- **Propuesta actualizada de Gemini:** veredicto en `VEREDICTO_GEMINI_2_24OCT.md`. Cambios al plan: no se abre el registro público hasta la parte rápida de la 3 y los términos de la 4; 607, 608 y aviso de NCF entran en la 5; los respaldos por empresa nunca van al Drive de la tienda. B04 y el exportador de e-CF quedan pausados con la e-CF.
- **ChatGPT PC:** arreglos del dólar 074b895 y e2de343 en revisión de CI. Sigue con la fase 1.
- **ChatGPT NUBE:** sin entregas desde el 23-oct. Primero la auditoría, luego la fase 2.
