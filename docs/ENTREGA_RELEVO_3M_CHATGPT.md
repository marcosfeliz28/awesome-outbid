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

### Actualización posterior al primer dictamen

El cuadro de abajo conserva el dictamen de los SHA originales, no el estado vigente. Claude corrigió ambos P1: dinero `028bcd2` y web `db4161c`, revisados con reproducción real antes/después. Dinero dejó de escribir el movimiento en caja ajena; web impide guardar el borrador vendido incluso si el callback cancelado llega a ejecutarse. Sus tres trabajos de CI completaron en verde.

Claude publicó la combinación `92853bb31870e9769cab13f1d22ac1fcf68d146d`. Una integración local independiente produjo el mismo árbol; no se sobrescribió su rama. GitHub run `38070042388` completó los tres trabajos en verde. Verificación local: `pnpm check` 541 aprobadas y 9 omisiones existentes; 41 migraciones sobre PostgreSQL 18.6; integración en una sola ejecución 293 aprobadas y 1 fallo, sin reintentos. El fallo está en `tests/auth-lockout.test.ts:621`: esperaba 429 y recibió 400. El diagnóstico detectó una ventana compartida de 60 segundos que podía caducar mientras la prueba esperaba el barrido. Sigue abierto hasta validar una fixture aislada sin relajar las respuestas exigidas ni cambiar límites de producción.

Entrega propia `078be28eedf5b5854760f91da9d32464ccf65e61`: integración local 276/276 y CI run `38069100501` con los tres trabajos en verde. El resultado positivo elevado de preservación de respaldos B10 también pasó en Windows CI. El merge posterior `7dc49ef` incorporó `origin/nexora-cloud@1efe40f` y reconcilió los nuevos plazos técnicos de privacidad; esta nueva base requiere validación propia antes de otro push.

| Rama / SHA revisado | Evidencia | Estado |
|---|---|---|
| datos / `7ffcbf3` | check 500 + focales 7; CI attempt 2 completo verde | Sin hallazgo nuevo concreto. Attempt 1 tuvo fallo de stock en cuatro-cajas; rerun de otro actor registrado |
| seguridad / `af69a67` | check 504 + focales 52; CI completo verde | Sin hallazgo nuevo concreto |
| web / `d729d01` | check 491 + navegador 7; CI en curso al revisar | P1 pendiente: callback de guardado puede recuperar borrador vendido sin UUID |
| dinero / `4adeea0` | check 483 + focales 38; CI en curso al revisar | P1 pendiente: descarte de venta permite movimiento en caja de otra sucursal |

WEB: `apps/web/src/cartDraft.ts:87–95,197–202`. Guardado pendiente no cancelado ni protegido por `sealed`; reproducción con módulo real y dobles de temporizador/almacenamiento muestra borrador vendido después de descarte, sin UUID. DINERO: `apps/api/src/offline-sale-review.ts:170–175,204–214` y `sales.ts:1281`. API/PG real aislado confirma movimiento en caja ajena tras sincronización rechazada. Detalles publicados en PR #2; no se usó producción.

En ese primer dictamen se rechazó integrar las cuatro ramas con los dos P1. La actualización anterior documenta sus correcciones posteriores y la combinación publicada por Claude. ChatGPT no empujó a `nexora-cloud` ni desplegó.

## Pendientes explícitos

### Correcciones locales posteriores, pendientes del CI de la nueva entrega

- `93502d7`: Windows-Smoke usa `Invoke-FitStorePgSql` en ambas consultas. Antes, las asignaciones reales extraídas del AST fallaban en Windows PowerShell 5.1 con `relation "sale" does not exist`; después devuelven `2|3|4` sobre dos bases PostgreSQL 18.6 aisladas y rechazan una tabla `Sale` ausente. La regresión está conectada al runner Windows. `pnpm instalador:validar` completo terminó con salida 0, sin ejecutar el smoke de una instalación real.
- `419fb51`: N-02 usa una API compilada nueva, señal TCP real de arranque y veinte tandas de siete peticiones. Conserva 140 intentos desde siete IP, ventana real de 60 s, rechazo de respuestas distintas de 400/429 y las expectativas originales 429/400/201. No cambia límites ni código de autenticación. El archivo completo pasó 17/17; el reloj inyectado solo se usa con la clase real en una prueba separada. Los intentos intermedios detectaron una señal de arranque prematura y respuestas 503 al lanzar 140 solicitudes simultáneas; no se aceptaron como respuestas correctas ni se ocultaron.
- `460f232`: manual actualizado con 22 capturas de React local, fixtures ficticias y tráfico externo bloqueado. No certifican permisos de API, operaciones realizadas ni producción. Se documentaron el botón de cierre recortado en 390 px y la diferencia entre el texto de la interfaz y el filtrado de diferencias de la API. Las ocho tareas principales conservan sus siete separadores.
- Validación conjunta local tras esas correcciones: `pnpm check` salida 0, 542 aprobadas y 9 omisiones existentes; typecheck, lint y compilaciones API/web pasan. La integración completa del nuevo árbol está en curso; no trasladar el CI verde de `078be28` a esta entrega sin un nuevo run verde.

- Corregir y verificar la fixture N-02 que falló en la integración combinada; no usar un CI verde para ocultar el fallo local.
- Capturas nuevas del manual: dependen de mezclar la caja web corregida (3k.5). No sustituirlas por imágenes de una versión anterior.
- Windows-Smoke limpio por la dueña: instalación/actualización/recuperación con servicios y elevación reales. CI y pruebas locales no certifican ese equipo ni hardware.
- Completar/revisar datos legales, apertura en Excel real y conectar Drive mediante sus cuentas: sin pedir claves por chat.
