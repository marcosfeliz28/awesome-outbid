# Validación visual local — cola offline de Mercancía

Fecha: 2026-11-18
Candidato exacto: `adb789cb43f950398d3ab6ecf4de0f29979eb3f1`

## Condiciones

- UI real en `127.0.0.1:14295`, API totalmente simulada y datos ficticios.
- Se insertaron dos muestras ficticias únicamente en el IndexedDB aislado del navegador: una entrada pendiente y una salida en conflicto.
- El estado offline se simuló con un evento `window.offline`; no se modificó la red del sistema.
- Combinaciones: 1440 claro ES, 1440 oscuro EN, 390 claro ES y 390 oscuro EN.
- No se pulsó Reintentar/Revisar, no se cargó la operación, no se confirmó entrada/salida y no hubo ventas, pagos ni llamadas a producción/Render.
- Todas las escrituras HTTP de negocio estaban bloqueadas. Escrituras observadas en la corrida final: cero.

## Resultado

Última corrida: `4 passed (16.6s)`. Paquete reducido: cuatro capturas de la cola y dos capturas representativas de los hallazgos anteriores, más JSON saneado.

## Lo corregido y comprobado

- ES: `Pendientes de este equipo`, `Pendiente · Entrada`, `Requiere revisión · Salida`, `Reintentar`, `Revisar`.
- EN: `Pending on this device`, `Pending · Receipt`, `Needs review · Removal`, `Retry`, `Review`.
- A 390 y 1440 los dos estados son visibles sin desbordamiento horizontal global.
- Los botones miden 45 px. En estado offline, `Retry/Reintentar` queda deshabilitado y `Review/Revisar` permanece disponible, coherente con el comportamiento presentado.
- Temas claro y oscuro conservan jerarquía y legibilidad.

## Hallazgos

### OFF-ADB-01 — Baja — la fecha de la cola EN conserva formato español

- Evidencia: `1440-dark-en-cola-offline.png` y `390-dark-en-cola-offline.png`.
- Código: la función `when` de `apps/web/src/Merchandise.tsx:88-96` usa siempre `es-DO`; la cola la consume alrededor de `:1370`.
- Resultado: con idioma EN se muestra `18-nov, 11:54 a. m.` debajo de `Pending · Receipt`.
- Esperado: usar `en-US` al estar EN, igual que ya hace el historial compartido de recepciones.

### OFF-ADB-02 — Media — persiste el hallazgo anterior de razones de salida en español bajo EN

- Evidencia: `390-dark-en-razones-salida.png` y métricas en los cuatro escenarios.
- Código: `apps/web/src/Merchandise.tsx:77-83`, render en `:788-792`.
- Resultado: `Stock removal reason` presenta `Merma`, `Dañado`, `Vencido`, `Muestra o probador`, `Uso interno`, `Devolución a proveedor`.
- Esperado: traducir solo las etiquetas visibles y conservar los valores enviados a la API.

### OFF-ADB-03 — Baja — persiste el nombre accesible español del cierre del editor de orden bajo EN

- Evidencia: `390-dark-en-hallazgos-previos.png` y métricas.
- Código: `apps/web/src/Purchases.tsx:204` no pasa `closeLabel`; el valor predeterminado es `Cerrar` en `packages/ui/src/index.tsx:126`.
- Resultado: el editor inglés `New purchase order` tiene un botón X anunciado como `Cerrar`.
- Esperado: pasar `Close`/`Cerrar` según el idioma.

## Límites

- Esta es una validación de presentación y localización, no una prueba funcional de sincronización, persistencia, permisos o seguridad.
- No se usó una interrupción real de red; el objetivo era mostrar de forma segura el estado de cola con muestras aisladas.
- El mensaje `MENSAJE FICTICIO DE CONFLICTO` es un dato de prueba, no texto de producto.

## Archivos

- `metricas-saneadas.json`.
- `1440-light-es-cola-offline.png`, `1440-dark-en-cola-offline.png`, `390-light-es-cola-offline.png`, `390-dark-en-cola-offline.png`.
- `390-dark-en-razones-salida.png`, `390-dark-en-hallazgos-previos.png`.
