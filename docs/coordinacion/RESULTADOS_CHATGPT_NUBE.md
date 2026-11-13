# Resultados de ChatGPT NUBE

## 2026-11-12 · revisión nocturna de textos, criterios y contrato

- **Base y fuentes:** revisión hecha desde `origin/nexora-cloud` `3705f7d8ef006c4a9698b70e7d65adbb133ef428`. Las cinco guías se leyeron sin editar desde `origin/claude-pc/ayuda-local-12nov` `0963547f8a4308e7e9e21be5eca47f4e418e91f6`; el contrato se leyó sin editar desde `origin/claude-pc/asistente-analista` `9d419f3052ea2c758814cb0ade2d0d1156135a3d`.
- **Asignación comprobada:** `docs/coordinacion/ESTADO_MEJORAS_12NOV.md:63-65` asigna exclusivamente a ChatGPT Nube estas tres tareas. No repiten D12 ni C5-1 y no requieren modificar `apps/**`, `tests/e2e/**` ni las ramas fuente.

### 1. Verificación de las cinco guías locales

| Guía           | Paso | Evidencia en la interfaz o el servidor                                                                                                                  | Resultado                                                                                                                                                                                |
| -------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cajera-s1.md` |    1 | `apps/web/src/passwordChange.ts:6-13`, `apps/web/src/passwordChange.ts:23-35`, `apps/web/src/App.tsx:548-564`                                           | **Corregir.** Para cajera/vendedora la regla es un PIN nuevo de seis números, no las cinco reglas de una contraseña fuerte.                                                              |
| `cajera-s1.md` |    2 | `apps/web/src/Management.tsx:1753-1759`                                                                                                                 | Conforme: «Caja» muestra `Abrir mi caja` cuando no hay sesión abierta.                                                                                                                   |
| `cajera-s1.md` |    3 | `apps/web/src/Management.tsx:2030-2068`, `apps/api/src/cash.ts:859-880`                                                                                 | **Corregir.** Un fondo menor que el sugerido exige una nota; no pide PIN.                                                                                                                |
| `cajera-s1.md` |    4 | `apps/web/src/Management.tsx:1713-1751`                                                                                                                 | Conforme: se ve `Caja abierta` y el nombre del equipo/caja.                                                                                                                              |
| `cajera-s1.md` |    5 | `apps/api/src/common.ts:768`, `apps/web/src/realtime.tsx:515-565`                                                                                       | Parcial: el equipo nuevo sí requiere aprobación o PIN. Quitar «no abras una caja solo para consultar», que no describe una regla demostrable del sistema.                                |
| `cajera-s2.md` |    1 | `apps/web/src/POS.tsx:960-976`, `apps/web/src/POS.tsx:1022-1028`                                                                                        | Conforme en función; corregir la frase «o escáname» por «o escanéalo con la cámara/lector».                                                                                              |
| `cajera-s2.md` |  2-3 | `apps/web/src/POS.tsx:1031-1082`, `apps/web/src/POS.tsx:1127-1289`, `apps/web/src/POS.tsx:1361-1388`                                                    | Conforme: búsqueda, variante, precio, existencia y carrito están visibles.                                                                                                               |
| `cajera-s2.md` |    4 | `apps/web/src/POS.tsx:1106-1123`, `apps/web/src/POS.tsx:1435-1549`                                                                                      | Conforme: F4 selecciona cliente y el formulario permite crear uno.                                                                                                                       |
| `cajera-s2.md` |    5 | `apps/web/src/POS.tsx:1288-1311`                                                                                                                        | **Corregir.** El total sí se revisa; «no cambies el cliente o producto» no es una regla del sistema y estorba una corrección normal del carrito.                                         |
| `cajera-s2.md` |    6 | `apps/web/src/POS.tsx:1073-1082`                                                                                                                        | Conforme con matiz: la pantalla recomienda menos palabras o el código; avisar a gerencia es procedimiento operativo, no comportamiento del programa.                                     |
| `cajera-s4.md` |  1-4 | `apps/web/src/Management.tsx:1695-1708`, `apps/web/src/Management.tsx:2072-2105`                                                                        | Conforme: `Movimiento`, salida, monto, motivo y PIN de gerencia cuando corresponda.                                                                                                      |
| `cajera-s4.md` |    5 | `apps/api/src/cash.ts:974-1033`                                                                                                                         | Conforme: el límite acumula las salidas de la usuaria en el turno/día y exige PIN al superarlo.                                                                                          |
| `cajera-s4.md` |    6 | `apps/api/src/cash.ts:987-1003`                                                                                                                         | Parcial: la operación es idempotente. «Conserva el comprobante según el procedimiento» no tiene respaldo en esta pantalla; dejarlo solo si existe un procedimiento externo aprobado.     |
| `cajera-s6.md` |  1-2 | `apps/web/src/Management.tsx:3372-3386`, `apps/web/src/Management.tsx:3685-3715`                                                                        | **Corregir.** La cajera sí puede pulsar `Solicitar anulación`, elegir el tipo de motivo y explicarlo; administración decide la anulación. No dirigir por nombre a personas concretas.    |
| `cajera-s6.md` |    3 | `apps/web/src/QuickQuestions.tsx:547-552`                                                                                                               | Conforme: no repetir la venta mientras la solicitud está pendiente.                                                                                                                      |
| `cajera-s6.md` |    4 | `apps/web/src/Management.tsx:3412-3420`, `apps/web/src/Management.tsx:3826-3887`                                                                        | **Corregir.** Las devoluciones y los abonos pueden impedir una anulación total; la guía debe separar `Solicitar anulación` de `Devolver`.                                                |
| `cajera-s6.md` |  5-6 | `apps/web/src/Management.tsx:3393-3409`, `apps/web/src/Management.tsx:3670-3683`                                                                        | Conforme con rol: quien administra necesita su caja abierta para una devolución y para el reembolso en efectivo si la caja original cerró.                                               |
| `cajera-s8.md` |  1-2 | `apps/web/src/App.tsx:1122-1147`, `apps/web/src/offlinePolicy.ts:3-12`, `apps/web/src/POS.tsx:2232-2260`                                                | Conforme: el indicador muestra el estado y solo se guarda localmente si la tienda permite ventas sin conexión. Crédito, contraentrega y una operación que requiere PIN esperan conexión. |
| `cajera-s8.md` |  3-4 | `apps/web/src/Management.tsx:1765-1924`, `apps/web/src/pendingSales.ts:190-197`, `apps/web/src/pendingSales.ts:297-313`                                 | Conforme: sincronización automática/manual, conflicto de inventario, actualización de precios y reintento.                                                                               |
| `cajera-s8.md` |    5 | `apps/web/src/POS.tsx:2254-2260`                                                                                                                        | Conforme en el código actual: no procesar crédito ni autorizaciones con PIN sin conexión.                                                                                                |
| `cajera-s8.md` |    6 | `apps/web/src/cartDraftPolicy.ts:5-13`, `apps/web/src/cartDraftPolicy.ts:29-38`, `apps/web/src/App.tsx:885-943`, `apps/web/src/pendingSales.ts:382-396` | Conforme con precisión: actividad conserva la sesión hasta dos horas; un carrito reciente se restaura; una venta local pendiente impide cerrar sin resolverla.                           |

**Lista de correcciones para Claude PC, sin tocar su rama:**

1. `cajera-s1.md`: sustituir las cinco reglas por «crea un PIN nuevo de seis números»; fondo menor = nota, no PIN; retirar consejos no demostrables.
2. `cajera-s2.md`: corregir «escáname»; eliminar la prohibición de cambiar cliente/producto; distinguir la ayuda de pantalla del procedimiento de escalar.
3. `cajera-s4.md`: conservar la salida y el PIN condicional; retirar la obligación de guardar un comprobante salvo que se cite el procedimiento externo.
4. `cajera-s6.md`: reescribir alrededor de `Solicitar anulación`; no nombrar personas; separar anulación, devolución y abono.
5. `cajera-s8.md`: conservar el flujo; precisar que la venta local depende de la configuración y que el cierre se bloquea mientras haya pendientes.

### 2. Criterios de aceptación en pantalla

Estos criterios describen la pantalla; no autorizan cambios en totales, impuestos, descuentos, precios, permisos ni persistencia de pagos.

#### C1 · Consumidor final por defecto

- **Antes:** sin cliente, la cabecera muestra `Selecciona el cliente`; al pulsar F12 se abre el selector y, después de elegir, hay que pulsar cobrar otra vez (`apps/web/src/POS.tsx:516-539`, `apps/web/src/POS.tsx:1106-1123`).
- **Después:** al iniciar una venta se ve `Consumidor final` seleccionado. Con artículos en el carrito, F12 abre el cobro en una sola acción.
- Elegir otro cliente reemplaza claramente al genérico y mantiene el comportamiento actual. Al finalizar o cancelar, la venta siguiente vuelve al cliente genérico.
- Si el cliente genérico no está disponible, la pantalla no inventa ni duplica clientes: explica el bloqueo y permite elegir o crear uno. La API sigue exigiendo cliente para crédito; no se cambia esa regla.

#### C2 · Cobro exacto y cambio visible

- **Antes:** la cajera abre cobro, elige efectivo, puede pulsar `Exacto`, agrega el pago y luego finaliza; el cambio aparece después de registrar pagos (`apps/web/src/POS.tsx:2515-2590`, `apps/web/src/POS.tsx:2750-2770`, `apps/web/src/POS.tsx:2880-2935`, `apps/web/src/POS.tsx:2990-3020`).
- **Después:** se ve una acción inequívoca `Cobrar exacto en efectivo`; al usarla se registra una sola vez el total pendiente en efectivo y el cambio visible es RD$0.00.
- Al escribir el efectivo recibido, el cambio se actualiza antes de confirmar. Enter ejecuta la acción visible una sola vez y nunca omite un PIN, motivo o validación existente.
- Total, impuestos, descuentos, métodos, redondeo y datos guardados deben coincidir exactamente con el flujo actual.

#### C3 · Una entrada clara para crédito

- **Antes:** crédito aparece en el atajo, en el selector de condición y entre las formas de pago, lo que presenta tres entradas (`apps/web/src/POS.tsx:2537-2580`, `apps/web/src/POS.tsx:2610-2630`).
- **Después:** la cajera ve una sola entrada inicial `Vender a crédito`. Dentro de ese flujo elige, si aplica, `Crédito (paga después)` o `Contraentrega`; no hay botones duplicados que parezcan métodos distintos.
- Antes de confirmar se muestran cliente, total pendiente y condición elegida. Si falta cliente, el selector se abre y al terminar vuelve al mismo punto del cobro.
- Se conservan permisos, PIN/motivo cuando corresponda, límites, deuda y forma de guardar pagos. No se acredita efectivo ni se altera el total.

#### C10 · Cierre guiado por pasos

- **Antes:** una sola pantalla larga reúne conteo, tarjetas, lotes, divisas, efectivo dejado, notas, confirmación y errores (`apps/web/src/Tienda.tsx:175-285`, `apps/web/src/Tienda.tsx:320-468`).
- **Después:** un indicador muestra cinco pasos: **1 Conteo**, **2 Tarjetas**, **3 Efectivo dejado**, **4 Revisar**, **5 Confirmar**. Atrás/Continuar conserva lo escrito.
- Cada error aparece en su paso y evita avanzar: conteos inválidos, lote obligatorio, nota de descuadre y PIN existente. La revisión resume únicamente lo que la cajera ingresó.
- El cierre continúa siendo ciego: la cajera no ve efectivo esperado ni diferencia antes de confirmar. La pantalla envía una sola solicitud con el mismo contenido y las mismas reglas actuales.
- La foto es opcional y queda fuera del criterio obligatorio hasta una aprobación separada. Cerrar/imprimir conserva su resultado actual.

### 3. Contrato del asistente analista frente al tope aprobado

**Veredicto: requiere corrección antes de firmar.** El contrato no está alineado por completo con la decisión registrada en `ESTADO_MEJORAS_12NOV.md:49`.

1. En `04_TERMINOS_USO_IA_VENTAS.md:41`, cambiar «US$0.40 ... (PENDIENTE de aprobar)» por «US$0.40 por usuario y día, aprobado por la dueña el 12-nov-2026».
2. En las líneas 13 y 75, separar el límite operativo aprobado de los precios/condiciones comerciales de la Hoja de contratación, que sí pueden seguir pendientes. «Los topes ... siguen PENDIENTES» contradice hoy la decisión sobre US$0.40.
3. No prometer un techo duro absoluto. El servidor comprueba el costo acumulado antes de reservar una pregunta (`apps/api/src/assistant.ts:1232-1246`) y bloquea preguntas posteriores cuando lo ya contabilizado alcanza el límite (`apps/api/src/assistant.ts:1088-1104`), pero una pregunta admitida puede sumar costo después de la comprobación. Redacción propuesta: «Antes de cada pregunta se comprueba el costo estimado ya registrado. Si alcanzó US$0.40, no se llama a la IA; una pregunta ya admitida puede hacer que el acumulado final supere ese valor».
4. Conservar la distinción entre límite de 30 preguntas y límite de costo. El valor configurado sí es `0.4` para analista (`apps/api/src/assistant.ts:38-46`, `apps/api/src/assistant.ts:1092-1095`).
5. Mantener el rótulo de borrador y la revisión por abogado dominicano antes de firma. Esta revisión es técnica, no jurídica.

### Regresión documental y autoauditoría

- **Antes:** la búsqueda de `revisión nocturna de textos`, `criterios de aceptación C1` y `US$0.40 ... aprobado` en ambos archivos de resultados no encontró la entrega y terminó con código 1.
- **Después:** el control exige las cinco guías, C1/C2/C3/C10, los tres puntos del contrato, los dos SHA fuente y esta sección en ambos archivos de resultados.
- **Control completo:** tras instalar desde el lockfile y generar el cliente Prisma local (sin conectar ni migrar una base), `pnpm check` terminó con código 0: typecheck y ESLint pasaron; 116 archivos de prueba y 1,028 pruebas pasaron; uno y 10, respectivamente, se omitieron por condiciones existentes; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Incidencia de preparación:** el primer `pnpm check` se detuvo en typecheck porque el worktree nuevo aún no tenía generado Prisma; el primer error fue `src/admin.ts(255,37): error TS2339: Property 'customer' does not exist on type 'Database'.` Después de `pnpm db:generate`, la comprobación completa quedó verde.
- Revisé que todas las correcciones estén formuladas como lista para las ramas propietarias: no edité guías, contrato, `apps/**` ni `tests/e2e/**`. No cambié reglas de dinero, precios o permisos.
- No se desplegó, mezcló ni abrió PR; no se tocó Render, producción, la base de la tienda ni credenciales. Windows-Smoke real sigue pendiente y no se declara certificado.

## 2026-11-12 · D12 · contenido de ayuda por rol

- **Rama y base:** `chatgpt-nube/ayuda-contenido-12nov`, creada desde `origin/nexora-cloud` `8a83093723a884f7edb017d2f0916b371f556227`. La implementación está en `6a809cd700c59b1bd7eddf6f2b4a24cb4300a8e7`.
- **Paso 0:** comprobé las fuentes vigentes completas: `MANUAL-CAJERO.md`, `MANUAL-CAJERA-PREGUNTAS.md`, `EXPLICACION_DUENA.md` y las 30 respuestas de `QuickQuestions.tsx`. La base no contenía `docs/ayuda/` ni `docs/ayuda/borradores-local/`; por tanto, no había un borrador local que reutilizar o revisar.
- **Entrega D12:** añadí 18 páginas independientes en `docs/ayuda/`: 12 para cajera, 3 para gerente y 3 para dueña. Todas tienen `titulo`, `rol`, `pantalla` y `palabras_clave`, entre uno y seis pasos, y una línea «Si algo sale mal:». Conservé la corrección integrada de C5-1: para crédito se exige elegir un cliente; no se afirma que «Consumidor final» esté prohibido.
- **Regresión documental:** en la base, `test "$(git ls-tree -r --name-only origin/nexora-cloud docs/ayuda | wc -l)" -ge 1` terminó con código 1 porque había 0 páginas. Después, el validador de metadatos, roles, cantidad de pasos y manejo de errores pasó sobre las 18 páginas. `git diff --check` también pasó.
- **Control completo:** `pnpm check` terminó con código 0. Typecheck y ESLint pasaron; 116 archivos de prueba pasaron y uno se omitió; 1,028 pruebas pasaron y 10 se omitieron; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** cada paso numerado tiene 20 palabras o menos. Contrasté los botones operativos con la interfaz actual: abrir/cerrar caja, guardar cliente, finalizar venta, solicitar anulación y resolver ventas sin conexión coinciden. El diff de implementación solo añade contenido bajo `docs/ayuda/`; no modifica `apps/**`, `tests/e2e/**`, dinero, permisos ni API.
- **Límites:** no abrí la interfaz ni ejecuté pruebas E2E; esta pieza es contenido y `tests/e2e/**` pertenece a Claude nube. No pude revisar borradores de la IA local porque no existen en la base publicada. No desplegué, mezclé ni abrí PR; no toqué Render, producción, la base de la tienda ni credenciales. Los tres CI se comprobarán sobre el SHA final después del único push permitido.

### Corrección solicitada por Norexos 1

- **Commit correctivo:** `f7e2fedf8f6f6f3ab0ec1b039751defb054938c7`, sobre la base actualizada `origin/nexora-cloud` `b6de76a4df69a5f9f44c96f288c6a320de98aef0`.
- **Crédito:** eliminé la aprobación obligatoria y dejé la condición real: gerencia solo escribe su PIN cuando el sistema lo pide. También eliminé de esta página la frase discutida sobre internet; el flujo queda alineado con la pregunta rápida implementada.
- **Depuración:** quité la frase de relleno de la autorización con PIN y retiré instrucciones operativas que no podía vincular con código, como borrar un teléfono con herramientas externas o hacer una restauración mensual.
- **Regresión:** antes de corregir, la búsqueda de frases prohibidas encontró tres coincidencias (`Confirma el acuerdo con gerencia`, `no tramites crédito sin internet` y `Comprueba el resultado antes`). Después, el mismo control no encuentra ninguna. El validador D12 vuelve a comprobar metadatos, roles, 1–6 pasos y la línea de error en las 18 páginas.
- **Control completo de la corrección:** `pnpm check` terminó con código 0. Typecheck y ESLint pasaron; 116 archivos de prueba pasaron y uno se omitió; 1,028 pruebas pasaron y 10 se omitieron; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** revisé el diff completo contra la base actualizada y comprobé cada rango de la tabla contra un archivo existente. La corrección modifica únicamente once páginas de ayuda y este informe; no cambia `apps/**`, `tests/e2e/**`, dinero, precios, permisos ni API. No hubo despliegue ni acceso a Render, producción, la base de la tienda o credenciales.

#### Evidencia página → paso → código

La revisión se amplió a las 18 páginas publicadas, aunque la orden menciona 14. Los rangos agrupados cubren todos los pasos numerados de cada página.

| Página | Paso(s) | Respaldo en código |
|---|---:|---|
| `cajera/abrir-caja` | 1 | `apps/web/src/App.tsx:470-528` |
| `cajera/abrir-caja` | 2–5 | `apps/web/src/Management.tsx:1688-1759`, `apps/web/src/Management.tsx:2030-2068` |
| `cajera/cerrar-caja` | 1 | `apps/web/src/Management.tsx:1708`, `apps/web/src/pendingSales.ts:382-396` |
| `cajera/cerrar-caja` | 2–6 | `apps/web/src/Tienda.tsx:329-367`, `apps/web/src/Tienda.tsx:389-467` |
| `cajera/cobrar-venta` | 1 | `apps/web/src/POS.tsx:1297-1306` |
| `cajera/cobrar-venta` | 2–6 | `apps/web/src/POS.tsx:2730-3013` |
| `cajera/escanear-con-camara` | 1–2 | `apps/web/src/POS.tsx:993-1028` |
| `cajera/escanear-con-camara` | 3–4 | `apps/web/src/POS.tsx:3045-3072` |
| `cajera/pedir-devolucion` | 1–5 | `apps/web/src/QuickQuestions.tsx:531-536`, `apps/web/src/Management.tsx:3388-3409`, `apps/web/src/Management.tsx:3828-3868` |
| `cajera/poner-venta-en-espera` | 1–3 | `apps/web/src/POS.tsx:457-485`, `apps/web/src/POS.tsx:1308-1312` |
| `cajera/poner-venta-en-espera` | 4–5 | `apps/web/src/QuickQuestions.tsx:555-560` |
| `cajera/preparar-venta` | 1–3 | `apps/web/src/POS.tsx:963-1082`, `apps/web/src/POS.tsx:1127-1289`, `apps/web/src/POS.tsx:1360-1380` |
| `cajera/preparar-venta` | 4–6 | `apps/web/src/POS.tsx:1106-1122`, `apps/web/src/POS.tsx:1435-1549`, `apps/web/src/POS.tsx:1281-1289` |
| `cajera/respuesta-perdida-al-cobrar` | 1–5 | `apps/web/src/POS.tsx:2197-2212` |
| `cajera/solicitar-anulacion` | 1–2 | `apps/web/src/Management.tsx:3372-3386` |
| `cajera/solicitar-anulacion` | 3–6 | `apps/web/src/Management.tsx:3685-3715`, `apps/web/src/QuickQuestions.tsx:547-552` |
| `cajera/trabajar-sin-conexion` | 1–2 | `apps/web/src/offlinePolicy.ts:3-12`, `apps/web/src/POS.tsx:2232-2252` |
| `cajera/trabajar-sin-conexion` | 3–6 | `apps/web/src/Management.tsx:1765-1923`, `apps/web/src/pendingSales.ts:382-396` |
| `cajera/usar-preguntas-y-encuesta` | 1–2 | `apps/web/src/POS.tsx:993-1001`, `apps/web/src/QuickQuestions.tsx:665-716` |
| `cajera/usar-preguntas-y-encuesta` | 3–5 | `apps/web/src/QuickQuestions.tsx:588-660`, `apps/web/src/QuickQuestions.tsx:707-713` |
| `cajera/vender-a-credito` | 1–2 | `apps/web/src/POS.tsx:1106-1122`, `apps/web/src/QuickQuestions.tsx:539-544` |
| `cajera/vender-a-credito` | 3–4 | `apps/web/src/POS.tsx:1939-1960`, `apps/web/src/POS.tsx:2348-2360`, `apps/web/src/POS.tsx:2563-2621` |
| `gerente/autorizar-con-pin` | 1–3 | `apps/web/src/POS.tsx:1939-1960`, `apps/web/src/POS.tsx:2348-2360`, `apps/web/src/Tienda.tsx:218-225` |
| `gerente/procesar-devolucion` | 1–4 | `apps/web/src/Management.tsx:3388-3409`, `apps/web/src/Management.tsx:3828-3868` |
| `gerente/procesar-devolucion` | 5–6 | `apps/api/src/sales.ts:3678-3696`, `apps/api/src/sales.ts:3783-3966` |
| `gerente/resolver-venta-sin-conexion` | 1–3 | `apps/web/src/pendingSales.ts:293-313`, `apps/web/src/Management.tsx:1765-1923` |
| `gerente/resolver-venta-sin-conexion` | 4–6 | `apps/web/src/pendingSales.ts:316-379` |
| `duena/desactivar-usuaria` | 1–3 | `apps/web/src/Management.tsx:4375-4389`, `apps/web/src/Management.tsx:4455-4516`, `apps/web/src/Management.tsx:4608-4638` |
| `duena/desactivar-usuaria` | 4 | `apps/web/src/realtime.tsx:294-463`, `apps/api/src/realtime.ts:415-430` |
| `duena/equipo-robado` | 1 | `apps/web/src/Management.tsx:4491-4516`, `apps/api/src/admin.ts:1121-1219` |
| `duena/equipo-robado` | 2 | `apps/web/src/realtime.tsx:442-463`, `apps/api/src/realtime.ts:415-430` |
| `duena/equipo-robado` | 3 | `apps/web/src/Management.tsx:4045-4165` |
| `duena/revisar-respaldos` | 1–2 | `apps/web/src/DriveBackup.tsx:154-166`, `apps/web/src/DriveBackup.tsx:203-249` |
| `duena/revisar-respaldos` | 3–4 | `apps/web/src/DriveBackup.tsx:128-138`, `apps/web/src/DriveBackup.tsx:254-266` |

## 2026-11-12 · Mejoras C5-1 · textos y ayuda

- **Rama y base:** `chatgpt-nube/ayuda-textos-12nov`, rebasada sin conflictos sobre `origin/nexora-cloud` `6bfa1aadd2443a4e45487cae61b2f74c19877822`. El commit de implementación es `ca514001ad75e21d49a1ba32dd81509de961458e`.
- **Pieza 1 conciliada, no repetida:** el arreglo original `chatgpt-nube/fix-e2e-12nov` (`8022a736`, run `43158775690`, tres CI verdes) ya está integrado por contenido en la base. La integración reescribió los SHA durante el rebase. Norexos 1 conserva la revisión e integración. Windows-Smoke continúa pendiente y no se declara certificado.
- **C5-1:** comparé las 30 respuestas de Preguntas rápidas, las ocho secciones del manual de caja y las 30 preguntas de la encuesta contra la interfaz actual. Corregí cinco discrepancias en los dos manuales. Documenté tres cambios exactos para `QuickQuestions.tsx` sin tocar `apps/**`, porque ese archivo pertenece a Claude nube. El detalle completo está en `docs/coordinacion/mejoras-12nov/C5-1_textos.md`.
- **Regresión antes/después:** antes del cambio, `vitest run tests/accessibility-contract.test.ts -t 'C5-1'` falló porque el manual no contenía `El fondo menor no requiere PIN`. Después pasó 1/1. La comprobación conjunta de `accessibility-contract` y `compliance` pasó 40 pruebas y omitió una.
- **Control final tras actualizar la base:** `pnpm check` terminó con código 0: typecheck y ESLint pasaron; 116 archivos de prueba pasaron y uno se omitió; 1,028 pruebas pasaron y 10 se omitieron; los builds web y API pasaron. Vite solo emitió la advertencia conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** el control completo detectó que mi primer título de la sección de anulación rompía un contrato documental existente. Conservé el encabezado `solo administración` y actualicé debajo el flujo real de solicitud. Las pruebas afectadas pasaron después. Revisé el diff final: solo contiene los dos manuales, la tabla C5-1, una regresión textual y este informe; no contiene `apps/**` ni `tests/e2e/**`.
- **Límites:** no abrí la interfaz ni ejecuté E2E de navegador. No desplegué, no mezclé, no abrí PR y no toqué Render, producción, la base de la tienda ni credenciales. Los tres CI se comprobarán sobre el SHA final después del único push permitido.

## 2026-11-08 · Asistente analista · `chatgpt-nube/asistente-analista`

- **Qué hice:** documenté el producto de IA analítica en `docs/ia/ASISTENTE_ANALISTA_SPEC.md`: ocho grupos de preguntas, las cinco herramientas actuales, seis lecturas faltantes, matriz de permisos para dueña/gerente/cajera y reconciliación obligatoria por tres caminos. Preparé `ASISTENTE_ANALISTA_EVAL_100.md` con exactamente 100 preguntas, respuestas y cálculos deterministas, incluidas trampas de PIN, otra empresa/sucursal, anulaciones, escrituras e inyección. En `ASISTENTE_ANALISTA_COSTOS.md` calculé cuatro escenarios con las tarifas implementadas en `ai-prices.ts` y conservé las cuotas vigentes de 100/250/600/1,500 preguntas.
- **Regresión documental:** antes, las tres comprobaciones `test -f` terminaron con código 1 porque los entregables no existían. Después, los tres archivos existen y no están vacíos; `rg -o 'AA-[0-9]{3}' ... | sort -u | wc -l` devuelve `100`; las búsquedas de PIN, otra sucursal, anulación, inyección, solo lectura, triple lectura y margen del 15 % pasaron. `git diff --check` pasó. Tras preparar el worktree con `pnpm install --frozen-lockfile` y `pnpm db:generate` (sin conectar ni migrar una base), `pnpm check` terminó con código 0: typecheck y lint pasaron, **112 archivos de prueba pasaron y 1 se omitió; 984 pruebas pasaron y 10 se omitieron**; los builds web/API pasaron. Vite emitió la advertencia no bloqueante ya conocida de un chunk mayor de 500 kB.
- **Autoauditoría:** las herramientas propuestas no aceptan empresa/sucursal desde el modelo y no escriben; cada una reutiliza una fuente existente y conserva el permiso del flujo original. La cajera no recibe totales gerenciales, costo, utilidad, esperado ni diferencia de cierre. Las anulaciones, devoluciones, pendientes y datos offline se tratan como excepciones, no como ingresos confirmados. Los cálculos monetarios tienen dos decimales y los porcentajes evitan dividir entre cero. Revisé que los casos AA-001 a AA-100 sean únicos y que los bloqueantes de seguridad estén identificados.
- **Costos y límites:** los tokens son supuestos, no mediciones. La tasa RD$65/US$ es una reserva de planificación, no una tasa vigente confirmada. Con una reserva de tres veces el techo estimado, el margen después de IA queda entre 78.3 % y 91.9 % en planes y entre 69.5 % y 74.6 % en paquetes. Esto no demuestra margen total ≥15 % porque faltan costos de hosting, soporte, impuestos y ventas; el documento incluye la fórmula para comprobarlo antes de vender.
- **Incidencias de preparación:** la primera ejecución de `pnpm check` falló con `tsc: not found` porque el worktree no tenía `node_modules`. Después de instalar desde el lockfile, la segunda falló en typecheck con errores como `Property 'customer' does not exist on type 'Database'` porque Prisma aún no estaba generado. No fueron fallos del cambio documental; tras generar el cliente, la corrida completa quedó verde.
- **Qué falta:** implementar y probar las seis herramientas en otra orden; medir promedio/P95 reales durante el piloto; aportar costos no IA y tasa cambiaria administrativa para certificar margen total. No se tocó código funcional, Render, producción, base ni credenciales; no se desplegó.

## 2026-11-07 · Auditoría del arreglo `flaky-password-telegram`

**Rama:** `chatgpt-nube/auditoria-flaky-password`  
**Base auditada:** `origin/nexora-cloud` en `1a42e1f3`; arreglo de origen `5815b56e` y adaptación de dobles `a8d8fb86`.

### Veredicto

**No encontré un hueco explotable de fuerza bruta.** El cambio de `update` a `updateMany` en `apps/api/src/security.ts:213-231` únicamente evita P2025 si una operación autorizada de cambio de contraseña ya borró la fila. En un fallo, el cupo de cuenta se reconstruye con el estado leído más ese fallo mediante `upsert` (`security.ts:244-265`); al llegar a 30 queda bloqueado durante el resto de la ventana y el intento siguiente se rechaza antes de ejecutar la comparación (`security.ts:200-208`).

La carrera requiere que, al mismo tiempo, termine con éxito un cambio o restablecimiento autorizado de contraseña. Esas operaciones incrementan `authVersion`; las claves de bloqueo incluyen esa versión (`apps/api/src/auth.ts:76-79`). Por eso el borrado/reinicio no permite seguir adivinando la contraseña anterior y el siguiente inicio usa otra identidad de bloqueo. El intento que pierde la carrera puede no incrementar su contador propio de 5 porque la fila desapareció antes del `UPDATE` crudo (`security.ts:237-243`), pero sí incrementa el cupo de cuenta y su credencial ya quedó invalidada. Un atacante no autenticado no dispone de una ruta para provocar ese borrado.

### Regresión y evidencia

- Añadí al test existente un caso de frontera: parte de 29 fallos, borra las filas dentro de la verificación, exige que el fallo 30 recree el cupo con `lockedUntil` y comprueba que el intento 31 no llama al verificador.
- Antes del arreglo (`75c20b3f`, padre de `5815b56e`): `tests/intentos-borrados.test.ts` falla **3/3**; el caso nuevo devuelve `Error: P2025` en vez de `{ status: 400, message: "Incorrecta." }`.
- Después (`1a42e1f3` + la regresión): `tests/intentos-borrados.test.ts` pasa **3/3**.
- Cobertura relacionada ya existente: `tests/auth-lockout.test.ts` comprueba el tope de 30 por cuenta y `tests/password-account.test.ts` la carrera de dos cambios simultáneos contra API/PostgreSQL.

### Autoauditoría y límites

- Revisé los tres caminos: acierto con fila borrada, fallo ordinario con fila borrada y frontera 29→30→rechazo 31.
- Revisé cambio obligatorio, cambio propio, restablecimiento administrativo y marcado de cambio obligatorio. Todos invalidan credenciales mediante `authVersion`; el reinicio de intentos es posterior a una operación autorizada, no una ruta pública independiente.
- No cambié autenticación, permisos, mensajes, límites, base, migraciones ni código de producción; solo amplié la regresión y este informe.
- El doble unitario reproduce la desaparición de filas, no el planificador real de PostgreSQL. La carrera y los límites reales quedan a cargo de `verify` en CI. No se accedió a producción, Render, credenciales ni a la base de la tienda.

### Estado

`pnpm check` terminó con código 0: typecheck, ESLint, **112 archivos de prueba pasaron y 1 se omitió; 985 pruebas pasaron y 10 se omitieron**, y los builds web/API terminaron correctamente. Vite emitió la advertencia ya conocida por un chunk mayor de 500 kB; no es un fallo y esta auditoría no modifica el bundle. La rama solo se declarará lista después del push y de comprobar `verify`, `windows-installer` y `render-images` sobre el último commit.
