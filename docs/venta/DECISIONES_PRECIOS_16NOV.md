# Decisiones de precios de la dueña (16-nov-2026) y lo que falta

Lo que dijo la dueña en el chat con Norexos 1, textual y sin interpretar de más.

| # | Dijo | Estado |
|---|---|---|
| 1 | «Pesos primero» (catálogo del código en RD$: Autoservicio 1,250, Básico 2,000, Pro 4,000, Premium 7,000 al mes) | Decidido (antes de los puntos siguientes) |
| 2 | **Instalado: US$200** (pago único). Pregunta: ¿qué incluye y cómo se maneja la IA? | Precio dado; contenido propuesto abajo, por confirmar |
| 3 | **Online: «bien a US$40» al mes** | Falta aclarar a qué plan reemplaza o si es el plan de entrada |
| 4 | Usar una **IA más barata** | Propuesta abajo |
| 5 | Analizar **Autoservicio (RD$1,250)**: hacerlo rentable o quitarlo | Análisis abajo; falta su decisión |
| 6 | **Botón** para poner o no poner el ITBIS en la factura | Pendiente de su sí; toca dinero |
| 7 | «Corrige todo lo demás» | Aplicado lo que no depende de decisiones (ver el final) |

## Preguntas abiertas (necesarias)
1. **Moneda:** dijo «pesos primero» y luego dio cifras en dólares. ¿Se muestra en RD$ (con la tasa del día) o en US$?
2. **US$40 en línea:** ¿es un solo plan que sustituye a los 4, o el precio de entrada (Básico)?
3. **ITBIS:** ¿los precios incluyen ITBIS o se suma aparte? (el botón del punto 6 es otra cosa: mostrarlo o no en el recibo.)

## Propuesta de Norexos 1 (sin decidir por ella)
**Instalado US$200, pago único.** Incluye: instalador, 1 sucursal, hasta 3 cajas, 1 año de actualizaciones y soporte por WhatsApp o correo; renovación opcional desde el segundo año (US$39 al año, por confirmar). **La IA no va incluida:** una IA siempre cuesta cada vez que se usa y un pago único no puede cubrir un gasto que se repite. Dos formas opcionales: (a) el cliente pone su propia clave con su propio gasto, o (b) paquetes prepagados (RD$399 por 100 preguntas, RD$999 por 300, ya en el código) que pasan por el servidor de Norexos.
**IA más barata:** el asistente de preguntas ya usa el modelo económico (menos de US$0.003 por pregunta). La lectura de facturas usa el modelo caro (US$0.05 a 0.15 por factura): se prueba un modelo intermedio con las 10 facturas reales de la lista PC-14 antes de cambiar. **No usar un modelo local para cifras, dosis, precios ni facturas:** el 15-nov un modelo local confundió mcg con mg.
**Online US$40 al mes (~RD$2,400 a RD$60):** da ganancia solo si el producto es **multiempresa compartido** (como está construido), no un servidor dedicado por cliente: el umbral de la nube dedicada ronda los US$62 (`PROPUESTA_PRECIOS.md`, histórico). Hay que comprobar el costo fijo real de la nube compartida y repartirlo entre clientes (ítem 23 de la lista del piloto).
**Autoservicio RD$1,250 (~US$21):** con nube compartida, IA incluida y soporte humano, pierde o gana muy poco. Opciones: (1) **quitarlo del precio público** y arrancar en Básico (más simple para lanzar; sigue en el código); (2) dejarlo **sin IA incluida y sin soporte humano** (solo guías), con pago anual de 10 meses; (3) subirlo. Recomendación: **opción 1 para el primer lanzamiento**, y reevaluar tras los primeros pilotos con costos reales.
**Botón de ITBIS:** el sistema ya tiene el ajuste de precio con ITBIS incluido o aparte (`taxIncluded`). Lo que se pide es otro ajuste: **mostrar u ocultar el desglose del ITBIS en el recibo** (solo presentación, sin cambiar totales). Toca dinero: se hace en rama aparte, con verificación ×3 y solo con su sí; la contadora debe confirmar que ocultarlo no confunde al cliente, porque el recibo no es fiscal.

## Corregido ya (sin necesitar decisiones)
- La landing y sus textos ya no prometen NCF: dicen que Norexos no emite NCF ni e-CF (ES y EN).
- `PROPUESTA_PRECIOS.md` quedó marcada como histórica.
- `HOJA_DE_PRECIOS.md` quedó marcada «EN REVISIÓN: no publicar».

## Falta (depende de las respuestas)
Actualizar hoja, landing, contratos y textos de venta a las cifras finales (ver `docs/piloto/ESPEC_PRECIOS_PESOS_16NOV.md`: 22 cambios, 11 con decisión).
