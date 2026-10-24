# Veredicto de Claude sobre la propuesta actualizada de Gemini (24-oct-2026)

Fuente: `Nexora_POS_Propuesta_Actualizada_Gemini_para_Claude.docx` (la entregó la dueña). Reglas que no cambian:
- la e-CF queda pausada para el equipo y la lleva la contable;
- toda venta lleva su comprobante y no se construye nada para dejar ventas fuera de la DGII;
- el margen mínimo es 15 % sin restar ITBIS;
- la IA propone y una persona aprueba.

## 1. Correcciones de Gemini a su propuesta anterior

Las acepto todas. Gemini retiró lo que ya existe y corrigió lo del instalador NSIS.

## 2. Sus 10 mejoras nuevas

| # | Mejora de Gemini | Veredicto | Dónde entra |
|---|---|---|---|
| 1 | Nota de crédito fiscal B04 ligada al NCF original | **Pausada.** Es comprobante fiscal: la decide la dueña con su contable, como la e-CF. Queda anotada como primera tarea fiscal cuando ella la reactive. | Fiscal (pausado) |
| 2 | Exportador/conector para el proveedor de e-CF de la contable | **Pausada** por la misma razón. Si la contable pide un archivo de ventas, se hace como reporte de solo lectura dentro de la mejora 5. | Fiscal (pausado) |
| 3 | 607, 608 e IT-1 además del 606 | **Aceptada.** Son reportes de solo lectura para el contador y no emiten comprobantes. | Mejora 5 |
| 4 | Interruptores por empresa y almacenes con nombre libre | **Aceptada.** Ya estaba en el plan (3b); se suma el nombre libre de los almacenes. | Mejora 3 |
| 5 | Respaldos por empresa en un almacenamiento aislado, no en el Drive de la tienda | **Aceptada, obligatoria.** Ningún respaldo de un cliente va al Drive de la tienda. | Mejora 2 (fase 1) |
| 6 | Asistente de primer arranque (logo/RNC, módulos, Excel o foto de factura, ticket de prueba) | **Aceptada.** Ya estaba en la fase 1; se le suman la impresión del ticket de prueba y los módulos. | Mejora 2 (fase 1) |
| 7 | Cobro de los planes por transferencia verificada, reusando la conciliación | **Aceptada.** Así se cobra desde el día 1 sin pasarela; la tarjeta llega después. | Mejora 2 (fase 1) |
| 8 | Aviso de secuencias NCF por agotarse o vencer | **Aceptada como aviso.** Solo avisa y no emite nada. | Mejora 5 |
| 9 | Cliente de escritorio Tauri conectado a la nube con impresión directa | **Aceptada** para la fase 3 (instalador vendible). | Fase 3 |
| 10 | Número de lote del verifón al cerrar caja con tarjeta, y foto opcional | **Aceptada.** Es pequeña y sirve también a la tienda. | Ajustes de caja (`ORDEN_AJUSTES_GEMINI_CHATGPT_PC.md`) |

## 3. Su crítica del orden

- **Acepto:** el registro público **no se abre** hasta que estén la parte rápida de la mejora 3 (quitar lo de Macgen) y los términos legales (mejora 4). Por eso son requisitos para cerrar la fase 1. ChatGPT PC hace la mejora 3 al final de la fase 1, en los mismos archivos, para no chocar.
- **Acepto:** el WhatsApp (9) va antes que el conector para la IA del cliente (7), si Meta lo permite. Si Meta no lo confirma, se adelanta la 7.
- **No acepto:** poner la mejora 6 («Pregúntele a Nexora») después de la 5. La hace ChatGPT NUBE en paralelo y en archivos propios, así que no retrasa nada.

## 4. Riesgos que confirmé en el código

- **Fotos dentro de la base:** las evidencias de cobro se guardan como imagen en base64 dentro de PostgreSQL (`apps/api/src/sales.ts:3315`). Con muchos clientes llenan la base. **Orden:** en el producto van en un almacenamiento de objetos aislado por empresa. En la tienda, Claude mide primero cuánto ocupan antes de decidir.
- **Modelo de IA:** las facturas usan hoy `claude-opus-5-5` (`apps/api/src/invoice.ts:324`), el más caro. Los precios que cita Gemini son de modelos viejos. Se mide con 10 facturas reales en la mejora 8.
- **Privacidad (Ley 172-13):** los términos deben decir que la IA procesa documentos del cliente y con qué proveedor, y que se usa la API comercial, sin entrenamiento con sus datos. Va en la mejora 4.
- **Instalador local:** el respaldo diario debe salir fuera de la PC (nube de Nexora o disco externo), con una alerta roja si pasan 48 horas sin respaldo. La licencia es Ed25519 con control del reloj, y la IA pasa por un intermediario en la nube, sin claves dentro de la PC. Todo eso va en la fase 3.
- **Pedidos de borrar ventas:** se mantiene la regla fija. Toda anulación deja rastro y no hay ninguna función para ocultar ventas.

## 5. Sus 5 funciones nuevas de IA

Las acepto para después de la mejora 6, porque reusan sus herramientas. Siempre propone la IA y aprueba una persona. Prioridad:

1. **Revisar transferencias desde la foto del comprobante.** Es la de más valor hoy: el 23-oct hubo 10 transferencias sin verificar, varias con la referencia «1111».
2. **Ayudante antes del cierre:** explica por qué no cuadra una caja.
3. **Recordatorios de cobro** de crédito y contraentrega.
4. **Borrador de orden de compra** a partir de lo que está por agotarse.
5. **Oferta para lotes por vencer**, que nunca baja del 15 % de margen y no cambia el precio base.

## 6. Costos

- **Servidor para los clientes:** las cifras de Gemini (unos US$50 al mes con la misma potencia que la tienda) son razonables. Claude confirma el monto exacto en Render antes de que la dueña autorice el sistema aparte.
- **Costo por consulta de IA:** se mide con 20 preguntas de prueba en la fase 2, no con tarifas viejas.
- **Azul y Cardnet:** sus tasas están sin confirmar. La dueña debe pedir la cotización por escrito.
