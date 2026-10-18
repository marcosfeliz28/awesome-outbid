# Auditoría completa Nexora POS — 18-oct-2026

Base revisada: `origin/nexora-cloud` @ `cf6f7022ab9682db45327558e5dd18946a7b1473` (rama de auditoría `nexora-chatgpt-auditoria`). Solo se añadieron informes bajo `docs/auditoria-completa/`; no se tocó código, pruebas, configuración ni datos de Casa. No se usó producción, Render, secretos ni servicios externos. La refutación de hallazgos altos se hizo desde otro worktree.

## Resumen para la dueña

1. Se revisaron las diez áreas pedidas: dinero, seguridad, inventario, datos/migraciones, integraciones, interfaz, infraestructura, instalador, pruebas y documentación.
2. No se confirmó pérdida real de dinero ni una alteración de datos de negocio durante esta auditoría.
3. Hay **dos hallazgos altos** que merecen atención: el flujo local de pruebas podría continuar contra una API/base remota si la configuración apunta allí (demostrado con mocks, sin contactar un servicio), y el inventario permite un camino sin lote cuando una categoría exige vencimiento (el consumo real de código se probó con stub, falta el flujo PostgreSQL completo).
4. Se identificaron nueve hallazgos medios y seis bajos; varios son huecos de prueba o riesgos aún no reproducidos, no fallos confirmados.
5. Primera `pnpm check`: 659 pruebas aprobadas y 10 omitidas, en 72 archivos. Una repetición posterior en árbol limpio encontró una falla de limpieza temporal `EBUSY` en `courier-migration-postgres.test.ts` (658 aprobadas, 1 fallida, 10 omitidas); typecheck y lint sí pasaron.
6. Los tests PostgreSQL de la suite Vitest usaron bases embebidas y temporales; `NEXORA_TEST_PG_URL` no estaba definido. No se migró ninguna base persistente.
7. No se ejecutaron `pnpm test:integration`, `pnpm verify` ni Playwright: el harness puede aceptar destinos remotos y no había API/base dedicada explícitamente configurada.
8. Cinco pruebas de backup/restore se omitieron por falta de admin PostgreSQL desechable y herramientas; también hubo skips condicionales de cumplimiento, inventario y despliegue. No se cuentan como aprobadas.
9. El revisor independiente reprodujo Q-01 con mocks locales; I-01 quedó **SIN REPRODUCIR de extremo a extremo**. Su intento de PostgreSQL falló por zona horaria, aunque la suite de almacenes pasó en el worktree principal y en una repetición focalizada.
10. El informe no aplica correcciones ni despliega nada. La fase de trabajo pendiente debe comenzar después de aceptar/priorizar este informe, en una rama distinta.

## Hallazgos por severidad

| ID | Severidad / estado | Área | Resumen |
|---|---|---|---|
| Q-01 | **ALTO — confirmado con mock local** | Pruebas/seguridad operativa | `verify.mjs`/preflight no imponen loopback ni una base marcada como descartable; un destino remoto simulado pasa las comprobaciones. No se contactó un servicio real ni se ejecutaron mutaciones externas. |
| I-01 | **ALTO — SIN REPRODUCIR end-to-end** | Inventario | Combinación `requiresExpiry=true`, `requiresLot=false` permite introducir/vender unidades sin lote/fecha; consumo real `takeStock` corroborado con stub, flujo completo de categoría/conteo/venta pendiente. |
| DIN-01 | **MEDIO — SIN REPRODUCIR API/PG** | Dinero | `POST /returns` permite omitir `operationId`; un reintento puede producir una devolución adicional. |
| DIN-02 | **MEDIO — SIN REPRODUCIR API/PG** | Dinero | Movimiento de caja acepta solicitud sin `operationId`; un reenvío puede registrar otra salida. |
| A2-01 | **MEDIO — SIN REPRODUCIR API/PG** | Seguridad | El cambio de usuario por PIN podría permitir que un gerente con `sale:manage` cambie a una cuenta administradora. |
| D-01 | **MEDIO — SIN REPRODUCIR PG** | Datos/migraciones | Migración puede silenciar el fallo de agregar `AuthAttempt.updatedAt`, aunque retención depende de esa columna. |
| N-01 | **MEDIO — SIN REPRODUCIR proveedor** | Integraciones | Resend puede repetir un correo si el proveedor lo acepta y la respuesta se pierde durante timeout/reintento. |
| N-02 | **MEDIO — SIN REPRODUCIR proveedor** | Integraciones | La entrega Telegram es al menos una vez; un fallo tras enviar pero antes de marcar `sent` puede duplicar aviso. |
| W-01 | **MEDIO — contradicción probada por código/test** | Instalador | El asistente ofrece destino OneDrive/USB, pero la ruta efectiva se fuerza a `%ProgramData%`; un test de contrato confirma el destino local. |
| Q-02 | **MEDIO — brecha de cobertura** | Pruebas | Faltan escenarios API concurrentes de idempotencia para devoluciones/COD/cobros por venta y cierre con diferencia de tarjeta + PIN. No se afirma que el código falle. |
| Q-04 | **MEDIO — fallo reproducido una vez** | Pruebas Windows/PostgreSQL | Una repetición de `pnpm check` falló al limpiar el directorio temporal de `courier-migration-postgres.test.ts`: `EBUSY: resource busy or locked, rmdir ...`. La causa exacta del bloqueo no se determinó. |
| D-02 | **BAJO — SIN REPRODUCIR PG** | Datos/migraciones | Restauración acepta cualquier URL PostgreSQL aunque la guía pide base nueva/vacía; el modo paralelo tampoco es atómico. |
| UI-01 | **BAJO — brecha de cobertura** | Interfaz | E2E móvil comprueba diferencia de conciliación, pero no pulsa verificar ni comprueba el resultado. |
| INF-01 | **BAJO — SIN REPRODUCIR Nginx** | Infraestructura | Validador textual de CIDR podría aceptar octetos/prefijos fuera de rango; no se ejecutó Nginx real. |
| Q-03 | **BAJO — limitación de cobertura declarada** | Pruebas | Backup/restore, salida térmica y restauración Windows tienen precondiciones/skips; se deben reportar por separado de pruebas pasadas. |
| DOC-01 | **BAJO — SIN REPRODUCIR instalador completo** | Documentación | Guía/NSIS permiten PIN de 4–5 dígitos, pero el script final exige exactamente 6; la instalación puede fallar después de avanzar. |
| DOC-02 | **BAJO — confirmado por lectura** | Documentación | `DEPLOY-RENDER.md` se contradice sobre si Nginx confía en `CF-Connecting-IP`; la sección nueva explica el criterio condicionado, la vieja lo niega. |

Detalle, líneas y parches sugeridos (no aplicados) están en los informes por área. **Críticos: 0. Altos: 2 (1 confirmado con mocks; 1 sin reproducción end-to-end). Medios: 9. Bajos: 6.**

## Pruebas y comandos

- `pnpm install --frozen-lockfile` — completó en los worktrees de auditoría.
- `pnpm db:generate` — completó con Prisma config y sin conectar a una base.
- `pnpm check` — suite completa: `Test Files 71 passed | 1 skipped (72); Tests 659 passed | 10 skipped (669)`. Typecheck, lint y builds web/API sin error observado. El build API se volvió a ejecutar de forma aislada y terminó con código 0.
- Repetición posterior de `pnpm check` en árbol limpio: typecheck y lint pasaron; Vitest terminó `Test Files 1 failed | 70 passed | 1 skipped (72); Tests 1 failed | 658 passed | 10 skipped (669)`. Fallo exacto: `tests/courier-migration-postgres.test.ts` → `EBUSY: resource busy or locked, rmdir 'C:\Users\marco\AppData\Local\Temp\nexora-courier-db-MxmzfV'`. El build no se ejecutó porque Vitest falló.
- `pnpm exec vitest run tests/warehouses-postgres.test.ts` — 1 archivo/4 pruebas aprobadas en el worktree principal, con PostgreSQL embebido; no se usó `NEXORA_TEST_PG_URL`.
- Notificaciones: 20 pruebas; interfaz y offline: 61; seguridad: 69; dinero: 26; inventario/importación: 15; zona horaria: 4; infraestructura (`cloud-deploy`): 33 aprobadas y 3 omitidas; instalador Windows PowerShell 5.1: 11 aprobadas; cobertura subset: 65; documentación: 4.
- Primer intento de dos suites de notificación antes de generar Prisma Client: falló durante carga con `Cannot find module '.prisma/client/default'`; después de `pnpm db:generate`, ambas pasaron (20/20). No fue un fallo funcional.
- Omitidas en `pnpm check`: `backup-restore` (5), `cloud-deploy` (3), `compliance` (1) e `inventario` (1). Los tests del instalador en Windows se ejecutaron aparte.
- No ejecutadas: `pnpm test:integration`, `node scripts/verify.mjs`, migraciones exhaustivas sobre bases vacía/hostil, E2E Playwright, Docker real, Nginx real ni CI GitHub. No se usó GitHub Actions como banco de pruebas.

## Qué quedó sin verificar

- El flujo completo de I-01 con migración/categoría/conteo/venta en PostgreSQL compatible; el revisor tuvo fallo por `America/Santo_Domingo` no reconocida, pero las pruebas de almacén pasaron en el worktree principal. Falta resolver la diferencia en una instalación PostgreSQL desechable con las zonas horarias necesarias.
- Reproducción PostgreSQL/API para DIN-01, DIN-02, A2-01, D-01 y D-02; suites de integración completas, carreras de caja/devolución y validación matriz rol × ruta × sucursal.
- Proveedores reales, `429`, reintentos/cortes de Resend y Telegram, OAuth/Drive y eventos Sentry.
- Playwright real a 320/390 px, flakiness en corridas repetidas, impresión física, instalación Windows limpia y restauración/actualización/rollback end-to-end.
- PostgreSQL 17 del CI frente al PostgreSQL embebido/local; no se compararon todas las migraciones contra ambas versiones.
- Causa raíz del `EBUSY` durante el teardown de `courier-migration-postgres.test.ts`; no se reintentó.
- Configuración viva de Render, certificados/dominios/IP reales, variables y estado del servicio; no se consultó Render.
- Estado de CI remoto de esta rama; el informe es evidencia local, no un resultado de GitHub Actions.

## Coincidencias con `docs/coordinacion/auditoria-2026-10-10/`

- **DIN-01 ↔ D-07** en `01-dinero-v2.md`: la opcionalidad de `operationId` en `POST /returns` estaba documentada como abierta/decidida por compatibilidad. El código de `cf6f7022` aún la acepta; la dueña debe reconciliar la decisión de compatibilidad con el riesgo actual antes de cambiarla.
- **D-01** comparte el patrón señalado como **M3 abierto/ampliado** en `04-infraestructura-v2.md`: las migraciones hacen DDL tolerante a fallos y pueden dejar restricciones/índices pendientes. D-01 es una instancia distinta y requiere comprobar estado de migración y columna.
- **DOC-02 ↔ L5 parcial** en `04-infraestructura-v2.md`: la documentación de despliegue aún conserva explicaciones históricas que contradicen la configuración actual; esta auditoría identifica una contradicción concreta de IP/Cloudflare.
- **Q-03** coincide con la limitación de skips condicionales ya enumerada en `07-calidad.md`; esta auditoría no la presenta como defecto nuevo.
- Para los demás hallazgos no encontré una coincidencia directa y abierta con los IDs de esos informes; esto no certifica que no existan reportes posteriores fuera de ese directorio.

## Entrega y límite de alcance

Los 10 informes por área y la refutación independiente están dentro de `docs/auditoria-completa/`. No se corrigió software ni se desplegó. La rama se mantiene separada de `nexora-cloud`; la siguiente fase de trabajo pendiente debe partir de una decisión/prioridad explícita basada en este inventario.
