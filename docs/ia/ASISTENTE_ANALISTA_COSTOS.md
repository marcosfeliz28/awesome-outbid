# Costos y cuotas del Asistente analista

**Fecha del cálculo:** 8 de noviembre de 2026  
**Estado:** estimación de planificación; **NO es una medición de producción**.

## Fuente de precios

`apps/api/src/ai-prices.ts` registra para Claude Haiku 5.5: US$0.10 por millón de tokens de entrada, US$0.50 por millón de salida, US$0.01 por millón de lectura de caché y US$0.125/US$0.20 por escritura de caché de 5 minutos/1 hora. El archivo enlaza la [documentación oficial de precios de Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) y anota consulta del 7 de noviembre de 2026.

La fórmula implementada en `apps/api/src/ai-usage.ts` es la autoridad para facturación interna. Esta estimación usa entrada y salida sin caché, que es más conservador que suponer aciertos de caché.

## Escenarios por pregunta

Fórmula: `(tokens_entrada × 0.10 + tokens_salida × 0.50) / 1,000,000`.

| Escenario | Entrada | Salida | Costo estimado US$ | Uso típico |
|---|---:|---:|---:|---|
| simple | 1,500 | 250 | 0.000275 | una lectura y respuesta corta |
| normal | 6,000 | 500 | 0.000850 | triple lectura y explicación |
| pesada | 18,000 | 900 | 0.002250 | comparación y varias excepciones |
| techo conservador | 40,000 | 2,400 | 0.005200 | cuatro rondas con salidas máximas acumuladas |

Los tokens son supuestos de diseño, no observaciones. La evaluación debe capturar entrada, salida, caché, rondas, herramienta y costo calculado para obtener promedio y percentil 95 reales.

## Conversión para presupuestar

Se usa **RD$65 por US$1 únicamente como supuesto conservador de presupuesto**, no como tasa vigente confirmada. Debe sustituirse por la tasa administrativa configurada al aprobar precios.

- Normal: aproximadamente RD$0.055 por pregunta.
- Pesada: aproximadamente RD$0.146 por pregunta.
- Techo conservador: aproximadamente RD$0.338 por pregunta.
- Reserva operativa propuesta: 3 veces el techo = **RD$1.014 por pregunta**.

## Cuotas propuestas

Se conservan las cuotas decididas por la dueña en `docs/coordinacion/ORDENES_24OCT_NOCHE_PRODUCTO.md`; no hace falta subir precios por el Asistente analista.

| Plan | Precio mensual | Preguntas | Reserva IA a RD$1.014/pregunta | Margen después de IA* |
|---|---:|---:|---:|---:|
| Autoservicio | RD$1,250 | 100 | RD$101.40 | 91.9 % |
| Básico | RD$2,000 | 250 | RD$253.50 | 87.3 % |
| Pro | RD$4,000 | 600 | RD$608.40 | 84.8 % |
| Premium | RD$7,000 | 1,500 | RD$1,521.00 | 78.3 % |
| Paquete extra | RD$399 | 100 | RD$101.40 | 74.6 % |
| Paquete extra | RD$999 | 300 | RD$304.20 | 69.5 % |

\*Este porcentaje descuenta solo el costo variable estimado de IA. No incluye Render, soporte, impuestos, ventas, respaldo ni procesamiento de cobros; por eso **NO CONFIRMA** un margen total del producto de 15 %.

## Regla para garantizar el 15 % total

Antes de vender, finanzas debe aportar el costo mensual no IA asignado a cada plan. El máximo seguro es:

`preguntas_máximas = piso((precio × 0.85 - costo_no_IA) / costo_P95_por_pregunta)`

Si el resultado queda por debajo de la cuota comercial, se reduce la cuota, se optimizan tokens o se cambia el precio mediante decisión de la dueña. No se debe esconder el sobrecosto ni degradar otras funciones.

## Controles recomendados

1. Mantener los topes actuales y pausar solo la IA al agotarlos.
2. Alertar al 70 %, 90 % y 100 % de la cuota.
3. Medir costo promedio, P95 y máximo por tipo de pregunta durante el piloto.
4. Activar un cortacircuito si el costo P95 supera RD$1.014 durante siete días.
5. Recalcular cuotas con tasa cambiaria, costos no IA y datos del piloto antes del lanzamiento abierto.

