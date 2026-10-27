# Auditoría de Fase 3 — registro, planes y respaldo

Fecha: 27-oct-2026  
Base: `producto-nexora` `c6148bac`  
Modalidad: solo lectura; sin Render, producción, credenciales ni datos de la tienda.

## Veredicto

La base técnica de la Fase 3 está implementada y probada, pero **no está lista para abrir el registro público**. No encontré fuga entre empresas en las pruebas ejecutadas. La salida comercial sigue bloqueada por el cobro real, los legales, la infraestructura separada, el piloto y la corrección/decisión sobre anulación de pagos.

## Estado comprobado

| Capacidad | Estado real | Evidencia |
|---|---|---|
| Registro por empresa | Hecho, cerrado por bandera | `apps/api/src/registration.ts:130-168`; `apps/web/src/App.tsx:304-315` |
| Confirmación de correo | Hecha | `apps/api/src/registration.ts:161-178` |
| Prueba de 14 días | Hecha | creación de empresa en `apps/api/src/registration.ts`; prueba `tests/product-registration-postgres.test.ts` |
| Planes y límites | Hechos | `apps/api/src/billing-plans.ts`; pruebas `product-billing-plans`, `product-platform-ai-packs-postgres` y `product-pilot-three-tenants-postgres` |
| Gracia y solo lectura | Hechos | `apps/api/src/tenant-lifecycle.ts:18-38`; `apps/api/src/common.ts:834-847` |
| Cobro manual/de prueba | Hecho | `apps/api/src/platform-billing.ts`; `tests/product-platform-billing-postgres.test.ts` |
| Cobro real | No hecho | no hay integración autorizada con procesador; por diseño de la fase anterior |
| Exportación por empresa | Hecha | `tests/product-tenant-export-postgres.test.ts` |
| Respaldo/restauración por empresa | Hechos y probados en base desechable | `tests/product-tenant-backup-postgres.test.ts` y `tests/product-tenant-backup-file.test.ts` |
| Separación multiempresa | Probada | matrices de rutas y piloto de tres empresas |
| Infraestructura pública independiente | No creada/autorizada | depende de Claude/Render y de la dueña; fuera de esta rama |

## Hallazgos y bloqueos

### F3-01 — Alto — anulación de cobros no restaura todo el ciclo de vida

`apps/api/src/platform-billing.ts:53-65` recompone únicamente una fecha. `apps/api/src/platform-billing.ts:140-167` actualiza `paidThroughAt`, pero no restaura atómicamente `status`, `trialEndsAt`, `pastDueAt` o `suspendedAt`, y permite afectar una cadena con pagos posteriores.

**Reproducción:** registrar dos pagos y anular el primero; o activar una empresa en prueba con un pago y anularlo. Comparar fechas y estado antes/después.

**Arreglo:** la rama `claude-pc/pc23-anulacion-fix` (`163a245b`) está verde. Requiere la decisión de la dueña antes de mezclar porque cambia reglas de cobro.

### F3-02 — Medio — acceso de operadora con secreto compartido

`apps/api/src/platform.ts:15-23` separa una etiqueta de operadora de la credencial real. `apps/api/src/platform.ts:48-68` usa un token global, con soporte para rotación, pero sin identidad revocable por persona.

**Reproducción:** dos personas usan el mismo token con etiquetas diferentes. Revocar a una obliga a rotar la credencial de todas.

**Arreglo:** cuentas individuales con MFA y bitácora ligada a identidad antes de ampliar el equipo de operación.

### F3-03 — Bloqueo comercial — no hay procesador real ni piloto

El cobro actual registra transferencias/manuales y sirve para probar el ciclo de vida; no cobra tarjeta ni confirma dinero con un procesador. Esto es correcto para la fase construida, pero no cumple la puerta “una empresa paga”.

**Arreglo:** la dueña elige y contrata procesador; se construye su adaptador en una rama separada con webhooks idempotentes, firmas verificadas y pruebas sin secretos reales.

### F3-04 — Bloqueo de salida — registro público deliberadamente cerrado

`apps/api/src/registration.ts:130-140` exige modo producto, bandera explícita, versiones legales y correo válido. La web aplica la misma puerta. No es un defecto: evita altas antes de que existan legales, cobro, infraestructura y soporte listos.

**Arreglo:** conservar cerrado hasta completar la lista de salida; nunca activar la bandera como sustituto de esas tareas.

## Pruebas observadas

- Registro y confirmación: 2/2.
- Piloto de tres empresas, sin cruce y con suspensión: 1/1.
- Ciclo de vida: 1/1.
- Exportación: 2/2.
- Respaldo/restauración de una empresa en base desechable: 1/1.
- Rutas de catálogo, inventario, dinero, administración, autenticación, exportaciones y NCF entre empresas: verdes.
- Base `c6148bac`: `verify`, `windows-installer` y `render-images` verdes en GitHub.

En la repetición local de `pnpm check`, 998 pruebas pasaron y una prueba de inicio sencillo agotó 180 segundos bajo carga; repetida sola pasó en 9,7 segundos. Está registrada como AT-11 en la auditoría total y no se ocultó ni se relajó.

## Puerta para abrir al público

- [ ] Decisión e integración de PC-23.
- [ ] Legales revisados por abogado y versiones definitivas.
- [ ] Procesador real contratado e integración probada.
- [ ] Infraestructura separada autorizada y creada por quien despliega.
- [ ] Restauración operativa ensayada desde el respaldo del producto.
- [ ] Al menos una empresa piloto completa registro, primera venta, pago y exportación.
- [ ] Auditoría final sin críticos ni altos y tres CI verdes en el commit candidato.

## Lo que necesita de la dueña

1. Decidir las reglas PC-23.
2. Elegir/contratar el procesador y facilitar un entorno de pruebas por el canal de secretos, nunca por chat.
3. Obtener revisión legal.
4. Autorizar el costo de la infraestructura independiente y elegir empresas piloto.

No se cambió código porque la responsabilidad de ChatGPT nube en esta fase es auditar. La exigencia de prueba roja/verde aplica a las correcciones que salgan de estos hallazgos; F3-01 ya tiene una rama con regresión y tres CI verdes, pendiente de decisión.
