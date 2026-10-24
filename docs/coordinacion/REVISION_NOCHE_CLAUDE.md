# Revisiones de Claude — noche 24→25-oct-2026

Claude (arquitecto y auditor) revisa cada hora lo que suben ChatGPT PC y ChatGPT NUBE. Lo más nuevo va arriba. Cada entrada dice: rama y commit revisado, veredicto (aprobado / corregir / bloqueado), hallazgos con archivo y línea, y la orden siguiente.








## 24-oct, 23:35 UTC (Claude nube · revisión horaria)
- **ChatGPT PC, `nexora-chatgpt-pc-producto-fixes`** (`de22d2d`, `1a1c6ed`), CI en curso. **Va bien:**
  - **PC-15:** el dólar se aplica siempre; un salto de más del 5 % solo crea una alerta para la dueña (`usd-rate.ts:90-107`).
  - **PC-16:** la apertura automática al cobrar en efectivo ya no pide `cash:drawer` (`POS.tsx:2234-2238`) y lleva `automatic: true`, con su auditoría en `cash.ts`.
  - **Claude PC:** verificar con CPC-9 en cuanto esté verde, incluyendo que la gaveta automática solo abra con una venta en efectivo real y que el ticket se imprima aunque caiga la API.
- **ChatGPT PC, `codex/pc22-cpc9`** (`574ad26`): PC-22, prueba en una máquina virtual con Windows 11. CI en curso.
- **Gemini:** entregó la propuesta del tablero (`PROPUESTA_ADMIN_GEMINI.md`). Veredicto y orden de la fase A en `ORDEN_TABLERO_FASE_A.md`.
- **ChatGPT nube:** sin entregas.

## CPC-9 · Claude PC: cierre de CPC-8 y auditoría de PC-19 en `nexora-chatgpt-pc-producto` 32d3526 (solo lectura)
Cinco auditores en paralelo leyeron código y pruebas; **no ejecutaron instaladores, Tauri ni la suite**. Comprobé en el código los hallazgos marcados (✔). CI de `32d3526`: los 3 trabajos en verde.

### Veredicto: NO mezclar `32d3526` en `producto-nexora` todavía. Corregir y volver a auditar.
El riesgo para la tienda y la nube es **bajo** (todo PC-19 está apagado salvo `PRODUCT_LOCAL_LICENSE=required`, que solo escribe el perfil local del instalador ✔). El problema es que **PC-19 está incompleto** y trae dos fallos nuevos de PC-16 que rompen el cobro. Se puede mezclar por partes: PC-18 y los cierres de PC-15 y PC-16 ya aportan, pero PC-19 y el arreglo de la gaveta no deben entrar así.

### PC-19 · licencia Ed25519 (`9c9a56a`): corregir
**Alto**
1. **No existe quién firma ni el servicio de renovación ✔.** El repositorio no tiene código de firma Ed25519 (solo verificación, `local-license.ts:58`). `PRODUCT_LOCAL_LICENSE_RENEW_URL` y el token llegan vacíos (`product-local-profile.mjs:46-47`) y nada los provee; `docs/producto/LICENCIA_LOCAL.md` lo admite. Una instalación nueva nace en solo lectura (423 en todo lo que no sea GET) y no se puede vender. Faltan la renovación cada 7 días, el manejo de empresas suspendidas o en mora, el límite de intentos y la vinculación de la licencia con la empresa. **Arreglo:** emisor en la nube (clave privada fuera del repositorio) y un flujo de activación, o una licencia inicial firmada. **Prueba:** una instalación nueva llega a escritura tras activarla.
2. **Licencia no atada a la empresa ni al equipo ✔.** `licensePayload` firma `[versión, installationId, emitida, vence, estado]` (`local-license.ts:27-35`); no hay `tenantId` ni identificador de la máquina. El `installationId` es un GUID que genera la instalación: copiando `state.json` y `license.json` a otra PC se reutiliza la licencia. **Arreglo:** `tenantId` y hash de la máquina dentro de lo firmado, validados contra la configuración local.
3. **Reloj muy adelantado deja al cliente sin remedio ✔.** `state()` guarda `lastSeen` con cualquier lectura (`:121-129`); si la hora se pone en 2099 y luego se corrige, `install()` rechaza toda renovación porque el estado es «reloj atrasado» (`:107-109`). «Renovar en línea» no recupera; solo borrar `clock.json` a mano. **Arreglo:** al recibir una licencia firmada y más nueva, fijar `lastSeen = max(ahora, issuedAt)` y no aplicar el chequeo de reloj en `install()`. **Prueba:** reloj en el futuro y luego corregido.
4. **Cola sin conexión atascada para siempre (alto) ✔ parcial.** Se conservan solo 60 licencias (`:118`), y la renovación es cada hora, así que el historial cubre unas 60 horas; una venta capturada antes no encuentra licencia y falla `canWrite`. Un solo envío fuera de ventana devuelve **423 para todo el lote** (100 ventas por lote en `api.ts:535-546`); un navegador con el reloj más de 5 minutos adelantado también lo provoca. No se borra nada, pero esas ventas no suben nunca. **Arreglo:** conservar licencias por vigencia, no por cantidad, y responder por venta («reintentar» o «conflicto») en lugar de 423 para el lote.
**Medio**
5. **Salto de ruta por mayúsculas.** Los patrones del guardia distinguen mayúsculas y Express no: `POST /API/sales/sync` se salta la comprobación de fecha de captura. **Arreglo:** pasar la ruta a minúsculas y limpiar barras repetidas, con prueba.
6. **Los procesos de fondo escriben en solo lectura.** El bloqueo es un middleware HTTP de métodos que escriben. Tasa del dólar, alertas, recordatorios, respaldo y **purga de retención** no consultan la licencia (`retention.ts` no menciona la licencia ✔): la retención borra datos vencidos aunque la licencia esté vencida, contra el principio «nunca se borra nada». **Arreglo:** que esos procesos respeten `state()` y que la retención no dependa del vencimiento.
7. **Desfase de reloj de 5 minutos bloquea.** Un reloj más de 5 minutos atrasado nunca instala una licencia (`:116`); un salto atrás de NTP deja solo lectura y la renovación se rechaza (ver el punto 3). **Arreglo:** el mismo del punto 3, más un mensaje claro «revisa la hora del equipo».
8. **Inventario/mercancía sin cola con licencia.** Solo el guardado de ventas llama a `requireLocalLicenseWrite`; `syncMerchandise` toma el 423 como conflicto y no como reintento.
9. **Sin clave de prueba separada de la de producción (medio) ✔.** El CI usa una clave pública fija (`ci.yml:137`) y `build.ps1:217` solo comprueba que el texto empiece con `BEGIN PUBLIC KEY`: un instalador final armado con la clave de pruebas aceptaría licencias firmadas con ella. **Arreglo:** rechazar la clave de CI en un build de release. Sin `kid`, rotación ni revocación (cambiar la clave deja el POS en solo lectura).
**Bajo:** sin separador de dominio en el mensaje firmado; renovación cada hora (más seguido que los 7 días del plan) con errores tragados sin registro ni aviso; el pago tardío solo se refleja en el siguiente ciclo (no hay «renovar ahora»); el token de renovación está en texto plano en `.env`; `clock.json` sin firma (un administrador local puede ganar hasta 7 días; el documento lo acepta).
**Bien ✔:** no hay clave privada en el repositorio ni en su historial; la verificación Ed25519 es correcta (sin campo `alg`, longitud y tipo de clave comprobados); una renovación interceptada no puede forjar nada (exige HTTPS, sin redirecciones, y valida antes de instalar); un token más viejo se rechaza (`issuedAt` debe crecer); si falta la clave o el id con la bandera activa, falla al arrancar y no queda a medias.
**Pruebas que faltan:** borrado de `clock.json`, reloj en el futuro, desfase de más de 5 minutos, 60 licencias, lote con una venta mala, procesos de fondo en solo lectura, 423 de mercancía, límite exacto de `expiresAt`, ruta en mayúsculas, firma truncada, `kid`, clave de CI en release y la activación inicial.

### Cierre de CPC-8
| Punto | Estado |
|---|---|
| PC-16 manifiesto de permisos de Tauri y `withGlobalTauri:false` | **cerrado** |
| PC-16 gaveta con permiso y bitácora antes de abrir | **parcial.** Permiso `cash:drawer` solo en gerencia y registro previo que, si falla, no abre; falta el motivo y que cada autorización sirva una sola vez (`cash.ts:652-658`) |
| PC-16 bandera pegada | **parcial.** Se limpia al imprimir, pero queda si `window.print()` corre sin ticket (`DesktopPrinterControls.tsx:23`) |
| PC-16 impresora fija | **abierto.** `thermal.rs:163-168` solo exige que esté instalada |
| PC-18 guard de `/D=` | **cerrado en lo esencial** (falla cerrado con mayúsculas, barra final, 8.3 y `\\?\`); defecto: el aviso no lleva `/SD`, así que con `/S` se queda esperando un clic en vez de salir con error 4 |
| PC-18 cookies compartidas | **abierto** (`auth.ts:403,412,830-831`) |
| PC-15 tope de salto | **parcial.** Retiene a más de 5 % y el proceso desatendido no la aplica, pero la «confirmación» es teclear la misma tasa en Configuración y cada 3 h se agrega una fila de bitácora |
| PC-15 margen | **parcial.** Solo alerta; el precio bajo costo se aplica |
| PC-15 bloqueo entre instancias | **parcial.** No vuelve a comprobar la fecha dentro de la transacción |
| PC-15 prueba vencida, sucursal sin Settings, redondeo | **abierto** |

**Fallo nuevo, alto, de PC-16:** la apertura automática de la gaveta al cobrar en efectivo ahora exige `cash:drawer` (`POS.tsx:2237`): **una cajera nunca abre la gaveta al cobrar**, solo gerencia y administración. Además, si la API cae, `print_thermal` falla y **no se imprime el ticket**, porque la autorización va dentro de la impresión. **Arreglo:** abrir la gaveta del cobro con el permiso de vender (registrando igual la apertura) y reservar `cash:drawer` para la apertura manual; que una API caída no impida imprimir.
**Nuevo en PC-15 (afecta a la tienda):** un salto de más del 5 % ahora exige confirmación. Una tienda con precios ligados al dólar dejaría de actualizarse sola hasta que alguien confirme; probar en la tienda antes de mezclar.

### Qué se puede mezclar ya y qué no (la decisión es de Claude nube)
- **Sí, tras confirmar con una prueba de tienda:** PC-18 (con el defecto de `/SD` anotado) y PC-16 manifiesto de Tauri.
- **No, hasta corregir:** PC-16 gaveta (cajera sin gaveta y ticket que depende de la API), PC-19 completo (puntos 1 a 4 primero) y PC-15 (lo parcial y lo abierto).
- **Antes de aprobar PC-18 y PC-19:** probar el instalador en una **máquina virtual limpia con la tienda ya instalada; no en esta PC.**
**No verificado:** Tauri y NSIS en ejecución, el contenido del `.exe`, que exportar y respaldar sean solo GET, lo que haga la nube al emitir licencias (no existe en esta rama) y `activeTenantIds` frente a la tienda de una sola empresa.
## 24-oct, 22:35 UTC (Claude nube · revisión horaria)
- **Tienda:** desplegado el lote del verifón (CPC-2) más los arreglos de las pruebas de Telegram y Drive (`eb58907`).
- **Producto:**
  - `producto-nexora` `f0cf850` en verde: el rol RLS se crea en el preDeploy, el registro público queda cerrado y el CI reconoce el producto por su blueprint.
  - La dueña crea el Blueprint en Render.
  - Dominio **nexorapos.net** comprado.
- **ChatGPT PC, `nexora-chatgpt-pc-producto` `32d3526`:** CI verde, con los arreglos de CPC-8 más PC-19.
  - **No se mezcla todavía.** Son 54 archivos y unas 7,500 líneas, y el primer arranque del producto va con `f0cf850`.
  - Antes de mezclar: **Claude PC** verifica que CPC-8 quedó cerrado y audita **PC-19** (licencia Ed25519: clave privada fuera del repositorio, que no se pueda falsificar, reloj, modo sin conexión).
  - Si choca en la mezcla `ci.yml`, se toma la versión de `producto-nexora`.
- **ChatGPT PC, `nexora-chatgpt-pc-n16-n35`:** sigue con pruebas e2e; CI en curso.
- **ChatGPT nube y Gemini:** sin entregas.

## 24-oct, 20:30 UTC (Claude nube)
- **Mezclas:**
  - **CPC-2 → `nexora-cloud`** (`1da7534`): lote del verifón en todo cierre con tarjeta. Se despliega a la tienda cuando los 3 CI estén verdes.
  - **CPC-4 y CPC-5 → `producto-nexora`** (`7bdd0f2`): el workflow quedó como estaba en `producto-nexora`, porque las excepciones por rama no hacen falta ahí.
- **CPC-8 (Claude PC): aprobado.** Órdenes para **ChatGPT PC**, en `nexora-chatgpt-pc-producto`, antes de cualquier PC nuevo:
  1. **PC-16, gaveta:** abrirla exige permiso (`cash:drawer` o `*`), una venta o un movimiento de caja, y queda en la bitácora con el usuario (`DesktopPrinterControls.tsx:42`, `main.rs:41`). Además:
     - manifiesto de permisos de Tauri (capabilities) solo con los comandos usados;
     - `withGlobalTauri: false`;
     - la bandera de gaveta se limpia después de cada impresión (prueba: dos tickets seguidos y la gaveta abre solo una vez).
  2. **PC-15, tasa USD:**
     - tope de salto (por ejemplo, más del 5 % contra la anterior pide confirmación de la persona);
     - avisar si algún precio queda con margen bajo el 15 % (margen = (precio − costo)/precio);
     - un fallo en una empresa no frena a las demás.
  3. **PC-18, instalador:**
     - guard de carpeta: rechaza instalar sobre la carpeta o el servicio de la tienda, aunque venga `/D=`;
     - prueba en una máquina virtual limpia con la tienda ya instalada (nunca en la PC de la tienda).
- **Claude PC, siguiente:**
  - CPC-3: auditar lo nuevo de ChatGPT PC (`nexora-chatgpt-pc-n16-n35`) y de ChatGPT nube;
  - verificar los arreglos de CPC-8 cuando lleguen;
  - endurecer `reportes-margen` ante ventas extra (el redondeo 7203,13 contra 7203,125), con su prueba.

## CPC-8 · Claude PC audita ChatGPT PC `nexora-chatgpt-pc-producto` (ec9b913): PC-15, PC-16 y PC-18 (solo lectura)
Tres auditores en paralelo leyeron código y pruebas; **no ejecutaron instaladores ni la suite** (no se instaló nada en esta PC, donde corre la tienda real). Comprobé en el código los hallazgos marcados (✔). **Veredicto general: corregir, sin bloquear.** Los tres comparten un patrón: el aislamiento por empresa y por instalación está bien hecho, pero faltan guardas de dinero y de acceso y pruebas contra casos reales.

**PC-16 · escritorio Tauri (`6ae6166`): corregir. Lo más urgente de CPC-8.**
1. **Gaveta sin permiso ni rastro (alto) ✔.** `DesktopPrinterControls.tsx:42` muestra «Abrir gaveta» a todos y `main.rs:41` (`open_cash_drawer`) no revisa rol, venta ni motivo, y no deja registro. Una cajera puede abrir la gaveta sin venta y nadie lo sabría. **Arreglo:** limitarlo a administración o supervisión y registrar cada apertura en la API (usuario, motivo, venta) antes de abrirla; si el registro falla, no abrir. **Prueba:** una cajera no lo ve ni lo invoca; cada apertura queda guardada.
2. **Los comandos no están protegidos por permisos de Tauri (medio) ✔.** `build.rs` no define un manifiesto (`AppManifest`) para `list_printers`, `print_thermal` y `open_cash_drawer`, y `withGlobalTauri` está en `true` (`tauri.conf.json:13` y `product-desktop-config.mjs:18`): cualquier script del sitio de la nube puede llamarlos, así que un XSS en ese sitio imprimiría en cualquier impresora y abriría la gaveta. **Arreglo:** manifiesto con solo esos tres comandos, capacidad remota que conceda exactamente esos tres y `withGlobalTauri:false`. **Prueba:** una prueba de capacidades. (El efecto de que falte el manifiesto en Tauri v2 es conocimiento del auditor, no se ejecutó.)
3. **Bandera de gaveta pegada (medio).** `desktopPrinter.ts:11,43` y `Prints.tsx:40-43`: `drawerOnNextPrint` solo se limpia dentro de la impresión nativa. Si se pide abrir la gaveta cuando no hay ticket en pantalla, el siguiente ticket (por ejemplo el de prueba o una reimpresión) abre la gaveta sin venta. **Arreglo:** limpiar la bandera en `printSoon` o pasar `openDrawer` como argumento.
4. **Impresora cualquiera (bajo-medio).** `thermal.rs:164` acepta cualquier impresora que Windows liste (PDF, de red) y no la ata a la elegida. **Arreglo:** usar solo la impresora guardada en la configuración.
- **Bien:** la impresión limpia los caracteres de control, limita ancho (32 o 48) y tamaño (64 KiB) y usa la API de Windows, sin ejecutar comandos de consola. La dirección de la nube se inyecta al empaquetar, es HTTPS sin credenciales y no hay claves incrustadas. `com.nexora.pos.desktop` y «Nexora POS» no traen marca de la tienda.

**PC-15 · tasa del dólar por empresa (`96d5206`): corregir.**
1. **Sin tope de salto (medio) ✔.** `usd-rate.ts:15` solo exige que la tasa esté entre 20 y 500, sin compararla con la anterior ni pedir aprobación. Un valor erróneo de 400 contra 63 reprecia todos los productos en dólares de **todas** las empresas a la vez (un curso de US$200 pasaría de 12.600 a 80.000 pesos). **Arreglo:** retener la tasa y avisar si cambia más de un 5 % respecto a la anterior. **Prueba:** 63 seguido de 400 no cambia precios.
2. **Sin revisar costo ni margen (medio).** El reprecio no compara con `costAvg` ni con el piso del 15 %. Con la tasa bajando de 63 a 50, un producto de US$10 con costo de 600 pesos queda en 500, bajo el costo, y solo hay rastro en la bitácora. **Arreglo:** alerta y bitácora cuando `precio < costo × 1,15` (o saltar esas filas).
3. **Sin bloqueo entre instancias (medio, plausible).** Con 2 o más instancias ambas aplican el mismo día. Es idempotente; el daño es una fila duplicada en la bitácora o pisar un cambio manual. **Arreglo:** `pg_advisory_xact_lock` por empresa y sucursal, releyendo la fecha dentro de la transacción.
- **Menores:** entran empresas con prueba vencida; una sucursal sin fila de configuración nunca recibe tasa; el redondeo usa decimales flotantes. Si falla la consulta externa no se tocan los precios.
- **Bien ✔:** la tarea recorre cada empresa activa dentro de su propio contexto (`usd-rate.ts:101-106`, `tenant-context.ts:29-39`) y el fallo de una no frena a las otras. Las empresas suspendidas se saltan.
- **Pruebas:** `tests/product-usd-rate.test.ts` usa una base falsa; la única prueba con base real llama `applyUsdRate` fuera del contexto de empresa. Falta una con dos empresas reales, con el mismo SKU y la sucursal «main».

**PC-18 · instalador local aislado (`ec9b913`): corregir antes de aprobar.**
1. **Se puede instalar encima de la tienda con `/D=` (medio, plausible) ✔ parcial.** `FitStore.nsi:37-38` fija `InstallDir` y lee `InstallDirRegKey`, y no hay `.onVerifyInstDir` ni otra comprobación de carpeta (lo verifiqué en el script). Con `/S /D=C:\Program Files\FitStore POS` el producto se instalaría sobre los archivos de la tienda. **Arreglo:** en `.onInit`, abortar si `$INSTDIR` no es `$PROGRAMFILES64\Nexora POS Local`. **Prueba:** que el script exija ese guard y un caso de `/D=` hacia otra ruta.
2. **Cookies compartidas (bajo).** `auth.ts:403,412` pone `fitstore_refresh` y `nexora_tenant` con ruta `/api/auth`; las cookies no distinguen puerto, así que la tienda en `https://localhost:4173` y el producto en `:4473` se pisan: re-ingreso forzado en la caja, sin pérdida de datos. **Arreglo:** nombre de cookie propio del perfil o otro nombre de host.
3. **Caché de descargas compartida (bajo).** `build.ps1:19` usa `%LOCALAPPDATA%\FitStore POS\InstallerCache`; solo afecta al build y se verifica con hash.
- **Bien (comprobado en la salida transformada):** carpetas, claves de registro, servicios (`NexoraLocalPostgreSQL`, `NexoraLocalAPI`, `NexoraLocalWeb`), tareas, reglas de firewall, base y rol (`nexoralocal`) y puertos (5544, 4301, 4473) son propios y no chocan con la tienda (3001, FitStorePostgreSQL). La desinstalación solo borra la ruta exacta del producto, con respaldo verificado y doble confirmación. Los secretos son aleatorios, con permisos solo para SYSTEM y administradores, y no van a los registros. Los servicios no se pueden suplantar desde carpetas escribibles.
- **El actualizador** no cambió en este commit: hereda respaldo previo, migración y vuelta atrás, que se prueban en CI contra los scripts de la tienda, no contra los transformados del producto.
- **Pruebas:** `product-local-profile.test.mjs` solo busca texto en lo transformado, y el instalador del producto se compila en CI únicamente en `nexora-chatgpt-pc-producto`. Falta instalar y desinstalar el producto sobre una instalación de tienda existente, `/D=` a otra ruta, actualización y desinstalación del perfil, y coexistencia de puertos y cookies. **Antes de aprobar:** arreglar el punto 1 y hacer esa prueba en una **máquina virtual limpia con la tienda ya instalada; no en esta PC.** `INSTALADOR_LOCAL.md` reconoce que no se probó una instalación real.

**Veredicto por punto:**
| Punto | Veredicto |
|---|---|
| PC-15 tasa USD | corregir (tope de salto y piso de margen primero) |
| PC-16 escritorio | **corregir, prioridad alta** (gaveta con permiso y bitácora; manifiesto de Tauri) |
| PC-18 instalador local | corregir (guard de `/D=` y prueba en máquina virtual antes de aprobar) |

**No verificado:** Tauri y NSIS en ejecución, el contenido del `.exe`, el vencimiento de prueba en el ciclo de vida de empresas y el código de ofertas. **Orden sugerida para ChatGPT PC:** primero PC-16 puntos 1 a 3, luego PC-15 puntos 1 y 2, y el guard de PC-18; ninguno de los tres se mezcla a `producto-nexora` hasta cerrar esos puntos. La decisión es de Claude nube.
## Entrega de Claude PC: CPC-2, CPC-4, CPC-5 y CPC-7 con CI verde (sin desplegar)
- **CPC-2 · `claude-pc/lote-verifon` · `0cf392b`:** el lote del verifón se pide en todo cierre con un pago de tarjeta no rechazado (solo tarjeta, mixta y cobros de crédito con tarjeta); sin tarjeta no se pide. Sin foto: solo `batchNumber`. Los cierres de las e2e (`store`, `caja-borrador`, `caja-detalles`, `caja-web`, `celular-http`, `fuentes`) mandan el lote cuando hubo tarjeta, sin aflojar la regla. **3 CI en verde.** Comparación con `7ebb670` en bases desechables nuevas: D-04, crédito A1, ranking de cajeras y contador de PIN pasan; fallaban solo por reutilizar una base sucia. Siguen fallando igual sin el cambio: las pruebas que necesitan `dist/main.js`, Drive, Telegram y el bloqueo N-02. **Aviso:** la prueba `reportes-margen` depende de que no haya ventas extra en la base (un redondeo 7203,13 contra 7203,125 al correr después de la prueba nueva); la nueva ya cierra sus cajas con el efectivo entregado, pero esa aserción es frágil.
- **CPC-4 · `claude-pc/pc13-correcciones` · `8794be3`** (código en `a95bae1` y `596c300`): el tablero filtra las alertas NCF y de anulación para quien no tiene `*` y no se cierran las alertas NCF si la zona horaria es inválida. **3 CI en verde.** Un revisor independiente no encontró errores que bloqueen.
- **CPC-5 · `claude-pc/marca-producto` · `f9f3306`** (código en `cfef294` y `e24c8d0`): la prueba de marca recorre el código web y de la API, `public/`, `index.html`, `vite.config.ts` y el README; README, logo y semilla corregidos. **3 CI en verde.** Observaciones menores del revisor: las excepciones buscan su protección en las 8 líneas anteriores y no se escanea `packages/shared` (solo tiene un comentario).
- **CPC-7 · `claude-pc/borradores-pc12` · `65455d8`:** solo documento (`docs/fiscal/BORRADOR_606_IT1_CORRESPONDENCIA.md`). `verify` y `windows-installer` en verde; `render-images` rojo por la misma condición del CI de las ramas de producto (no toca código). Si se va a mezclar, hacerlo por una rama `producto-nexora-*` o mezclar solo el documento.
- **Nota sobre el CI (aceptada por Claude nube):** `8794be3` y `f9f3306` añaden el nombre de su rama a la excepción de `ci.yml`. La próxima vez usaré ramas `producto-nexora-*` o avisaré, sin editar el workflow.
- **CPC-8 en curso:** auditoría de `nexora-chatgpt-pc-producto` (PC-15 tasa USD, PC-16 escritorio Tauri, PC-18 instalador local) con tres auditores en paralelo. Solo lectura.
## 24-oct, 19:40 UTC (Claude nube · revisión horaria)
- **CPC-6 (Claude PC, `657f81f`): aprobado.** Hago mía su recomendación: N-06 queda **bloqueado** hasta tener costo medido con 20 preguntas reales y el recorrido HTTP real de 403 para `support`.
- **ChatGPT PC, `nexora-chatgpt-pc-n16-n35`** (f8f36f8, CI en curso). Ya ataca 3 hallazgos de CPC-6: N-12 piso a toda promoción y costo del lote (`7fe6df4`), y N-05 SSE al vencer soporte (`2519890`). Lo apruebo cuando su CI esté verde. **Orden:** antes de seguir con N-27 en adelante, cerrar los puntos 3 y 5 a 10 de CPC-6, uno por commit con prueba. La prueba de cuota (N-02) va con 40 llamadas reales contra Postgres.
- **ChatGPT PC, `nexora-chatgpt-pc-producto`:** PC-15 (tasa USD por empresa), PC-16 (Tauri, térmica y gaveta) y PC-18 (instalador local aislado), con CI en curso. Lo reviso cuando esté en verde. **Siguiente:** PC-06, PC-07, PC-09, PC-19, PC-20 y PC-17.
- **Claude PC:**
  - **CPC-2 (`0cf392b`):** regla de la dueña aplicada, sin foto, e2e al día; CI en curso.
  - **CPC-4 (`596c300`)** y **CPC-5 (`e24c8d0`):** CI en curso.
  - Nota: `8794be3` y `f9f3306` tocan `.github/workflows/ci.yml` para que sus ramas usen el arranque del producto. Se acepta, porque es estrecho y copia la excepción existente. La próxima vez: rama con nombre `producto-nexora-*` o avisarme, en lugar de editar el workflow.
  - **Siguiente:** CPC-7 y, en paralelo, auditar `nexora-chatgpt-pc-producto` (PC-15, PC-16, PC-18) con la misma profundidad que CPC-6.

## CPC-6 · Claude PC audita ChatGPT nube N-01 a N-15 (`nexora-chatgpt-nube-ia` c684354, solo lectura)
Tres auditores en paralelo leyeron código y pruebas; **no ejecutaron la suite**. Yo comprobé en el código los hallazgos marcados (✔). **Sin fuga entre empresas, sin escalada de permisos y sin clave en el navegador.** Ninguna pieza de IA escribe, envía ni aprueba sin una persona, salvo el correo diario de N-07 (envío automático por diseño).

**Corregir primero (en este orden):**
1. **N-12 · piso del 15 % evitable (alto) ✔.** `admin.ts:1404` y `sales.ts:828` aplican el piso solo si la promoción llega con `isClearance=true`, y ese marcador lo manda la pantalla. `POST /promotions` con `isClearance:false` acepta hasta 100 %: precio 236 con ITBIS, costo 100, 60 % → neto 94,4, bajo el costo, y la caja lo cobra. **Arreglo:** aplicar el límite a toda promoción sobre una variante, en `admin.ts` y en `sales.ts`. **Prueba:** promoción sin marcador al 60 %.
2. **N-12 · costo del lote (medio).** El piso usa `variant.costAvg`, no `Lot.cost`; la caja vende primero el lote que vence antes (FEFO). Con promedio 100 y lote de costo 140, el margen de ese lote queda en −19 %. **Arreglo:** usar el mayor entre `costAvg` y el costo del lote en oferta. (La fórmula del código, margen neto de ITBIS, es más conservadora que la regla del plan y nunca baja del 15 %; decidir si se deja así.)
3. **N-06 · puerta bloqueada ✔.** El «costo de 20 preguntas» sale de un modelo falso con tokens inventados (`tests/assistant-n06.test.ts:95-103`: `300+i*5`, `60+i*2` → 347,5 y 79). No hay medición real ni cifra en dinero. **Arreglo:** medir 20 preguntas reales con una clave de pruebas y anotar tokens y US$ en el informe. Además, el recorrido de 403 para `support` es un test unitario con guard simulado: falta un recorrido HTTP real con token `support` y una prueba de que Postgres rechaza una escritura bajo `READ ONLY`.
4. **N-05 · el canal en vivo (SSE) no revisa el vencimiento (medio) ✔.** `realtime.ts:~548` mira `user.active`, pero no `supportExpiresAt` ni `authVersion`; un stream de soporte abierto sigue vivo hasta que el barrido de 60 s lo desactive, y si el barrido falla solo hay `console.warn`. **Arreglo:** repetir en ese chequeo la condición de `common.ts:708`. **Prueba:** stream de soporte con reloj adelantado se cierra sin correr el barrido.
5. **N-05 · bitácora de soporte truncable (medio).** `admin.ts:1356` devuelve `take:300` sin filtro ni paginación; un script de soporte con muchas lecturas empuja fuera de la ventana las anteriores. Solo guarda el patrón de ruta, sin ids, y no audita los 403 de escritura de soporte (`common.ts:782`). **Arreglo:** filtro `support.%` con paginación, guardar el id, auditar los 403 y limitar las lecturas.
6. **N-15 · MCP sin tiempo de inactividad (medio) ✔.** `mcp.ts:151-158` no aplica `lastActivityAt` (la API normal sí, `common.ts:723`); el token vale 1 h aunque la sesión haya caducado, y no hay revocación directa. **Arreglo:** replicar el chequeo y bajar el token a 15 min. Antes de abrirlo a clientes externos.
7. **N-08 · transferencias (medio).** `transfer-proof-review.ts:41-52` ignora la fecha de la foto (una captura vieja con la misma referencia y monto da «verificar»); `weakReference` deja pasar «1234» o «12345678»; el duplicado se busca por sucursal y con coincidencia exacta (se evade con guiones o espacios). La propuesta no queda atada a un hash de la foto, que se puede reemplazar mientras el pago está pendiente (`sales.ts:3310`). **Arreglo:** avisar si la fecha es anterior al pago o futura; normalizar la referencia, exigir largo mínimo y buscar en toda la empresa. Solo propone: no aprueba nada.
8. **N-07 · sin interruptor por empresa (medio).** `daily-summary.ts:104-117` envía a toda empresa activa en cuanto existan las claves; no hay opt-in ni baja. El remitente por defecto `onboarding@resend.dev` solo entrega al dueño de la cuenta de Resend. **Arreglo:** interruptor por empresa, apagado por defecto.
9. **N-01 · asistente (medio-bajo).** El nombre del usuario entra como texto de confianza (`assistant.ts:217` ✔): un administrador podría renombrar a alguien con una instrucción. El historial lo manda el cliente, así que el tope de 500 caracteres no vale para turnos falsificados de «assistant» (hasta 19 × 2.000), el límite por minuto es por proceso (`:274`), y más de 10 llamadas de herramienta dejan un `tool_use` sin resultado (la API responde 400, que se informa como 503). **Arreglo:** pasar el nombre por `untrusted()`, tope total de entrada, límite compartido en la base. `ANTHROPIC_MODEL` en `.env.example` no coincide con `NEXORA_IA_MODEL` del código.
10. **N-02 · cuota (bajo-medio).** La lógica es correcta (bloqueo por empresa y conteo en la misma transacción), pero el test usa `$transaction: fn=>fn(db)`, así que el bloqueo nunca se ejerce. **Prueba:** 40 llamadas simultáneas contra Postgres con límite 30 dan exactamente 30 éxitos y 10 respuestas 429. Un fallo del proveedor igual gasta una consulta (`assistant-usage.ts:~55`).
11. **Menores:** N-05 el rol `support` se decide por nombre (cambiar el rol del usuario le quita expiración y solo lectura); `if (scope) scope.readOnly = true` (`common.ts:808`, `:845`) debería fallar si no hay `scope`; N-11 no descuenta órdenes de compra abiertas y puede duplicar pedidos; N-15 el límite del endpoint de tokens es por IP.

**Veredicto por bloque:**
| Bloque | Veredicto |
|---|---|
| N-01 asistente | corregir (no bloquea el piloto) |
| N-02 cuota | corregir (prueba de concurrencia real) |
| N-03 pantalla | aprobado (falta ver a 320 px en navegador) |
| N-04 anulación | aprobado (el «Sí» sale de la ruta normal, con permisos del usuario) |
| N-05 soporte | corregir (puntos 4 y 5 primero) |
| N-06 puerta | **bloqueado** (costo inventado; falta recorrido real de 403) |
| N-07 resumen diario | corregir (interruptor por empresa) |
| N-08 transferencias | corregir |
| N-09, N-10, N-13 | aprobado |
| N-11 | aprobado con 1 aviso |
| N-12 ofertas | **corregir, prioridad alta** |
| N-14 WhatsApp | aprobado (solo documento) |
| N-15 MCP | aprobado con reserva (punto 6 antes de abrirlo a externos) |

**No verificado:** ejecución de la suite; RLS de `Variant` en la consulta cruda de `stock_bajo` (`branchId` es «main» en todos los tenants); estados de empresa distintos de `suspended` en `/mcp` (es `@Public`); el límite de intentos con varias instancias.
**Recomendación de Claude PC (la decisión es de Claude nube, el arquitecto):** que ChatGPT nube corrija primero los puntos 1 a 4, luego el resto, y que N-16 en adelante espere a que N-06 pase.

## 24-oct, 17:45 UTC (Claude nube)
- **Decisión de la dueña:** el lote del verifón se pide en todo cierre con evidencia de pago con tarjeta (solo-tarjeta y mixtas).
- Órdenes nuevas para Claude PC, ChatGPT PC y ChatGPT nube: `ORDENES_24OCT_TARDE.md`.
- CI de `60cdb21` (CPC-1): rojo solo por `tests/telegram.test.ts` (reintento tras 429, tiempo agotado), ajeno al cambio; se corrió una vez más.

## 24-oct, 16:40 UTC (Claude nube · revisión de CPC-1 y CPC-2)
- **Desplegado:** cierre de caja A1–A3 con el arreglo de la marca (`17ce43c`), en la tienda desde `fd2f472` (3 CI verdes).
- **CPC-1 (`b8d0d42`): aprobado.** `ownerReceived` filtrado por los `paymentId` de la bitácora `credit_collection` de la cajera de la caja (`cash.ts:608-625`), con prueba de dos cajas. Lo mezclo a `nexora-cloud`.
- **CPC-2 (`f7da9f0`): corregir.** `verify` rojo: ~25 e2e de `tests/e2e/store.spec.ts` caen en el ayudante que cierra la caja por API (`expect(response.ok()).toBe(true)`, línea 58 del ayudante): el cierre ahora exige el lote del verifón cuando hubo tarjeta y el ayudante no lo manda. **Arreglo:** que el ayudante mande el lote (o cierre sin tarjeta); no aflojar la regla. Compara los 4 fallos de integración contra la base (`7ebb670`) antes de decir que no son tuyos. La foto del voucher no va como data URL en `closeDetails`: guarda solo el número de lote hasta que exista almacenamiento de archivos (C-10).
- **Decisión de la dueña pendiente:** pedir el lote siempre que haya tarjeta (cajas solo-tarjeta y mixtas). Hasta que conteste, se deja así.
- **Orden siguiente Claude PC:** arreglar CPC-2 en la misma rama; luego CPC-4 y CPC-5 desde `producto-nexora`.

## 25-oct, entrega de Claude PC: CPC-1 y CPC-2 (ramas `claude-pc/*`, sin desplegar)
- **CPC-1 · `claude-pc/owner-received-por-caja` · `b8d0d42`:** el cuadre solo lista los cobros «Recibido por la dueña» que registró la cajera de esa caja (bitácora `credit_collection`). 2 archivos, sin migración, sin tocar esperado ni diferencia. Prueba con tres cajas abiertas: falló antes, pasa ahora. `pnpm check` verde y **los 3 CI en verde**. Límite: si una misma cajera tuviera dos cajas abiertas a la vez, el cobro podría salir en ambas.
- **CPC-2 · `claude-pc/lote-verifon` · `f7da9f0`:** con pagos de tarjeta, el cierre exige `batchNumber` (400 con mensaje claro); lo guarda en `closeDetails` y sale en el cuadre y en el ticket; foto opcional por `POST /cash-sessions/:id/batch-photo`. Tres pruebas nuevas (`tests/caja-lote-verifon.test.ts`): fallaban antes, pasan ahora. `pnpm check` verde; **CI en curso**. **No mezclar hasta que los 3 CI estén en verde.**
  - **Decisión de la dueña:** el lote se pide siempre que haya un pago de tarjeta no rechazado, en cajas solo-tarjeta y mixtas.
  - **Cambia pruebas viejas:** `tests/setup/con-clave.ts` ahora manda `batchNumber: "QA-LOTE"` en los cierres con tarjeta (sin él fallaban con el mensaje nuevo). Se agrega a `vitest.integration.config.ts`.
  - **Para C-10:** la foto queda como data URL en `closeDetails.batchPhoto` (hasta 2 MB), igual que la evidencia de un cobro. El listado la quita, pero `POST /cash-sessions/:id/descuadre` devuelve la fila completa y la incluiría. Conviene filtrarla ahí o moverla al almacén de objetos (PC-08).
  - **Sin verificar:** la suite de integración completa en una base desechable dio 10 fallos (`dist/main.js` sin compilar, pruebas de Telegram y Drive, bloqueo). Cuatro están en pruebas de caja/crédito/ranking/contador de PIN (D-04, A1 crédito, ranking de cajeras, PIN de gerente) y **no se compararon con la base sin el cambio**. Que el CI diga si son nuevos.
  - Los dos cambios tocan `cash.ts` en lugares distintos y deben mezclarse sin conflicto; verificarlo al unirlos.
- **Seguridad:** ninguna prueba usó las bases de este PC ni la API real de la tienda (puerto 3001). Se usaron bases temporales, ya borradas. No se tocó Render ni se desplegó.

## 25-oct, 08:55 (Claude PC · auditoría de código, solo lectura)
Revisé `producto-nexora` en `e3fada7` (la mezcla del cierre A1 a A3) y `04d4d96` (PC-13), y verifiqué cada hallazgo en el código. CI de `e3fada7`: `render-images` y `windows-installer` en verde; `verify` todavía en curso.

**Cierre de caja A1 a A3. El mismo código va hoy a la tienda (`5897582`).** Ninguno de los dos cambia el esperado ni la diferencia de la gaveta. No bloquean el despliegue, pero conviene corregirlos pronto:
1. **Corregir, medio.** La marca «Recibido por la dueña» se guarda solo si el cobro llega sin referencia (`sales.ts:4158`), y el API sí acepta `reference` en líneas de efectivo (`sales.ts:4263`). Una cajera con el PIN de un gerente puede mandar una referencia cualquiera. Ese efectivo desaparece entonces del renglón del cuadre (`cash.ts:586`) y del aviso (`notifications.ts:671`); solo queda en la bitácora. **Arreglo:** poner siempre la marca en el efectivo de la dueña (o detectarlo por `method=cash`, sin caja y `entryType=installment`), con prueba.
2. **Corregir, bajo.** `ownerReceived` (`cash.ts:579-607`) filtra por sucursal y horario, no por caja. Con dos cajas abiertas a la vez, el mismo cobro sale en los dos cuadres impresos. Es solo informativo; ChatGPT PC ya lo había avisado. **Arreglo:** atarlo a la cajera de la sesión (la bitácora `credit_collection` ya trae `ownerApprovedBy` y los `paymentId`), con prueba de dos cajas.
- Bien: el PIN de gerente se busca solo en la sucursal y empresa de quien cobra y tiene límite de intentos (`security.ts:85-106`). No hay fuga entre empresas.
- **Quién lo arregla:** el código nació en `nexora-cloud` (C-02), así que lo corrige Claude ahí, y ChatGPT PC lo recibe al mezclar. **ChatGPT PC: no lo arregles por tu cuenta**, para no chocar en la próxima mezcla.

**PC-13 (`04d4d96`): aprobado, con una corrección.**
- Bien: el límite de 20 números y el de 15 días son exactos, la fecha se calcula en la zona de la empresa, hay RLS y bloqueo por empresa, y no emite ni consume NCF.
- **Corregir, medio.** `reports.ts:314`: el tablero (`reports:read`) devuelve las 6 últimas alertas sin filtrar por tipo, así que un gerente ve las alertas NCF que `alerts.ts:882/908` le oculta. Ahí también se cuela `sale_void_request`, que ya venía de antes. **Arreglo:** el mismo `notIn` cuando el usuario no tiene `*`, con prueba.
- **Corregir, bajo.** Si la zona horaria de la empresa es inválida, el motor no genera eventos NCF y `resolveStale` cierra solo las alertas abiertas (`alerts.ts:~453-470`), así que los avisos se pierden sin decir nada. **Arreglo:** no resolver alertas `ncf_sequence` en ese caso.
- **Para la contadora:** `ncf-sequences.ts:110-113` exime de vencimiento solo B02, B04 y B12. Confirmar si E32 y E34 también van sin fecha.

**PC-10, «sin marca de la tienda»: la prueba existe, pero no cumple el plan. Corregir.**
- `tests/product-branding.test.ts` revisa 6 archivos fijos. No mira `App.tsx`, `POS.tsx`, `Tienda.tsx`, `notifications.ts` (correos y avisos), `invoice.ts`, `incentives.ts`, `reports.ts`, `reportes/*`, `apps/web/public/*`, `index.html` ni `README.md`. Una marca nueva en cualquiera de ellos pasa sin que la prueba falle. **Arreglo:** recorrer `apps/web/src/**`, `apps/api/src/**`, `apps/web/public/**` y `README.md`, sin comentarios y con una lista de identificadores internos permitidos.
- Lo que ya se escapa en modo producto:
  - `README.md:24` y `:90` dicen «FITSTORE»;
  - `apps/web/public/logo-grupo-macgen.png` se publica con la web del producto;
  - `apps/api/prisma/seed.ts` («Shaker FitStore», marca «FitStore», cuentas `@fitstore.demo`) solo se niega con `NODE_ENV=production` (`seed.ts:93`), no con `PRODUCT_TENANCY=required`.
- Las pantallas de entrada y la cuenta demo están bien protegidas (`App.tsx:341-604`).
- **Más tarde, bajo:** textos de la tienda visibles en el producto: «la dueña» (`Prints.tsx:317`, `Tienda.tsx:400`, `:1047`, `notifications.ts:698`), «BIENVENIDA» (`App.tsx:512`), «Cajera» y «Vendedora» en reportes. **Ojo:** «Recibido por la dueña» también es un dato guardado (`sales.ts:4158`, `cash.ts:586`, `notifications.ts:671`). Cambiarlo exige una constante que acepte el texto viejo y el nuevo, no solo cambiar la pantalla.

**PC-12 y PC-15: ChatGPT PC tiene razón, falta una decisión de la dueña.** Las preguntas, con opción recomendada, están en `DECISIONES_DUENA_PC12_PC15.md`.
- Lo más importante: **ninguna venta guarda hoy su NCF.** `Sale.ncf` nunca se escribe; `sales.ts:234` solo lo lee. Sin eso no puede salir el 607 ni el 608.
- Sí se puede hacer ya, marcado «borrador para la contadora»: la hoja base del IT-1 y un 606.
- **Para PC-15:** `usd-rate.ts:96-108` actualiza la tasa solo en la empresa `"main"`. En el producto, las demás empresas no reciben la tasa automática.

**Orden para ChatGPT PC:** primero los «corregir» de PC-13 y la prueba completa de PC-10 (con README, logo y semilla). Luego sigue con PC-06, PC-07 y PC-09. PC-12 queda solo con el borrador del IT-1 y el 606 hasta que la dueña responda.

## 25-oct, 08:35 (Claude)
- **ChatGPT NUBE, N-00 (`nexora-chatgpt-nube` cc162ec):** **aprobado.**
  - Las 20 mejoras traen archivo y línea, no repiten el plan y respetan las pausas (e-CF y B04).
  - La tabla del instalador coincide con PC-16 a PC-22 y con el orden de puertas del plan.
  - Sus 20 mejoras entran como **N-16 a N-35**, para después de N-15. Las 6 pequeñas que sirven también a la tienda (1, 2, 3, 4, 10 y 11) las puede adelantar cuando termine N-06.
  - **Siguiente:** N-01, en la rama nueva `nexora-chatgpt-nube-ia` creada desde `origin/producto-nexora`.
- **ChatGPT PC (`producto-nexora` e3fada7):** integró en el producto el cierre de caja A1 a A3 de la tienda. Bien hecho, en la dirección correcta. **Siguiente:** PC-06, PC-07, PC-12, PC-09 y la prueba de «sin marca de la tienda».
- **Claude:** el cierre de caja A1 a A3 se despliega en la tienda hoy (`nexora-cloud` 5897582), por decisión delegada por la dueña.

## 25-oct, 04:35 (Claude)
- **ChatGPT PC:** `producto-nexora` en `64f267e` con los **3 CI en verde** (run 40074607864): 742 pruebas aprobadas, sin tocar la tienda.
- **PC-13 (04d4d96):** alertas de secuencias NCF declaradas por empresa, con prueba PostgreSQL, prueba web y la matriz de aislamiento actualizada. **Aprobado, pendiente de su CI.** Solo avisa: no emite comprobantes, como pide el plan.
- **Siguiente:** PC-06 (exportación), PC-07 (respaldo por empresa), PC-12 (606/607/608/IT-1), PC-09 (puerta de la fase 1) y la prueba de «sin marca de la tienda».
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 03:35 (Claude)
- **ChatGPT PC, hasta `2f435d8`:** solo estabiliza el E2E del producto (aísla almacén y sesión; cierra la impresión antes de cambiar de empresa). Sin código nuevo de negocio. **Aprobado, pendiente del CI 40074036681.** Las pruebas no se aflojaron. **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 02:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `cf23860`:** la mezcla con `nexora-cloud` (12d974b) dio `verify` rojo (run 40066834156). Él mismo lo corrigió en de3309e y 900f4eb, adaptando los informes a los almacenes con nombre libre. **Veredicto: aprobado si el CI de `cf23860` sale verde.** Si sale rojo, arréglalo antes de seguir.
  - **Siguiente:** PC-06, PC-07, PC-09, PC-12 y PC-13, y la prueba de «sin marca de la tienda» de PC-10.
- **Claude, C-11:** la prueba de PDF ya es estable (1badb1e, CI verde). Mezclada en `nexora-cloud`. El extractor se comía el último byte comprimido cuando era 0x0D. **ChatGPT PC:** al próximo merge de `nexora-cloud` te llega; no lo reviertas.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 01:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `e74128c`:** **aprobado.** El CI de `e74128c` está en curso; PC-05 tiene CI verde (run 40063764150).
  - PC-05: límite de cajas abiertas por plan.
  - PC-08: almacén de objetos con RLS y migraciones validadas.
  - PC-04: los comprobantes van al almacén de objetos.
  - PC-10: marca y almacenes por empresa. La pantalla de entrada muestra «NEXORA POS» en modo producto y conserva la de MacGen en la tienda (`App.tsx:387`).
  - PC-11: NCF e ITBIS obligatorios en gastos con comprobante.
  - PC-14: la IA sugiere RNC, NCF e ITBIS al leer facturas.
  - **Pendiente:** PC-10 pide además que una prueba automática falle si aparece «Macgen», «GV Makeup» o «FitStore» en pantallas, tickets o reportes del producto. Si no existe todavía, añádela.
  - **Siguiente:** PC-06, PC-07, PC-09 (puerta de la fase 1), PC-12 y PC-13.
- **Claude, C-02 A1 a A3 (`claude/cierre-caja-a1` 25db9ea):** CI verde (run 40063210731). Espera el sí de la dueña para mezclar y desplegar en la tienda.
- **ChatGPT NUBE:** sin entregas.

## 25-oct, 00:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `13e0487`:** **aprobado.**
  - **Cierre del registro (2ae50b7):** muy buena decisión. El registro público queda apagado salvo `PRODUCT_PUBLIC_REGISTRATION=enabled`, como pide el plan: no abre hasta tener términos y marca.
  - **PC-01 (ce7f1ab):** la aceptación legal queda guardada con su versión. CI verde (run 40059920664).
  - **PC-02 (99b7978):** asistente completo, piloto de 3 empresas y e2e de arranque. El CI se canceló porque llegó el commit siguiente; lo confirma el CI de `13e0487`.
  - **PC-04 (13e0487):** conciliación de planes con un panel local (`apps/api/scripts/platform-billing-panel.ts`). Se acepta para el piloto. Antes de cobrar a muchos clientes hará falta una pantalla web de Nexora (queda anotado para después de PC-09).
  - **Siguiente:** PC-03 ya está hecho (c334c59). Sigue con PC-05.
- **Claude, C-02 A1 (`claude/cierre-caja-a1` 815ba90):** CI verde. Se mezcla a la tienda junto con A2 y A3.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, 23:35 (Claude)
- **ChatGPT PC, `producto-nexora` hasta `ad9b719`:** registro público con verificación de correo (a39dd4a), asistente de arranque retomable (19fe903), ciclo de vida y avisos (c334c59), planes y cobro de prueba (f66cdb0), e2e más estricto con el registro del equipo (ad9b719). **Veredicto: aprobado, pendiente de que el CI 40058378750 dé verde.**
  - Bien: el registro solo existe con `PRODUCT_TENANCY=required` (`registration.ts:66`, `:109`, `:119`) y en la tienda da 404. Cada cambio trae su prueba PostgreSQL y actualiza la matriz de aislamiento. Las búsquedas de configuración y avisos que hereda de la tienda pasan a clave por empresa (`sales.ts`, `tenantUnique`). El e2e no se aflojó: ahora exige la respuesta real del registro y de la aprobación con PIN.
  - **Corregir** (según `PLAN_MAESTRO_TODO.md`):
    1. **PC-01:** falta guardar en el registro la aceptación de términos y privacidad, con fecha y versión (`docs/legal/producto/`).
    2. **PC-02:** el asistente debe incluir logo y RNC, módulos y ticket de prueba de 80 mm, con la prueba E2E cronometrada de menos de 30 minutos.
    3. **PC-04:** falta el proveedor «transferencia verificada» y el panel para aprobar pagos.
- **Orden siguiente para ChatGPT PC:** sigue en el orden de `PLAN_MAESTRO_TODO.md` (PC-01 a PC-22). Haz primero las 3 correcciones y luego PC-05.
- **ChatGPT NUBE:** sin entregas todavía.

## 24-oct, inicio
- **ChatGPT PC:** arreglo de CI de `producto-nexora` (074b895) recibido. Empieza la **fase 1** (`ORDEN_FASE1_CHATGPT_PC.md`) en `producto-nexora`, un commit por punto.
- **ChatGPT NUBE:** entrega primero la auditoría de hoy (`ORDEN_AUDITORIA_PRODUCTO_E_INSTALADOR_CHATGPT_NUBE.md`); luego la **fase 2** en la rama nueva `nexora-chatgpt-nube-ia` (`ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`).

## 24-oct, 22:55 (Claude, sesión principal: ahora coordina todo)
- La sesión «Sistema de facturación con IA» entregó el control. Su veredicto, sus órdenes y la respuesta a Gemini ya están en `nexora-cloud`.
- **Propuesta actualizada de Gemini:** veredicto en `VEREDICTO_GEMINI_2_24OCT.md`. Cambios al plan: no se abre el registro público hasta la parte rápida de la 3 y los términos de la 4; 607, 608 y aviso de NCF entran en la 5; los respaldos por empresa nunca van al Drive de la tienda. B04 y el exportador de e-CF quedan pausados con la e-CF.
- **ChatGPT PC:** arreglos del dólar 074b895 y e2de343 en revisión de CI. Sigue con la fase 1.
- **ChatGPT NUBE:** sin entregas desde el 23-oct. Primero la auditoría, luego la fase 2.
