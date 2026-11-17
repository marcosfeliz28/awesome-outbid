# Evidencia fotográfica de suplementos — lote 3

## Alcance

- Maestro cubierto: filas 121–180 de `docs/fotos/suplementos.csv` (60 SKU).
- Entrega: 44 fotografías WebP reales y 16 faltantes explícitos.
- Ninguna imagen se subió a la tienda. Son candidatas internas sujetas a auditoría de Dot/Claude y aprobación de Marcos antes de cualquier uso.

## Criterio de aceptación

Cada fotografía aceptada se descargó de la URL consignada en `fotos.csv`, se abrió como imagen real y se normalizó a WebP sobre fondo blanco sin ampliarla. La auditoría comprobó manualmente la etiqueta frontal, marca, variante/sabor y presentación; además, ambas dimensiones nativas entregadas por la fuente son de al menos 800 px. `contacto.png` reúne las 44 imágenes finales con su SKU para una segunda revisión visual.

Se rechazaron candidatas cuando la etiqueta contradecía el maestro, la variante exacta no podía demostrarse, la imagen era posterior o promocional, la fuente no respondía o la resolución real era inferior a 800 × 800. El parámetro de una URL no se trató como tamaño real: las dimensiones se midieron después de descargar y decodificar el archivo.

## Derechos y vigencia

Que una URL esté activa o pertenezca a una marca no demuestra permiso de reutilización ni que el envase sea el vigente. Por eso cada fila declara `permiso de reutilización no comprobado`; estas imágenes no están aprobadas para publicación. La coincidencia visual y la resolución tampoco sustituyen una revisión de derechos.

## Comprobación reproducible

```bash
node docs/fotos/verificar_lote3.mjs
```

Resultado esperado: `PASS: lote 3 completo, 44 fotos reales y 16 faltantes`. El validador exige 60 SKU contabilizados, columnas obligatorias, identidad única, WebP ≥800 × 800, correspondencia exacta declarada, igualdad entre archivos y filas y una hoja de contacto válida.

## Autoauditoría

- Se retiró la candidata Berry Blast después de revisar la hoja de contacto porque era una composición promocional con frutas y salpicaduras, no un fondo limpio.
- Se rechazó IsoFit de 70 servicios frente al objetivo de 30; no se cambió el inventario para hacerla coincidir.
- Se rechazó Magnesium Glycinate de Perfect Vitamin Products frente a Pro Performance Nutrition.
- Se separaron las variantes ambiguas Isopure/Low Carb/Zero Carb en lugar de inferir que eran equivalentes.
- Las 16 ausencias conservan motivo individual en `faltantes.csv`; no se inventó una coincidencia para completar el lote.
- No se modificaron aplicación, inventario, precios, dinero, producción, Render, base ni credenciales.
