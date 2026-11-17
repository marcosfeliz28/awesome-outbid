# Ventas · primer corte visual Higgsfield

Referencia aprobada: norexos-ventas-higgsfield-01.png (Library libfile_fde3_f-b5c0448337148191addeb81f8cd305d6_00021c7591648191a2873caeaff1ea36).
Base: 04e1b13884bac7d96effda7e015195a092a4e05b. Rama: dot/ventas-higgsfield-17nov.

## Implementado
- Superficies esmeralda/doradas con bisel, sombra y relieve CSS. Azul, claro, oscuro y negro mediante preferencias actuales.
- Tres contadores de **resultados cargados**, no totales de período. Evita inventar importes o agregar respuestas paginadas como si fueran todas las ventas.
- Vista previa a la derecha en escritorio; debajo en ancho reducido. Se elige con el número de venta, con estado aria-pressed y teclado nativo. El botón conserva el modal completo existente.
- Recuento, encabezado, tabla y nueva vista previa ES/EN. Modales de operación heredados siguen con su copia existente (traducción completa pendiente).
- Hover con elevación, pulsación y foco visible. Reducción de movimiento respetada.
- Mismos endpoints, búsquedas, permisos, acciones y pagos. Total de vista previa pasa por saleMoney y conserva ocultación de caja ciega. No se altera base, API, producción ni configuración.

## Pendiente / límites
No se afirma fidelidad visual completa. Faltan capturas reales a 1440 y390 en claro/oscuro y cotejo con el PNG aprobado. No se añadió gráfico temporal ni selector de método/período del concepto: la respuesta actual no garantiza el universo completo necesario. La previsualización es un resumen; los artículos y pagos permanecen en el detalle original para conservar todos los controles de autorización. No despliegue.

## Comprobaciones
- tsc --noEmit -p apps/web/tsconfig.json: PASS.
- eslint apps/web/src/SalesFusion.tsx apps/web/src/Management.tsx: PASS.
- node docs/diseno/ventas-integrado/verificar-ventas.mjs: PASS,12 contratos de presentación/seguridad/accesibilidad. Son contratos estáticos, no pruebas de navegador.
- Build Vite: PASS (7.46s, advertencia habitual de bundle mayor de500KB). Los tres controles completos de CI no se ejecutaron en este corte.
