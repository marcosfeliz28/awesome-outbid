# Caja · concepto Higgsfield 01 · implementación inicial para revisión

Referencia: PNG nítido revisado de Caja; Library `libfile_fde3_f-84d6325a9b8881919cb389ee4c9d4ec7_00021c7591648191a2873caeaff1ea36`, SHA256 `9555ca20584c15ec1fd61d461c3d348b19fcaf4952ea9bca8220539698b89dbc`.
Estado: imagen conceptual pendiente de aprobación de Marcos. Esta rama prepara una vista funcional para revisar, no significa aprobación ni despliegue.

## Cambios reales
Pintura CSS aislada de POS y shell mientras Caja está montada. Superficies negras/verdes con borde oro, relieve, catálogo con fotos reales existentes sin saturación artificial, tarjeta de venta actual, controles elevados, resumen legible, CTA Cobrar. En claro se prioriza contraste, azul y Negro como preferencias. Hover y pulsación ligeros; foco visible, reduced-motion y forced-colors.

Se conserva el POS original. `PRESENTACION_REVERSIBLE.json` registra cada cambio de presentación; prueba revierte importaciones, clase, preferencias y etiquetas, y exige SHA256 exacto del archivo original. No se modifican cálculos, queries, pagos, carrito, cantidades, stock, persistencia, teclado, permisos, API ni BD.

Idioma: etiquetas principales de Caja en ES/EN. Datos de productos, avisos y modales de pago conservan su idioma original; no se anuncia traducción completa. Cambiar apariencia no recarga ni limpia carrito.

## Diferencias deliberadas del PNG
No reemplazar fotos reales por frascos genéricos de la maqueta. No sustituir stock por «Disponible», ni inventar caja abierta, importes o ITBIS. Se mantienen controles mayorista, estados, lector y seguridad originales. La app conserva fuente operativa y datos reales; no se rasteriza la pantalla. No se afirma equivalencia visual100% sin comparar capturas reales.

## Pruebas locales
Typecheck web, ESLint y build web pasan. 30/30 pruebas pasan: presentación reversible3, Inicio11, estiloPOS2, política borrador7, carrera borrador3, refresco trasventa4.
Harness nuevo con API únicamente DEMO, escrituras desconocidas405 y recursos externos bloqueados: `pnpm exec playwright test -c playwright.visual-caja.config.ts`. Siete casos preparados:1440/390 claro/oscuro, monto/cantidad/descuento/ITBIS, agotado, F2/F4/F12 sin confirmar pago y movimiento reducido. Cloud Chromium no puede iniciar por `socket EPERM`; ejecución real de esos casos y capturas se hará en copia PC antes de aprobar apariencia.

Sin producción, despliegue, datos de clientes, dinero ni cambios de seguridad.

Check global cloud: 16 suites PostgreSQL siguen bloqueadas por falta de libicuuc.so.60. Se reparó una cita documental del título traducido (el fragmento de evidencia pasó de texto literal a t(...)); pruebas de citas pasan sin relajar sus assertions. Los demás cambios de docs/sistema son reanclajes automáticos a las nuevas líneas del mismo código.
