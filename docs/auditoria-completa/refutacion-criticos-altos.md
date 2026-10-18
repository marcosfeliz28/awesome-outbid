# Revisión adversaria independiente — hallazgos altos

Fecha: 2026-10-18  
Base del código: `origin/nexora-cloud` `cf6f7022ab9682db45327558e5dd18946a7b1473`  
Alcance: refutación de I-01 (inventario) y Q-01 (aislamiento de pruebas). Solo se usaron datos sintéticos. No se contactó ningún host externo ni se leyó `.env`.

## I-01 — categoría exige vencimiento pero permite existencia y venta sin lote

**Resultado adversario: no refutado; el camino de código queda corroborado, pero la reproducción completa contra PostgreSQL quedó bloqueada por el PostgreSQL embebido de Windows.** Mantener el hallazgo como alto/SIN REPRODUCIR hasta validar en un PostgreSQL local que incluya la zona horaria requerida.

### Comprobación independiente

- `apps/api/src/catalog.ts:234-249` acepta `requiresExpiry: true` junto con `requiresLot: false` sin normalizar ni rechazar esa combinación.
- `apps/api/src/inventory.ts:1491-1537` crea un conteo sin comprobar la política de lotes al capturar la fila. En `:1590-1624`, la aplicación valida `requiresLot` solamente; para `requiresLot: false`, permite que el delta incremente `Variant.stock` y registra `InventoryMovement` sin `lotId`.
- `apps/api/src/inventory.ts:532-560` solo entra al consumo FEFO si `requiresLot` es verdadero o si hay lotes. Con `requiresLot: false` y `lots: []`, el flujo crea `pieces = [{ qty }]`; no verifica `requiresExpiry` ni exige fecha.
- La lógica de la función real `takeStock`, compilada desde el código de la rama, se ejecutó con una transacción doble controlada y variante sintética (`requiresExpiry=true`, `requiresLot=false`, stock 3, sin lotes). Salida:

```json
{"parts":[{"qty":1}],"movement":{"variantId":"qa-variant","type":"sale","qty":-1,"balanceAfter":2,"refId":"qa-sale","reason":"Venta FEFO","userId":"qa-user","branchId":"qa-branch","warehouseId":"qa-store"},"remainingStock":2}
```

Esto demuestra que la función de consumo acepta una unidad sin asignación de lote; no es una reproducción end-to-end ni una afirmación sobre persistencia.

### Intento con PostgreSQL descartable

Se instaló desde el lockfile, se generó Prisma y se compiló la API. Se intentó ejecutar el flujo completo con base nueva `nexora_i01_qa` en PostgreSQL embebido, con puerto libre elegido por el harness, migraciones aplicadas y solo categoría/producto/variante de QA. El intento no alcanzó el conteo: al crear la variante, el trigger de stock falla porque el paquete de PostgreSQL embebido disponible no reconoce `America/Santo_Domingo`. La misma limitación apareció en la prueba PG existente.

Comando de prueba existente:

```text
pnpm exec vitest run tests/warehouses-postgres.test.ts
```

Salida exacta resumida por Vitest:

```text
FAIL tests/warehouses-postgres.test.ts
PrismaClientUnknownRequestError: Invalid `db.variant.create()` invocation
PostgresError { code: "22023", message: "time zone \"America/Santo_Domingo\" not recognized" }
Test Files 1 failed (1)
Tests 4 skipped (4)
```

La prueba limpió su base y directorio temporales. No se usó una URL heredada ni servicios externos. Las pruebas funcionales de control sí pasaron:

```text
pnpm exec vitest run tests/integration-api-check.test.ts tests/inventory-resilience.test.ts
Test Files 2 passed (2)
Tests 12 passed (12)
```

Estas pruebas no cubren la combinación de categoría de I-01.

**Conclusión:** la revisión independiente confirma que los guards mencionados existen tal como los describe I-01 y que `takeStock` permite el fallback sin lote. No puedo certificar el efecto completo categoría → conteo persistido → venta porque la base de prueba falla antes de crear la variante. No se hizo parche.

## Q-01 — `verify.mjs` puede continuar contra API no local

**Resultado adversario: confirmado por recorrido de control y prueba con mocks locales; no se accedió a ninguna API real.**

- `scripts/verify.mjs:203-219`: solo rechaza una API no local dentro del bloque donde la comprobación `/health` no responde. Si `/health` responde, ejecuta `pnpm test:integration` y después E2E sin comprobar `target.local`.
- `tests/setup/integration-api.ts:33-96` comprueba salud, inicia sesión demo y que el SID resultante exista en `DATABASE_URL`; no exige loopback ni que la base tenga nombre/marcador descartable. Ese login ya es una mutación de sesión/intento, antes de cualquier test de escritura.
- `scripts/verify.mjs:157-164` también usa la conectividad del host de `DATABASE_URL` como condición para no arrancar PostgreSQL local; no valida que ese servidor sea descartable.

Prueba segura, sin red: el siguiente mock reemplazó las respuestas de fetch y la consulta de SID. La IP `203.0.113.77` es de documentación; no se intentó conectarse a ella.

```text
node --experimental-strip-types --input-type=module -e <mock de verifyIntegrationApi>
{"acceptedApi":"http://203.0.113.77:9443/api","calls":["http://203.0.113.77:9443/api/health","http://203.0.113.77:9443/api/auth/login"],"sessionWasConfirmed":true,"networkUsed":false}
```

El resultado evidencia que el preflight acepta una API remota cuando los mocks simulan respuestas válidas y una sesión visible en la base indicada; no demuestra contacto ni escritura en un servicio real. `targets()` del verificador, probado sin red, devolvió:

```json
{"api":"http://203.0.113.77:9443/api","health":"http://203.0.113.77:9443/api/health","apiPort":"9443","proxy":"http://203.0.113.77:9443","local":false}
```

La combinación estática y mock sustenta que, si esa API responde y el SID es visible en la base remota, el flujo continúa a integración. No se invocó `pnpm verify`, `pnpm test:integration` ni la etapa de mutación de fixtures.

## Preparación y límites

- `pnpm install --frozen-lockfile` — código 0; pnpm 11.19.0, 925 paquetes.
- `pnpm db:generate` — código 0; Prisma Client 6.19.0. No se consultó una URL de base externa.
- `pnpm --filter @fitstore/api build` — código 0.
- No se ejecutó `pnpm check`, suite de integración ni E2E; para esta refutación basta el caso dirigido y los tests señalados arriba. No se modificó ningún archivo de aplicación, prueba o configuración.
- I-01 requiere repetición PG con timezone instalada para cerrar el estado SIN REPRODUCIR. Q-01 no requiere ni justifica probar contra un sistema externo.

## Nota posterior del auditor principal

En la auditoría principal, después de recibir esta revisión, repetí `pnpm exec vitest run tests/warehouses-postgres.test.ts` en el worktree `nexora-audit-pc` sobre el mismo SHA de aplicación, con `NEXORA_TEST_PG_URL` ausente. Resultado exacto: `Test Files 1 passed (1); Tests 4 passed (4); Duration 8.77s`. La suite del mismo archivo también pasó dentro de `pnpm check` (`4 tests`, 27–34 s según la corrida). Esto contradice el error de zona horaria observado en el worktree del revisor. El flujo completo de I-01 categoría → conteo → venta aún no está cubierto por esos cuatro tests; mantengo I-01 **SIN REPRODUCIR de extremo a extremo** y dejo registrada la inconsistencia ambiental, en vez de atribuirla a la aplicación.
