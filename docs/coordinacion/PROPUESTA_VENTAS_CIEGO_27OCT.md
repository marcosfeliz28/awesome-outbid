# B-01 · Propuesta sin aplicar para «Ventas» y arqueo ciego

**Estado:** preparada para revisión; no integrar ni desplegar hasta decisión de la dueña.  
**Rama aislada:** `chatgpt-nube/ventas-ciego`.

## Problema

Una cajera con su caja abierta puede entrar en **Ventas** y ver el total y la forma de pago. Esa información permite reconstruir parte de lo esperado antes del cierre y contradice el arqueo ciego aplicado en Caja y en «Mis ventas».

## Comportamiento preparado

- Cajera con caja propia abierta: la lista y el detalle sustituyen totales, saldos, importes de línea y descuento por **Importe oculto**. La lista sustituye los métodos por **Forma de pago oculta** y el detalle no monta los datos de cada pago.
- Mientras la consulta de sesiones todavía carga o falla, la vista se cierra por defecto para evitar una revelación momentánea.
- Cajera después de cerrar su caja: vuelve a ver los datos de sus ventas.
- Gerencia (`sale:manage`) y quien tiene `profit:read`: conserva los importes.
- PDF, cálculos, API, permisos, abonos, devoluciones y correcciones no cambian.

Los valores se reemplazan durante el render. No se usa desenfoque CSS, por lo que el importe oculto no queda como texto accesible ni como contenido visual detrás de un filtro.

## Correspondencia con el servidor

La decisión replica la frontera vigente de `canViewCashExpected`:

```text
profit:read O sale:manage
```

No se reutiliza `sale:write` como permiso de importes: ese permiso permite vender y entrar a la vista, pero no autoriza romper el arqueo ciego.

## Archivos

- `apps/web/src/salesAmountPrivacy.ts`
- `apps/web/src/Management.tsx`
- `tests/management-messages.test.ts`

## Decisión pendiente

La dueña debe confirmar si esta regla se integra. Hasta ese «sí», la rama se conserva separada de `chatgpt-nube/lumina-adentro-b`, `nexora-cloud` y producción.
