# Camino B · Nexora POS como producto por suscripción

**13 de octubre de 2026 · Informe de decisión para la dueña · solo diseño**

## Recomendación y separación

Vender primero una **PWA en la nube por negocio**, cobrada mensualmente en la página web de la dueña. La instalación local con licencia puede ofrecerse después a clientes que necesiten funcionar sin Internet, pero exigiría instalación, soporte y respaldos en cada PC, cobro de licencias y control de actualizaciones. El servidor de la casa puede guardar una copia y servir para pruebas; no debe alojar a clientes que pagan.

`producto-saas` parte del código de `nexora-cloud` y evoluciona por separado. Sus bases, servicios, secretos, respaldos y dominio serán propios. **No se conectará a Render ni a la base de la tienda**, ni incluirá datos, costos, clientes o credenciales de Grupo Macgen. Las demostraciones usarán datos ficticios. Ninguna modificación vuelve a `nexora-cloud` sin orden escrita de la dueña.

## Cobro desde la web

El cliente elige plan, paga en una página de cobro segura y recibe acceso cuando el procesador confirma el pago por webhook verificado. La suscripción debe registrar periodo, renovación, impago, cancelación, reintentos, factura/recibo y conciliación. No guardar números de tarjeta en Nexora. Apple Pay y Google Pay son **opciones a confirmar para la cuenta dominicana y el procesador elegido**; que un procesador las anuncie en otro país no demuestra que estén disponibles aquí.

| Opción | Qué se pudo verificar al 13-oct-2026 | Antes de contratar |
|---|---|---|
| [Azul](https://www.azul.com.do/) | Operador dominicano con pagos digitales; el sitio menciona pagos recurrentes. | Cotización escrita de comisión, cargo fijo, moneda, depósitos, recurrencia, Apple Pay/Google Pay y API/webhooks para la entidad de la dueña. |
| [CardNET](https://www.cardnet.com.do/) | Operador dominicano con soluciones de comercio electrónico. | Las mismas condiciones por escrito; no hay una tarifa pública de esta integración verificada en la consulta. |
| [PayPal RD](https://www.paypal.com/do/business/accept-payments/checkout) | Ofrece checkout comercial para RD; publica una [página de tarifas](https://www.paypal.com/do/business/paypal-business-fees). | Confirmar comisión efectiva para la cuenta, retiro a banco dominicano, moneda, tiempo de depósito, suscripciones y carteras móviles; no asumir que todo funciona igual que en EE. UU. |
| [Stripe](https://stripe.com/global) | Su lista pública de países no muestra a República Dominicana como país de apertura directa. | Solo viable si la dueña tiene una entidad elegible real en otro país y acepta sus obligaciones fiscales y bancarias; verificarlo antes de elegirlo. [Stripe Billing](https://docs.stripe.com/billing/subscriptions/build-subscriptions) documenta la técnica, no la elegibilidad local. |

**No hay comisión, plazo de depósito ni disponibilidad de Apple Pay/Google Pay para la cuenta real confirmados todavía.** Pedir dos propuestas escritas a Azul y CardNET y una simulación de PayPal; calcular con la tasa efectiva y cargo fijo de la propuesta ganadora. La página de cobro, política de reembolsos y facturación deben revisarse con contable/abogado dominicano. El POS hoy entrega «documento interno, sin valor fiscal»; vender el software y emitir comprobantes fiscales de la suscripción son obligaciones distintas de emitir comprobantes desde el POS.

## Aislamiento de negocios y costo de infraestructura

Línea base del `render.yaml` actual, **solo como referencia de tamaño, no de rendimiento demostrado**: web 0.5c/512 MB **US$7/mes**, API 1c/2 GB **US$25/mes**, PostgreSQL 0.5c/1 GB **US$19/mes** y 5 GB de almacenamiento expandible a **US$0.30/GB/mes** ≈ **US$1.50**. Total **US$52.50/mes** antes de respaldos externos, tráfico, monitoreo, pasarela y soporte. Precios de [Render](https://render.com/pricing), consultados el 13-oct-2026; confirmar la factura y cuotas vigentes antes de contratar.

| Diseño | Costo mensual con N clientes pequeños, misma web/API de referencia | Riesgo y decisión |
|---|---:|---|
| Una base compartida | US$52.50 inicial; a 10 clientes **US$5.25/cliente** de infraestructura | Cada tabla y consulta debe llevar `tenantId`, con aislamiento en API **y** Row Level Security en PostgreSQL, pruebas de acceso cruzado, copias y restauración por cliente. Un error puede exponer varios negocios. |
| Una base PostgreSQL por cliente | US$32 web/API compartidas + **US$20.50 por cliente** (base + 5 GB). A 10: **US$23.70/cliente**. | Mejor separación y restauración, más conexiones/migraciones/operación. Puede necesitar API separada para aislamiento completo. |

Estas son **cuentas de precio**, no una promesa de capacidad: no hay benchmark de ventas, concurrencia ni tamaño por cliente. Antes de vender, probar con 1, 5, 10 y 25 negocios ficticios; medir p95 de caja, conexiones, CPU/RAM y crecimiento del disco, y subir plan cuando el objetivo de servicio deje de cumplirse. No afirmar cuántos clientes caben solo por la RAM nominal. Una base por cliente a US$20/mes pierde dinero incluso antes del soporte.

## Planes y precio mínimo

Propuesta comercial para validar, en USD antes de impuestos locales: **Básico US$20/mes** (POS, inventario, reportes, usuarios y respaldos; límites de sucursales, cajas y espacio por definir) y **Con asistente desde US$39/mes** (borradores con revisión humana, cupo medido de mensajes/uso de IA; excedentes con tarifa anunciada). No prometer respuesta automática: requiere aprobación posterior. Una licencia local sería un producto aparte, con precio de instalación y mantenimiento por definir.

Ejemplo transparente para el Básico con **10 clientes en base compartida**: US$5.25 de infraestructura por cliente + **supuestos** de US$1 de copia externa y US$2 de soporte = US$8.25 de costo fijo. Si la pasarela costara **4 % hipotético** y se busca 30 % de margen operativo, precio mínimo = 8.25/(1 − 0.04 − 0.30) = **US$12.50** antes de impuestos, cargo fijo por cobro, fraude y desarrollo. Con **un solo cliente**, el mismo cálculo da **US$84.09**. En base separada y 10 clientes: (23.70 + 3)/0.66 = **US$40.45**. Por eso US$20 solo es viable como hipótesis para una cohorte suficiente en base compartida y con costos reales medidos. El plan con asistente suma costo de Meta, tokens de IA, revisión humana y soporte: **no hay precio mínimo verificable sin volumen real y tarifas contratadas**. US$39 es un precio de prueba, sujeto a cupos y cotización.

## Construcción por fases y decisiones

1. **Diseño y prueba aislada:** contrato de `tenantId` o base por cliente, roles, respaldos y restauración por negocio; auditoría de IDOR y pruebas de aislamiento. Elegir el modelo después de un piloto con datos ficticios.
2. **Cobro:** seleccionar procesador dominicano con propuesta firmada; integrar suscripción, webhook idempotente, impagos y baja; términos, privacidad, retención, soporte y factura propia revisados en RD.
3. **Piloto limitado:** 3–5 negocios consentidos, métricas de rendimiento/costo y restauraciones ensayadas. Ajustar límites y precio con datos observados.
4. **Asistente:** primero modo borrador aprobado por una persona, gastos de Meta/IA por cliente y techo de uso; automatización solo con OK escrito de la dueña. PWA primero; tiendas de apps después. Google Play indica **US$25 una vez** para la cuenta de desarrollador y tarifas de servicio que incluyen **15 % para suscripciones** según su política; Apple Developer Program indica **US$99/año** y su programa para pequeños negocios ofrece **15 %** a quienes califiquen. Estas comisiones aplican según categoría, programa, país y modalidad de cobro; no se presupuestan para la PWA vendida desde la web. Confirmar reglas de pagos externos antes de empaquetar. Fuentes: [registro Google Play](https://support.google.com/googleplay/android-developer/answer/6112435), [tarifas Google Play](https://support.google.com/googleplay/android-developer/answer/112622), [Apple Developer Program](https://developer.apple.com/programs/) y [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/), consultadas el 13-oct-2026.

**Decisiones de la dueña:** modelo de aislamiento, país/entidad que cobra, procesador y moneda, precio y límites de los planes, alcance del soporte, tratamiento fiscal con el contable y autorización de un piloto. **Estado:** únicamente este informe; no hay código del Camino B, ni despliegue, ni acceso a datos de producción.

**Fuentes adicionales, consultadas el 13-oct-2026:** [orden 3ad](../coordinacion/INSTRUCCIONES_ACTUALES.md), [`render.yaml`](../../render.yaml), [Render pricing](https://render.com/pricing), [Azul](https://www.azul.com.do/), [CardNET](https://www.cardnet.com.do/), [PayPal RD](https://www.paypal.com/do/business/accept-payments/checkout), [Stripe availability](https://stripe.com/global). Las condiciones comerciales no publicadas se dejan expresamente pendientes de cotización.
