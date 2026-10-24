# Plan de las 10 mejoras de Nexora POS (para venderlo y que los clientes usen IA)

> **Documento compartido** para la dueña, Claude (nube) y ChatGPT PC. Fuente única: si algo cambia, se edita aquí.
> Origen: competencia de 10 propuestas (skill `arena`), ganó la a004 tras 4 rondas, 24-oct-2026.
> Orden de la dueña (24-oct): «quiero que lo ejecutemos todo».
> Reglas que siguen valiendo: CLAUDE.md, AGENTS.md y docs/coordinacion/INSTRUCCIONES_ACTUALES.md (despliega solo Claude con los 3 CI en verde; nada se aplica en la tienda sin su confirmación).
> **Regla fiscal fija:** toda venta lleva su comprobante; el sistema no tendrá ninguna función para dejar ventas fuera de lo que se reporta a la DGII.

## Estado (actualizar al avanzar)

| # | Mejora | Responsable | Estado |
|---|---|---|---|
| 1 | Factura electrónica e-CF (tienda y clientes) | Dueña (contador, OFV, certificado, proveedor) + ChatGPT PC (programación) + Claude (revisión/despliegue) | Pendiente: confirmar grupo DGII antes del lun 26-oct |
| 2 | Terminar fase 1 + producto en línea con cobro real | ChatGPT PC + Claude (Render) + Dueña (procesador de pago) | En curso (verify rojo desde 23-oct) |
| 3 | Quitar lo de Macgen + interruptores por negocio | ChatGPT PC + Claude | Pendiente |
| 4 | Papeles legales y soporte | Dueña (abogado) + Claude (borradores) | Pendiente |
| 5 | 606 e IT-1 para el contador | ChatGPT PC + Claude + contador | Pendiente |
| 6 | «Pregúntele a Nexora» (IA solo lectura) | ChatGPT NUBE + Claude (orden `ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`, 24-oct) | Pendiente (fase 2) |
| 7 | Conector MCP/OAuth para la IA del cliente (solo propone) | ChatGPT PC + Claude + Dueña (decide la regla del 19-oct) | Pendiente |
| 8 | Lectura de facturas con IA para todos | Claude (cambio de modelo) + ChatGPT PC | Pendiente |
| 9 | Asistente de WhatsApp con IA | Dueña (Meta) + ChatGPT PC + Claude | Pendiente (fase 0 Meta) |
| 10 | Resumen diario con IA | Dueña (cuenta Resend) + ChatGPT PC + Claude | Pendiente (paso cero: RESEND_API_KEY) |

---


## En 30 segundos

Hoy Nexora funciona bien para **una sola tienda, la suya**. Para venderlo hacen falta tres cosas:

1. que **facture legal** con la DGII, usted y cada cliente;
2. que **cada negocio se registre, pague y trabaje solo**;
3. que la **IA ayude sin poder dañar nada**.

**Lo que ya está hecho o encargado:**
- La separación entre empresas («fase 0») se **aprobó el 20 de octubre**: 155 rutas revisadas, 0 fugas.
- La «fase 1» ya está encargada a ChatGPT PC: registro, prueba gratis, cobro **de prueba (sin dinero real)**, solo lectura, exportación y respaldo por empresa.
- **Un bloqueo de hoy:** desde el 23 de octubre una prueba automática está en rojo en la versión para vender, por la tasa del dólar. Frena **solo el producto**; los arreglos de su tienda se pueden seguir desplegando. El arreglo ya está encargado.
- **La IA ya está dentro del sistema:** en Mercancía lee la foto o el PDF de una factura de proveedor y prepara la entrada para que una persona la revise.

**Lo urgente es su propia factura electrónica** (mejora 1). Según su grupo ante la DGII, la fecha límite puede ser el **1 de noviembre** (en 8 días) o el **15 de noviembre**. Su contador debe decirle cuál **a más tardar el lunes 26**.

**Orden:** las mejoras **1 a 4 impiden vender** si faltan; la **5** hace que los contadores lo recomienden; las **6 a 10 son la IA**. Los tiempos y costos son **estimados**, confírmelos antes de decidir. Las conversiones usan el dólar a unos RD$63.

---

## 1. Factura electrónica (e-CF) para su tienda y para cada cliente

**Qué es:** que cada venta salga con su comprobante electrónico aceptado por la DGII, a través de un proveedor autorizado (PSFE). Hoy el sistema maneja B01, B02, B14 y B15, pero **no ha emitido ningún comprobante oficial** y **no tiene nota de crédito**.

**Tipos que debe cubrir** (los que el sistema ya maneja hoy, pasados a electrónico, más los que faltan):
- **E31** (crédito fiscal) y **E32** (consumidor final): sustituyen a B01 y B02;
- **E44** (regímenes especiales) y **E45** (gubernamental): sustituyen a B14 y B15. Sin ellos, un cliente que hoy le factura a un ministerio no podría usar Nexora;
- **E34** (nota de crédito, para devoluciones) y **E33** (nota de débito): no existen hoy en el sistema;
- **E41** (compras) y **E43** (gastos menores), solo para los clientes que los necesiten. Pueden entrar después.

**Parte A: su tienda (urgente, no espera al software)**
- **Pequeño, micro o no clasificado:** facturas B válidas hasta el 15/11/2026. **Mediano o grande:** solo electrónica desde el **1/11/2026**. Su grupo **todavía no está confirmado**.
- Contratar un proveedor **no la convierte en emisora**. Usted tiene que pedir su autorización en la Oficina Virtual (OFV) de la DGII y sacar un certificado digital. **Hágalo ya**, sea cual sea la fecha.
- La conexión con Nexora no va a estar lista para ninguna de las dos fechas. **Puente:** facturar en el portal web del proveedor justo después de cobrar en Nexora. Cada venta sale con su comprobante en la mano, nunca en tandas al final del día. Se lleva una hoja compartida con **número FS de Nexora, e-NCF, monto y hora**, y en el cuadre de la noche se comparan los totales. El Facturador Gratuito de la DGII sirve de respaldo, pero la admisión no es automática.
- **Si el contador dice «mediano»:** ese mismo día firme con un proveedor que tenga portal y pregúntele al contador por la contingencia autorizada. No emita facturas B después del 31 de octubre por su cuenta.

**Parte B: cada cliente (lo que hace vendible el producto)**
- Cada negocio factura con **su propio RNC**, su autorización, su certificado y su cuenta con el proveedor, guardados aparte de los demás. Hace falta un paso de **«alta fiscal»** que lo guíe por todo eso.
- **Sin internet:** si el proveedor **firma en la caja**, la venta sale con la leyenda de contingencia y se envía en menos de 72 horas. Si **solo firma en la nube** (lo más común), el negocio necesita **secuencias B de contingencia autorizadas** (máximo 15 días, regularizadas en 30) y el sistema debe asignarlas a la venta sin conexión y luego ligarlas a su e-CF. A cada proveedor hay que preguntarle: **«¿firman en la caja sin internet?»**.

**Costos conocidos:**
- Certificado DIGI: **US$29.95 al año**, unos RD$1,900.
- Timbro (INDEXA): **sin cargo por emitir hasta el 31/12/2026**. Desde 2027, por RNC y más ITBIS: plan **Inicio** RD$0/mes con 500 facturas y RD$0.75 por cada adicional; plan **Negocio** RD$1,790/mes con 10,000 facturas y RD$0.14 por adicional.
- **Ejemplo:** un cliente con 3,000 ventas al mes paga unos **RD$2,212 (Inicio) o RD$2,112 (Negocio) con ITBIS**, más del doble del plan de RD$990. Desde unas 2,900 facturas al mes conviene Negocio.
- **La conexión con Nexora se cotiza aparte**, aunque emitir sea gratis. Alanube no publica precios.

**Lo que usted decide:**
- el proveedor: pida cotización por escrito a dos de la lista de la DGII;
- quién paga el proveedor de cada cliente. **Recomiendo que lo pague cada cliente directamente**, o que el plan incluya un número fijo de facturas (por ejemplo, 500) y el resto se cobre aparte. Si lo incluye sin límite, los que más venden le hacen perder dinero.

No recomiendo construir un emisor propio certificado: es más lento.

**Tiempo estimado:** 6 a 10 semanas de programación (seis tipos, nota de crédito ligada a la venta, alta fiscal, contingencia), más el trámite de la DGII, que no depende de nosotros.

**Listo cuando:**
- una venta de su tienda sale con su e-NCF aceptado, y una devolución saca su E34 ligada a esa venta;
- una empresa de prueba con otro RNC hace lo mismo, **y además factura una venta a gobierno en E45**, sin ver nada suyo.

## 2. Terminar la fase 1 y poner el producto en línea con cobro real

**Qué es:** lo que ChatGPT PC tiene encargado desde el 20 de octubre:
- registro en la web con **14 días gratis**;
- asistente de arranque (categorías, productos desde Excel, cajeras, primera caja);
- cobro mensual **con un proveedor de prueba, sin dinero real**. Nexora no guarda tarjetas;
- límites por plan;
- si el cliente no paga, 7 días de gracia y luego **solo lectura**. Sus datos nunca se borran;
- descarga completa de sus datos y respaldo cifrado por empresa.

**Ojo: terminar la fase 1 no basta para vender.** Faltan dos cosas que el encargo no permite hacer sin usted:
- **El sistema aparte para los clientes en Render** (dos servicios y una base de datos nueva, nunca la de su tienda). Todavía no existe. Lo crea Claude cuando usted lo autorice, y tiene su propia mensualidad.
- **El cobro con dinero real.** El plan lo deja para la fase 3, con 3 a 5 negocios piloto. Necesita una cuenta de comercio con el procesador de pago.

**Bloqueo de hoy:** la prueba `verify` está en rojo desde el 23 de octubre en la versión para vender. Hasta que pase a verde, la fase 1 no avanza. **Su tienda no está frenada por esto.**

**Lo que usted decide:**
- **autorizar el sistema aparte en Render**; pídale antes a Claude el costo mensual exacto;
- **el procesador de pago** (Azul, Cardnet o PayPal), y **abrir ya la cuenta de comercio**: es un trámite con el banco que tarda semanas;
- los precios finales. Los propuestos van de **RD$990 a RD$7,990 al mes**; pruébelos con 3 a 5 negocios piloto;
- si cobra aparte la instalación asistida.

**Tiempo estimado:** el rojo, días. La fase 1, 4 a 6 semanas. El cobro real depende del procesador.

**Listo cuando:**
- una persona que usted no conoce se registra, carga 3 productos y vende sin llamarla;
- un cobro de prueba falla, la cuenta pasa sola a solo lectura y el cliente todavía puede descargar sus datos;
- **un negocio piloto paga su primera mensualidad real.**

## 3. Quitar lo de Macgen y dejar que cada negocio lo ajuste a su medida

**Qué es:** sacar del código lo que es solo suyo y dejar que cada cliente ponga lo propio.
- **Parte rápida:** nombre, logo, RNC, pie del ticket y cuentas de banco. Hoy la pantalla de entrada dice «Grupo MacGen · GV Makeup», el ticket usa su logo y hay unas 18 menciones fijas.
- **Parte larga:** interruptores para prender o apagar lo que un negocio no use: lotes y vencimientos, contraentregas, incentivos de vendedoras, tasa del dólar, mensajero.

**Por qué:** a una ferretería no le sirven las fajas ni los lotes. Estas piezas están muy metidas en el sistema; el rojo de hoy salió justo de la tasa del dólar.

**Lo que usted decide:**
- un solo nombre para todo (el README todavía dice «FitStore»);
- si registra la marca «Nexora» en ONAPI antes de anunciarla. Primero verifique que nadie la tenga.

**Tiempo estimado:** la parte rápida, 1 semana. Los interruptores, 3 a 5 semanas.

**Listo cuando:** una empresa de prueba de otro ramo apaga lo que no usa y no ve nada de Macgen en pantallas, tickets ni reportes.

## 4. Papeles legales y soporte para vender en serio

**Qué es:**
- contrato y términos de servicio;
- política de privacidad según la Ley 172-13, que diga claramente que la IA procesa datos del cliente y con qué proveedor;
- avisos de licencias de terceros, que hoy faltan en la app según el propio inventario legal;
- un centro de ayuda con guías cortas y una página que diga si el sistema está funcionando;
- soporte por WhatsApp o correo, solo cuando la ayuda y la IA no lo resuelvan.

**Por qué:** sin contrato, un error o una fuga de datos cae sobre usted personalmente. Sin soporte ordenado, cada cliente nuevo le quita tiempo de la tienda.

**Lo que usted decide:**
- contratar un abogado para revisar los borradores que ya existen en `docs/legal`. Es un pago único; pida cotización;
- quién atiende el soporte.

**Tiempo estimado:** 1 a 2 semanas de programación, más lo que tarde el abogado.

**Listo cuando:** el abogado da el visto bueno por escrito y cada cliente acepta los términos al registrarse.

## 5. Terminar los reportes para el contador de cada cliente (606 e IT-1)

**Qué es:** que el sistema entregue el **606** (compras y gastos) en el formato oficial de la DGII y la base del **IT-1** (ITBIS del mes). El 607 y el 608 solo hacen falta en los meses en que el negocio no facture 100 % electrónico.

**Lo que ya existe (la mitad está hecha):** en Mercancía, la exportación **«Compras del período en Excel para la contable»** ya trae fecha de factura, proveedor, **RNC, NCF, ITBIS**, condición y total. Además ya filtra por fecha de factura, como pide el 606.

**Lo que falta:**
- **Gastos** (alquiler, luz, mensajería): hoy guardan el suplidor (y, por medio de él, su RNC), pero **no el NCF ni el ITBIS**. Hay que agregarlos y pedirlos cuando el gasto tenga factura con NCF.
- En las **entradas de mercancía** el NCF y el ITBIS ya existen, pero se pueden dejar vacíos. Hay que exigirlos cuando la compra tenga comprobante.
- Pasar compras y gastos juntos al **formato oficial del 606** (columnas, códigos de tipo de gasto y forma de pago) y sacar la base del IT-1.
- Los gastos ya registrados no tienen NCF. El primer 606 completo saldrá bien **solo para un mes registrado entero con los campos nuevos**.

**Por qué:** en RD el contador es quien recomienda o rechaza un sistema. Si recibe el archivo listo para subir, se lo recomienda a sus otros clientes. No impide vender, pero ayuda mucho a vender.

**Lo que usted decide:** pedirle a su contador que pruebe el primer archivo con sus compras reales.

**Tiempo estimado:** 2 a 3 semanas, más un mes de uso para la primera prueba real.

**Listo cuando:** su contador sube a la DGII un 606 de un mes registrado entero con los campos nuevos, y la DGII lo acepta sin corregir nada a mano.

---

## 6. «Pregúntele a Nexora»: la IA que consulta y explica

**Qué es:** un botón en cada pantalla para preguntar con palabras normales: «¿qué se vendió más esta semana?», «¿qué se me va a agotar?», «¿por qué mi caja no cuadra?», «¿cómo hago un traspaso?».

**Cómo es seguro:** la IA **solo lee**, y solo los datos de esa empresa y el manual. No mueve dinero, inventario ni precios. Si el usuario quiere un cambio, le indica dónde hacerlo.

**Costo de la IA:**
- Con el modelo económico (Claude Haiku 5.5), una pregunta normal cuesta **menos de RD$0.50**.
- Una pregunta larga, que revise un mes entero de pagos, puede costar **unos RD$5**. Por encima de cierto tamaño de datos, el precio sube 5 veces.
- Por eso **el tope de cada plan cuenta consultas y también cantidad de datos (tokens)**. Cada pregunta tiene un tamaño máximo; si se pasa, la IA pide acotar las fechas.
- Así, las 30 consultas del plan de RD$990 cuestan **menos de RD$15 al mes**, y como mucho unos RD$150 si todas fueran largas.
- El modelo mejor se usa solo para las preguntas difíciles. Hay un contador visible.

**Lo que usted decide:** cuántas consultas y cuántos datos trae cada plan, y si vende paquetes adicionales.

**Tiempo estimado:** 3 a 5 semanas. Ya está en el plan como fase 2.

**Listo cuando:** responde bien 20 preguntas típicas de prueba y nunca muestra datos de otra empresa.

## 7. Conector para que la IA del cliente trabaje, pero solo proponiendo

**Qué es:** convertir **su propio método** en una función del producto. Hoy usted trabaja así con Claude: la IA prepara el cambio, lo verifica, usted confirma y todo queda en la bitácora. Para los clientes son tres piezas:

- **Un conector de Nexora para Claude y ChatGPT.** El cliente no es programador, así que no le vamos a dar una «llave» para pegar en ninguna parte. En su app de Claude o ChatGPT toca **«Agregar conector» → Nexora**, entra con su usuario y contraseña de Nexora y autoriza. Técnicamente esto es un **servidor MCP con inicio de sesión OAuth**: el estándar que usan esas apps para conectarse con otros sistemas. Esa sesión es un **usuario de IA con permisos limitados**, aparte de las terminales que aprueba el gerente, y el dueño la apaga con un botón. (Para clientes técnicos se puede dar además una llave de API.)
- **Una bandeja de «cambios propuestos»** (conteos, entradas de mercancía, productos nuevos), donde una persona con permiso aprueba o rechaza.
- **Una bitácora** de quién propuso y quién aprobó.

**Por qué:** es lo que distingue a Nexora. Otros sistemas ofrecen un chat; este deja que la IA haga el trabajo pesado sin poder dañar nada sola. Y no está en ningún plan todavía.

**Ojo: esto cambia una regla suya.** Su plan del producto (19 de octubre) dice que la IA del cliente **«nunca mueve dinero, inventario ni precios»**. Con esta mejora la IA sí **propone** cambios de inventario, que se aplican solo cuando una persona los aprueba. Usted decide si cambia la regla. Si dice que no, el conector se queda en **solo lectura**, que de todos modos ya vale la pena.

**Reglas fijas:**
- La IA nunca aprueba sus propios cambios.
- Nunca anula ventas ni toca la caja ni el dinero.
- **Precios fuera en la primera versión.** Si se agregan más adelante, el sistema rechaza cualquier precio por debajo del margen mínimo del negocio y nunca cambia un precio por una oferta (la oferta la aplica la caja, como hace usted).
- El propio sistema revisa las reglas de cada negocio, como el margen mínimo, antes de dejar aprobar.

**Costo de la IA:** lo paga el cliente con su propia suscripción de Claude o ChatGPT. A usted no le cuesta.

**Tiempo estimado:** 6 a 8 semanas (el conector con su inicio de sesión es la parte más grande).

**Listo cuando:** una dueña de prueba, sin ayuda técnica, conecta Nexora desde su app de Claude o de ChatGPT, le pide un conteo, una persona lo aprueba en la bandeja y el inventario cambia solo después de esa aprobación.

## 8. Lectura de facturas de proveedor con IA, para todos los clientes

**Qué es:** la función que ya existe (foto o PDF de la factura → entrada lista para revisar), disponible en cada empresa con un tope de uso por plan.

**Por qué:** ya está hecha y ahorra horas de digitación. Es la forma más barata de decir «este sistema trae IA».

**Qué falta:**
- **Bajar el costo.** Hoy usa un modelo caro (Opus 5.5), a unos **RD$5 por factura**. Con uno intermedio (Sonnet 5.5) bajaría a unos **RD$2.50**; con el económico (Haiku 5.5), a **menos de RD$0.50**. El modelo está fijado en la configuración de Render, así que cambiarlo **no es reprogramar, pero sí es un despliegue** con las 3 pruebas en verde, hecho por Claude. Antes se prueba con 10 facturas reales: se mide lo que cuesta de verdad cada una (los modelos no cuentan el texto igual) y se revisa qué pasa cuando una lectura falla, para que no deje la entrada en blanco. El modelo caro se deja para las facturas difíciles.
- **Leer también el RNC del suplidor, el NCF y el ITBIS.** Hoy solo lee total, códigos, cantidades, costos, lotes y vencimientos. Con esos tres datos, la lectura **alimenta directamente el 606** de la mejora 5.
- Que cada empresa vea cuánto lleva usado.
- Mantener lo que ya hace bien: no mueve inventario sin que una persona revise.

**Tiempo estimado:** el cambio de modelo, 1 a 2 días con la prueba y el despliegue. Los datos fiscales y el contador por empresa, 1 semana.

**Listo cuando:** 10 facturas reales de suplidores distintos se leen bien con el modelo escogido, **con su RNC, NCF e ITBIS**, y el costo medido por factura queda anotado.

## 9. Asistente de WhatsApp con IA para las ventas de cada negocio

**Qué es:** llevar a todos los clientes lo que usted pidió el 13 de octubre para su número de suplementos. Ese encargo **todavía está en la fase 0** (revisar Meta), sin programar.
- El cliente escribe por WhatsApp.
- La IA consulta existencia y precio (solo lectura) y redacta la respuesta.
- **Una vendedora la aprueba antes de enviarla.**
- Cada negocio pone sus reglas de descuento, siempre por encima de su margen mínimo.
- Los reclamos, las devoluciones y los pagos dudosos pasan a una persona.

**Por qué:** en RD se vende por WhatsApp. Una caja que también ayuda a contestar WhatsApp se vende sola.

**Antes de ofrecerlo a otros negocios hay cuatro requisitos de Meta:**
1. **La política de Meta sobre IA.** Meta no permite asistentes de IA «de uso general» en la plataforma de WhatsApp para empresas. Un asistente de tienda con un fin concreto (existencias, precios, pedidos) suele estar permitido, pero **hay que confirmarlo por escrito**: es el punto (c) de la fase 0 que usted ya ordenó. Si no se permite, esta mejora no se vende.
2. **Nexora como «proveedor tecnológico» de Meta** (Tech Provider), o trabajar a través de un socio autorizado (BSP). Sin eso Nexora puede conectar su número, pero no el de otros negocios. Con eso, el cliente conecta su número con un botón («registro integrado» de Meta).
3. **Cada cliente verifica su propio negocio en Meta** y paga sus mensajes a Meta con su propia forma de pago. Usted no carga con esa cuenta.
4. **El número.** Conectarlo al sistema puede sacarlo de la app WhatsApp Business del celular de la vendedora, con su historial. Meta a veces permite usarlo en los dos lados a la vez («coexistencia»), pero **no se pudo verificar para su número**.

**Costo:** la IA cuesta centavos por conversación con el modelo económico. Meta cobra sobre todo los mensajes que inicia el negocio; confirme su lista de precios vigente.

**Lo que usted decide:**
- **¿mismo número o número nuevo?** Recomiendo **un número nuevo para la prueba**. El de la vendedora solo se conecta si Meta confirma la coexistencia en su panel, revisado con usted;
- primero su tienda; cuando funcione y estén los requisitos 1 a 3, se ofrece como extra en los planes Pro y Premium. **Regla para los clientes:** nunca se conecta el único número de un negocio sin verificar antes la coexistencia.

**Tiempo estimado:** 4 a 6 semanas para su tienda. Para los clientes, más el trámite de proveedor tecnológico con Meta (semanas, no depende de nosotros).

**Listo cuando:**
- en el número de prueba, 50 conversaciones reales salen con borradores correctos que la vendedora solo tuvo que aprobar, sin perder su WhatsApp;
- una empresa de prueba conecta **su propio** número con el botón de Meta, con su propia verificación y su propia facturación.

## 10. Resumen diario con IA para el dueño

**Qué es:** cada noche, un mensaje corto al dueño del negocio. Por ejemplo: «Vendiste RD$X, la caja 2 tuvo un descuadre de RD$Y, se van a agotar estos 3 productos, hay 2 contraentregas sin cobrar».
- Usa las alertas y los reportes que el sistema ya tiene.
- La IA solo los resume con palabras claras.

**Por qué:** un dueño que no está en la tienda (como usted muchas veces) ve el valor de la IA todos los días sin preguntar nada. Eso hace que no cancele.

**Costo de la IA:** menos de RD$1 por día por empresa con el modelo económico.

**Correo primero, WhatsApp después:**
- **Paso cero, que ya está pendiente:** el correo del sistema todavía no está encendido. Falta que usted cree la cuenta gratis en resend.com y que se ponga su clave (`RESEND_API_KEY`) en Render, como dice su lista de pendientes. Eso también enciende los correos de cierre de caja y anulaciones que ya están programados.
- **Para los clientes:** el producto necesita su propio dominio de envío (por ejemplo, avisos@nexora…) y, cuando sean muchos negocios cada noche, el plan pagado de envío de correos. Es un costo pequeño al mes; cuéntelo en el precio.
- **Por correo** sale en 1 a 2 semanas después del paso cero.
- **Por WhatsApp** necesita los requisitos de Meta de la mejora 9. Además, como el mensaje lo inicia el negocio, **Meta cobra cada envío**: confirme el precio antes de incluirlo en un plan.

**Listo cuando:** usted recibe su resumen 7 noches seguidas y todos los números coinciden con los reportes del sistema.

---

## Por dónde empezar esta semana

1. **Contador, a más tardar el lunes 26:** que confirme por escrito su grupo y su fecha (15 de noviembre si es pequeño, 1 de noviembre si es mediano). Sin esperar la respuesta, empiece en la OFV la **solicitud de emisora electrónica** y pida el **certificado digital** (mejora 1).
2. **Proveedor de e-CF:** pida cotización a dos de la lista de la DGII. Pregúnteles si tienen **portal web** mientras se hace la conexión, en cuántos días activan el RNC, el costo de la conexión y **por cada RNC de sus futuros clientes**, si emiten **E44 y E45**, y **si firman en la caja sin internet** (mejora 1).
3. **ChatGPT PC:** pregunte si la prueba en rojo del 23 de octubre ya está en verde. Sin eso la fase 1 no avanza (mejora 2).
4. **Banco:** pregunte a Azul o Cardnet qué piden para abrir una cuenta de comercio para cobros mensuales (mejora 2).
5. **Resend:** cree la cuenta gratis y pase la clave a Claude para Render, sin escribirla en el chat. Enciende los correos de hoy y prepara el resumen diario (mejora 10).

Lo más rápido: el cambio de modelo de la 8 (1 a 2 días), la parte rápida de la 3 (1 semana) y la 10 por correo (1 a 2 semanas). Las mejoras 7 y 9 son las que harán que los clientes la escojan a usted.

## Lo que dejé fuera a propósito

- **Apps en Play Store o App Store:** la versión web ya se instala en el celular.
- **Trabajo sin internet en la laptop:** la caja ya vende sin conexión.
- **Construir un emisor propio certificado de e-CF:** un proveedor autorizado resuelve más rápido.

Nada de esto impide vender al principio.

## Supuestos

- «Venderlo de manera independiente» lo entendí así: que otros negocios lo paguen y lo usen sin depender de usted ni de su tienda, como usted decidió el 19 de octubre.
- Las fechas y los precios fiscales vienen del documento fiscal del sistema, con datos al 6 de octubre de 2026. Confírmelos con su contador y con el proveedor.
- Los costos de IA salen de los precios actuales de los modelos de Claude, con preguntas y facturas de tamaño normal. Son estimados: se miden de verdad en la primera prueba.
- Las reglas de Meta (IA, proveedor tecnológico, coexistencia) cambian a menudo: se confirman en la fase 0 antes de programar.
- Los tiempos suponen que ChatGPT PC programa y Claude revisa, como ahora. Son estimados.
- No modifiqué nada en el sistema; esto es solo la recomendación.
