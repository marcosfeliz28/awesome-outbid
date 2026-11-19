# DIS-02 · Confirmar salida de modales con datos

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `packages/ui/src/index.tsx:86-120`: `Modal` llama `onClose` ante X, Escape o clic exterior sin conocer cambios pendientes.
- `apps/web/src/POS.tsx:1842-1900,2528-2535`: `Checkout` mantiene pagos y otros datos localmente dentro del modal.
- `apps/web/src/Tienda.tsx:175-195,314-320`: `CloseCashModal` conserva conteos/notas locales y puede perderlos al cerrar.

## Cambio mínimo

Agregar a `Modal` una guardia opcional de descarte (`shouldConfirmClose` + mensaje accesible). Solo Checkout y cierre de caja la activan cuando existe entrada significativa distinta de su estado inicial. X, Escape y clic exterior pasan por la misma guardia; cancelar la confirmación conserva foco y datos. Después de guardar/finalizar, el cierre programático no pregunta.

Pseudocódigo: `requestClose(reason) -> dirty ? confirmDiscard() : onClose()`; la decisión de `dirty` pertenece a cada pantalla.

## Regresión nueva

Crear `tests/modal-dirty-guard.test.tsx`: modal limpio cierra por X/Escape/exterior; modal sucio pregunta en los tres casos; cancelar conserva campos y foco; confirmar cierra una vez; cierre tras éxito no pregunta. Añadir casos de Checkout con pago parcial y cierre de caja con un conteo o nota. Falla hoy porque todo cierre es inmediato.

Pruebas existentes: `tests/f2-01-primitivos.test.tsx` lee/prueba primitivas UI; `tests/accessibility-contract.test.ts`, `tests/caja-web-ticket.test.ts`, `tests/claude-round2.test.ts`, `tests/management-messages.test.ts` y `tests/compliance.test.ts` leen las pantallas relacionadas.

## Casos límite y marcha atrás

- No considerar sucio abrir/cerrar selectores sin cambiar valor.
- Un pago agregado y luego eliminado deja limpio solo si el estado coincide exactamente con el inicial.
- La confirmación debe admitir teclado, devolver foco y no abrir dos diálogos por eventos simultáneos.
- No usar `beforeunload` ni bloquear navegación global en esta pieza.
- Marcha atrás: retirar props opcionales y guardias de las dos pantallas; `Modal` recupera el contrato anterior.
