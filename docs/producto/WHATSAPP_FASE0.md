# N-14 · WhatsApp Business Platform para Nexora POS — Fase 0

**24 de octubre de 2026 · decisión de producto, sin código ni conexión a Meta**

## Propuesta para el primer piloto

Empezar con **borradores de respuesta que una persona revisa y envía**. Nexora no debe activar envíos automáticos, campañas ni vincular el número de la vendedora hasta que la dueña vea las condiciones de su cuenta de Meta, el costo y la elegibilidad de coexistencia. El [informe de la tienda del 14 de octubre](../whatsapp/FASE_0_META_WHATSAPP.md) contiene el presupuesto y sus límites; no hay todavía un mes real de consumo que permita dar un precio mensual cierto.

## Número y coexistencia

La **WhatsApp Business App Coexistence** permite en determinados casos usar la app y la plataforma con el mismo número mediante el alta que ofrece Meta. **La elegibilidad del número de la vendedora y las funciones conservadas no se pudieron comprobar sin entrar a su cuenta.** No se debe migrar el número basándose en documentación genérica. Primero, dentro de Meta Business Manager, comprobar si Embedded Signup ofrece coexistencia para ese número y qué pasa con el historial, dispositivos y mensajes. Si no es elegible, conservar la app con su número y usar otro para el piloto de la API; cualquier migración del número actual necesita una decisión expresa de la dueña.

## Requisitos que hay que confirmar en Meta

1. Cartera de negocio y cuenta de WhatsApp Business bajo control legal de cada negocio cliente; número con recepción de código de verificación y nombre visible aprobado.
2. Estado de **verificación del negocio**, límites de mensajes y documentos que Meta pide a esa cuenta. Los requisitos y límites pueden variar; se comprueban en el panel, no se suponen.
3. Para Nexora como producto que conectaría cuentas de **otras empresas**, confirmar en la documentación y revisión de Meta el alta como **Tech Provider**, Embedded Signup, permisos avanzados y revisión de la app. Un piloto con la cuenta propia no demuestra que Nexora ya esté autorizado para incorporar clientes.
4. Webhook HTTPS con validación de firma, credenciales por empresa guardadas como secretos, permisos mínimos, aislamiento de mensajes, control de bajas y consentimiento para mensajes iniciados por el negocio.
5. Plantillas aprobadas para mensajes fuera de la ventana de atención; distinguir servicio, utilidad, autenticación y marketing al presupuestar. La ventana de servicio de 24 horas **no vuelve gratis cualquier plantilla**.

## Asistentes de IA y política

La [página de precios de Meta](https://whatsappbusiness.com/es-la/products/platform-pricing/) menciona bots de atención, pero **eso no equivale a una autorización general para un asistente de IA de terceros**. Antes de ofrecer un asistente por WhatsApp en Nexora, Meta debe confirmar que el caso concreto —respuestas sobre la operación de la tienda, no un chatbot de propósito general— cumple las [políticas comerciales](https://whatsappbusiness.com/policy/) y los términos vigentes de la plataforma. El piloto propuesto prepara borradores visibles para la vendedora; ella decide cada envío. También debe informar al cliente que se usó IA cuando corresponda, minimizar los datos enviados al modelo y pasar pagos dudosos, quejas y devoluciones a una persona. No usar el canal para promesas de salud sobre suplementos.

## Costo y decisión antes de construir

`costo mensual = cargos Meta por mensajes y categoría/país + proveedor intermediario (si se contrata) + IA por uso real + infraestructura y revisión humana`.

No hay tarifas ni volúmenes verificables de la cuenta elegida para calcular ese total. Pedir a Meta o al proveedor elegido la tarifa actual de República Dominicana y registrar un mes de mensajes por categoría antes de fijar planes de Nexora. La Cloud API directa evita la cuota de un intermediario, pero exige operar webhooks, plantillas, soporte y cumplimiento por cuenta propia.

**Decisiones que faltan de la dueña:** número para el piloto (nuevo o existente), si autoriza comprobar coexistencia en su panel, si prefiere Cloud API directa o proveedor autorizado y techo mensual de gasto. **No se conecta ni envía nada en N-14.**

## Fuentes oficiales y alcance de la consulta

- [Meta: inicio de WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), consultada el 24-oct-2026. La página de Developers puede requerir iniciar sesión; no confirma el estado de una cuenta concreta.
- [Meta: Embedded Signup y coexistencia](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/whatsapp-business-app-coexistence), consultada el 24-oct-2026. Elegibilidad del número sin verificar.
- [Meta: precios de la plataforma](https://whatsappbusiness.com/es-la/products/platform-pricing/), consultada el 24-oct-2026. La tarifa aplicable debe comprobarse para el país y la categoría antes del piloto.
- [Meta: política comercial de WhatsApp](https://whatsappbusiness.com/policy/), consultada el 24-oct-2026. El texto público no resuelve por sí solo la autorización del caso de IA SaaS propuesto.
