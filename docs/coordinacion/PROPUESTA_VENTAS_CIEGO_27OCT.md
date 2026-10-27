# B-01 · Propuesta sin aplicar para «Ventas» y arqueo ciego

**Estado:** preparada para revisión; no integrar ni desplegar hasta decisión de la dueña.  
**Rama aislada:** `chatgpt-nube/ventas-ciego`.

## Problema

Una cajera con su caja abierta puede entrar en **Ventas** y ver el total y la forma de pago. Esa información permite reconstruir parte de lo esperado antes del cierre y contradice el arqueo ciego aplicado en Caja y en «Mis ventas».

## Comportamiento preparado

- Cajera con caja propia abierta: `GET /api/sales` no entrega subtotal, descuento, impuestos, total, saldo, pagos, método ni importes de línea/devolución. La web sustituye esos espacios por **Importe oculto** y **Forma de pago oculta**.
- Mientras la consulta de sesiones todavía carga o falla, la vista se cierra por defecto para evitar una revelación momentánea.
- Cajera después de cerrar su caja: vuelve a ver los datos de sus ventas.
- Gerencia (`sale:manage`) y quien tiene `profit:read`: conserva los importes.
- PDF, cálculos, permisos, abonos, devoluciones y correcciones no cambian.

La protección principal está en la API: el navegador no recibe los datos durante la caja abierta. La web aplica además una presentación cerrada por defecto mientras confirma el estado de caja. No se usa desenfoque CSS.

## Correspondencia con el servidor

La decisión replica la frontera vigente de `canViewCashExpected`:

```text
profit:read O sale:manage
```

No se reutiliza `sale:write` como permiso de importes: ese permiso permite vender y entrar a la vista, pero no autoriza romper el arqueo ciego.

## Archivos

- `apps/web/src/salesAmountPrivacy.ts`
- `apps/web/src/Management.tsx`
- `apps/api/src/sales.ts`
- `tests/management-messages.test.ts`
- `tests/claude-round2.test.ts`
- `tests/caja-ciega-margen-api.test.ts`

## Validación

- Integración contra PostgreSQL y API locales desechables: 10/10 pruebas de `caja-ciega-margen-api.test.ts`, incluido ocultar con caja abierta y restaurar después del cierre.
- Web y DTO: 31/31 pruebas focales.
- ESLint de los archivos modificados, `pnpm typecheck` y compilación web: correctos.

## Decisión pendiente

La dueña debe confirmar si esta regla se integra. Hasta ese «sí», la rama se conserva separada de `chatgpt-nube/lumina-adentro-b`, `nexora-cloud` y producción.
