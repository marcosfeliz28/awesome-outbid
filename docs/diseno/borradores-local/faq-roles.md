Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/ROLES_Y_PERMISOS.md`. Tarea N36. Cada respuesta tiene dos frases y su cita. Los permisos reales en producción pueden diferir de los de fábrica (la propia entrada lo marca como «DUDOSO»).

# Preguntas frecuentes sobre roles

1. **¿Qué puede hacer la dueña (administración)?** Tiene el permiso `*`, que da acceso a todo el menú. Es la única que anula ventas, verifica transferencias y cambia la configuración. (`packages/shared/src/index.ts:759-786`; `apps/api/src/sales.ts:2369-2372`; `apps/api/src/admin.ts:839-940`)
2. **¿Qué puede hacer un gerente?** Ve costos y utilidades, hace devoluciones, aprueba conteos y cobra créditos con tarjeta o transferencia. Su PIN es el «PIN de gerente» que pide la caja. (`apps/web/src/Tienda.tsx:321-328`; `apps/api/src/security.ts:92-136`)
3. **¿Qué no puede hacer un gerente?** No puede anular una venta, verificar transferencias de ventas, registrar abonos, traspasar entre Casa y Tienda, guardar la configuración ni crear usuarios. Eso es solo de administración (`*`). (`apps/api/src/sales.ts:2369-2372`, `:2749-2751`; `apps/api/src/warehouses.ts:112-114`; `apps/api/src/admin.ts:1024-1320`)
4. **¿Qué puede hacer la cajera?** Vende en el Punto de venta, ve Ventas y Productos (solo lectura), abre y cierra su caja y atiende clientes. No ve Reportes, Mercancía ni costos. (`apps/web/src/App.tsx:209-216`; `apps/api/src/merchandise.ts:154-156`; `apps/api/src/common.ts:366-370`)
5. **¿Puede la cajera ver cuánto debería tener la caja?** No, la caja es ciega: declara lo que contó y la comparación aparece después de cerrar. (`apps/api/src/common.ts:70-72`; `apps/web/src/managementMessages.ts:41-44`)
6. **¿Puede la cajera anular una venta?** No la anula; pide la anulación y la administración la aprueba. Nadie aprueba su propia solicitud. (`apps/api/src/sales.ts:1862`, `:2081`, `:2404`)
7. **¿Cuándo necesita la cajera el PIN de un gerente?** Para descuentos sobre el límite, créditos sobre los topes, nota de crédito sin código y salidas de efectivo grandes. También para cerrar con descuadre, usar un vale de caja o trasladar la caja a otro equipo. (`apps/web/src/POS.tsx:1866-1884`; `apps/api/src/cash.ts:975-1013`, `:1076-1090`, `:1139-1165`, `:1248-1300`)
8. **¿Puede un gerente aprobarse a sí mismo con su PIN?** No: el PIN debe ser de otra persona con permiso; solo la dueña puede usar el suyo. (`apps/api/src/security.ts:81-82`, `:99-102`)
9. **¿Qué puede hacer el personal de almacén?** Ve Productos, Inventario, Compras y Mercancía. No vende ni abre caja. (`packages/shared/src/index.ts:759-786`)
10. **¿Qué ve la empleada de GV?** Solo el módulo GV Makeup Studio: cursos, citas, interesadas y reportes. No tiene acceso a configuración, usuarios, costos ni inventario. (`apps/web/src/App.tsx:282`; `apps/web/src/realtime.tsx:147-153`)
11. **¿Qué contraseña usa cada rol?** La cajera usa una contraseña de 6 números y debe cambiarla al entrar. Los demás roles usan una contraseña fuerte de 12 o más caracteres. (`apps/api/src/password-policy.ts:11-13`, `:66-72`)
12. **¿Qué pasa si el equipo es nuevo?** Debe aprobarlo un gerente, con su PIN en el mismo equipo o desde Configuración. Sin eso no se vende ni se mueve mercancía. (`apps/web/src/realtime.tsx:513-516`; `apps/api/src/realtime.ts:257-264`)

## Qué NO comprobé
Las respuestas resumen la entrada; no se contrastaron con el código ni con los permisos reales de producción (la dueña puede editarlos en Configuración › «Usuarios y permisos»).
