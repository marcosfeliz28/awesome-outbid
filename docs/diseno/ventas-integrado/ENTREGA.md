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

## Integración aislada 18-nov
- Base actual: `92d131f8847c1bd338b48c34231bf3c6ae82cb5b`; rama `dot/ventas-integrada-18nov`. Los cuatro commits visuales anteriores se aplicaron sin conflictos, incluido el encabezado visible requerido por las pruebas existentes.
- No cambian POS, Inicio/App, API, archivos públicos/fotos ni configuración Render. Caja/turnos sigue fuera de esta rama.
- Se corrigió una cita documental ambigua (`<button`) hacia el guard real de anulación; el reanclador actualizó las demás referencias de línea. No se modificaron pruebas existentes.
- Web typecheck, ESLint completo, build Vite y 14 contratos focales: PASS.
- Suite local: 1041 pruebas pasan; 12 fallan, 48 omitidas. Los 16 archivos fallidos son de PostgreSQL: `initdb` no inicia por ausencia de `libicuuc.so.60` (exit127). No es CI verde ni verificación API completa.
- `pnpm check` además encontró `ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH` por node_modules compartido mediante symlink. Los controles indicados arriba se ejecutaron directamente con Node; no se desactivaron pruebas ni controles.
- Capturas 1440/390 claro/oscuro y E2E quedan pendientes en ejecutor con navegador operativo. La referencia PNG aprobada sí fue inspeccionada, pero no se afirma equivalencia visual real todavía.
- Sin push, merge ni despliegue. El build produjo advertencia habitual de chunks mayores a500kB.
