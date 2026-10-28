# Procesador de pagos · investigación (Claude PC · 28-oct-2026)

**Estado:** investigación de lectura. No se creó ninguna cuenta, no se llenó ningún formulario, no se usó ninguna llave ni dato de pago. Las cifras de comisiones no se encontraron publicadas: hay que pedirlas a cada proveedor.

## Cuadro comparativo

| Proveedor | Cómo se integra | Disponibilidad para comercios en RD | Comisiones | Qué pide | Lo que no se confirmó |
|---|---|---|---|---|---|
| **Azul** | Página de pago alojada por Azul (la tarjeta se captura en Azul, no en nuestro sitio). Plugins disponibles (Odoo, WooCommerce). | Sí, es un adquirente local muy usado en RD. | No publicadas: van en el contrato del comercio. | Entidad legal en RD (según un conector); Merchant ID, Auth Key y código de moneda; los tokens, reembolsos y anulaciones se habilitan por separado. | Tarifa por transacción y mensual; si aplica el 20 % para MIPYMES certificadas. |
| **CardNet** | Integración con el adquirente; botón de pago de comercio electrónico. | Sí: se describe como el adquirente más grande de RD (informe de 2022). | Personalizadas, según contrato. | Número de comercio, terminal y código de categoría de comercio, a través de su ejecutivo de cuenta; cuenta de comerciante con acceso de prueba y producción. | Tarifa exacta; liquidación del siguiente día hábil aparece en directorios de terceros, no en fuente oficial. |
| **Stripe** | Integración por API y páginas alojadas. | **Verificar.** Hay fuentes que dicen que soporta RD para pagos a receptores (payouts), pero no se confirmó que pueda abrir cuenta de comerciante en RD. | No publicadas en las fuentes consultadas. | Cuenta verificada; según el caso, una entidad fuera de RD (por ejemplo, una empresa de EE. UU.). | Elegibilidad de cuenta de comerciante en RD. Hay que revisar stripe.com/global. |
| **PayPal** | Botón o API. | **No investigado** en esta pasada. | No investigado. | No investigado. | Todo. |

## Recomendación (para decisión de la dueña)
1. **Azul** si el objetivo es cobrar tarjetas locales con un solo contrato en RD. Es la opción con más evidencia de uso local en esta búsqueda.
2. **CardNet** como alternativa o segunda vía, con cotización formal.
3. **Stripe** solo después de confirmar en su página oficial que puede abrir cuenta de comerciante en RD.
4. **PayPal** queda sin evaluar.

## Pasos que requieren a la dueña (Claude PC se detiene aquí)
- Número de tarjeta, contraseñas o claves de API: solo los escribe la dueña; no se guardan en el repositorio.
- Cédula o RNC y documentos adjuntos: solo la dueña.
- Firmas: solo la dueña.
- Aceptar términos o contratos: solo la dueña.

## Fuentes consultadas
- Azul: integración y requisitos según conectores de terceros (Odoo, WooCommerce) y artículos de prensa dominicana.
- CardNet: directorios de comparación y guías de integración de terceros.
- Stripe: guía de apertura de cuenta de terceros y documentación de Mercor y Stripe sobre payouts; sin lista oficial de comerciantes confirmada.
