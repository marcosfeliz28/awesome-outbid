# B-01 · Propuesta sin aplicar para «Ventas» y arqueo ciego

**Estado:** preparada para revisión; no integrar ni desplegar hasta decisión de la dueña.
**Rama aislada:** `chatgpt-nube/ventas-ciego`.

## Problema

Una cajera con su caja abierta puede entrar en **Ventas** y ver el total y la forma de pago. Esa información permite reconstruir parte de lo esperado antes del cierre y contradice el arqueo ciego aplicado en Caja y en «Mis ventas».

## Comportamiento preparado

- Cajera con caja propia abierta: `GET /api/sales` no entrega subtotal, descuento, impuestos, total, saldo, pagos, método ni artículos/cantidades. Ocultar también el detalle cuantitativo impide reconstruir el importe consultando los precios del catálogo.
- El PDF del recibo responde 403 mientras esa caja siga abierta. Al cerrar, vuelve a estar disponible sin alterar el comprobante.
- Crear, consultar y cancelar solicitudes de anulación devuelve una venta redactada sin total, artículos ni pagos durante la caja abierta.
- La web sustituye esos espacios por **Importe oculto**, **Forma de pago oculta** y avisos explícitos para el detalle y las anulaciones.
- En filas redactadas, la descarga muestra **Disponible al cerrar** y queda deshabilitada, sin hacer una petición que terminaría en 403.
- Si una solicitud redactada no puede aprobarse, la cajera recibe un aviso genérico de revisión; no se revela si la venta tiene abonos.
- Mientras la consulta de sesiones todavía carga o falla, la vista se cierra por defecto para evitar una revelación momentánea.
- Cajera después de cerrar su caja: vuelve a ver los datos de sus ventas.
- Gerencia (`sale:manage`) y quien tiene `profit:read`: conserva los importes.
- El contenido del PDF, los cálculos, permisos, abonos, devoluciones y correcciones no cambian.

La protección principal está en la API: el navegador no recibe los datos durante la caja abierta. La web aplica además una presentación cerrada por defecto mientras confirma el estado de caja. No se usa desenfoque CSS.

## Alcance de B-01

B-01 cierra las fugas de la vista **Ventas**, su recibo PDF y las solicitudes de anulación asociadas. No convierte todo Nexora en un arqueo ciego global.

El módulo **Créditos** queda fuera de esta propuesta. En particular, el límite MEDIO preexistente de `/api/cod/pending` debe evaluarse y corregirse como una tarea separada, con sus propios flujos de cobro y conciliación.

## Correspondencia con el servidor

La decisión replica la frontera vigente de `canViewCashExpected`:

```text
profit:read O sale:manage
```

No se reutiliza `sale:write` como permiso de importes: ese permiso permite vender y entrar a la vista, pero no autoriza romper el arqueo ciego.

## Archivos

- `apps/web/src/salesAmountPrivacy.ts`
- `apps/web/src/Management.tsx`
- `apps/web/src/VoidRequests.tsx`
- `apps/api/src/sales.ts`
- `tests/management-messages.test.ts`
- `tests/claude-round2.test.ts`
- `tests/caja-ciega-margen-api.test.ts`

## Validación

- Integración contra PostgreSQL y API locales desechables: 10/10 pruebas de `caja-ciega-margen-api.test.ts`, incluido historial sin detalle reconstruible, PDF bloqueado, anulaciones redactadas y restauración de los tres canales después del cierre.
- Regresión completa de solicitudes de anulación contra una base limpia: 13/13.
- Pruebas unitarias del PDF y promociones: 10/10.
- Web y DTO: 32/32 pruebas focales.
- ESLint de los archivos modificados, `pnpm typecheck` y compilación web: correctos.

## Decisión pendiente

La dueña debe confirmar si esta regla se integra. Hasta ese «sí», la rama se conserva separada de `chatgpt-nube/lumina-adentro-b`, `nexora-cloud` y producción.
