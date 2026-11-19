# Operaciones · primer corte high 4K

Áreas: Mercancía, Solicitudes de anulación, Conciliación, Mensajero, Compras, Gastos y Clientes.

Referencia: propuestas high 4K de 18-nov (3840×2160), aprobadas para implementación. No son capturas de una app ni una autorización para cambiar reglas de negocio.

## Contrato

Se conservan las rutas, permisos, handlers, cifras, confirmaciones, formulario y flujo operativo existentes. Las pruebas reversibles retiran exclusivamente presentación/traducción y contrastan hashes originales. No se añaden datos de demostración a la aplicación.

No se copian los defectos de las láminas: fecha 3026, cargo bancario inventado, estados de borrador/cola simultáneos, tabla de Gastos desalineada, campo Estado nuevo para Clientes ni obligatoriedad nueva de identificación. El pago a proveedor conserva su alcance de proveedor, no se convierte en un pago específico de una orden por una imagen.

## Acabado

Materiales verde/oro y azul, superficies claras/oscuras/negras, emblemas vectoriales, controles con relieve, hover y pulsación. Respeta movimiento reducido, foco visible y controles táctiles. Los nombres, datos comerciales y mensajes de negocio no se traducen automáticamente.

## Verificación pendiente

Revisión visual exacta 1440/390 con datos sintéticos, largo de importes, tablas/acciones, apertura y cancelación de diálogos, permisos de caja no administrativa. La batería visual nueva bloquea escrituras y fuentes externas; no certifica permisos backend, PWA, impresión o funcionamiento en producción.

Es un primer corte de integración, no certificado como coincidencia absoluta de píxeles. Se preserva la arquitectura de listas y formularios funcionales allí donde la propuesta dibujó operaciones inexistentes. No usar la aprobación estética para saltar QA o preflight de publicación.

## Idioma de este corte

ES/EN implementado para controles principales de las siete vistas, fechas de revisión y formularios locales de Compras/Gastos/Clientes. Subformularios existentes de compras/recepción, privacidad de clientes, editor de tarifa, cámara/importación/alta rápida y algunos resúmenes dinámicos de Mercancía conservan español. Los errores y confirmaciones de negocio originales no se reescriben. No afirmar traducción integral.

## Composición y evidencia

La capa compartida se incorporó exactamente desde `4aee37f02`: restaura preferencias al navegar directo y adapta logo/navegación mientras una vista premium está montada. Los wrappers no almacenan datos comerciales. Importes de las tres tablas tienen columna `operations-money`; auxiliares usan `operational-aux-money` para no partir centavos. La prueba de navegador con datos sintéticos queda pendiente de ejecución disponible; las pruebas de fuente no sustituyen capturas.
