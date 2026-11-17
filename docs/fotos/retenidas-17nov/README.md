# Candidatas para las 18 fotos retenidas — 17-nov-2026

## Resultado

Se revisaron los 18 SKU retenidos sin cambiar catálogo, inventario ni aplicación. Esta carpeta contiene 18 archivos candidatos de 800 × 800 para auditoría interna, pero **solo seis tienen coincidencia exacta comprobada** de marca, sabor/variante y presentación: `INV-1122`, `INV-1152`, `INV-1192`, `INV-1193`, `INV-1199` e `INV-1937`.

Los doce restantes son evidencia explícita de una discrepancia o de un dato que no pudo comprobarse. No deben asignarse a productos ni publicarse en la tienda. Entre ellos están los tres Isopure blancos solicitados (`INV-1156`, `INV-1172`, `INV-1173`): son el envase oficial actual, pero sus etiquetas declaran 2.73, 2.73 y 2.91 lb frente a 3 lb en el catálogo. No se redondeó ni se cambió el catálogo para forzar la coincidencia.

## Qué contiene

- `candidatas.csv`: fuente, URL original, dimensiones nativas verificadas, lectura visible, coincidencias separadas, alternativa y límites de derechos/vigencia para los 18 SKU.
- `INV-*.webp`: copia normalizada mecánicamente a 800 × 800 sobre fondo blanco, sin ampliación desde una fuente menor de 800 px.
- `contacto.png`: hoja de contacto para revisar de un vistazo; verde = coincidencia exacta, ámbar = discrepancia/no comprobado.
- `verificar_retenidas17.mjs`: control reproducible de cobertura, identidad, dimensiones y conteo de estados.

## Criterio conservador

Una URL oficial o activa no prueba permiso de reutilización ni vigencia física del envase. Tampoco se trató un título comercial como prueba cuando la etiqueta visible decía otro peso. Por eso el CSV separa coincidencia visual, composición, derechos y vigencia. Todos los archivos siguen siendo candidatos internos sujetos a auditoría independiente de Dot/Claude y aprobación de Marcos.

## Comprobación

```bash
node docs/fotos/retenidas-17nov/verificar_retenidas17.mjs
```

Resultado esperado: `PASS: 18 candidatas contabilizadas; 6 coincidencias exactas y 12 pendientes explícitos`.

## Límites

No se subió ninguna imagen a la tienda, no se modificó `apps/**`, no se tocaron precios, dinero, producción, Render, base de datos ni credenciales. La entrega no autoriza publicación ni atribuye derechos de uso.
