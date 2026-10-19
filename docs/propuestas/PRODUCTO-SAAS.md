# Propuesta de producto SaaS Nexora

**Documento de decisión — no autoriza programación ni despliegue**

**Fecha de corte de precios y fuentes:** 19 de octubre de 2026

**Rama de trabajo:** `nexora-chatgpt-pc-saas`

## 1. Recomendación ejecutiva

Nexora puede convertirse en un SaaS mensual vendible a comercios dominicanos, pero no conviene intentar entregar a la vez nube multiempresa, aplicaciones móviles, sincronización offline completa, cobro recurrente e inteligencia artificial autónoma. La secuencia recomendada es:

1. **Vender primero una PWA SaaS en la nube**, con cobro contratado en la web, aislamiento multiempresa verificable, respaldo, exportación y soporte.
2. **Publicar después aplicaciones móviles gratuitas de acompañamiento con Capacitor**, destinadas a clientes que ya tengan cuenta. No deben mostrar botones, enlaces ni mensajes para comprar fuera de la tienda.
3. **Agregar IA limitada, medible y revisable**, usando un modelo económico por defecto y escalando solamente los casos complejos.
4. **Construir la sincronización offline para PC como una fase separada**, después de estabilizar el modelo multiempresa y los eventos de inventario/venta.
5. **Mantener el código, la marca y el producto base como propiedad privada de Nexora**, vendiendo derecho de uso y servicios, no el código fuente.

Con una mezcla estimada de 50% Básico, 35% Pro y 15% Premium, los precios propuestos son **RD$1,990, RD$3,990 y RD$7,990 al mes**, antes de los impuestos que correspondan. El margen mensual modelado conservador es 39.8% con 10 clientes, 59.8% con 50 y 63.5% con 200. Es un modelo de planificación: falta cotizar formalmente adquirencia, asesoría legal/fiscal, soporte real y carga de producción antes de aprobarlo.

## 2. Alcance y decisiones heredadas

Esta propuesta conserva las decisiones ya documentadas en los caminos local y SaaS:

- El producto local, el SaaS y `nexora-cloud` siguen separados. Esta rama no debe mezclarse con producción.
- No se utilizarán datos reales, credenciales, dominio ni secretos de Group Macgen en el producto vendible.
- El servidor de la casa puede servir para pruebas o una copia adicional, nunca para alojar clientes.
- Nexora no almacenará números de tarjeta ni CVV. El procesador alojará el formulario y/tokenizará el medio de pago.
- La IA empieza en modo de consulta, con aprobación humana para toda acción de negocio sensible.
- Los documentos internos del POS no se deben presentar automáticamente como comprobantes fiscales. La facturación fiscal del SaaS requiere su propio diseño y validación contable.
- Solamente Claude queda autorizado por las órdenes vigentes para desplegar; este documento no concede permiso de despliegue a nadie.

El código actual organiza casi todas las entidades por `branchId`. Una sucursal no equivale a una empresa cliente. Antes de vender el SaaS se necesita una entidad de inquilino o empresa (`tenant`) independiente, y pruebas que demuestren que una empresa jamás puede leer, modificar, exportar o restaurar datos de otra.

## 3. Cliente objetivo y propuesta de valor

### Cliente inicial

El nicho más razonable es el comercio dominicano pequeño o mediano que tiene entre una y cinco sucursales, necesita caja e inventario, y valora acompañamiento local. No se debe comenzar intentando servir simultáneamente restaurantes complejos, cadenas internacionales, manufactura y comercio electrónico.

### Promesa comercial inicial

> Caja, inventario y control del negocio desde cualquier lugar, con acompañamiento local, respaldo y ayuda inteligente bajo control del dueño. La continuidad offline será un complemento futuro y no se ofrecerá antes de superar la fase 3.

La ventaja defendible no es “tener IA”. Competidores grandes pueden agregarla. La combinación defendible es:

- flujo adaptado al comercio dominicano;
- migración y soporte en español, con responsable local;
- inventario y auditoría pensados para el negocio objetivo;
- exportación y recuperación de datos claras;
- eventual continuidad offline sin convertir cada cliente en un código distinto;
- IA con fuentes, límites, presupuesto y trazabilidad por empresa.

## 4. Competencia y posición de precio

Precios públicos revisados el 19 de octubre de 2026; pueden cambiar, tener impuestos, promociones o límites adicionales.

| Producto | Referencia pública | Lectura para Nexora |
|---|---:|---|
| Alegra POS RD | Inicial US$25, Pro US$39, Gastrobar US$55/mes | Es el ancla regional más directa. Nexora debe explicar con claridad por qué cobra más en Pro/Premium. |
| Loyverse | POS base gratis; historial US$5/tienda; empleados US$25/tienda; inventario avanzado US$25/tienda | Presiona el extremo económico. No conviene competir sólo por precio. |
| Odoo | Una aplicación gratis; Standard US$24.90/usuario/mes anual promocional; Custom US$49 promocional | Muy amplio y configurable, pero su costo crece por usuario y la implantación puede ser compleja. |
| Poster POS | US$26, US$44 y US$62/mes anual; registro adicional US$19 | Referencia para restaurantes y operación por terminal. |
| Shopify | Basic US$39/mes más POS Pro US$89/ubicación/mes | Potente para comercio electrónico; deja espacio para una oferta local más sencilla. |
| Bsale México | MXN$860, MXN$1,060 y MXN$1,660/mes con IVA | Referencia latinoamericana, no una cotización dominicana. |

Fuentes: [Alegra República Dominicana](https://www.alegra.com/rdominicana/precios/), [Loyverse](https://loyverse.com/pricing), [Odoo](https://www.odoo.com/es_ES/pricing), [Poster](https://joinposter.com/en/pricing), [Shopify POS](https://www.shopify.com/pos/pricing) y [Bsale México](https://www.bsale.com.mx/collection/servicios-relacionados-plan-estandar).

Alegra fue la única referencia con tarifa pública claramente dirigida a República Dominicana que se pudo verificar en esta revisión; varios proveedores locales trabajan por cotización. Antes del lanzamiento se deben pedir al menos tres demostraciones/cotizaciones dominicanas y agregarlas al análisis, sin inventar precios donde no se publican.

**Posición recomendada:** no ser el más barato. El plan Básico queda cerca de Alegra; Pro y Premium se justifican por más ubicaciones/dispositivos, soporte, auditoría, restauración, automatización y cuotas de IA. Si esas diferencias no existen en el producto real, hay que bajar el precio o no lanzar esos planes.

## 5. Planes, límites y precios

Conversión informativa usada: **RD$61.8322 por US$1**, tasa de venta publicada por el Banco Central para el 16 de octubre de 2026. Se debe actualizar antes de aprobar precios o contratar servicios.

| Capacidad | Básico | Pro | Premium |
|---|---:|---:|---:|
| Precio mensual, antes de impuestos aplicables | **RD$1,990 / US$32.18** | **RD$3,990 / US$64.53** | **RD$7,990 / US$129.22** |
| Sucursales incluidas | 1 | 2 | 5 |
| Dispositivos o cajas licenciadas | 2 | 6 | 20 |
| Usuarios | 3 | 10 | 30 |
| POS, inventario y reportes básicos | Sí | Sí | Sí |
| Compras, promociones y reportes avanzados | — | Sí | Sí |
| Auditoría avanzada, API y exportaciones programadas | — | — | Sí |
| Conversaciones de IA incluidas al mes | 50 | 300 | 1,000 |
| Atención | Horario laboral | Prioritaria | Prioritaria con objetivo de respuesta menor |
| Restauración asistida | Cotizada | 1 al año | 4 al año |

Reglas comerciales propuestas:

- No habrá planes “ilimitados”. Usuarios, dispositivos, almacenamiento, correo, IA y sucursales deben medirse.
- Al llegar al límite de IA, se bloquean nuevas consultas o se compra un paquete prepagado; nunca se deja una cuenta abierta sin tope.
- Los límites se aplican por `tenant`, no por interfaz ni por texto enviado al modelo.
- La función offline para PC **no está incluida en el lanzamiento**. Después de la fase 3 puede venderse como complemento por ubicación, con un precio preliminar de RD$1,790/mes que debe volver a calcularse tras medir soporte y sincronización.
- La instalación, migración, capacitación presencial, hardware, personalizaciones y facturación fiscal se cotizan por separado.
- Los precios al cliente se expresan “antes de impuestos aplicables” hasta recibir una opinión contable escrita.

## 6. Costos mensuales y margen

### 6.1 Supuestos del modelo

El cálculo usa una mezcla de clientes de 50% Básico, 35% Pro y 15% Premium. Incluye:

- plataforma estimada de US$84.50 para 10 clientes, US$156.50 para 50 y US$431 para 200;
- reserva de atención humana de US$6, US$14 y US$30 por cliente según plan;
- presupuesto de IA de US$0.45, US$2.67 y US$8.87 por cliente según plan;
- cobro conservador con Azul: 6% sobre ventas, RD$15 por cargo aprobado entre recurrencia y 3DS, y RD$4,895 fijos mensuales distribuidos entre clientes (RD$2,500 de integración, RD$1,800 de bóveda y RD$595 complementarios);
- reparto de infraestructura por peso 1.0, 1.3 y 2.0 para Básico, Pro y Premium.

No incluye adquisición de clientes, desarrollo inicial, impuestos, asesoría legal/contable, devoluciones, contracargos, deuda incobrable, visitas presenciales ni comisión de vendedores. El 6% de adquirencia y los RD$4,895 fijos son una sensibilidad conservadora, no una tarifa obtenida para Nexora. Si la cotización confirma que bóveda o cargo complementario no aplican, el margen mejora; hasta entonces no se eliminan del presupuesto.

### 6.2 Escenarios de infraestructura

| Componente mensual | 10 clientes | 50 clientes | 200 clientes |
|---|---:|---:|---:|
| Web/API | US$32.00 | US$50.00 | US$170.00 (`2 × US$85`) |
| PostgreSQL compartido | US$19.00 | US$40.00 | US$75.00 |
| Espacio de trabajo/operación Render Pro | US$25.00 | US$25.00 | US$25.00 |
| Almacenamiento | US$1.50 | US$7.50 | US$30.00 |
| Correo transaccional | US$0.00 | US$20.00 | US$90.00 |
| Monitoreo | US$0.00 | US$12.00 | US$39.00 |
| Backup externo/reserva operativa | US$7.00 | US$2.00 | US$2.00 |
| **Total plataforma** | **US$84.50** | **US$156.50** | **US$431.00** |
| **Costo medio de plataforma** | **US$8.45** | **US$3.13** | **US$2.16** |

Estas son envolventes de presupuesto, no garantías de capacidad. Antes de cambiar de nivel se requieren pruebas de carga con mezcla real de ventas, reportes, sincronización e IA. Render publica actualmente servicios desde US$7, PostgreSQL desde US$6 y almacenamiento adicional a US$0.30/GB; los tamaños concretos usados aquí son deliberadamente prudentes. Fuentes: [precios de Render](https://render.com/pricing), [backups de PostgreSQL en Render](https://render.com/docs/postgresql-backups), [R2](https://developers.cloudflare.com/r2/pricing/), [Resend](https://resend.com/pricing/) y [UptimeRobot](https://uptimerobot.com/pricing/).

### 6.3 Costo y margen por plan

Margen = `(precio - costo mensual directo estimado) / precio`. El ITBIS no se resta para calcular este margen; su tratamiento va por separado.

| Escala | Plan | Precio US$ | Costo directo US$ | Costo directo RD$ | Margen |
|---:|---|---:|---:|---:|---:|
| 10 | Básico | 32.18 | 23.27 | 1,439 | 27.7% |
| 10 | Pro | 64.53 | 37.45 | 2,316 | 42.0% |
| 10 | Premium | 129.22 | 68.25 | 4,220 | 47.2% |
| 50 | Básico | 32.18 | 12.70 | 785 | 60.5% |
| 50 | Pro | 64.53 | 25.61 | 1,584 | 60.3% |
| 50 | Premium | 129.22 | 53.44 | 3,304 | 58.7% |
| 200 | Básico | 32.18 | 10.74 | 664 | 66.6% |
| 200 | Pro | 64.53 | 23.41 | 1,448 | 63.7% |
| 200 | Premium | 129.22 | 50.70 | 3,135 | 60.8% |

| Escala | Ingreso medio/cliente | Costo medio/cliente | Costo total/mes | Margen combinado |
|---:|---:|---:|---:|---:|
| 10 | US$58.06 | US$34.98 / RD$2,163 | US$350 / RD$21,631 | **39.8%** |
| 50 | US$58.06 | US$23.33 / RD$1,443 | US$1,166 / RD$72,126 | **59.8%** |
| 200 | US$58.06 | US$21.17 / RD$1,309 | US$4,233 / RD$261,761 | **63.5%** |

Los tres escenarios superan el mínimo solicitado de 15%, pero 10 clientes dejan poco espacio para adquisición, desarrollo y contingencias. La reserva de soporte equivale, a un costo cargado de US$30/hora, a 12 minutos/mes en Básico, 28 en Pro y 60 en Premium. Si el soporte real duplica esas reservas, el margen combinado baja a 18.4% con 10 clientes, 38.5% con 50 y 42.2% con 200. La operación empieza a verse sostenible alrededor de 50 clientes, siempre que la telemetría confirme esos tiempos.

## 7. Inversión inicial y recuperación

### 7.1 Presupuesto de trabajo

| Concepto | Orden de magnitud | Nota |
|---|---:|---|
| MVP SaaS PWA: multiempresa, cobro, seguridad, operación y QA | 800–1,100 horas | No incluye apps nativas ni offline completo. |
| Visión completa: apps, offline, licencias y sincronización | 1,600–2,400 horas acumuladas | Depende de pruebas en dispositivos y complejidad fiscal. |
| Valor interno de planificación | US$25–US$40/hora | Supuesto para decidir; no es una cotización. |
| Desarrollo del MVP | US$20,000–US$44,000 | Resultado de los dos supuestos anteriores. |
| Desarrollo de la visión completa | US$40,000–US$96,000 | Debe dividirse en fases con puerta de aprobación. |
| Legal, fiscal, seguridad, contratos y marca | US$5,000–US$15,000 | Reserva hasta obtener cotizaciones dominicanas. |
| Apple Developer | US$99/año | Publicación iOS. |
| Google Play Console | US$25 una vez | Publicación Android. |
| Registro de marca denominativa ONAPI | RD$6,930 | RD$5,720 solicitud + RD$1,210 publicación, según tarifa pública. |

Totales de planificación, convirtiendo ONAPI y el mínimo de constitución a la tasa de este documento:

| Escenario de arranque | Desarrollo | Legal/fiscal/seguridad | Cuentas, marca y constitución mínima | **Total** |
|---|---:|---:|---:|---:|
| Bajo | US$20,000 | US$5,000 | US$252 | **US$25,252** |
| Base | US$35,000 | US$10,000 | US$252 | **US$45,252** |
| Alto | US$44,000 | US$15,000 | US$252 | **US$59,252** |

El total no incluye capital de trabajo, mercadeo, equipos ni una constitución superior al mínimo tributario; tampoco convierte la visión completa de US$40,000–US$96,000 en compromiso. Cada fase debe tener cotización y tope propios.

Fuentes de costos verificables: [Apple Developer Program](https://developer.apple.com/programs/whats-included/), [Google Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) y [ONAPI](https://www.onapi.gov.do/index.php/servicios/signos-distintivos/marcas/item/574-registro-de-marca-denominativa-2k23). La constitución de compañía tiene además un impuesto de 1% del capital autorizado, con mínimo de RD$1,000 según [DGII](https://ayuda.dgii.gov.do/conversations/registro-nacional-de-contribuyentes-rnc/ca1564-cul-es-el-monto-que-debo-pagar-por-el-impuesto-de-constitucin-de-compaas/5f3c17618cd858ce879a663c); la estructura jurídica concreta debe decidirla un profesional.

### 7.2 Ejemplo de recuperación

Para visualizar la escala se usa el escenario base completo de **US$45,252**. No es una promesa de costo. La recuperación divide esa inversión entre la contribución mensual después de los costos directos modelados:

| Cohorte ya activa | Contribución mensual | Recuperación teórica del costo de arranque |
|---:|---:|---:|
| 10 clientes | US$231 | 196 meses |
| 50 clientes | US$1,737 | 26.1 meses |
| 200 clientes | US$7,379 | 6.1 meses |

El reloj empieza cuando la cohorte completa está activa; no incluye el tiempo para conseguirla. Por eso la primera meta comercial debe ser validar 10 clientes pagos antes de financiar toda la visión, y la segunda alcanzar 50 con soporte medido.

## 8. Cobros recurrentes en República Dominicana

### 8.1 Procesador recomendado

Solicitar propuestas a **Azul y CardNet** y escoger con una tabla firmada de: afiliación, mensualidad, MDR, 3DS, tokenización, recurrencia, contracargos, devoluciones, tiempo de liquidación, webhooks, ambiente de prueba y soporte.

Azul publica RD$2,500/mes para API, página de pago o plugins; RD$5 por recurrencia aprobada, RD$10 por rechazada; RD$1,800/mes para bóveda de tokens; 3DS entre RD$7.50 y RD$10; y un MDR de hasta 6% sujeto al comercio. [Tarifario Azul](https://www.azul.com.do/Pages/es/tarifarioAzul.aspx) y [página de pagos](https://www.azul.com.do/Pages/es/paginaPago/pagina-pagos.aspx).

CardNet publica afiliación de RD$850, botón de pago de RD$2,500, enlace/terminal virtual de RD$850, 3DS y tokenización a RD$7.50 por transacción, además de cargos por baja facturación. MDR, recurrencia y liquidación deben cotizarse. [Tarifario CardNet](https://www.cardnet.com.do/tarifario).

PayPal queda como alternativa internacional, no como primera opción: en República Dominicana publica 5.40% + US$0.30 hasta US$3,000 mensuales, con porcentajes menores por volumen sujeto a aprobación. [Tarifas PayPal RD](https://www.paypal.com/do/business/paypal-business-fees?locale.x=es_DO).

Stripe no lista actualmente a República Dominicana para abrir una cuenta directa. Sólo se evaluará si Nexora tiene una entidad, banco, impuestos y operación reales en un país admitido; no se debe simular residencia. [Disponibilidad global de Stripe](https://stripe.com/global).

### 8.2 Diseño seguro de facturación

- El cliente introduce la tarjeta en la página alojada por el adquirente. Nexora guarda sólo identificadores/token autorizados, marca, últimos cuatro dígitos y vencimiento si el proveedor los entrega.
- Los webhooks se verifican criptográficamente, se guardan con identificador único y se procesan de forma idempotente.
- La suscripción no cambia de estado por una redirección del navegador; cambia por evento verificado y conciliación.
- Estados mínimos: `trial`, `active`, `past_due`, `grace`, `limited`, `suspended`, `terminated`.
- Reintentos propuestos: días 1, 3 y 7. Durante siete días de gracia el producto sigue funcionando y muestra avisos sólo a responsables.
- Tras la gracia pasa a modo limitado: lectura, exportación y cierre de operaciones ya iniciadas; no se deben secuestrar ni borrar datos por una tarjeta fallida.
- A los 30 días puede suspenderse la operación nueva. Se mantiene exportación para el propietario y avisos antes de cualquier eliminación.
- Retención propuesta: 90 días después de terminación; luego eliminación programada y envejecimiento normal de backups. Legal debe validar el plazo.
- Un pago conciliado reactiva la cuenta sin duplicar la suscripción.

### 8.3 Apple Pay y Google Pay

Apple Pay y Google Pay son billeteras para presentar una tarjeta tokenizada; **no sustituyen** al adquirente dominicano ni son lo mismo que App Store In-App Purchase o Google Play Billing. Si Azul/CardNet los habilitan para la cuenta de Nexora, el checkout web alojado puede mostrarlos en dispositivos compatibles y liquidar la operación a través del adquirente. Hay que confirmar en la cotización el soporte para pagos recurrentes o credenciales guardadas, navegadores admitidos, dominios/verificación, devoluciones y contracargos. La página de pagos de Azul anuncia ambas billeteras, pero eso no garantiza su activación comercial para cada afiliado.

| Proveedor | Apple Pay / Google Pay | Recurrencia | Costo usado o publicado | Estado para Nexora |
|---|---|---|---|---|
| Azul | Ambos anunciados en su página de pagos | Recurrencia publicada | RD$4,895 fijos conservadores + RD$15/cargo + MDR hasta 6% | **Requiere cotización y habilitación escrita** |
| CardNet | No se confirmó públicamente para la cuenta requerida | Requiere cotización | Afiliación/botón/link, 3DS y tokenización según tarifario; falta MDR y recurrencia | **Requiere cotización escrita** |
| PayPal RD | No se usa como prueba de soporte nativo de ambas billeteras | Debe validarse para el producto/país | 5.40% + US$0.30 en el primer tramo | **Alternativa cara, no principal** |
| Stripe | Soporte técnico global, pero sin alta directa en RD | Sí en países/cuentas elegibles | No se modela | **No disponible directamente para una entidad dominicana** |

### 8.4 Impuestos y comprobantes

La tasa general de ITBIS es 18% según [DGII](https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/itbis.aspx). Sin embargo, una respuesta oficial de DGII del 3 de septiembre de 2026 indica que una suscripción SaaS y componentes accesorios de IA/WhatsApp están exentos de ITBIS en el supuesto consultado. Otras consultas distinguen desarrollo a medida, licencias o cesión de derechos. Fuentes: [consulta SaaS de DGII](https://ayuda.dgii.gov.do/conversations/discusiones/itbis-en-suscripcin-de-software-saas-con-ia-y-whatsapp/6a99bbad1622efb01549712e), [consulta sobre desarrollo de software](https://ayuda.dgii.gov.do/conversations/discusiones/retencion-de-itbis-por-concepto-de-desarrollo-de-software/656781a044f32b4163d56007) y [consulta técnica sobre software](https://dgii.gov.do/legislacion/consultas/Consultas%20Tecnicas%202024/Septiembre/Consulta%2017-ITBIS%20a%20software.pdf).

Por tanto, Nexora **no debe agregar ni omitir automáticamente 18%**. Antes de facturar necesita una opinión escrita que clasifique por separado suscripción, implantación, capacitación, personalización, hardware y soporte, y determine NCF/e-CF, retenciones y comprobantes. La prórroga pública para pequeños y micro contribuyentes llega al 15 de noviembre de 2026; no se debe confundir esa fecha con una exención permanente. [Aviso e-CF DGII](https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/06-26.pdf).

## 9. Aplicaciones móviles

### 9.1 Estrategia recomendada

Comenzar con PWA instalable. Cuando el flujo web sea estable, envolver el frontend React/Vite con **Capacitor**, que permite reutilizar la aplicación y acceder gradualmente a funciones nativas. [Documentación de Capacitor](https://capacitorjs.com/docs) y [guía inicial](https://capacitorjs.com/docs/getting-started).

React Native o Flutter tendrían sentido si el producto necesitara una experiencia nativa profundamente distinta; hoy implicarían mantener una segunda interfaz y reescribir más lógica. No es la opción inicial.

Trabajo que Capacitor no elimina:

- almacenamiento seguro del token, cierre de sesión remoto y bloqueo biométrico opcional;
- enlaces profundos y retorno seguro desde el proveedor de pago;
- cámara y lectura de códigos, impresión/archivos, compartir y notificaciones;
- detección de red, base offline, migraciones y límites de tareas en segundo plano;
- permisos mínimos, manifiestos de privacidad y eliminación de cuenta cuando aplique;
- certificados, perfiles, firma, pruebas en dispositivos y proceso de revisión;
- Mac con Xcode para compilar/publicar iOS y Android Studio para Android.

Publicación propuesta:

1. Inscribir a la entidad titular en Apple Developer (US$99/año) y Google Play Console (US$25 una vez), completar identidad/organización y D‑U‑N‑S cuando aplique, y mantener los accesos con MFA.
2. Reservar identificadores, nombre, fichas, política de privacidad, URL de soporte, capturas y declaraciones de datos/permisos.
3. Crear certificados y claves de firma bajo control de la empresa; probar primero en TestFlight y los canales internos/cerrados de Google Play.
4. Someter una aplicación útil y completa, responder la revisión y no prometer funciones que el backend aún no soporta.
5. Mantener calendario de actualizaciones del SDK, privacidad, compatibilidad del sistema y renovación de la cuenta; publicar no es un trabajo de una sola vez.

### 9.2 Reglas de Apple y Google

La aplicación debe ser **gratuita y de acompañamiento**: usuarios que ya pagan en la web pueden iniciar sesión y usar su cuenta. Dentro de la app no habrá precios, compra, “mejorar plan”, enlace a checkout ni llamada a comprar afuera. Así se reduce el riesgo de que la suscripción digital tenga que usar las compras de la tienda.

Apple cobra normalmente 30%, o 15% para participantes que califiquen en Small Business y ciertos casos de suscripción. La estrategia de Nexora se apoya únicamente en la regla 3.1.3(f): aplicación gratuita que acompaña una herramienta web pagada, sin compra dentro de la app ni llamadas a comprar fuera. No se presupone la excepción separada para servicios empresariales. Fuentes: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [suscripciones](https://developer.apple.com/app-store/subscriptions/) y [Small Business Program](https://developer.apple.com/app-store/small-business-program/).

Google exige Play Billing para muchas ventas digitales dentro de la aplicación y publica tarifas de servicio que, según programa y transacción, suelen ser 15% en suscripciones o en el primer tramo elegible. También permite aplicaciones de consumo donde la compra ocurre fuera y dentro sólo se usa lo adquirido, sin conducir al usuario al pago. Fuentes: [política de pagos](https://support.google.com/googleplay/android-developer/answer/9858738), [tarifas](https://support.google.com/googleplay/android-developer/answer/112622) y [aplicaciones de consumo](https://support.google.com/googleplay/android-developer/answer/10281818).

Antes de enviar a revisión, un especialista debe revisar la versión vigente y la redacción exacta. Si se decide vender dentro de la app, hay que presupuestar StoreKit/Play Billing, validación de recibos, restauración de compras, cancelaciones, devoluciones y comisión de la tienda.

## 10. Arquitectura multiempresa

### 10.1 Modelo recomendado

Para 10–200 clientes se recomienda PostgreSQL compartido con aislamiento fuerte, no una base por cada cliente. A US$19 por base, 200 bases costarían al menos US$3,800/mes antes de cómputo y operación. Premium empresarial puede ofrecer una base dedicada con precio y operación propios.

Comparación mínima reproducible, usando el resto de la plataforma de la sección 6 y sustituyendo sólo PostgreSQL compartido por una instancia de US$19 para cada cliente:

| Clientes | Plataforma con DB compartida | US$/cliente | Plataforma con 1 DB/cliente | US$/cliente | Diferencia mensual |
|---:|---:|---:|---:|---:|---:|
| 10 | US$84.50 | US$8.45 | US$255.50 | US$25.55 | +US$171 |
| 50 | US$156.50 | US$3.13 | US$1,066.50 | US$21.33 | +US$910 |
| 200 | US$431.00 | US$2.16 | US$4,156.00 | US$20.78 | +US$3,725 |

Ambas columnas conservan web/API, almacenamiento, correo, monitoreo y reserva de backup/operación. La columna dedicada es todavía un mínimo: no añade automatización de 200 migraciones, conexiones, restauraciones y alertas separadas. Por eso se recomienda compartida + RLS para planes normales y dedicada sólo como Enterprise cotizado.

Entidades nuevas mínimas:

- `Tenant` u `Organization`, separado de `Branch`;
- `Membership` con roles y sucursales permitidas;
- `Subscription`, `Plan`, `Entitlement` y `UsageLedger`;
- `DeviceLicense` y sesiones/dispositivos revocables;
- conversaciones/mensajes de IA con consumo y fuentes;
- soporte, exportaciones y restauraciones auditables;
- `Outbox`, `Inbox`, `SyncCursor`, eventos y conflictos para la fase offline.

### 10.2 Reglas de aislamiento

- Toda tabla de negocio lleva `tenant_id` no nulo. Claves únicas, relaciones e índices lo incluyen cuando corresponda.
- El `tenant_id` se deriva de la sesión autenticada; nunca se acepta del cuerpo, URL libre o prompt de IA como autoridad.
- Cada transacción configura el contexto del inquilino y PostgreSQL aplica Row-Level Security. La aplicación también filtra; una capa no reemplaza a la otra.
- Almacenamiento de objetos, cachés, colas, trabajos, logs, métricas y backups incluyen el inquilino en su partición o clave.
- El personal de soporte usa acceso temporal, mínimo, con motivo, aprobación y registro; no cuentas maestras compartidas.
- Las pruebas automatizadas intentan lectura, escritura, exportación, reporte, archivo y restauración cruzada entre dos empresas.
- Cada migración se prueba con datos de varios inquilinos, rollback operativo y copia restaurable.

## 11. Continuidad offline para PC y sincronización

El sistema actual tiene colas parciales para ventas/mercancía, pero no una sincronización bidireccional completa. No se debe anunciar “funciona offline” como característica SaaS hasta construir y probar lo siguiente.

### 11.1 Diseño propuesto

Cada tienda con offline tendrá un nodo local que atiende los equipos de su LAN y guarda sus operaciones. Un agente sincroniza con la nube:

- UUID global para cada entidad, más `tenant_id`, `device_id`, secuencia monotónica y marca de versión;
- `outbox` local append-only, `inbox` idempotente, cursor confirmado y reintentos con retroceso;
- eventos firmados y claves de idempotencia para que una venta o pago se acepte una sola vez;
- borrados lógicos o tombstones hasta que todos los nodos relevantes confirmen;
- compatibilidad de versiones y migraciones antes de permitir sincronizar una versión nueva.

### 11.2 Conflictos por dominio

- **Ventas y pagos:** eventos inmutables. Una corrección es otro evento; no se edita ni se sobrescribe una venta sincronizada.
- **Inventario:** movimientos, no cantidades finales. La nube consolida; una venta offline válida no desaparece aunque produzca inventario negativo, sino que genera alerta/conflicto.
- **Precios y catálogo:** la nube es autoridad y versiona. Cada línea vendida conserva precio, costo, impuesto y descuento usados en ese instante.
- **Clientes/proveedores:** fusión por campo con historial; conflictos sensibles requieren revisión humana.
- **Cierres, devoluciones y transferencias:** reglas de gerente y, para riesgo alto, conexión obligatoria o autorización previamente firmada.
- **Numeración fiscal:** sólo con bloques preasignados o identificador provisional y posterior finalización, después de validación de contador/proveedor fiscal.

### 11.3 Licencia sin secuestrar datos

El servidor entrega una licencia firmada por dispositivo por 30 días, renovable al conectarse, con siete días de gracia. Tras expirar, el nodo conserva lectura, cierre seguro y exportación; no borra ni cifra los datos del cliente. La licencia limita dispositivos según plan y puede revocarse al volver a conectarse. El borrado remoto no se considera un control confiable.

La fase offline requiere pruebas de corte de Internet, reloj incorrecto, duplicación, dos cajas vendiendo el mismo artículo, actualización incompleta, disco lleno, restauración, conflicto, revocación y reconexión después de semanas.

## 12. Inteligencia artificial por empresa

### 12.1 Modelo y costo

La recomendación es **GPT-6 Luna por defecto** y **GPT-6.1 Sol sólo por escalamiento** para consultas complejas. La tarifa oficial revisada es:

| Modelo | Entrada por 1M tokens | Entrada cacheada | Salida por 1M tokens | Uso propuesto |
|---|---:|---:|---:|---|
| GPT-6 Luna | US$0.10 | US$0.01 | US$0.50 | Resúmenes, explicación de reportes, consultas frecuentes. |
| GPT-6.1 Sol | US$2.00 | US$0.10 | US$10.00 | Casos complejos que Luna no resuelva con confianza. |
| GPT-6 Astra | US$10.00 | US$1.00 | US$50.00 | No incluir de forma general; sólo evaluación excepcional. |

Fuente: [precios oficiales de la API de OpenAI](https://developers.openai.com/api/docs/pricing) y [catálogo de modelos](https://developers.openai.com/api/docs/models). Una conversación de referencia de 20,000 tokens de entrada y 3,000 de salida cuesta aproximadamente US$0.0035 en Luna o US$0.07 en Sol. Con 95% Luna, 5% Sol y 30% de reserva, el presupuesto es US$0.0089 por conversación: US$0.45/50, US$2.67/300 y US$8.87/1,000.

La API de Gemini puede evaluarse como segunda fuente o contingencia, pero debe usarse en modalidad pagada y con acuerdo de tratamiento: la modalidad gratuita puede permitir uso para mejora y revisión humana. Fuentes: [precios de Gemini](https://ai.google.dev/gemini-api/docs/pricing), [regiones](https://ai.google.dev/gemini-api/docs/available-regions) y [términos](https://ai.google.dev/gemini-api/terms).

### 12.2 Límites y seguridad

- La IA sólo recibe datos del `tenant` autenticado y únicamente los campos necesarios.
- El RAG busca en documentos y datos de esa empresa; sus filtros se prueban contra fugas cruzadas.
- Inicio en sólo lectura y **prohibición técnica de tocar dinero**: la IA no recibe herramientas para cobrar, pagar, reembolsar, cerrar caja, cambiar precios, autorizar descuentos ni ejecutar movimientos de inventario. Puede explicar o preparar un borrador; una persona autorizada debe ejecutar la acción manualmente en la interfaz normal, fuera del flujo de IA.
- Se registra empresa, usuario, modelo, tokens, fuentes y acción propuesta/aceptada, sin guardar secretos ni datos de tarjeta.
- Se filtran credenciales y datos personales innecesarios; hay retención definida y opción de desactivar IA por empresa.
- El asistente muestra fuentes, reconoce incertidumbre y deriva a una persona. No actúa como autoridad legal, médica, fiscal o financiera.
- Tope monetario diario y mensual por tenant, alarma al 70/90/100% y corte duro al llegar al límite.
- Las llamadas de búsqueda web y archivos tienen cargos separados; no se activan por defecto.

OpenAI indica que los datos de la API no se usan para entrenar por defecto, sujeto a sus controles y política vigentes. [Uso de datos de OpenAI](https://help.openai.com/en/articles/5722486-how-your-data-is-used-) y [países compatibles](https://developers.openai.com/api/docs/supported-countries).

## 13. Backups, disponibilidad y salida del cliente

- Render PostgreSQL ofrece recuperación a un punto en el tiempo según plan. Además, ejecutar `pg_dump` cifrado nocturno hacia un proveedor independiente.
- Retención inicial: siete diarios, cuatro semanales y doce mensuales; legal debe ajustar según datos y contrato.
- Prueba trimestral de restauración en un entorno aislado, con tiempo y evidencia. Un backup no probado no cuenta como recuperación.
- Restauración por tenant mediante herramientas probadas; nunca importar directamente sobre producción sin staging y verificación.
- Exportación del cliente en formatos documentados (CSV/JSON más archivos), disponible durante la suscripción y la ventana de salida.
- Objetivos iniciales propuestos: RPO 24 horas para desastre de plataforma y RTO 8 horas en Básico/Pro; Premium puede comprar objetivos menores sólo después de demostrar capacidad.
- Render no publica una región dominicana. La ubicación y transferencia internacional deben declararse en contrato y privacidad. [Regiones de Render](https://render.com/docs/regions).

## 14. Privacidad, seguridad y protección del negocio

### 14.1 Datos personales

La Ley 172-13 dominicana exige tratar los datos con finalidad, proporcionalidad, derechos del titular y medidas de seguridad. Nexora debe contratar revisión legal local y documentar:

- quién es responsable y quién encargado de cada dato;
- base y finalidad, avisos, consentimiento cuando corresponda y atención de acceso/rectificación/cancelación/oposición;
- subprocesadores, transferencias internacionales y acuerdo de tratamiento;
- retención, eliminación, exportación y respuesta a incidentes;
- MFA, mínimo privilegio, cifrado en tránsito/en reposo, rotación de secretos y revisión de accesos.

Fuente: [Ley 172-13 en la Superintendencia de Bancos](https://www.sb.gob.do/regulacion/leyes/ley-no-172-13-proteccion-de-los-datos/) y [texto publicado por INDOTEL](https://indotel.gob.do/wp-content/uploads/2025/04/Ley-172-13-Sobre-proteccion-de-Datos-personales.pdf). Este documento no declara cumplimiento; enumera trabajo requerido.

### 14.2 Propiedad intelectual y contratos

Antes de cobrar se requieren, como mínimo:

- términos de servicio, EULA/licencia SaaS, privacidad, DPA, política de uso aceptable, soporte/SLA, cancelación/reembolsos y respuesta a incidentes;
- registro de marca Nexora, dominios controlados por la empresa y repositorios privados con MFA;
- inventario de licencias de dependencias, SBOM, análisis de secretos y vulnerabilidades;
- contratos laborales/proveedores con confidencialidad y cesión apropiada del trabajo creado;
- cláusula que deja el núcleo, mejoras generales, herramientas y know-how en Nexora;
- licencia de uso para el cliente mientras pague y derecho de exportar sus datos, no derecho al código fuente;
- anexos de personalización que distingan datos/contenido del cliente de componentes reutilizables de Nexora;
- acceso al código o escrow sólo en contratos Enterprise expresos y con precio/riesgo propios.

## 15. Personalizaciones sin destruir el producto

Toda solicitud pasa por descubrimiento pagado y se clasifica como configuración, extensión reutilizable o desarrollo exclusivo. No se crean ramas permanentes por cliente.

Paquetes orientativos, antes de impuestos:

| Paquete | Alcance | Precio orientativo |
|---|---:|---:|
| Ajuste menor | hasta 5 horas | US$250 / RD$15,458 |
| Mejora corta | hasta 10 horas | US$450 / RD$27,824 |
| Proyecto acotado | hasta 25 horas | US$1,000 / RD$61,832 |

Cada propuesta incluye alcance, exclusiones, dependencias, entregables, pruebas, aceptación, 50% de anticipo y 30 días para defectos del alcance. Soporte corrige fallos del producto; una nueva regla o flujo es mejora. Urgencias y exclusividad llevan recargo. Los precios se validarán con horas reales después de los primeros cinco trabajos.

Priorización del núcleo: impacto en clientes × ingreso/retención × reutilización, dividido por riesgo, soporte y complejidad. Una solicitud de un solo cliente se implementa con configuración, feature flag o API estable cuando sea posible, y siempre pasa pruebas multiempresa, seguridad y regresión.

## 16. Fases, puertas y entregables

### Fase 0 — Decidir y contratar (2–4 semanas)

- entrevistas con 10 comercios y cartas de intención de al menos 3;
- cotizaciones firmadas de Azul/CardNet, contador, abogado y seguridad;
- clasificación tributaria, modelo de contrato, marca y responsable del producto;
- prueba de disposición a pagar RD$1,990/RD$3,990/RD$7,990.

**Puerta:** no programar el MVP completo si nadie acepta precio y condiciones.

### Fase 1 — Fundación SaaS y piloto PWA (12–18 semanas)

- modelo `Tenant`, membresías, RLS y pruebas cruzadas;
- planes, derechos, uso, cobro, webhooks, gracia y exportación;
- secretos por ambiente, logs, backups y restauración;
- onboarding/migración y operación para 3–10 pilotos;
- IA en sólo lectura, con tope pequeño y apagable.

**Puerta:** 10 clientes pagos, cero fuga multiempresa, dos restauraciones exitosas y costo/soporte medidos durante 60 días.

### Fase 2 — Escala y aplicaciones de acompañamiento (8–12 semanas)

- optimización y pruebas de carga para 50 clientes;
- Capacitor Android/iOS, almacenamiento seguro, cámara, notificaciones y revisión de tiendas;
- apps de consumo sin compra ni enlaces de compra;
- métricas de activación, abandono, tickets y consumo de IA.

**Puerta:** aprobación de tiendas, margen combinado mayor a 40% y soporte dentro de reserva.

### Fase 3 — Offline PC y licenciamiento (16–24 semanas)

- protocolo de eventos, outbox/inbox, conflictos, licencia firmada y exportación;
- piloto con dos tiendas y cortes de red controlados;
- auditoría de ventas, pagos, stock, actualización y restauración.

**Puerta:** 30 días de piloto sin pérdida ni duplicación y conciliación documentada.

### Fase 4 — 200 clientes y opciones Enterprise

- capacidad, observabilidad, rotación de guardia, recuperación y simulacro de incidentes;
- base dedicada y SLA sólo para clientes que lo paguen;
- revisión anual de precios, comisiones, IA, retención, leyes y tiendas.

## 17. Métricas y decisiones que la dueña debe controlar

Tablero mensual mínimo:

- clientes activos, MRR, altas, bajas, expansión y mora;
- margen directo por plan y por cohorte;
- horas/tickets de soporte por cliente;
- costo de plataforma, pagos, correo, almacenamiento e IA;
- activación a 7/30 días y uso por función;
- disponibilidad, errores, RPO/RTO demostrado y restauraciones;
- fugas/bloqueos de seguridad y accesos de soporte;
- ventas offline pendientes, conflictos y tiempo de convergencia;
- devoluciones, contracargos y facturas conciliadas.

Decisiones concretas para aprobar antes de código:

| Decisión | Opciones concretas | Recomendación | Impacto / dato pendiente |
|---|---|---|---|
| Nicho | minorista general / suplementos-belleza-fajas / restaurantes | suplementos, belleza y fajas para el primer piloto | Permite usar experiencia real; validar con 10 entrevistas. |
| Precios | los tres propuestos / descuento fundador temporal / precio menor permanente | precios propuestos y descuento fundador con fecha, sin alterar tarifa base | Medir conversión y horas de soporte. |
| Procesador | Azul / CardNet / ambos | cotizar ambos y escoger principal + contingencia técnica | Falta MDR, liquidación, recurrencia y billeteras por escrito. |
| Impuestos/e-CF | SaaS exento / gravado / componentes con tratamientos distintos | opinión escrita por componente antes de facturar | Puede cambiar precio final, contrato y comprobante. |
| Inversión | escenario bajo US$25,252 / base US$45,252 / alto US$59,252 | liberar por fases, no aprobar el total de una vez | Cancelar si no hay demanda o fallan puertas. |
| Mora/datos | gracia 7/30/90 propuesta / plazos más cortos / más largos | 7 días gracia, limitación, suspensión día 30 y retención 90 | Legal y capacidad de almacenamiento deben validarlo. |
| IA | sin IA / sólo lectura / acciones con herramientas | sólo lectura con prohibición absoluta de dinero | Confirmar cuotas y consentimiento por tenant. |
| Offline | no construir / incluido / complemento pagado | complemento después de fase 3 | Recalcular RD$1,790 al medir costo real. |
| Soporte | horario laboral / guardia pagada / 24×7 | horario laboral; guardia como Premium/Enterprise | Definir responsable, escalamiento y costo laboral. |
| Propiedad | licencia SaaS / entrega de fuente / escrow Enterprise | licencia propietaria; fuente privada; escrow sólo excepcional | Abogado debe cerrar entidad, marca y contratos. |

## 18. Riesgos principales y mitigación

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| Fuga entre empresas | consulta o exportación sin `tenant_id` efectivo | RLS, contexto transaccional, pruebas adversariales y revisión externa. |
| Precio no aceptado | pilotos piden descuentos antes de probar | cartas de intención y pago real antes de ampliar inversión. |
| Soporte consume el margen | más de la reserva de US$6/14/30 | onboarding, telemetría, límites, base de ayuda y repricing. |
| Comisión/regla de tiendas | rechazo o exigencia de IAP | PWA primero, app complementaria sin compra y revisión previa. |
| Offline duplica o pierde ventas | cursor atrasado, eventos repetidos | eventos inmutables, idempotencia, simulaciones y piloto cerrado. |
| IA filtra o actúa mal | respuestas sin fuente o herramientas excesivas | aislamiento por tenant, sólo lectura, aprobación humana y cortes de presupuesto. |
| Proveedor de pago falla | webhook perdido o conciliación distinta | idempotencia, consulta periódica, conciliación y segundo proveedor evaluado. |
| Incumplimiento fiscal/privacidad | factura o transferencia no documentada | opinión escrita, contratos, inventario de datos y revisión anual. |
| Dependencia de un proveedor | restauración o migración no probada | exportación, backups externos, infraestructura reproducible y simulacros. |

## 19. Fuentes adicionales y alternativas

- Banco Central de la República Dominicana, certificación/histórico de la tasa de referencia usada (venta, 16-oct-2026): [Certificación de tasas](https://www.bancentral.gov.do/SectorExterno/CertificacionTasas).
- Alternativas de infraestructura para comparar antes de renovar: [Railway](https://docs.railway.com/pricing/plans), [Supabase](https://supabase.com/pricing) y [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets).
- Pooling de conexiones en Render: [PgBouncer](https://render.com/docs/postgresql-connection-pooling).
- Las fuentes anteriores fijan tarifas/reglas públicas. Las estimaciones de horas, soporte, mezcla, consumo y recuperación son supuestos explícitos de Nexora y deben reemplazarse por datos de pilotos.

## 20. Secuencia y decisiones de cierre

El orden de ejecución que se somete a aprobación es: **(1)** contratos, cotizaciones y validación comercial; **(2)** PWA multiempresa con cobro, backup e IA de sólo lectura; **(3)** aplicaciones de acompañamiento; **(4)** offline PC sincronizado; **(5)** escala y Enterprise. Cada paso se detiene si no supera su puerta de la sección 16.

La dueña debe escoger entre las opciones de la sección 17 antes de autorizar código. La recomendación concreta es: nicho suplementos/belleza/fajas; precios RD$1,990/RD$3,990/RD$7,990; Azul o CardNet sólo tras cotización comparada; inversión liberada por fases; IA sin herramientas de dinero; offline como complemento; soporte laboral con guardia pagada; y licencia propietaria sin entregar el código fuente.

## Resumen final para la dueña
1. Recomiendo lanzar primero la PWA SaaS con 3–10 clientes pagos; las apps y el offline vienen después de demostrar aislamiento, restauración y demanda.
2. Propongo Básico RD$1,990, Pro RD$3,990 y Premium RD$7,990 mensuales, antes de impuestos aplicables, con límites claros y sin uso ilimitado.
3. El margen conservador modelado es 39.8% con 10 clientes, 59.8% con 50 y 63.5% con 200, pero aún faltan cotizaciones legales, fiscales, de pagos y soporte real.
4. Antes de código debe aprobar nicho, inversión, procesador, tratamiento fiscal, contratos, privacidad y reglas de mora/exportación; ningún dato real ni despliegue queda autorizado aquí.
5. Si se aprueba, Claude debe revisar esta propuesta antes de programar y la fase 2 sólo comienza tras 10 clientes pagos, cero fuga multiempresa y dos restauraciones comprobadas.
