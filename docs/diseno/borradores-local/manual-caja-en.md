**Borrador sin verificar** (modelo local qwen-optimizado, cola N9–N16, orden 73). Fuente: `origin/nexora-cloud` (`f0446d50` o posterior). **Revisión de Claude PC:** N10 · citas POS.tsx sin comprobar una a una; hay NO ENCONTRADO explícitos. Solo sirve como guía de lectura.

Borrador sin verificar · fuente = inventario de textos del POS (no el código completo; no se abrió docs/operacion) · archivos revisados (PARCIAL) · cada cita con archivo:línea · al final: qué hiciste, cómo lo comprobé, qué NO comprobé.

### Manual corto para la cajera

1. **Abrir el POS**: sin cita en el inventario (NO ENCONTRADO).
2. **Elegir cliente**: presiona F4 para elegir cliente (POS.tsx:1048). «Crear» no aparece en la lista: NO ENCONTRADO.
3. **Escanea o busca un artículo**: Utiliza el lector de código de barras o busca el artículo en el sistema (POS.tsx:1177).
4. **Agregar al carrito**: NO ENCONTRADO (no hay texto de esa acción en la lista).
5. **Ver subtotal**: Revisa el subtotal de la venta (POS.tsx:1183).
6. **Aplicar descuento global**: Si es necesario, ingresa el descuento global (POS.tsx:1187).
7. **Ver total a cobrar**: Revisa el total final a cobrar (POS.tsx:1215).
8. **Cobrar**: Presiona el botón de cobrar (POS.tsx:1232) o F12 (POS.tsx:1233).
9. **Elegir método de pago**: Selecciona el método de pago (tarjeta, crédito, etc.) (NO ENCONTRADO).
10. **Elegir banco**: Si es transferencia o tarjeta, elige el banco (NO ENCONTRADO).
11. **Confirmar venta**: Confirma la venta registrada (POS.tsx:2360).
12. **Solicitar NCF**: Si es necesario, solicita el NCF (POS.tsx:2583).
13. **Seleccionar tipo de NCF**: opciones B01 · Crédito fiscal y B02 · Consumidor final (POS.tsx:2589-2590).
14. **Nota de crédito**: aparece el aviso «Nota de crédito disponible» (POS.tsx:2636). Imprimirla: NO ENCONTRADO.
15. **Finalizar venta**: Cierra la venta y genera el comprobante (NO ENCONTRADO).

### Revisión de Claude PC
Se corrigieron 5 pasos: afirmaciones sin base en el inventario (pasos 1, 2, 4, 14) y una cita (paso 13, línea 2589-2590). El resto se contrastó contra las líneas citadas.

### Qué hiciste
- Escribí un manual corto para la cajera basado en los textos proporcionados.
- Cité las líneas correspondientes del archivo `pos-filas.md`.

### Qué NO comprobé
- No revisé el código completo ni los archivos de `docs/operacion`.
- No verifiqué la lógica de los pasos en el sistema.