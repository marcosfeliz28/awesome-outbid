# Cobertura de pruebas — API y shared (D15)

Alcance: `apps/api/src` (55 módulos) y `packages/shared/src`.
Método: cruce de los imports en `tests/*.test.ts` contra cada módulo fuente.
Fecha: 2026-10-27. Solo lectura; no se edita código.

## Resumen

La cobertura es alta y en gran parte por **integración HTTP** (suites
`*-postgres.test.ts` que ejercitan rutas completas) y por **escaneo de fuente**
(pruebas que leen el archivo como texto para verificar invariantes), no solo por
pruebas unitarias directas. `packages/shared/src/index.ts` está cubierto por
`business.test.ts` (más de 600 líneas). Los huecos reales son módulos de
infraestructura y de los constructores de reportes.

## Módulos sin prueba unitaria directa (candidatos a cubrir)

| Módulo | Estado observado |
|---|---|
| `courier.ts` | Sin import directo en `tests/`; la lógica de envío se prueba solo vía rutas |
| `session-activity.ts` | Sin import directo; se alude en un comentario de `auth-guard.test.ts` |
| `offline-sale-review.ts` | Sin import directo; la revisión de ventas offline se cubre por rutas |
| `income-report.ts` | Sin import directo; cubierto parcialmente por rutas de reportes |
| `gv-citas.ts` | Sin import directo (solo `gv-money.ts` tiene `gv-unit.test.ts`) |
| `reportes/base.ts` | Sin import directo |
| `reportes/dinero.ts` | Sin import directo |
| `reportes/inventario.ts` | Sin import directo |
| `reportes/margen.ts` | Sin import directo |
| `reportes/ventas.ts` | Sin import directo |
| `xlsx-guard.ts` | Sin import directo (el guard se ejercita indirecto en `xlsx-bomb.test.ts`) |
| `gv.ts` (controlador) | Sin import directo; cubierto por integración |

## Las 20 pruebas más valiosas por escribir

1. **`courier` · tarifa de envío** — `courierCharge`/validación: una tarifa
   `> 0` y `≤ 5000` es válida; `0` o negativa se rechaza; nombre requerido.
2. **`session-activity` · inactividad** — el cálculo de inactividad respeta el
   margen de 1 minuto al comparar (`auth-guard.test.ts` ya lo asume).
3. **`offline-sale-review` · aprobación** — aprobar registra `approvedBy`;
   rechazar no lo hace; una venta ya revisada no se puede revisar dos veces.
4. **`offline-sale-review` · sin conexión** — un reintento con el mismo
   `offlineUuid` no duplica la venta.
5. **`income-report` · solo abonos verificados** — `income` por día descarta
   pagos `pending_verification` y suma solo `status='ok'`.
6. **`gv-citas` · transición de cita** — `pendiente → pagada` y `pendiente →
   cancelada`; una cita pagada no se puede volver a pagar.
7. **`reportes/base` · período** — normaliza `from`/`to`; rechaza `from > to` y
   fechas fuera del rango permitido.
8. **`reportes/dinero` · agregación** — suma por método de pago y por caja,
   con `cash`/`card`/`transfer`/`receivable` en el orden de la tienda.
9. **`reportes/margen` · fórmula** — margen = `(precio − costo)/precio` sin
   restar ITBIS (coincide con `margin()` de `packages/shared`).
10. **`reportes/inventario` · valoración** — valor de inventario = Σ costo ×
    existencia, con lotes y combos.
11. **`reportes/ventas` · descuentos** — el reporte resta descuento global y por
    línea y cuadra `subtotal − descuento = total`.
12. **`xlsx-guard` · zip-bomb** — un XLSX con celda comprimida enorme se
    rechaza antes de leer; una celda con `=` (fórmula) se neutraliza.
13. **`merchandise` · plantilla** — `readInvoiceTable` mapea columnas de la
    plantilla (ya parcial en `merchandise-template.test.ts`): añadir columnas
    faltantes/desordenadas.
14. **`database-pool` · reintentos** — un fallo transitorio de conexión se
    reintenta con backoff; N reintentos agotan y propagan el error.
15. **`credit-reminder` · programación** — el recordatorio se dispara por
    vencimiento y respeta `dueDate` en `America/Santo_Domingo`.
16. **`notifications` · render** — `renderEvent`/`renderSale` escapan HTML y
    truncan texto largo sin romper el aviso.
17. **`incentives` · mes** — `businessMonth` en el límite del huso (una venta
    de medianoche cae en el día/mes correcto).
18. **`receipt-pdf` · leyenda no fiscal** — `NON_FISCAL_LEGEND` y la política
    de devolución no prometen garantías fuera de plazo.
19. **`catalog` · unicidad de código** — dos variantes con el mismo `code` en
    la misma sucursal se rechazan al guardar.
20. **`security` · secretos débiles** — `validateSecret` rechaza valores
    triviales (`changeme`, `qwerty`, `fitstore`) y acepta uno robusto.

## Notas

- `sales.ts`, `cash.ts`, `auth.ts`, `admin.ts`, `inventory.ts`, `invoice.ts`,
  `receipt-pdf.ts`, `notifications.ts`, `rate-limit.ts` y `retention.ts` están
  bien cubiertos (unitarios + integración).
- `main.ts`, `common.ts`, `sales.ts`, `auth.ts` además son verificados por
  pruebas de escaneo de fuente (invariantes textuales).
- Las suites `*-postgres.test.ts` requieren PostgreSQL local; las unitarias
  (módulos puros) pueden correr sin base.
