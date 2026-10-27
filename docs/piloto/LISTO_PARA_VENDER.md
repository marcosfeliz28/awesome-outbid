# Nexora POS: ¿está listo para vender? (lista honesta)

**Fecha:** 25-oct-2026 · **Hecha por:** Claude PC, solo leyendo documentos (no se ejecutó nada, no se tocó código).
**Para quién:** la dueña. Lenguaje simple.

## Cómo leer esto

| Marca | Significa |
|---|---|
| ✅ | Listo: hay código, hay prueba y el CI salió verde. |
| 🟡 | Parcial: existe, pero una auditoría marcó algo por corregir o falta probarlo de verdad. |
| 🔴 | Falta, o no hay evidencia en el repositorio. |
| ⏸ | En pausa por decisión de la dueña. **No se promete a ningún cliente.** |

**Regla de esta lista:** "CI verde" y "pruebas automáticas" NO son lo mismo que "probado en un negocio real". Cuando las auditorías de Claude dijeron "solo se leyó el código, no se ejecutó", aquí también lo decimos. Los SHA son de las ramas `producto-nexora`, `nexora-chatgpt-pc-producto`, `nexora-chatgpt-pc-producto-fixes`, `nexora-chatgpt-nube-ia` y `claude-pc/*`.

**Dato general:** el producto ya está en vivo en Render (`nexora-saas-web.onrender.com`, `/api/health` ok), pero **el registro público está cerrado a propósito** y nadie puede entrar todavía sin invitación.

---

## 1. Registro e invitación de negocios

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| PC-01 Registro `/registro` con correo verificado, límite por IP | ✅ | `a39dd4a`; aprobado en la revisión de las 23:35 | Está apagado a propósito (`PRODUCT_PUBLIC_REGISTRATION`). Abrirlo es decisión de la dueña. |
| PC-01 Aceptación de términos y privacidad con fecha y versión | ✅ | `ce7f1ab`, CI verde (run 40059920664) | Los textos que se aceptan son borradores (ver área 6). |
| PC-02 Asistente de arranque (logo, RNC, módulos, productos, cajeras, ticket 80 mm) | 🟡 | `99b7978` + e2e de arranque; el CI de ese commit se canceló y lo confirma el de `13e0487` | La prueba cronometrada "menos de 30 minutos" fue con datos de prueba, no con una persona real. Falta probarlo con un negocio de verdad. ChatGPT PC + la dueña. |
| PC-03 Estados: trial 14 d, activo, mora 7 d, suspendido solo lectura | ✅ | `c334c59`, aprobado | Falta ver los avisos de 7 y 3 días en un negocio real. |
| PC-23 Crear empresa piloto por invitación desde un panel de la plataforma | 🔴 | La revisión de las 02:45 dice que "no existe aún el panel de la dueña de la plataforma ni las invitaciones del piloto" | ChatGPT PC lo construye. **Sin esto no se puede invitar a los 3 a 5 pilotos.** Hay un panel local de pagos (`billing:panel`), pero no invitaciones. |

## 2. Cobro de planes y límites

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| PC-04 Cobro por "transferencia verificada" con comprobante | 🟡 | `f66cdb0` y `13e0487`; `docs/producto/COBRO_TRANSFERENCIA_OPERACION.md` | Aceptado solo para el piloto. El panel es local en la PC del operador, no una pantalla web segura. Sin 2FA de plataforma. ChatGPT PC. |
| PC-04 Precios de los planes | ✅ | Commit `822fe70`: RD$1,250 / 2,000 / 4,000 / 7,000 con 100 / 250 / 600 / 1,500 preguntas | Decididos por la dueña. Falta confirmar el texto de ITBIS con abogado/contadora. |
| PC-04 Cuenta de banco de Nexora para cobrar | 🔴 | Va en variables de entorno de Render; nada indica que estén puestas | La dueña pone los datos en Render. |
| PC-05 Límites por plan (sucursales, cajas, usuarios, equipos) con 409 | ✅ | `e74128c`, CI verde (run 40063764150) | Revisar en el piloto que el mensaje del 409 se entienda. |
| PC-24 (nombrado en el encargo, sin texto en el plan) | 🔴 | Sin evidencia en el repositorio: `PLAN_MAESTRO_TODO.md` lista PC-01 a PC-22 (y PC-23 en la revisión de las 02:45) | Claude nube debe aclarar qué es PC-24. |
| Cobro con tarjeta (Azul/Cardnet) | 🔴 | No existe; el plan solo acepta transferencia | La dueña pide la cuenta de comercio. No hace falta para el piloto. |

## 3. Datos del cliente: exportación, respaldo, restauración

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| PC-06 Exportación completa por empresa (Excel y JSON) | 🟡 | `e3a1b47`; pruebas PostgreSQL focales 4/4 | Sin revisión de Claude todavía. Falta confirmar que exportar sirve en estado "suspendido". |
| PC-07 Respaldo cifrado por empresa y restauración en base desechable | 🟡 | `87a78f0`; `docs/producto/RESPALDO_POR_EMPRESA.md` | La restauración solo está probada en una base local desechable. **Nadie ha restaurado el respaldo de un cliente real.** Sin revisión de Claude. |
| PC-07 Destino del respaldo aislado por empresa (nunca el Drive de la tienda) | 🔴 | El documento describe el archivo cifrado y la restauración, no dónde se guarda fuera de la PC | ChatGPT PC define el destino. La dueña autoriza el costo, si lo hay. |
| PC-08 Fotos y PDF fuera de PostgreSQL | 🟡 | Almacén de objetos con RLS en `e74128c`; incluido en el respaldo `NXTB/2` | En Render hace falta un almacenamiento real; en pruebas es una carpeta local. Sin evidencia de uno configurado. |
| PC-20 Respaldo diario de la versión local fuera de la PC, alerta a las 48 h | 🔴 | `INSTALADOR_LOCAL.md` dice que PC-20 falta | ChatGPT PC. Obligatorio antes de vender la versión local. |

## 4. Aislamiento entre empresas y seguridad

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| Matriz de aislamiento: ninguna fuga entre empresas A y B | ✅ | Fase 0 (`736c961`, integración 472/472): 153 de 156 rutas con caso real A/B; la prueba falla si aparece una ruta sin caso. Las 3 sin caso son rutas públicas de salud | "0 fugas" vale para los casos probados, no para todas las combinaciones ni para concurrencia (lo dice el propio informe). Repetirla antes de cobrar. |
| RLS (la base separa empresas) en las 58 tablas | ✅ | Migración de la fase 0; el rol RLS se crea solo en el preDeploy (`f0cf850`, `9879484`); en vivo en Render | Cada tabla nueva debe mantenerlo (la prueba lo exige). |
| N-05 Soporte de solo lectura con interruptor de 24 h | 🟡 | `4014e66`; auditoría CPC-6: "corregir" (puntos 4 y 5) | El canal en vivo (SSE) no revisa el vencimiento; la bitácora se puede truncar. Hay arreglos posteriores (`103d7ba`, `2519890`) sin re-auditar. ChatGPT nube. |
| N-05 Recorrido real de 403 para `support` en toda escritura | 🔴 | CPC-6: hoy es una prueba unitaria con un guardia simulado | Falta recorrido HTTP real y prueba de Postgres con READ ONLY. ChatGPT nube. |
| N-15 Conector MCP de solo lectura (OAuth) | 🟡 | `c684354`; CPC-6: "aprobado con reserva" | No abrir a clientes externos hasta limitar el tiempo de inactividad y bajar el token a 15 min. ChatGPT nube. |
| Cookies y sesión: producto y tienda no se pisan | 🟡 | `769c51b` (cookies propias de Local); solo leído | Sin prueba con ambos instalados. |
| Verificación en dos pasos para administradores (C-07) | ⏸ | Depende de decisión de la dueña | La dueña decide. |
| Repositorio de GitHub privado | 🔴 | Está en "Lo que le toca a la dueña"; sin evidencia de que se hizo | La dueña. Hacerlo antes de dar acceso a nadie. |

## 5. Fiscal (la contadora manda)

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| PC-11 Gastos con NCF e ITBIS obligatorios | ✅ | `e74128c` | Confirmar con la contadora el tratamiento por tipo de gasto. |
| PC-14 La IA lee el RNC, NCF e ITBIS del suplidor | 🟡 | `e74128c`; falta la prueba con 10 facturas reales | La dueña manda 10 facturas de distintos suplidores. |
| PC-13 Aviso cuando quedan pocos NCF (menos de 20 o 15 días) | ✅ | `04d4d96`; correcciones en CPC-4 (`8794be3`), 3 CI verdes | La contadora confirma si E32 y E34 también van sin vencimiento. Solo avisa, no emite. |
| 606 (compras): borrador para la contadora | 🟡 | Solo el documento `BORRADOR_606_IT1_CORRESPONDENCIA.md` (`65455d8`, rama `claude-pc/borradores-pc12`). No hay archivo generado | Faltan decisiones de la dueña (`DECISIONES_DUENA_PC12_PC15.md`) y el formato oficial con la contadora. ChatGPT PC después. |
| IT-1 hoja base (borrador) | 🟡 | Mismo documento; la parte de ITBIS de ventas y compras es posible | Igual que el 606. Es un borrador, **no se presenta a la DGII**. |
| 607 (ventas) y 608 (anulados) | 🔴 | El sistema **nunca guarda el NCF de cada venta** (`Sale.ncf` solo se lee). Sin eso no pueden salir | Decisión de la dueña con la contadora. ChatGPT PC. |
| Emisión de NCF desde el producto | 🔴 | El producto solo avisa y no emite ni consume NCF (PC-13) | **No se promete.** El negocio sigue emitiendo por su medio actual. |
| e-CF (factura electrónica) | ⏸ | Pausada por la dueña | **No se promete.** La dueña lo ve con su contadora. |
| B04 (nota de crédito fiscal) y conector con proveedor e-CF | ⏸ | Pausados por la dueña | **No se promete.** |

## 6. Marca y legal

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| Términos de servicio | 🟡 | Borrador v0.1 en `docs/legal/producto/TERMINOS_DE_SERVICIO.md`, con marcas [ABOGADO] y [DUEÑA]; nombre legal, RNC y plazos en blanco | **El abogado debe revisarlo.** `PRODUCT_LEGAL_APPROVED` no está confirmado. La dueña pide cotización. |
| Política de privacidad | 🟡 | Borrador en `docs/legal/producto/POLITICA_PRIVACIDAD.md` | Igual: abogado. |
| Sin marca de la tienda (Macgen, GV Makeup, FitStore) en el producto | 🟡 | PC-10 `e74128c`; prueba de marca ampliada en `cfef294`/`e24c8d0` (CPC-5, 3 CI verdes) | Quedan textos de la tienda ("la dueña", "BIENVENIDA", "Cajera", "Vendedora"); "Recibido por la dueña" es además un dato guardado. La ampliación no se re-auditó. |
| Nombre "Nexora" registrado en ONAPI | 🔴 | Decisión pendiente de la dueña | La dueña. |
| Avisos de licencias de terceros dentro de la app (C-05) | 🟡 | Avisos regenerados (75 componentes) al agregar Tauri, con prueba de licencias | Sin evidencia de que un abogado lo haya revisado. |
| Derechos de datos del cliente final | 🟡 | `docs/legal/` existe para la tienda | El producto necesita su versión revisada. |

## 7. Instalador y escritorio (PC-16 a PC-22)

**Resumen:** nada de esta área está lista para venderse. Todo está en `nexora-chatgpt-pc-producto` (sin mezclar a `producto-nexora`). Las auditorías CPC-8, CPC-9 y CPC-10 solo leyeron el código; **no ejecutaron Tauri, NSIS ni la suite**.

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| PC-16 App de escritorio Tauri: impresión directa en térmica 80 mm | 🟡 | `6ae6166`; CI compila Tauri y corre pruebas Rust (run 40124069319) | **Nunca se probó con una impresora real.** Falta atar la impresión a la impresora elegida. ChatGPT PC + la dueña con su impresora. |
| PC-16 Gaveta de dinero | 🟡 | `eb52692`, `e095879`; CPC-10: "parcial" | F1 abierto: se puede reabrir con una venta vieja o con la caja cerrada (falta ventana de 2 min y caja abierta). La apertura manual no pide motivo. Sin prueba con gaveta real. ChatGPT PC. |
| PC-16 Permisos de los comandos de Tauri | 🟡 | Manifiesto y `withGlobalTauri:false` (CPC-9: "cerrado") | Solo leído, no ejecutado. |
| PC-15 Tasa del dólar por empresa | 🟡 | `f223e4c`, `823691b`; CPC-10: "parcial" | Falta tope duro para valores absurdos (un dato malo de 400 contra 63 se aplicaría a todas las empresas). Texto viejo en pantalla. El margen solo avisa. ChatGPT PC; decide la dueña. |
| PC-17 Instalador firmado y actualización automática | 🔴 | Sin evidencia: no hay certificado de firma ni actualizador automático | La dueña compra el certificado de firma de código. ChatGPT PC. |
| PC-18 Instalador local (NSIS) aislado de la tienda | 🟡 | `ec9b913`, `34aeaa1`, `81c4f17`, `769c51b`; CI compiló el NSIS (run 40132396864) | **Nunca se instaló en un Windows real ni limpio.** Claude lo revisó solo en código. |
| PC-19 Licencia Ed25519 | 🔴 | CPC-9: "corregir". `LICENCIA_LOCAL.md`: "no se entrega como producto vendible" | **No existe el servidor que emite licencias**: una instalación nueva queda en solo lectura. Falta atar la licencia a la empresa y la máquina, rotación de claves y rechazar la clave de pruebas en el instalador final. Los arreglos de reloj y cola offline (`a789758` a `a02147f`) no se re-auditaron. ChatGPT PC + ChatGPT nube. |
| PC-20 Respaldo diario fuera de la PC y alerta a las 48 h | 🔴 | Sin evidencia en el repositorio | ChatGPT PC. |
| PC-21 IA y soporte desde la versión local sin claves en la PC | 🔴 | Sin evidencia en el repositorio | ChatGPT PC + ChatGPT nube. |
| PC-22 Prueba en Windows 10 y 11 limpios | 🔴 | Existe un guion (`c242d29`/`574ad26`, `Windows11-Coexistence.ps1`). El propio informe dice que **no se ejecutó**: falta su `resultado.json` | No hay ninguna prueba en una máquina virtual limpia. **No marcar ✅ sin ese resultado.** Alguien con una VM Windows 11 y otra Windows 10. **Nunca en la PC de la tienda.** |
| Versión en el navegador (PWA en la nube) | ✅ | Producto en vivo en Render; `/healthz/deep` 204 | Es lo que se ofrece al piloto. No necesita instalador. |

## 8. IA y soporte (N-01 a N-15)

Todo está en `nexora-chatgpt-nube-ia` (`c684354`), **sin mezclar a `producto-nexora`**. CPC-6 lo auditó leyendo código, sin ejecutar la suite. Veredicto: "sin fuga entre empresas, sin escalada de permisos y sin clave en el navegador".

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| N-01 Pregúntele a Nexora (10 herramientas, defensas, límites) | 🟡 | CPC-6: "corregir (no bloquea el piloto)" | Nombre de usuario sin filtro, historial falsificable, límite por minuto por proceso. Necesita clave de IA en Render (sin evidencia de que exista). ChatGPT nube. |
| N-02 Cuota mensual por plan y bitácora | 🟡 | `55377a0`; CPC-6: "corregir" | Falta probar 40 llamadas simultáneas contra Postgres (la prueba actual simula el bloqueo). ChatGPT nube. |
| N-03 Pantalla del asistente | 🟡 | `a0fe5c4`; CPC-6: "aprobado" | Falta verla a 320 px en navegador real. |
| N-04 Pedir anulación solo con el "Sí" | ✅ | `a14b25f`; CPC-6: "aprobado" | Solo leído; sin prueba con una cajera real. |
| N-05 Soporte de solo lectura | 🟡 | Ver área 4 | Ver área 4. |
| N-06 Puerta: costo medido con 20 preguntas reales + 403 real | 🔴 | CPC-6 y Claude nube: **BLOQUEADO**. El "costo" salió de un modelo falso con tokens inventados | Medir 20 preguntas reales con clave de prueba y anotar tokens y dólares. **Sin esto no se puede confirmar que los planes con IA (100/250/600/1,500 preguntas) dejen margen.** ChatGPT nube + clave de prueba de la dueña. |
| N-07 Resumen diario por correo | 🟡 | `04b1f4d`; CPC-6: "corregir" | Falta interruptor por empresa apagado por defecto; hoy enviaría a toda empresa activa en cuanto exista la clave. Necesita `RESEND_API_KEY` y remitente propio. |
| N-08 Revisar transferencias desde la foto | 🟡 | `bb877ed`; CPC-6: "corregir" | Ignora la fecha de la foto, deja pasar referencias como "1234", el duplicado se evade con guiones. Solo propone. |
| N-09 Ayudante antes del cierre | ✅ | `f05b6c9`; CPC-6: "aprobado" | Solo leído. |
| N-10 Recordatorios de cobro | ✅ | `8830806`; CPC-6: "aprobado" | Solo leído. |
| N-11 Borrador de orden de compra | 🟡 | `0153dc1`; CPC-6: "aprobado con 1 aviso" | No descuenta órdenes abiertas: puede duplicar pedidos. |
| N-12 Oferta para lotes por vencer, margen mínimo 15 % | 🔴 | CPC-6: **corregir, prioridad alta**. Con `isClearance:false` se aceptaba hasta 100 % y la caja cobraba bajo costo. `745e235` y `7fe6df4` son arreglos posteriores | Re-auditar. Hasta entonces **no ofrecer ofertas de lotes**. El piso usaba el costo promedio, no el costo del lote. ChatGPT nube. |
| N-13 Centro de ayuda y página de estado | ✅ | `7d00d26`, `4278ee1`, `6bbdc64`; CPC-6: "aprobado" | Solo leído. Falta mezclarlo a `producto-nexora`. |
| N-14 WhatsApp fase 0 | ✅ (solo documento) | `20908d2`; CPC-6: "aprobado" | **No hay código.** Esperar aprobación de la dueña y verificación en Meta. |
| N-15 Conector MCP | 🟡 | `c684354`; "aprobado con reserva" | Ver área 4. |
| N-16 a N-35 (las 20 mejoras de la auditoría) | 🔴 | N-00 aprobado; hay avance en `nexora-chatgpt-pc-n16-n35` | **Esperan a que N-06 pase.** No son necesarias para el piloto. |

## 9. Tablero del administrador y caja de las cajeras

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| Tablero fase A (aprobar con botón y PIN, `liquidity` solo lectura) | 🟡 | `99570b6` en `chatgpt-pc/tablero-admin-a`; CI en curso, el anterior (`c0495a5`) salió rojo | Claude PC debe auditarlo con `ORDEN_TABLERO_FASE_A.md`. El constructor deja el CI en verde. |
| Cierre de caja A1 a A3 (efectivo de la dueña con PIN, ticket con esperado/contado/diferencia, aviso de PIN) | ✅ | `5897582` en `nexora-cloud` (ya en la tienda); integrado al producto en `e3fada7` | Quedan dos correcciones menores de la auditoría del 08:55 (la marca "Recibido por la dueña" depende de que no venga referencia). Claude nube. |
| Cuadre por caja (CPC-1) | ✅ | `b8d0d42`, 3 CI verdes | Si una cajera tuviera dos cajas abiertas a la vez, un cobro podría salir en ambas. |
| Lote del verifón al cerrar con tarjeta (CPC-2) | ✅ | `0cf392b`, 3 CI verdes, mezclado en `nexora-cloud` (`1da7534`) | Sin foto, por decisión de la dueña. |
| Reporte de cierre con transferencia rechazada (FIN-01) | 🔴 | El informe de ChatGPT PC del 15-oct lo marca alto; sin evidencia de arreglo | Claude nube / ChatGPT PC. Puede mostrar como cobrada una transferencia rechazada. |
| Conciliar transferencias sin total del banco (FIN-02) | 🔴 | Mismo informe; sin evidencia de arreglo | Igual. |
| Cajera cobra tarjeta o transferencia por rutas alternas (M-PC-01) | 🔴 | Informe del 15-oct; sin evidencia de decisión | Decide la dueña; luego ChatGPT PC. |

## 10. Operación

| Punto | Estado | Evidencia | Qué falta / quién lo hace |
|---|---|---|---|
| Render del producto (web, API y base propias) | ✅ | Blueprint de la dueña; `nexora-saas-web.onrender.com` 200, `/healthz/deep` 204 (revisión 02:45) | Confirmar el costo mensual (~US$40-55). |
| Dominio `nexorapos.net` | 🟡 | CNAME en Cloudflare ya puesto | **La dueña agrega el dominio en Render (Custom Domains).** Luego Claude ajusta `WEB_ORIGIN` y `APP_PUBLIC_URL`. |
| Correo con Resend | 🔴 | Sin evidencia de cuenta ni clave | La dueña crea la cuenta y pega la clave en Render; verificar dominio propio. |
| WhatsApp fase 0 | ⏸ | Solo documento; sin código | La dueña aprueba antes de programar. |
| Página de estado y centro de ayuda | 🟡 | N-13 en la rama IA, sin mezclar | Mezclar a `producto-nexora`. |
| Monitoreo y alertas de caída del producto | 🔴 | Sin evidencia; `MONITOR_DE_CAIDAS.md` es de la tienda | Claude nube lo adapta. |
| Guías y manuales para el cliente | 🟡 | Guías de la tienda (`GUIA_ADMINISTRADORA`, `GUIA_CAJERA`, `CHECKLIST_DIA_1`); hay `docs/piloto/GUIA_ARRANQUE_PILOTO.md` | Revisar que no lleven marca de la tienda. |

## 11. Lo que debe hacer la dueña

| Pendiente | Estado | Evidencia | Qué falta |
|---|---|---|---|
| Hacer privado el repositorio en GitHub | 🔴 | Sin evidencia | La dueña. |
| Autorizar Render del producto | ✅ | Ya está en vivo | Confirmar el monto mensual. |
| Agregar el dominio `nexorapos.net` en Render | 🔴 | Falta (revisión 02:45) | La dueña. |
| Cuenta de comercio Azul o Cardnet | 🔴 | Sin evidencia | La dueña. No hace falta para el piloto. |
| Cotización del abogado: términos y privacidad | 🔴 | Sin evidencia | La dueña. **Obligatorio antes de abrir el registro.** |
| 10 facturas de suplidores distintos | 🔴 | Sin evidencia | La dueña. |
| Cuenta en resend.com y clave pegada en Render | 🔴 | Sin evidencia | La dueña. |
| Decidir cuántas consultas de IA por plan | ✅ | `822fe70` (100 / 250 / 600 / 1,500) | Faltan los costos medidos (N-06). |
| Decidir el nombre Nexora y ONAPI | 🔴 | Sin evidencia | La dueña. |
| Decidir si la IA propone cambios de inventario (N-15) | 🔴 | Sin evidencia | La dueña. |
| Decidir la foto de testers (C-08) | 🔴 | Sin evidencia | La dueña. |
| Decidir la verificación en dos pasos (C-07) | ⏸ | Sin decisión | La dueña. |
| Responder las 12 preguntas de `DECISIONES_DUENA_PC12_PC15.md` | 🔴 | Sin respuestas en el repositorio | La dueña (y la contadora para las de DGII). |
| Certificado de firma de código (PC-17) | 🔴 | Sin evidencia | La dueña, más adelante. |
| Número de prueba y verificación en Meta (N-14) | ⏸ | Fase 0 solo documento | La dueña, más adelante. |
| e-CF con su contadora | ⏸ | Pausada | La dueña. |

---

## Puerta del piloto: lo mínimo para 3 a 5 negocios gratis

El piloto es en la web (PWA en Render), con invitación, sin cobrar y con acompañamiento. **No usa instalador, ni licencia local, ni IA de pago.**

Todo esto debe estar listo antes de invitar al primero:
1. **PC-23** (crear empresa piloto por invitación): hoy 🔴.
2. Repositorio privado en GitHub: hoy 🔴.
3. Dirección de acceso estable: dominio `nexorapos.net` en Render, o la dirección de Render: hoy 🟡.
4. Matriz de aislamiento repetida en verde sobre la versión que se va a desplegar: hoy ✅ en la fase 0, hay que repetirla.
5. PC-06 y PC-07 revisados por Claude, con una restauración probada en una base desechable: hoy 🟡.
6. Los 3 CI de la última versión de `producto-nexora` en verde y desplegada.
7. Aviso escrito al piloto de que el sistema **no emite NCF ni e-CF** y no sustituye su facturación fiscal actual: hoy 🔴.
8. Una persona de contacto que responda dudas y una guía corta (`docs/piloto/GUIA_ARRANQUE_PILOTO.md` existe): hoy 🟡.
9. Un acuerdo de piloto aceptado por escrito, aunque sea simple, mientras llega el abogado: hoy 🔴.

**No hace falta para el piloto:** cobro, tarjeta, Resend, IA del asistente, WhatsApp, instalador, licencia, firma de código, 606/607/608.

Si se activa la IA en el piloto: antes se corrigen N-12 (ofertas) y los puntos 1 a 4 de CPC-6, y se pone un tope de gasto en la clave.

## Puerta de venta: todo esto debe estar ✅ antes de cobrar al primer cliente

1. **Legal:** términos y privacidad revisados por un abogado y `PRODUCT_LEGAL_APPROVED` confirmado. Hoy 🔴.
2. **Marca:** "Nexora" registrada en ONAPI, o decisión escrita de seguir sin registro. Hoy 🔴.
3. **Registro público:** abrirlo solo con 1 y 2 hechos. Hoy 🔴.
4. **Cobro:** cuenta de banco de Nexora configurada, panel de pagos seguro (no solo en la PC local) y un primer pago conciliado de extremo a extremo. Hoy 🟡.
5. **Datos del cliente:** exportación y restauración probadas con una empresa real, con destino de respaldo por empresa definido. Hoy 🟡/🔴.
6. **Aislamiento:** matriz en 0 fugas más el recorrido HTTP real de 403 para soporte. Hoy 🟡.
7. **Correo:** Resend con dominio propio verificado. Hoy 🔴.
8. **Operación:** monitoreo, página de estado, guías para el producto y un responsable de soporte. Hoy 🔴/🟡.
9. **Fiscal:** la web debe decir claramente qué se hace (borradores 606/IT-1, aviso de NCF) y qué no (emisión, e-CF, B04), con revisión de la contadora. Hoy 🟡.
10. **Dinero:** cerrar FIN-01 y FIN-02 (transferencias rechazadas y conciliación) y decidir M-PC-01. Hoy 🔴.
11. **Si se vende IA:** N-06 resuelto con costo real medido y N-12 corregido y re-auditado. Hoy 🔴.
12. **Si se vende la versión instalada:** PC-17, PC-19, PC-20 y PC-22 todos ✅, con prueba en Windows 10 y 11 limpios y el servidor de licencias funcionando. Hoy todos 🔴. Si no están listos, **se vende solo la versión web**.
