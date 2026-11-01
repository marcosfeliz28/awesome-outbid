# Recuento: lo que ya se decidió y lo que falta (1-nov-2026)

Para: la dueña. Preparado por Norexos 1 (Claude, nube), con los documentos del repositorio a la fecha.

**Cómo leerlo.** La sección 1 solo tiene decisiones que están escritas en un documento con fecha. Lo que no está escrito como decidido va en la sección 2, aunque se haya hablado. Cuando dos documentos se contradicen, lo digo en la sección 6. Cada punto dice dónde está escrito (archivo en `docs/` salvo que se indique otra cosa).

**Alcance de la revisión.** Leí los documentos de esta rama (`claude-pc/recuento-decisiones`) y consulté, solo para ver si existen, las ramas de `origin`. No revisé el contenido de cada rama. Lo que dice una rama de lo que hizo, lo tomé de su mensaje de commit o del documento que la menciona, y lo marqué así.

---

## 1) Lo que la dueña ya decidió

| Fecha | Decisión (en una línea) | Dónde está escrito |
|---|---|---|
| 1-nov | **No se bloquea ninguna venta por margen menor al 15 %.** La cajera puede vender con cualquier margen. La dueña lo revisa al final, con el cobro. El 15 % queda como referencia para fijar precios y para avisos, no como bloqueo en caja, promociones ni al editar precios. | `PENDIENTES_NOCHE_30OCT.md` (sección «Decisión de la dueña (1-nov-2026)»); `PLAN_DE_HOY_1NOV.md` |
| 1-nov | **Reembolsos de cursos GV siempre en pesos (RD$)**, aunque el curso sea en US$. Los reportes netos restan reembolsos en pesos. | `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 106); `PENDIENTES_NOCHE_30OCT.md` |
| 1-nov | **GV tendrá caja propia («opción B»)**: apertura, cierre con conteo y diferencia, y resumen del día. Todo lo que GV cobra (cursos, citas, pagos con tarjeta, transferencia o efectivo) cuadra con esa caja, no con la del punto de venta. | `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 106); `PENDIENTES_NOCHE_30OCT.md`. El diseño está en la rama `claude-pc/gv-cierre` (`docs/diseno/GV_CIERRE.md`), sin construir. |
| 1-nov | **El incentivo GV por pago va a quien cobró cada pago**, no a quien registró la inscripción. Es proporcional al pago, en el mes del pago. Anulación y reembolso lo revierten. | Mensaje del commit `c227d6b` en `claude-pc/gv-incentivos`, que dice «decisión de la dueña, 1-nov». **No encontré el texto de la dueña.** Ver contradicción C2. |
| 31-oct | **Incentivo fijo por alumna** cuando se registra la inscripción: Automaquillaje RD$ 50, Perfeccionamiento RD$ 500, Maquilladora profesional RD$ 1,000. El Brazilian touch no paga incentivo a Clary; lo lleva Yaisa (RD$ 10,000 por el grupo, pagado aparte). | `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 103); `GV_CATALOGO_CURSOS.md` |
| 31-oct | **Pagos GV en dólares** se registran con la opción de moneda y su equivalente en pesos, con la tasa del día capturada. Una devolución quita el incentivo. | `PENDIENTES_NOCHE_30OCT.md` (registro 31-oct 22:15 UTC) |
| 31-oct | **Catálogo de cursos GV:** cada curso es un ítem propio con su precio. No se cambia ningún precio sin orden de la dueña. | `GV_CATALOGO_CURSOS.md` |
| 31-oct | **GV debe tener cierre** desde ya: abrir caja, cerrar caja y factura del día. | `PENDIENTES_NOCHE_30OCT.md` (registro 31-oct 22:15 UTC) |
| 1-nov | **Reportes amigables:** todos los reportes ofrecen PDF y Excel, con «De qué trata», gráficas y explicación de cada columna. Aplica a la tienda, al instalador sin internet, a GV, a la Tienda en línea y al producto. Nada depende de internet. | `ORDEN_REPORTES_AMIGABLES_1NOV.md` (pedido de la dueña, «todas las versiones») |
| 15-oct | **Créditos y contraentregas en efectivo:** cualquier cajera puede cerrarlos, y el dinero entra a su caja. Tarjeta y transferencia las registra la administración. El documento dice «por desplegar». | `PENDIENTES-DUENA.md` (sección «Créditos cobrados en efectivo») |
| 14-oct | **Cierre de caja con tarjeta distinta del verifón:** si el total de tarjeta no coincide con el sistema, la cajera no cierra sola. Hace falta el PIN de un gerente. El verifón se cierra cada día antes de cerrar la caja. | `PENDIENTES-DUENA.md` (sección «Cierre de Farianelis del 14-oct») |
| 14-oct | **Correo de cierres y anulaciones:** cada cierre de caja y cada solicitud de anulación manda correo a la dueña. | `PENDIENTES-DUENA.md` (sección «Correo de cierres y anulaciones») |
| 29-oct | **e-CF y DGII quedan fuera de la versión 1** (en pausa por orden de la dueña). Ver C7. | `PLAN_MAESTRO_NOREXOS.md` |
| 29-oct | **La dueña habla solo con Norexos 1.** Todo lo demás le llega por ese canal. | `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 46) |
| 29-oct | **Piloto al final, tickets «Pedir un cambio» después del cambio de nombre.** Ver C5 y C6. | `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 46) |
| Permanente | **Margen = (precio − costo) / precio, sin restar ITBIS.** Los precios no cambian por ofertas: la caja aplica el descuento. | `CLAUDE.md` (reglas 3); `PLAN_MAESTRO_NOREXOS.md` |
| Permanente | **Solo Norexos 1 despliega**, con 3 CI verdes del mismo SHA y sin cajas abiertas. Nadie más despliega. | `PLAN_DE_HOY_1NOV.md`; `PLAN_MAESTRO_NOREXOS.md` |
| Permanente | **No se toca lo que la dueña contó** sin un conteo nuevo suyo. | `CLAUDE.md` (regla 3); `PENDIENTES_NOCHE_30OCT.md` (punto 14) |

---

## 2) Lo que falta que decida la dueña

Cada punto dice qué hay que decidir, las opciones, y mi recomendación en una línea. Las recomendaciones son mías; no son decisiones.

**Precios y cobro**

1. **Plan y precios.** Opciones: **A**, tres planes (Básico US$ 29, Medio US$ 59, Completo US$ 119, más instalación); **B**, plan único de US$ 69 con IA aparte (US$ 9 por usuario que la use); **C**, piloto gratis 60 días y luego 20 % de descuento el primer año. *Recomendación: A, pero solo con hosting compartido entre clientes; con un Render dedicado por cliente, el Básico pierde dinero y el Medio no llega al 15 % (ver C4).* Fuentes: `PROPUESTA_PRECIOS.md`, `ESTUDIO_PRECIOS_MERCADO.md` §3.
2. **Moneda de cobro y tipo de cambio.** No decidido. *Recomendación: cobrar en pesos con una tasa fija revisada cada mes, para que el cliente pague en su moneda.* Fuente: `PROPUESTA_PRECIOS.md`.
3. **Procesador de pagos y cobro al cliente.** Opciones: Azul (recomendado en `PLAN_MAESTRO_NOREXOS.md`, D3), CardNET, PayPal, Stripe por otra entidad. Requiere aprobación del procesador y un cobro de prueba real. *Recomendación: Azul, y abrir ya la cuenta de comercio, porque el trámite tarda semanas (`PLAN-10-MEJORAS-PRODUCTO.md`, línea 128).* Ver C5.
4. **Límite de IA por plan.** La propuesta dice 10 preguntas por día en el plan Medio, pero el sistema hoy topa en 30 por día. *Recomendación: 10 por día en Medio, para que el peor caso quede en unos US$ 15 al mes por usuario.* Fuentes: `PROPUESTA_PRECIOS.md`; `PENDIENTES_NOCHE_30OCT.md`. Ver C9.

**Dominio, correo y marca**

5. **Dominio.** `norexos.ai` figuraba disponible el 27-oct a las 22:50 UTC y no hay constancia de que se haya registrado. `norexos.com` está en el plan (E0). Falta confirmar el dominio de la portada. *Recomendación: registrar `norexos.ai` ya y `norexos.com` solo para redirigirlo.* Fuentes: `PREGUNTAS_DUENA_VENTA.md` (preguntas 1–2); `PLAN_LANZAMIENTO.md` §1; `RESPUESTA_CLAUDE_PC_27OCT.md` (línea 506).
6. **Correo y canal de soporte, y horario de respuesta.** Sin decidir. *Recomendación: un correo de soporte en el dominio nuevo, una vez registrado, y un horario de respuesta publicado que cumplamos.* Fuentes: `PLAN_LANZAMIENTO.md` §2; `PREGUNTAS_DUENA_VENTA.md`. Ver C8.
7. **Registro de la marca Norexos (ONAPI).** Por confirmar. *Recomendación: revisar que el nombre esté libre antes de gastar en publicidad.* Fuente: `PLAN_LANZAMIENTO.md` §4.

**Legal y fiscal**

8. **Abogado y contrato.** ¿Hay abogado? (D4). Los contratos en `docs/venta/contrato/01–05` son borradores generados por IA, sin revisión. Hay 20 puntos para el abogado en `PUNTOS_PARA_ABOGADO.md`. *Recomendación: contratar una revisión de esos 20 puntos antes de vender, y no firmar el borrador tal como está.*
9. **Datos de la empresa para el contrato.** Nombre legal de la proveedora, RNC y domicilio. Los pide `PUNTOS_PARA_ABOGADO.md` (punto 1). *Recomendación: enviarlos a Norexos 1 para que el abogado los use.*
10. **e-CF y factura fiscal del servicio.** Hay conflicto de fechas (C7). *Recomendación: que el contador confirme por escrito el plazo y si el resumen del día de GV es factura fiscal (pregunta P7 del diseño de GV).*

**Instalador**

11. **Certificado de firma de código del instalador.** Lo compra la dueña (`PLAN_MAESTRO_TODO.md`, PC-17). Es ruta crítica del lanzamiento. *Recomendación: comprarlo ya, porque su trámite tarda y bloquea la venta del instalador.*
12. **Modelo de venta y actualización del instalador.** Pendiente: suscripción mensual o licencia por PC; actualización a mano o automática. *Recomendación: primero «instalar encima conservando datos», que ya tiene ruta simple; decidir el modelo junto con los precios.* Fuente: `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 47); `PENDIENTES_NOCHE_30OCT.md` (4 decisiones E3).

**Operación del negocio**

13. **H-19: pagos a proveedores con caja registrada.** Sin respuesta. **La pregunta exacta no está escrita en los documentos leídos**, así que no puedo describir las opciones. *Recomendación: que Norexos 1 la reenvíe con opciones concretas antes de que la dueña decida.* Fuentes: `PENDIENTES_NOCHE_30OCT.md`; `PLAN_DE_HOY_1NOV.md`.
14. **Lista de IP permitidas de la base de datos (Render).** Hoy la base no acepta conexiones externas. *Recomendación: dejarla cerrada, o abrirla solo para las IP fijas que necesitemos, nunca a todo internet.* Fuente: `PENDIENTES_NOCHE_30OCT.md` (punto 11 y reportes del 1-nov).
15. **Copia diaria de la base fuera de Render.** Pendiente desde el 15-oct; el plan está en `docs/RESPALDO_CLOUD_RENDER.md` y no está activado. *Recomendación: activarla; sin copia, una falla de Render podría costar todos los datos.*
16. **Cupo de GV (D1): bloquear o avisar.** Opciones: A, bloquear; B, avisar. *Recomendación: B, avisar, como propone `PLAN_MAESTRO_NOREXOS.md`.*
17. **Criterio de devoluciones.** Hay que escoger uno solo: por **fecha de la venta original** (la opción que sugiere `PLAN_DE_HOY_1NOV.md`) o por **fecha de la devolución**. El documento no tiene la decisión escrita de la dueña. *Recomendación: fecha de la venta original, en tienda, reportes y GV por igual.* Ver C1.
18. **Incentivo GV: ¿a quien registra o a quien cobra?** Ver C2. Además falta confirmar que el incentivo se prorratee según lo que se cobra, y dónde va el tipo «Maquilladora profesional», que hoy no existe en el sistema (`RESPUESTA_CLAUDE_PC_27OCT.md`, orden 103, «DUDA»). *Recomendación: cobrador y prorrateo, como está en el commit, si la dueña lo confirma; el tipo nuevo se crea como categoría aparte.*
19. **Caja GV: 14 preguntas abiertas (P1–P14)** del diseño `docs/diseno/GV_CIERRE.md` (en la rama `claude-pc/gv-cierre`). Las más urgentes: P1 (¿una persona puede tener abierta caja de tienda y de GV a la vez?), P4 (¿la caja GV es ciega?), P6 (¿de qué caja salen los reembolsos en pesos?) y P7 (¿el resumen del día es factura fiscal?). *Recomendación: responder P7 primero, porque si es fiscal el diseño cambia.*
20. **Nombres de las pantallas.** «Punto de venta» o «POS»; «GV Makeup Studio» o «Cursos y cobros». *Recomendación: usar el nombre del menú en todos los documentos, para que la cajera lo vea igual.* Fuente: `PREGUNTAS_DUENA_VENTA.md` (puntos 2–3).
21. **Cuadres que dependen de la dueña.** Cuadre de Wendy tras FS-328 (esperado 9,700 contra contado 2,200); diferencia de Lizbeth (117,000 contra 11,700; ver `PENDIENTES_NOCHE_30OCT.md`); transferencias de Mercancía sin verificar (65, por RD$ 242,540). Son decisiones de dinero de la dueña; no se tocan sin conteo nuevo suyo. Fuente: `PENDIENTES_NOCHE_30OCT.md`.
22. **«La Lacto».** `PENDIENTES_NOCHE_30OCT.md` la menciona como decisión pendiente, pero el documento no dice qué es. *Recomendación: que la dueña lo aclare en una línea.*

**Acciones que solo puede hacer la dueña**

23. Pegar las instrucciones nuevas en la rutina horaria de Claude PC, cambiar la clave de la cuenta `claude-acceso`, y poner las credenciales de entorno para revisar el sistema con cuenta. **No escribo ni pego valores de credenciales.** Fuentes: `PLAN_DE_HOY_1NOV.md`; `ARRANQUE_NOREXOS1_1NOV.md`.

---

## 3) Lo que falta construir (dueño y estado)

| Pieza | Dueño | Estado |
|---|---|---|
| **Arreglo del CI rojo de dinero** (devoluciones: falla `tests/dinero-auditoria.test.ts` líneas 902 y 942, diferencia de 118) | Norexos 1 con agente de la nube (`claude-pc/fix-ci-mes`) | **Urgente.** Falla desde las 04:00 UTC del 1-nov. El primer arreglo (`4f994d7b`) no bastó; hay una segunda causa (devolución de otro mes). Bloquea todo lo de dinero y los despliegues. |
| Incentivos GV (pago a quien cobró, fijos por alumna) | Norexos PC (`claude-pc/gv-incentivos`, commit `c227d6b`) | Hecho según su mensaje; **bloqueado por el CI rojo**. Falta la decisión 18. |
| Correcciones de dinero (H-01, H-08, H-04) | Agente de la nube (`claude-pc/fix-dinero`) | Bloqueado por el CI rojo. |
| Seguridad menor | Agente de la nube (`claude-pc/fix-seg-menor`) | Bloqueado por el CI rojo. |
| Animación de reportes | Agente de la nube (`claude-pc/anim-reportes`) | Bloqueado por el CI rojo. |
| Parches de la pieza 23 y pruebas `pq-*`, `zod4` | Agentes (`claude-pc/pq-*`) | Bloqueados por el CI rojo. |
| **Cierre propio de GV** (caja GV, cierre, resumen del día) | Norexos PC (orden 106) | Solo diseño (`claude-pc/gv-cierre`, `b7918c54`). Sin construir. Depende de la decisión 19 y de `gv-incentivos`. |
| Reembolsos GV en pesos | Norexos PC (orden 106) | Pendiente; va con el cierre GV. |
| **Reportes PDF y Excel** (A: motor de exportación; B: guía de cada reporte; C: botones en pantalla; D: maqueta del informe) | A y B: agentes de la nube; C: ChatGPT PC; D: ChatGPT nube | **No verificado.** Las ramas que pide la orden (`claude-pc/reportes-export`, `claude-pc/reportes-guia`) **no existen en origin**. Hay otras (`claude/reportes-40`, `claude/reportes-arreglos`, `claude/reportes-grupos`) que no revisé. |
| Desglose del mes | Norexos 8 | Desplegado el 30 y 31-oct (`PENDIENTES_NOCHE_30OCT.md`). |
| IA de ventas (T33) | Norexos 9 (`claude/ia-ventas-linea`) | Lista, sin desplegar. Espera la decisión de la dueña. Migraciones aditivas. |
| Instalador sin internet: auditoría | Claude PC (`claude-pc/instalador-sin-internet`) | **No existe la rama ni el documento** `docs/auditoria/INSTALADOR_SIN_INTERNET_1NOV.md`. Hay una rama distinta, `claude-pc/instalador-e3`, que no revisé. |
| Licencia, activación y actualización del instalador (E3) | Taller, luego Norexos PC | Espera las decisiones 11 y 12. |
| Landing `norexos.ai` | Norexos 1 publica; dueña registra el dominio | Textos listos (`LANDING_TEXTOS.md`, versión en inglés `LANDING_TEXTOS_EN.md`); DNS preparado (`docs/venta/dominio/DNS_Y_CORREO.md`); rama `claude-pc/dominio-landing`. Falta dominio y publicar. |
| Contrato, privacidad, acuerdo de tratamiento y condiciones de cobro | Norexos 1 (borradores); abogado (revisión) | Borradores en `docs/venta/contrato/01–05`, sin revisión. |
| Límite de IA por plan y tickets «Pedir un cambio» (E6) | Taller | Por construir. |
| Cambio de nombre a Norexos en el código (E1) | Taller | En curso, estado no verificado. No renombrar ramas, servicios de Render ni claves. |
| Textos en inglés (E4) | Taller, Forja, Brazo; revisa Norexos 1 | Borradores (`LANDING_EN_PLANES.md`). |
| Respaldo diario fuera de Render | Dueña (decisión 15) y Norexos 1 | Plan escrito; no activado. |

---

## 4) Lo que falta verificar

- **Instalador sin internet.** Falta una prueba en una PC Windows limpia, sin red: instalar, crear el negocio de prueba, vender, abrir y cerrar caja, sacar un reporte en PDF y en Excel, apagar, volver a abrir y actualizar. Solo la dueña o ChatGPT PC pueden hacerla; Norexos 1 no tiene Windows. No está certificado. La lista de lo que necesita internet no está hecha (ver la tabla de la sección 3).
- **Reportes PDF y Excel.** Hay que comprobar que las cifras son idénticas a las de la pantalla, que no dependen de internet (fuentes ni gráficas remotas), que la fórmula de devoluciones es la misma en todos (decisión 17), y que no hay inyección de fórmulas en Excel. Nada de esto está probado.
- **Despliegue.** Ahora no se puede desplegar: el CI de `nexora-cloud` está rojo desde el 1-nov a las 04:00 UTC. Antes de cualquier despliegue hay que tener 3 CI verdes en el mismo SHA y una lectura reciente (menos de 2 horas) de que no hay cajas abiertas. Último despliegue de la web: rediseño del 31-oct a las 12:10 UTC (`PENDIENTES_NOCHE_30OCT.md`).
- **Caja GV.** No hay pruebas de caja GV, porque el cierre no está construido.
- **Costo real de hosting por cliente.** No está medido. El estudio usa precios publicados de Render y no tiene la medición del ancho de banda (`ESTUDIO_PRECIOS_MERCADO.md` §3, «NO VERIFICADO»).
- **Cobro de prueba con el procesador.** Pendiente: requiere la cuenta de comercio.
- **Pruebas con cuenta real en vivo.** Pendiente desde el 31-oct: depende de las credenciales de entorno (decisión 23).

---

## 5) Orden sugerido para terminar

1. **Hoy: arreglar el CI rojo de dinero.** Antes hay que confirmar el criterio de devoluciones (decisión 17); la recomendación es fecha de la venta original. Sin CI verde no se mezcla ni se despliega nada de dinero. Bloquea: `gv-incentivos`, `fix-dinero` y todos los despliegues.
2. **Mezclar en este orden**, uno por uno, con 3 CI verdes: arreglo de CI → incentivos GV → dinero → seguridad → diseño → `pq-*` (`PLAN_DE_HOY_1NOV.md`). Desplegar la API primero y luego la web, y verificar en vivo.
3. **Caja GV.** Responder P7, P1, P4 y P6 (decisión 19) → construir el cierre GV → reembolsos en pesos. Depende de `gv-incentivos`.
4. **Reportes PDF y Excel.** Primero la guía (B), luego el motor (A), luego los botones (C). La maqueta (D) es insumo. Hay que verificar que las cifras coinciden con la pantalla.
5. **Decisiones de la dueña, en un solo mensaje:** plan y precios (1), moneda (2), procesador (3), dominio (5), soporte (6), abogado (8), firma del instalador (11), modelo del instalador (12), y las que quedan. Desbloquea la landing, el cobro, el contrato y el piloto.
6. **Instalador.** Auditoría sin internet → prueba en Windows limpio sin red → firma → instalación con acta. Bloquea la venta del instalador y el piloto.
7. **Lanzamiento.** Landing (depende del dominio) → cobro de prueba real (depende del procesador y la cuenta de comercio) → piloto con 1–2 clientes (decisión: quiénes) → venta limitada. Antes hay que fijar la fecha de fin (C6).

**Qué bloquea qué:** el CI rojo bloquea todo lo de dinero. El dominio bloquea la landing. La cuenta de comercio bloquea el cobro. El abogado bloquea el contrato, y el contrato bloquea el cobro. La firma del instalador bloquea la venta del instalador. Los precios bloquean el contrato y la landing de planes.

---

## 6) Riesgos y cosas dudosas

**Contradicciones entre documentos**

- **C1. Devoluciones.** `PLAN_DE_HOY_1NOV.md` y `ORDEN_REPORTES_AMIGABLES_1NOV.md` dicen que la devolución se resta en el mes de la venta original. `AUTOAUDITORIA_3V_3W_3X_3Z_CHATGPT_NUBE.md` (línea 8) dice que la devolución va por fecha de devolución. El código tiene las dos reglas: `/dashboard/year` usa la fecha de devolución y el desglose usa la fecha de venta. Esa diferencia es la causa del CI rojo.
- **C2. Incentivo GV.** La orden 103 y el registro del 31-oct dicen que el incentivo va a **quien registra** la inscripción. El commit `c227d6b` (1-nov) dice que va a **quien cobra**, y lo llama decisión de la dueña. No encontré ese texto de la dueña en los documentos. Hay que confirmarlo (decisión 18).
- **C3. Margen 15 %.** `CLAUDE.md`, `PLAN_MAESTRO_NOREXOS.md`, `PLAN_LANZAMIENTO.md` y `PROPUESTA_PRECIOS.md` siguen escribiendo que el 15 % es mínimo obligatorio. La decisión del 1-nov lo convierte en referencia. Esos documentos hay que actualizarlos.
- **C4. Hosting y margen del plan A.** `PROPUESTA_PRECIOS.md` dice que todos los planes superan el 15 % si el hosting queda bajo US$ 8, 15 y 30 por cliente. `ESTUDIO_PRECIOS_MERCADO.md` (31-oct) calcula con Render dedicado un hosting de US$ 52 a 77: el Básico da −80 % y el Medio 11.5 % (o −31 % con el espacio Pro). **El plan A no cumple la regla sin hosting compartido.**
- **C5. Abogado y procesador (Azul).** `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 46, 29-oct) dice que se quitaron «abogado/legal» y «cobro (Azul)» del plan. `PLAN_MAESTRO_NOREXOS.md`, `PLAN_LANZAMIENTO.md` y `PLAN_DE_HOY_1NOV.md` siguen pidiéndolos a la dueña.
- **C6. Fecha de lanzamiento.** `PLAN_MAESTRO_NOREXOS.md` dice 2 de diciembre (peor caso 23 de diciembre). El plan v2 de `RESPUESTA_CLAUDE_PC_27OCT.md` (orden 46) dice 24 de noviembre. Hay que escoger uno.
- **C7. e-CF.** `PLAN_MAESTRO_NOREXOS.md` dice que e-CF está fuera de la versión 1. `INSTRUCCIONES_ACTUALES.md` (sección 3i, 10-oct) habla de un plazo de e-CF el 15/11/2026 para contribuyente pequeño. `PUNTOS_PARA_ABOGADO.md` (punto 4), basado en el aviso DGII 14-25, dice que el último plazo para micro, pequeños y no clasificados venció el 15-may-2026. **Es un riesgo fiscal.** Lo tiene que confirmar el contador (decisión 10).
- **C8. Correo de soporte.** `PUNTOS_PARA_ABOGADO.md` usa `soporte@norexos.ai` como si ya estuviera decidido. `PREGUNTAS_DUENA_VENTA.md` y `PLAN_LANZAMIENTO.md` dicen que lo decide la dueña.
- **C9. Límite de IA.** `PROPUESTA_PRECIOS.md` dice 10 preguntas por día en Medio. El sistema hoy topa en 30 por día (`PENDIENTES_NOCHE_30OCT.md`).
- **C10. Estudio de precios.** `PROPUESTA_PRECIOS.md` (30-oct) dice que no hay estudio de mercado. El estudio existe desde el 31-oct. Es un documento desactualizado, no una contradicción de fondo.
- **C11. Documentos que no están en esta rama.** `docs/diseno/GV_CIERRE.md` (la orden 106 dice «construir según» ese documento), `docs/auditoria/INSTALADOR_SIN_INTERNET_1NOV.md`, `PROCESO_RAMAS_1NOV.md`, `SEGURIDAD_RAMAS_1NOV.md` y `docs/coordinacion/REPORTE_VENTAS_OCT2026_POR_AREA.md` no existen aquí. El de GV sí existe en la rama `claude-pc/gv-cierre`.
- **C12. «3 CI verdes».** Varios documentos (`PENDIENTES_NOCHE_30OCT.md`, `PLAN_DE_HOY_1NOV.md`) hablan de CI en verde como condición. Desde el 1-nov el CI de `nexora-cloud` está rojo. Ningún documento de esta semana afirma que esté verde.

**Riesgos**

- **Ventas bajo el 15 %.** Sin bloqueo, la cajera puede vender a pérdida. Es decisión de la dueña, y la revisión queda en sus manos al cobro. Hay que tenerlo presente en el reporte de margen bajo.
- **Plan A sin hosting compartido.** Puede perder dinero en cada cliente del Básico (C4).
- **Contratos y datos personales.** Los borradores son generados por IA y no están revisados por un abogado. Quedan dudas sobre el tope de responsabilidad, sobre si el cliente puede considerarse consumidor (Ley 358-05), y sobre las transferencias internacionales de datos (Render, Anthropic, Google Drive, Telegram). `PUNTOS_PARA_ABOGADO.md` las lista.
- **«La IA de ventas no guarda consultas».** Está afirmado en el documento legal a partir de la rama `claude/ia-ventas-linea`, que no está desplegada. Hay que confirmarlo antes de publicarlo.
- **Instalador.** Ninguna prueba en Windows limpio. No está certificado. No se debe vender como instalación certificada.
- **Caja GV mezclada con la de tienda.** Mientras no se decida P1–P14, existe el riesgo de que una caja GV reciba ventas de tienda o al revés (el diseño lo señala en su sección 6).
- **Reportes con cifras de dinero.** Si el CI de dinero sigue rojo, las cifras que ve la dueña pueden no coincidir con las de los PDF y Excel nuevos.
- **Credenciales.** Hay pendiente cambiar la clave de `claude-acceso`. No se escriben valores en documentos ni en chats.

---

## Fuentes leídas

- `AGENTS.md`, `CLAUDE.md`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md`, `docs/operacion/PENDIENTES-DUENA.md`
- `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md`, `PLAN_DE_HOY_1NOV.md`, `RESPUESTA_CLAUDE_PC_27OCT.md` (órdenes 46, 47, 58, 66, 74, 94–109 y las secciones de GV), `ORDEN_CHATGPT_CONSTRUCTOR_1NOV.md`, `ORDEN_CHATGPT_HOY_1NOV.md`, `ORDEN_INSTALADOR_SIN_INTERNET_1NOV.md`, `ORDEN_REPORTES_AMIGABLES_1NOV.md`
- `docs/venta/PROPUESTA_PRECIOS.md`, `PREGUNTAS_DUENA_VENTA.md`, `PLAN_LANZAMIENTO.md`, `ESTUDIO_PRECIOS_MERCADO.md`, `contrato/PUNTOS_PARA_ABOGADO.md`, `contrato/PUNTOS_VERIFICADOS.md` (resumen), `dominio/DNS_Y_CORREO.md` (existencia)
- `docs/proyecto/PLAN_MAESTRO_NOREXOS.md`, `docs/operacion/GV_CATALOGO_CURSOS.md`
- Rama `claude-pc/gv-cierre`: `docs/diseno/GV_CIERRE.md` (secciones 2.7, 6 y 7)
- Mapa del sistema (`graphify query`, con `docs/sistema/mapa/graph.json.gz`). Solo sirvió de apoyo; las cifras se tomaron de los documentos. `graphify-out/` está en `.gitignore`, no se sube.
