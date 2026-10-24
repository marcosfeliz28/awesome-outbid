# Nexora POS — propuesta de planes y precios (para decisión de la dueña)

**24 de octubre de 2026 · Borrador comercial, no aprobado.** Este documento no cambia los precios del producto, no autoriza cobros y no promete aplicaciones móviles o de escritorio antes de su prueba y publicación.

## 1. Punto de partida real del código

`apps/api/src/billing-plans.ts` define hoy estos topes y mensualidades de prueba. La propuesta es **conservarlos para el piloto**, medir costo y soporte durante 30 días y decidir entonces si se publican o ajustan. No confundir un valor guardado en el código con una tarifa ya aprobada por la dueña.

| Plan | Precio actual de prueba | Sucursales | Cajas/equipos | Usuarios | Preguntas de IA al mes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Autoservicio | RD$990 | 1 | 1 | 2 | 30 |
| Básico | RD$1,990 | 1 | 2 | 3 | 50 |
| Pro | RD$3,990 | 2 | 6 | 10 | 300 |
| Premium | RD$7,990 | 5 | 20 | 30 | 1,000 |

Incluidos en todos, cuando superen su puerta de salida: POS, inventario, clientes, reportes básicos, respaldo/exportación por empresa, soporte técnico para incidencias y acceso web. Los límites son por **empresa**, no por usuario. La IA propone y explica; nunca aprueba por sí sola dinero, inventario, anulación o datos fiscales. El respaldo verificable y la restauración son una obligación de seguridad, no un extra vendible.

**No vender todavía como disponible:** iPhone/Android en las tiendas de aplicaciones, instalador local sincronizado, e-CF/B04, exportadores fiscales sin visto bueno contable, personalizaciones y SLA. Esos puntos tienen puertas técnicas y legales separadas. La instalación local, una vez probada, podría ser un complemento con licencia y soporte mensual propios; no incluirla gratis por accidente en los cuatro planes.

## 2. Política propuesta de IA y cobro

- Mantener el número de preguntas anterior **y** un presupuesto monetario por empresa. Se bloquea o pide autorización al alcanzar primero cualquiera de los dos; no hay consumo ilimitado silencioso.
- Proponer topes internos iniciales de gasto del proveedor: US$1 / US$2 / US$8 / US$20 al mes (Autoservicio/Básico/Pro/Premium). Son límites operativos, **no** cargos extras al cliente. Si el costo real se aproxima, avisar antes de suspender.
- Las preguntas no usadas no se acumulan. El costo de herramientas, reintentos, imágenes y búsqueda debe contar en el mismo presupuesto. Poner un tope por conversación y registrar tokens/costo por empresa sin guardar secretos en el navegador.
- No activar recargas automáticas ni facturar sobreuso hasta que la dueña apruebe precio, moneda, impuestos, aviso al cliente y flujo de pago.
- **Puerta pendiente N-06:** el informe de 20 preguntas reales todavía no existe; las cifras de IA de abajo son escenarios, no una medición. Antes de fijar precios hay que medir las 20 preguntas con clave de pruebas, sin datos reales de clientes.

## 3. Costo de Render por empresa: modelo, no factura actual

Render cobra **por instancia compartida**, no una instancia por empresa, y además cobra almacenamiento y tráfico. Su propia referencia de julio de 2026 daba aproximadamente **US$13/mes** para un web service Starter y una base Basic-256mb de un negocio pequeño; eso no dimensiona por sí solo una plataforma multiempresa. La [página de planes de cómputo](https://render.com/docs/compute-plans) indica capacidad, y la [página de precios](https://render.com/pricing) indica almacenamiento PostgreSQL a **US$0.30/GB-mes**, disco a **US$0.25/GB-mes** y tráfico extra a **US$0.15/GB**. [Referencia de Render para pequeños negocios](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses).

Presupuesto de trabajo **hipotético** para el piloto: US$100/mes de API, PostgreSQL, archivos/respaldo y vigilancia compartidos. No se ha leído la factura real de Render ni medido carga de 20 empresas. Se reparte por empresas activas; si hay 20, son **US$5 por empresa**; si sólo hay 5, **US$20 por empresa**. Añadir aparte correo, soporte humano, impuestos, comisión de cobro, copias externas, fallos de pago y margen para crecer. No usar el plan gratuito de PostgreSQL para ventas reales: Render advierte que expira y que los recursos gratuitos no son para producción. [Condiciones de servicios gratuitos](https://render.com/docs/free).

Para comparar con los precios en pesos, el ejemplo siguiente usa **RD$65/US$1 como supuesto presupuestario**, no como cotización actual ni tasa de cobro. La cuenta debe recalcularse con la tasa y las facturas reales el día que la dueña decida.

| Partida ilustrativa por empresa, con 20 empresas | Autoservicio | Básico | Pro | Premium |
| --- | ---: | ---: | ---: | ---: |
| Render compartido, US$5 × RD$65 | RD$325 | RD$325 | RD$325 | RD$325 |
| IA con 10× reserva de llamadas/herramientas | RD$18 | RD$29 | RD$176 | RD$585 |
| Correo/almacenamiento variable, supuesto | RD$65 | RD$65 | RD$65 | RD$65 |
| Soporte humano presupuestado, supuesto | RD$150 | RD$300 | RD$600 | RD$1,500 |
| **Costo mensual ilustrativo** | **RD$558** | **RD$719** | **RD$1,166** | **RD$2,475** |
| **Margen antes de impuestos/comisión/otros** | **44 %** | **64 %** | **71 %** | **69 %** |

La línea de IA usa sólo un **ejemplo**, no medición: 4,000 tokens de entrada y 1,000 de salida por pregunta, con el precio publicado de Haiku 5.5 de **US$0.10/MTok de entrada y US$0.50/MTok de salida**; eso da US$0.0009 por llamada simple y se multiplica por diez para reservar uso de herramientas/reintentos. [Tarifas API de Claude](https://claude.com/pricing). Si se usa otro modelo o preguntas con documentos largos, la cifra cambia.

**Sensibilidad:** con sólo 5 empresas y el mismo gasto fijo de US$100, la cuota de Render sube de RD$325 a RD$1,300 por empresa; Autoservicio de RD$990 perdería dinero aun antes de comisiones. La conclusión no es subir automáticamente el precio, sino tratar ese plan como piloto subsidiado hasta conseguir escala o medir una infraestructura menor que sea segura.

## 4. Decisiones que debe tomar la dueña

1. ¿Mantener las cuatro mensualidades del código para el piloto o publicar otro precio? Recomendación: mantenerlas **sin publicarlas aún** y revisar tras 30 días con costos reales y al menos tres empresas piloto.
2. ¿Cobrar en RD$ y quién absorbe variación de USD, comisión del procesador e impuestos? Mostrar siempre el total final antes de cobrar.
3. ¿Qué soporte humano promete cada plan (horario, respuesta, instalación, capacitación)? No vender “ilimitado” sin capacidad.
4. ¿Se cobrarán instalación, migración de Excel, impresoras, versión Windows, aplicaciones móviles y cambios a la medida? Propuesta: cotizar por separado hasta que existan pruebas, mantenimiento y límites de alcance.
5. ¿Qué pasa al agotar IA: pausa con aviso, compra manual de paquete o pasar a otro plan? Recomendación: pausa con aviso; jamás cargo automático sin consentimiento.

## 5. Datos a levantar antes del precio final

Factura real de Render por servicio, almacenamiento y tráfico; costo de respaldo/restauración; 20 consultas reales de IA por tipo de tarea; minutos de soporte por empresa; costo de cobro y morosidad; carga simultánea de cajas; revisión fiscal/legal de contratos y comprobantes. Con esos datos, volver a calcular `margen = (precio cobrado − costo completo) / precio cobrado` por plan y por cohorte de 5, 20 y 100 empresas.
