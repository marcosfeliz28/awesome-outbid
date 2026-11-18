# Compras, Gastos y Clientes: ES/EN acotado

Base: `f0fc99007`. Rama aislada: `dot/operaciones-es-en-18nov`.

Cambios sólo en las tres funciones de Management y un import de diccionario local. Encabezados, tablas, filtros, botones, campos de FormModal y ConfirmModal usan el idioma existente. Fechas pasan locale a la firma real `dateLabel(value, locale)`; se conserva America/Santo_Domingo. Los datos de proveedores, clientes, categorías y mensajes de negocio no se traducen. No cambia API, payloads, query keys, permisos, idempotencia, cálculos ni comportamiento de privacidad.

Se añade `operations-money` sólo a Total de Compras, Monto de Gastos y Total gastado de Clientes; el integrador aporta el CSS. Los renders formatMoney no cambian.

Se amplían las secuencias reversibles de Operaciones, Productos y Caja con import y funciones completas antes/después. Sus hashes base originales no cambian. La prueba compara llamadas API, payloads, guards y cálculos con TypeScript AST y exige reversión completa de Management.

Validación: 27/27 pruebas focales; eslint y tsc web pasan. Regresión de idioma antes: 2/6 fallan, después: 6/6 pasan. No se ejecutó QA visual ni backend; no despliegue, no push.

No es traducción integral: PurchaseEditor, ReceiptEditor y ReceiptHistory conservan español, al igual que CustomerPrivacyNotice (aviso jurídico) y mensajes de negocio/toasts preservados. Los datos dinámicos no se traducen ni se inventan.
