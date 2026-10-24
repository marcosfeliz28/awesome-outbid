# Cobro del producto por transferencia — fase 1

Este flujo pertenece **únicamente a la base independiente de Nexora como producto**. No se conecta con `Payment` de ventas, ni con la base o Render de la tienda. Los precios mensuales de la propuesta siguen sujetos a aprobación de la dueña. No se cobran tarjetas.

## Recorrido

1. La empresa dueña abre **Plan y facturación**, elige plan y crea una solicitud. El servidor fija el precio; no acepta un importe enviado por el navegador.
2. Los datos bancarios aparecen **sólo** si Nexora configura `NEXORA_BILLING_BANK_NAME`, `NEXORA_BILLING_BANK_ACCOUNT` y `NEXORA_BILLING_BANK_HOLDER`. No hay cuenta incrustada en el código.
3. La empresa adjunta JPG, PNG o WebP de hasta 2 MB. La lista sólo entrega `hasProof`, nunca base64. El archivo se lee por una ruta autenticada y aislada por empresa.
4. Un operador de la **plataforma Nexora**, no el administrador `*` de una empresa, revisa el pago contra el banco. El operador usa el CLI separado con un login PostgreSQL operacional miembro del rol `nexora_platform_billing`. Ese rol sólo puede leer solicitudes y contadores de cupos, escribir la decisión y cambiar plan/fecha/estado; no puede leer hashes de contraseñas ni clientes. No hay aprobación desde el navegador de la empresa.
5. Para aprobar, el operador aporta el SHA-256 del comprobante inspeccionado, la fecha pagada y el motivo. Si la imagen cambió, la transacción aborta. Si el nuevo plan no admite los usuarios, equipos aprobados o sucursales ya activos, también aborta. Una aprobación repetida con los mismos datos devuelve el resultado previo; una decisión distinta es rechazada.
6. La decisión queda en `BillingRequest` y en `BillingDecision` (una fila inmutable por solicitud). La aprobación mueve el Tenant a `active`; el ciclo de vida posterior usa `paidThroughAt`. Un rechazo no activa el plan.

## Operación separada

Un administrador de la infraestructura crea **fuera del repositorio** un login PostgreSQL dedicado con contraseña fuerte, permiso `CONNECT` a la base *del producto* y membresía en `nexora_platform_billing`. La aplicación de cada empresa **no** recibe esa conexión ni ese rol. El operador configura `PLATFORM_BILLING_DATABASE_URL`, `PRODUCT_TENANCY=required` y `NEXORA_BILLING_OPERATOR_ID` en su entorno operacional (no en el navegador ni en el repo). La revisión se ejecuta con `pnpm --filter @fitstore/api exec tsx scripts/review-product-billing.ts <id> approved <fecha-ISO> <motivo> <sha256>`; para rechazar se usa `rejected`, un marcador en el argumento de fecha y un motivo. Nunca ejecutar el CLI sin cotejar el movimiento en el banco: una foto por sí sola no acredita pago.

El proveedor `test` sólo puede aparecer con `BILLING_TEST_MODE=enabled` y `NODE_ENV` distinto de `production`; sus solicitudes pasan igualmente por el CLI. No envía dinero ni toca pasarelas reales.

Pendiente deliberado: interfaz propia para operadores de Nexora, autenticación de plataforma con SSO/2FA, conciliación bancaria automática, y validación final de precios, términos fiscales y cuentas por la dueña. La pantalla `TransferReconciliation.tsx` es de pagos **entre clientes de una tienda** y su administrador tenant: reutilizar sus permisos para la plataforma sería una escalada entre empresas. Aquí se reusa el patrón de evidencia separada y revisión atómica, no esa autorización.
