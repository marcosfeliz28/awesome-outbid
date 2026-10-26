# T5 · Pruebas adversarias nuevas para GV

Fecha: 2026-10-26  
Código GV validado: `origin/claude/modulo-gv` en `a97f8fa73f096be98c31bdd63dc1d9d697eaa157`  
Archivo nuevo: `tests/adversarial/gv-adversarial-t5-postgres.test.ts`
Archivos existentes modificados: ninguno.

**URGENTE · La suite independiente de la adenda reproduce seis fallos actuales (35/41 aprobadas). El 13/13 de la primera suite no cierra GV.**

## Cobertura

La suite añade 13 pruebas de API y PostgreSQL para:

1. rechazar sobrepagos y evitar pendiente negativo;
2. convertir dos clics concurrentes con el mismo `operationId` en un solo pago;
3. impedir que quien registra una transferencia la auto-verifique;
4. repetir la misma importación sin duplicar cursos, inscripciones ni pagos;
5. impedir que una clave de pago se reutilice para moverlo a otra inscripción;
6. rechazar pagos importados sin clave estable;
7. negar al rol `gv` costos, configuración, usuarios, roles y datos Macgen;
8. impedir pagos nuevos en inscripciones canceladas;
9. impedir pagos nuevos en inscripciones reembolsadas;
10. impedir pagos nuevos en citas canceladas;
11. impedir pagos nuevos en citas reembolsadas;
12. rechazar fechas imposibles en cursos, pagos y citas;
13. rechazar importes con tres decimales en todos los puntos de entrada.

La suite usa identificadores únicos y desactiva al usuario temporal al terminar. No incluye datos del negocio ni secretos nuevos.

## Resultado ejecutado

En un worktree de `a97f8fa`:

- 56 migraciones aplicadas en PostgreSQL desechable;
- base de prueba sembrada correctamente;
- `tests/adversarial/gv-adversarial-t5-postgres.test.ts`: **13/13 aprobadas**;
- `pnpm typecheck`: aprobado;
- ESLint focal del archivo: aprobado;
- `git diff --check`: aprobado.

Los casos estaban diseñados para fallar frente a las aperturas originales GV-05 y GV-07 a GV-13 y pasar con sus correcciones. No cubren los tres hallazgos nuevos de importación descubiertos en T1; esas regresiones deben añadirse al corregirlos porque hoy deben fallar.

## Cómo incluirla sin tocar configuración en esta entrega

Por orden de T5 no se modificó `vitest.integration.config.ts`. Cuando `claude/modulo-gv` se mezcle en la rama que ejecuta integración, su integración en CI debe autorizar también el ajuste del descubrimiento en `tests/configuracion-pruebas.test.ts`, que actualmente enumera solo `tests/*.test.ts`. No basta agregar una ruta anidada a `include`, porque el segundo contrato la consideraría inexistente. Ruta de esta primera suite:

```text
tests/adversarial/gv-adversarial-t5-postgres.test.ts
```

Después ejecutar:

```bash
pnpm test:integration
```

No debe habilitarse todavía en `producto-mezcla-4` aislada: esa rama aún no contiene el rol, las migraciones ni las rutas `/gv`. La inclusión corresponde al commit que mezcle el módulo GV.

El archivo vive en `tests/adversarial/` de forma deliberada. La primera entrega lo dejó en `tests/` y el CI falló exactamente con `tests/configuracion-pruebas.test.ts`: «agrégalo a vitest.config.ts o a vitest.integration.config.ts». Moverlo conserva la orden de no tocar configuraciones y evita fingir que corre en la rama que todavía no tiene GV.

## Límites

- No prueba IndexedDB ni navegación directa de GV; esos casos requieren navegador.
- No prueba la futura conciliación masiva GV, que sigue abierta como GV-16.
- No prueba el requisito de terminal para verificación, que sigue parcial como GV-05.
- No cambia pruebas existentes ni la configuración para forzar un verde artificial.

## Adenda independiente · 41 contratos y entorno propio

# T5 · pruebas adversarias de GV

**26-oct-2026. Solo archivos nuevos.** Aplicación, migraciones, pruebas existentes y configuraciones existentes intactas. Sin producción, Render, datos reales ni credenciales fijas. La suite crea y destruye su propia base PostgreSQL y una API compilada de este checkout.

## URGENTE · quedan dos regresiones financieras reproducibles

Sobre `claude/modulo-gv` **a97f8fa** (incluye correcciones API `07da948`):

| Caso | Gravedad | Evidencia del código | Reproducción y esperado/observado | Arreglo propuesto |
|---|---|---|---|---|
| GV-09 residual: total inferior a pagos existentes omitidos del archivo | Alta | `apps/api/src/gv-money.ts:295`, `:308`, `:311`; `apps/api/src/gv.ts:757`, `:762`, `:770`; citas `apps/api/src/gv-citas.ts:262`, `:267` | Importar entidad de 100 con pago verificado de 80 y clave estable; reimportar misma entidad con total 10 y `payments: []`. Se espera conflicto y conservar total 100. Devuelve 201 y actualiza el total pese al pago existente. Reproducido para inscripción y cita. | Bloquear entidad y cargar todos sus pagos persistidos; validar el estado resultante de combinar pagos existentes y archivo. No validar solo las filas de pagos presentes en el archivo. La importación debe ser atómica. |
| GV-13 residual: importación borra reembolso definitivo | Alta | `apps/api/src/gv-money.ts:313`, `:320`; edición protegida en `:240`; importación actualiza sin esa guarda en `apps/api/src/gv.ts:770` y `apps/api/src/gv-citas.ts:267` | Importar entidad 100/pago verificado 40; marcar `reembolsada` por PATCH con monto 40 y fecha; reimportar misma entidad activa/agendada, mismos pagos, `refundAmount:null`, `refundDate:null`. Se espera rechazo y conservar reembolso. Devuelve 201 y permite sobrescribir estado/reembolso. Reproducido para inscripción y cita. | Aplicar la misma máquina de estados a la importación bajo bloqueo, conservar reembolso inmutable y exigir operación explícita auditada para correcciones. |
| Fecha fuera de rango devuelve 500 | Media | `apps/api/src/gv-money.ts:30`–`:35`, especialmente `toISOString()` en `:34` | Enviar pago de 10 con `date: "2026-13-01"` a inscripción o cita válidas. Se espera 400 sin escritura; devuelve 500 porque `Invalid Date.toISOString()` lanza antes de la validación. | Comprobar `Number.isFinite(date.getTime())` antes de convertir a ISO; después comprobar equivalencia del día. Mantener rechazo de fechas normalizadas como 30-feb. |

Los dos primeros casos añaden ejecución a los límites observados en T1. Las pruebas usan respuestas HTTP y consultas al PostgreSQL descartable, no mocks del controlador. No prueban todos los intercalados de concurrencia ni la carrera entre planificación de importación y revisión bancaria.

## Archivos entregados

- `tests/adversarial/gv-independent-t5.test.ts`: 41 casos; altas y pagos por API HTTP real, comprobación de persistencia, estados, importación y aislamiento.
- `vitest.gv-adversarial.config.ts`: configuración nueva que incluye únicamente ese archivo; no se modificó `vitest.config.ts` ni la lista de integración.

## Cómo ejecutar

En un worktree desechable de la rama GV a revisar, copiar **solo estos dos archivos nuevos**. La rama de entrega de documentos parte de `nexora-cloud`: no significa que tenga el módulo GV instalado. No mezclar código de GV para ejecutar desde una rama que aún no lo contiene.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @fitstore/api build
pnpm exec vitest run --config vitest.gv-adversarial.config.ts
```

Para ejecutar además las tres suites GV existentes en el mismo sandbox, antes de destruirlo:

```sh
GV_VERIFY_EXISTING=1 pnpm exec vitest run --config vitest.gv-adversarial.config.ts
```

La configuración no tiene `test.fails`, skips ni expectativas que validen el defecto. La salida 1 es correcta mientras queden contratos incumplidos. El gancho opcional informa por separado el estado de las suites existentes: no convierte su éxito en éxito de las adversarias. Si las existentes fallan, también falla la ejecución después de limpiar su entorno.

Requisitos: Node 24, pnpm 11, dependencias instaladas, Prisma generado y API compilada para **el mismo checkout**. PostgreSQL 18 embebido lo proporciona la dependencia existente `embedded-postgres`. La suite no acepta API ni base externas: asigna dos puertos libres en loopback, usa directorio temporal propio, usuario sintético y secretos aleatorios, aplica migraciones y seed a esa base. Se niega a ejecutar si hay `.env` en la raíz o en `apps/api`, pues la aplicación los carga automáticamente. No requiere editar variables de producción ni un `.env` local. Limpia procesos, conexiones y directorio en `afterAll`; no hay credenciales en el documento ni en archivos versionados.

## Cobertura y resultados

Los mismos 41 contratos se ejecutaron antes y después:

| Grupo | Casos | Antes: `a74b8ee` (citas + GV sin correcciones) | Después: `a97f8fa` |
|---|---:|---:|---:|
| Sobrepago secuencial y dos cobros concurrentes, inscripción/cita | 4 | 4 fallan | 4 pasan |
| Doble clic concurrente con la misma operación | 2 | 2 fallan (una respuesta interna) | 2 pasan |
| Registradora intenta aprobar su transferencia | 2 | 2 fallan | 2 pasan |
| Cobros en cancelada/reembolsada después de transición por API | 4 | 4 fallan | 4 pasan |
| Fecha 30-feb y mes 13, en ambos tipos | 4 | 2 pasan, 2 fallan | 2 pasan, 2 fallan |
| Monto con tres decimales | 2 | 2 pasan | 2 pasan |
| Repetición exacta de importación | 2 | 2 pasan | 2 pasan |
| Reutilizar clave bajo otra clienta | 2 | 2 fallan | 2 pasan |
| Cambiar importe de pago verificado | 2 | 2 fallan | 2 pasan |
| Pago importado sin clave estable | 2 | 2 fallan | 2 pasan |
| Reimportar con pagos omitidos y total menor | 2 | 2 fallan | 2 fallan |
| Reimportar sobre reembolso definitivo | 2 | 2 fallan | 2 fallan |
| Rol GV contra 11 rutas de Macgen | 11 | 11 pasan | 11 pasan |
| **Total** | **41** | **17 pasan / 24 fallan, salida 1** | **35 pasan / 6 fallan, salida 1** |

Rutas comprobadas: productos, configuración, usuarios, roles, resumen, reporte de ventas, ventas, clientes, inventario, transferencias pendientes y auditoría. Esta cobertura no equivale a probar IndexedDB, cambio rápido de usuario, navegación visual, registro de terminales o todas las rutas del sistema; esos hallazgos necesitan pruebas específicas adicionales.

Suites existentes sobre `a97f8fa`: `gv-unit.test.ts`, `gv-modulo-api.test.ts`, `gv-citas-api.test.ts`: **3 archivos, 17 pruebas aprobadas, salida 0**. Pasan aunque las adversarias detectan seis incumplimientos.

`pnpm --filter @fitstore/api build` pasó en ambos snapshots. ESLint pasó sobre los dos archivos nuevos. No se ejecutó `pnpm check` completo ni se declara GV aprobado: el propósito de esta entrega es aportar regresiones que fallen con defectos reales sin tocar las pruebas existentes.

Logs de ejecución conservados localmente: `/tmp/cola-t5-before-final.log` y `/tmp/cola-t5-after-final.log`; la segunda corrida también identifica su registro separado de las suites existentes. No se incluyen logs completos en Git porque el sandbox usa credenciales efímeras. Los mensajes resumidos son:

```text
ANTES a74b8ee
Test Files  1 failed (1)
Tests       24 failed | 17 passed (41)

DESPUÉS a97f8fa
Test Files  1 failed (1)
Tests       6 failed | 35 passed (41)

CONTROLES EXISTENTES a97f8fa
Test Files  3 passed (3)
Tests       17 passed (17)
```

### Verificación final de los archivos entregados

Se reubicó la suite independiente en `tests/adversarial/gv-independent-t5.test.ts`, con una configuración **nueva** de ejecución explícita `vitest.gv-adversarial.config.ts`. No se alteró el descubrimiento ni se ocultó un fallo en una suite existente: por orden de T5 estas pruebas pendientes de GV no se incorporan al CI general de la rama de documentos. El gancho opcional de controles existentes ahora conserva la limpieza del entorno y propaga un fallo de esos controles, si ocurre.

Última ejecución sobre `a97f8fa`, con los archivos en su ubicación final: **35/41 adversarias aprobadas,6 fallidas;17/17 controles existentes aprobados**, salida final1 por los defectos reales,12,97s. Registro local `/tmp/cola-t5-final-path.log`. ESLint focal y formato de ambos archivos nuevos aprobados. Los41 contratos son los mismos comparados antes/después; los cambios finales son de ruta y limpieza del entorno, no de expectativas. No se ejecutó nuevamente toda la suite antigua del producto.
