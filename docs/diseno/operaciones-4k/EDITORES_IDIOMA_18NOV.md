# Editores de compra/recepción y aviso de clientes ES/EN

Base: `0b0d9dcf7ca5e0c240c5481e3f4086ace29be378`.

- `PurchaseEditor` y `ReceiptEditor` leen el selector global de idioma. Se traducen títulos, etiquetas, ayudas, opciones visibles, botón de guardar, quitar línea y confirmación local de creación.
- Valores guardados de daño, enums de pago, identificadores de campos, solicitudes, idempotencia, conversión de vencimiento UTC-04, validaciones y handlers conservados. Las etiquetas de opciones no reemplazan los valores que recibe la API.
- `CustomerPrivacyNotice` se extrae a archivo propio y mantiene el export desde helpers para no modificar consumidores. Conserva finalidad, opcionalidad y derechos; el enlace a la política existente permanece intacto y se rotula `Privacy (Spanish)` en inglés.
- No se editan DocumentFields, ReceiptHistory, ReceiptDetail, API ni permisos.

## Verificación

- `vitest run --config vitest.purchase-editors-language.config.ts`: 36/36, 5 archivos. Se incluyen AST de llamadas/handlers, preservación y regresiones de Caja/Productos/Operaciones.
- Regresión contra Purchases.tsx de la base: 3/6 nuevas pruebas fallan; restaurado el archivo final: 36/36 pasan.
- ESLint focal, typecheck web y `git diff --check` pasan.
- No ejecutado: navegador, CI remoto, aggregate pnpm check, backend real. No push ni despliegue.

## Límites

Los mensajes seguros de negocio/servidor conservan su texto original. La política de privacidad enlazada no se traduce ni se altera. Validaciones nativas del navegador dependen de su idioma. Esta entrega no certifica traducción integral de todos los módulos.
