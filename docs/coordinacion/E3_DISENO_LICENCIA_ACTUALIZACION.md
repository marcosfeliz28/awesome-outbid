# E3 · Licencia y actualización: diagnóstico (Norexos PC, orden 47)

Base: `origin/producto-nexora` (ef063f6a). No se toca `producto-nexora` ni `nexora-cloud`.

## Licencia
- Ya existe: `apps/api/src/local-license.ts` (licencia firmada, atada a empresa y equipo, modo `write` / `read-only`, historial offline de 90 días, tolerancia de reloj de 5 min). Pruebas: `tests/product-local-license.test.ts`, `tests/licencias.test.ts`.
- Falta (orden 47): interruptor `modo` con dos valores, «suscripción mensual» o «licencia por PC», y periodo de gracia sin internet explícito.
- Riesgo: el formato firmado (`licensePayload`) ya lo usan licencias existentes. Añadir `modo` cambia lo firmado. Solución propuesta: campo nuevo opcional con versión 3 del payload, sin tocar la validación de la versión 2.
- Sin cobro ni pasarela. Sin claves reales en el código: la clave pública sigue en su archivo de configuración.

## Actualización
- Ya existe en el instalador: `installer/FitStore.nsi` tiene modo de actualización (`UpdateMode`), preparación (`UpdatePrepared`) y rollback (`TryRollbackUpdate`). `instalador/README.md` describe staging con manifiesto y rollback desde `.onInstFailed`.
- Falta: prueba de que los datos y la configuración se conservan al instalar encima y de que el respaldo local se crea antes. Solo se puede correr en una PC Windows limpia (no en esta laptop, que tiene PostgreSQL real).

## Próximo paso
1. Licencia: prueba roja para `modo` y periodo de gracia, luego el cambio en versión 3 del payload.
2. Actualización: escribir la prueba de PowerShell de «instalar encima» y dejarla lista para correr en PC limpia.
