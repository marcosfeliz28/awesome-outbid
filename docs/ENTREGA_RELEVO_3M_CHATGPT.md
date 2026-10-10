# Entrega parcial del relevo 3m — 10 octubre 2026

Revisión asistida por IA, no auditoría independiente. Sin producción, despliegues, cambios de planes ni secretos. Rama de trabajo: `nexora-chatgpt-fase2`. Esta entrega no significa que `claude/wave3` esté aprobada.

## Trabajo propio

- 3l A1/A2/M1–M3/B1–B4: entrega anterior `9e751e7`, CI completo de aquella versión verde. Incorporada la base `origin/nexora-cloud@0097082` mediante merge `496030f`, sin rebase.
- B8 `702cbe6`: SID virtual separado por servicio, acceso separado a secretos/PFX/logs y claves CA/servidor distintas. Regresiones con ACL NTFS, SID contra `sc showsid` y PFX reales. La prueba de recuperación se actualizó en `0d3d184` para cargar helpers reales y cotejar firmas, no copiar su lógica.
- B9 `677adeb`: ambos lanzadores usan `ProgramData\FitStore POS\Backups`. Antes, regresión AST de la asignación real falla por `Documents\FitStore Backups`; después, dos casos PASS.
- B10 `240f5a3`, runner `c6ac770`: antes de retirar servicios o borrar Data, preserva y verifica copias retenidas y sus acompañantes SHA/manifiesto fuera de Data. Prueba ejecuta funciones reales; en CI exige administrador para comprobar copia positiva y ACL. En este equipo sin elevación se verifica rechazo seguro, integridad/rutas/junction y orden de operaciones.
- B11 `be01e14`, lint `2d3765f`: sesión GUID NSIS, misma identidad en preflight/rollback. Regresión anterior falla por ausencia de `Var InstallerSession`. Función real extraída, compilada con NSIS y ejecutada localmente: dos GUID distintos, exit 0. Acceso B8 no recorre `node_modules`.
- Excel `1d64f21`, QA `196756b`: generador ExcelJS reproducible, sin runtime externo ni dependencias nuevas. Antes `Cannot find module '@oai/artifact-tool'`; después `Tests 3 passed (3)`. Conserva ceros, decimales y fecha real; no importa lote/vencimiento automáticamente. Exportación temporal renderizada e inspeccionada. XLSX/PNG publicados intactos; apertura en Microsoft Excel real pendiente.
- 3k `f72d40a`, `133041c`, `b99ae24`, `e4a05e8`: aviso, política, terceros, preguntas para contador y explicación para la dueña; fuentes por archivo/línea en base `496030f`. Borradores con datos por completar y revisión jurídica, sin certificar cumplimiento ni asumir servicios conectados.

### Comandos y resultados locales

```powershell
pnpm check
$env:PGBIN = 'C:/Program Files/PostgreSQL/18/bin'
pnpm instalador:validar
node instalador/tests/installer-session-smoke.mjs
pnpm exec vitest run tests/merchandise-template.test.ts
```

`pnpm check`: 481 aprobadas, 9 omisiones preexistentes; typecheck, lint y compilaciones API/web pasan. Validación completa del instalador en `c6ac770` más `e5178e4` (cherry-pick `0d3d184`): exit 0, «Validación del instalador correcta: 27 archivos requeridos y controles de seguridad». Se registró primero el fallo `Get-FitStoreServiceSid` ausente en fixture; cuatro escenarios PostgreSQL reales pasan después de cargar el helper real. No se omitió ni relajó la prueba.

El CI del SHA final y la integración local final se registran en PR #2 después de ejecutarlos. No afirmar verde antes de observar los tres trabajos completos: `verify`, `windows-installer`, `render-images`.

## Revisión de ramas recibidas

| Rama / SHA revisado | Evidencia | Estado |
|---|---|---|
| datos / `7ffcbf3` | check 500 + focales 7; CI attempt 2 completo verde | Sin hallazgo nuevo concreto. Attempt 1 tuvo fallo de stock en cuatro-cajas; rerun de otro actor registrado |
| seguridad / `af69a67` | check 504 + focales 52; CI completo verde | Sin hallazgo nuevo concreto |
| web / `d729d01` | check 491 + navegador 7; CI en curso al revisar | P1 pendiente: callback de guardado puede recuperar borrador vendido sin UUID |
| dinero / `4adeea0` | check 483 + focales 38; CI en curso al revisar | P1 pendiente: descarte de venta permite movimiento en caja de otra sucursal |

WEB: `apps/web/src/cartDraft.ts:87–95,197–202`. Guardado pendiente no cancelado ni protegido por `sealed`; reproducción con módulo real y dobles de temporizador/almacenamiento muestra borrador vendido después de descarte, sin UUID. DINERO: `apps/api/src/offline-sale-review.ts:170–175,204–214` y `sales.ts:1281`. API/PG real aislado confirma movimiento en caja ajena tras sincronización rechazada. Detalles publicados en PR #2; no se usó producción.

**No integrar las cuatro ramas** con estos defectos. El relevo §6 exige autorización de la dueña para corregir en ramas Claude; no se han modificado. No se creó ni empujó `claude/wave3`, ni se empujó a `nexora-cloud`.

## Pendientes explícitos

- Correcciones y regresiones reales de los dos P1 antes de integrar wave3; luego CI completo del SHA integrado.
- Capturas nuevas del manual: dependen de mezclar la caja web corregida (3k.5). No sustituirlas por imágenes de una versión anterior.
- Windows-Smoke limpio por la dueña: instalación/actualización/recuperación con servicios y elevación reales. CI y pruebas locales no certifican ese equipo ni hardware.
- Completar/revisar datos legales, apertura en Excel real y conectar Drive mediante sus cuentas: sin pedir claves por chat.
