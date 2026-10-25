# Prueba en Windows limpio (PC-18 y PC-22): guía para ejecutarla y guardar evidencia

**Para:** la dueña y un técnico. **Estado:** escrita el 25-oct-2026 solo leyendo documentos y código. **Nada de esto se ha ejecutado todavía.**
**Rama base:** `nexora-chatgpt-pc-producto-fixes` (`1a1c6ed`). Guion automático de ChatGPT PC: rama `origin/codex/pc22-cpc9`, archivo `instalador/tests/Windows11-Coexistence.ps1`.
**Lista a actualizar con los resultados:** `docs/piloto/LISTO_PARA_VENDER.md` en la rama `origin/claude-pc/piloto` (este documento NO la edita).

---

## 1. Por qué debe ser una máquina limpia y desechable

1. **La PC de la tienda es real.** Corre la tienda con PostgreSQL (5434 en el guion; confirme el suyo), la API en **3001** y la web en **4173**, con ventas y respaldos de verdad. Instalar, actualizar o desinstalar ahí puede dejar la tienda sin servicio.
2. **Las auditorías encontraron un riesgo concreto** (CPC-8, punto 1 de PC-18): con `/S /D=C:\Program Files\FitStore POS` el instalador del producto podría instalarse **encima de los archivos de la tienda**. Se agregó un guardia (CPC-9: "cerrado en lo esencial"), pero **nadie lo ha probado en ejecución**. Probarlo en la PC de la tienda es justo el accidente que se quiere evitar.
3. **El producto usa otros nombres y puertos** (carpeta `Nexora POS Local`, servicios `NexoraLocal*`, puertos **5544 / 4301 / 4473**). Que no choquen con la tienda solo se demuestra con **la tienda instalada primero** en una máquina limpia.
4. **"Limpia" de verdad** significa: Windows recién instalado, sin FitStore ni Nexora. Si ya hubo una prueba, se vuelve al snapshot (sección 2) o se reinstala. El guion se niega a correr si encuentra rastros.

**Reglas de oro**
- Nunca en la PC de la tienda. Nunca con datos reales de clientes. Nunca con licencias o claves reales.
- El guion automático solo corre con `-ConfirmDisposableVm` y en una máquina que se reconozca como virtual. Es una protección: no la eluda.
- No ejecute nada de `instalador/` en la PC de la tienda, ni "para ver".

---

## 2. Cómo conseguir un Windows limpio (de más fácil a más difícil)

Se necesita **una máquina Windows 11 y otra Windows 10** (o la misma, reinstalada). Mínimo por máquina: **4 CPU, 8 GB de RAM (16 GB recomendado con tienda y producto juntos), 60 GB de disco libre, internet**. Para el punto de la impresora hace falta USB físico (ver 3.6).

| # | Opción | Facilidad | Ventaja | Límite |
|---|---|---|---|---|
| A | **Segunda PC o laptop** que no se use para vender (con Windows recién instalado) | Alta | Única que prueba impresora y gaveta reales | Hay que reinstalar Windows entre pruebas. El guion automático **no corre** (no es VM): se hace a mano |
| B | **VM en la nube** (Azure, AWS, Google) con Windows 10/11 | Media | No toca ningún equipo suyo; se borra al terminar | Cuesta unos centavos por hora; Windows 10/11 de escritorio en nube puede requerir licencia propia. Sin impresora USB |
| C | **Hyper-V "Creación rápida"** (Windows 10/11 **Pro**) | Media | Viene con Windows; tiene punto de control | Activarlo pide administrador y **reiniciar**. No sirve en Home. **No lo active en la PC de la tienda**: reiniciarla corta las ventas |
| D | **VirtualBox + ISO de evaluación** | Media-baja | Gratis, funciona en Home | ISO de unos 5 GB, instalación a mano. Con Hyper-V activo puede ir lento |
| E | **Windows Sandbox** | Muy fácil, pero **no sirve para esta prueba** | Se abre limpio cada vez | Todo se borra al cerrarlo, así que no permite probar reinicio, actualización ni desinstalación entre sesiones; sin punto de control. Requiere Pro/Enterprise y virtualización; activarlo pide administrador y reinicio. Úselo solo para un chequeo rápido de "¿abre?", sin dar nada por probado |

**Recomendación:** pida a un técnico la opción **C o D en una PC que no sea la de la tienda** (o la A si hay una PC de repuesto). La A es obligatoria para la impresora.

### Pasos (opciones C y D)
1. Descargue la **ISO de evaluación** de Windows 11 y de Windows 10 desde el Evaluation Center oficial de Microsoft. Anote la versión.
2. Cree la VM con 4 CPU, 8-16 GB de RAM y disco de 60 GB. En VirtualBox active EFI y TPM si Windows 11 lo pide. Hyper-V "Creación rápida" lo hace solo.
3. Instale Windows, cree un usuario **administrador** local, aplique actualizaciones y **no instale nada más**.
4. Haga un **snapshot / punto de control llamado `LIMPIO`**. Todo se prueba a partir de él.
5. Entre bloques de la sección 3 que digan "volver a LIMPIO", **restaure el snapshot**. Haga otro llamado `TIENDA-INSTALADA` tras instalar la tienda (permite repetir la coexistencia sin reinstalar).
6. Copie a la VM solo: los dos `.exe` (tienda y producto local), una licencia de **prueba** y, si usa el guion, el repositorio. Calcule el SHA-256 de cada `.exe` (`Get-FileHash`) y anótelo.
7. Al terminar, saque las capturas y la carpeta de evidencia **fuera** de la VM y destruya la VM.

---

## 3. Matriz de pruebas

Marque `[x]` solo con evidencia (sección 4). Si pasa algo distinto de lo esperado, es un fallo: anótelo, no lo arregle sobre la marcha.

**Antes de cada tanda, en PowerShell como administrador:** `Get-Service *FitStore*,*Nexora*` y `netstat -ano | findstr "3001 4173 5434 5544 4301 4473"` deben salir vacíos. Guarde la salida.

### 3.1 Instalar el producto solo (PC-18)
- [ ] Ejecutar `Nexora-POS-Local-Setup-<versión>.exe` como administrador, ruta por defecto. Esperado: termina sin error; carpeta `C:\Program Files\Nexora POS Local`; datos en `C:\ProgramData\Nexora POS Local`.
- [ ] Servicios `NexoraLocalPostgreSQL`, `NexoraLocalAPI`, `NexoraLocalWeb` en **Running** y arranque **Automatic** (`Get-Service Nexora*`).
- [ ] Puertos escuchando **5544** (PostgreSQL), **4301** (API) y **4473** (web HTTPS): `Get-NetTCPConnection -State Listen -LocalPort 5544,4301,4473`.
- [ ] No existe ningún servicio ni puerto de la tienda (3001, 4173, 5434).
- [ ] Verificador instalado devuelve `ok: true`: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexora POS Local\scripts\Verify-FitStore.ps1" -InstallDir "C:\Program Files\Nexora POS Local"`.

### 3.2 Instalar la tienda y luego el producto (coexistencia, PC-22)
Volver a LIMPIO. Instalar primero la tienda y después el producto.
- [ ] Tienda instalada: servicios `FitStorePostgreSQL`, `FitStoreAPI`, `FitStoreWeb` Running; puertos 5434, 3001 y 4173. Anotar el hash de `C:\ProgramData\FitStore POS\secrets.json`.
- [ ] Producto instalado en la misma máquina: **los seis servicios** Running y **los seis puertos** escuchando (5434, 3001, 4173, 5544, 4301, 4473).
- [ ] El hash de `secrets.json` de la tienda **no cambió** y su web sigue respondiendo.
- [ ] Cada base tiene solo su dueña: base `fitstore`/usuario `fitstore` en 5434 y base `nexoralocal`/usuario `nexoralocal` en 5544; ninguna contiene el correo de la otra.
- [ ] Dos registros y dos desinstaladores separados (`HKLM\SOFTWARE\FitStore POS` y `HKLM\SOFTWARE\Nexora POS Local`).
- [ ] Cookies: iniciar sesión en la tienda y en el producto en el **mismo navegador**; ninguna cierra la sesión de la otra.
- **Atajo automático** (solo VM Windows 11, con la tienda **sin** instalar, porque el guion la instala él): `powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalador/tests/Windows11-Coexistence.ps1 -StoreInstaller <ruta> -LocalInstaller <ruta> -StoreSha256 <hash> -LocalSha256 <hash> -ConfirmDisposableVm` (o `-BuildFromSource`, que exige Node y pnpm). Deja `resultado.json` y `pc22-windows11.log` en `C:\Users\Public\Documents\Nexora PC22 Evidence\<fecha>\`. También desinstala el producto y comprueba que la tienda queda intacta (cubre parte de 3.10).
  - El guion solo cubre **Windows 11** (exige compilación 22000 o más). En Windows 10 se hace a mano con esta matriz.

### 3.3 Instalar con `/D=` a la carpeta de la tienda (guardia, PC-18)
Con la tienda instalada (punto `TIENDA-INSTALADA`). **Es la prueba que más protege a la tienda.**
- [ ] **Modo normal:** `Nexora-POS-Local-Setup-<v>.exe /D=C:\Program Files\FitStore POS`. Esperado: aviso "El producto local solo puede instalarse en C:\Program Files\Nexora POS Local..." y no se instala nada. Comparar `Get-FileHash` de los archivos de `C:\Program Files\FitStore POS` antes y después (iguales) y servicios de la tienda en Running.
- [ ] **Modo silencioso:** `Start-Process .\Nexora-POS-Local-Setup-<v>.exe -ArgumentList '/S','/D=C:\Program Files\FitStore POS' -Wait -PassThru`. **Esperado: código de salida 4**, sin ventana y sin instalar.
  - **PROBLEMA CONOCIDO (por verificar):** CPC-9 anotó que ese aviso (`MessageBox MB_ICONSTOP`, en `instalador/tools/product-local-profile.mjs`, alrededor de la línea 78) **no lleva `/SD`**, así que con `/S` el instalador puede **quedarse esperando un clic en vez de salir con 4**. ChatGPT PC dice haberlo corregido (commits `81c4f17` y `769c51b`), pero **en la rama base de esta guía (`1a1c6ed`) el texto no tiene `/SD`**. Anote lo que ocurre de verdad: si se cuelga, mate el proceso, confirme que tampoco instaló nada y regístrelo como FALLA (no como aprobado).
- [ ] Variantes (CPC-9 dijo que fallan cerrado; verificar): minúsculas `c:\program files\fitstore pos`, con barra final, ruta corta 8.3 (`C:\PROGRA~1\FITSTO~1`) y `\\?\C:\Program Files\FitStore POS`. Todas deben rechazarse sin tocar la tienda.
- [ ] `/D=C:\Prueba` (carpeta cualquiera): también se rechaza, porque el guardia exige exactamente `Program Files\Nexora POS Local`.

### 3.4 Servicios y puertos tras reiniciar
- [ ] Reiniciar Windows. Sin iniciar sesión, esperar 2 minutos: los tres `NexoraLocal*` están en **Running** solos y 5544, 4301 y 4473 escuchan.
- [ ] Con la tienda instalada, los seis servicios vuelven solos.
- [ ] Apagado brusco de la VM y encendido: el producto arranca y no pierde la última venta de prueba.

### 3.5 Primera ejecución
- [ ] Abrir `https://localhost:4473` (certificado propio; anotar el aviso del navegador y cómo se acepta). Entra con la cuenta dueña creada en el instalador.
- [ ] Abrir desde **otro equipo o celular de la red** (IP de la VM; en VM puede requerir red puenteada): carga la página.
- [ ] Hacer el asistente de arranque (PC-02) y una **venta de prueba**; aparece en reportes.
- [ ] Firewall: anotar la regla creada (`Get-NetFirewallRule *Nexora*`); el puerto debe abrirse solo a la red local.

### 3.6 Impresora térmica y gaveta (PC-16): requiere impresora real
No se puede en VM sin USB. La hace **la dueña**, en la PC de repuesto (opción A), con una **impresora de 80 mm** y su gaveta.
- [ ] Ticket de prueba: ancho de 80 mm correcto, sin texto cortado, tildes y ñ bien, corte de papel.
- [ ] Venta en **efectivo**: la gaveta abre una sola vez.
- [ ] Venta con **tarjeta o transferencia**: la gaveta **no** abre.
- [ ] Impresora desconectada: la venta se guarda y se avisa; no se pierde.
- [ ] Apertura manual de gaveta: pide permiso y deja registro.
- [ ] Anotar marca y modelo de la impresora y el tipo de cable (USB o red).
- Conocido: la impresión aún no está atada a la impresora elegida, y el hallazgo F1 (reabrir con una venta vieja o caja cerrada) estaba abierto; verificar si aparece.

### 3.7 Licencia (PC-19)
- [ ] **Sin licencia**: la instalación nueva arranca en **solo lectura** (se ve, no se vende ni edita). Captura del aviso.
- [ ] Con licencia **de prueba** firmada válida: se puede vender. (No existe el emisor real: pida una de prueba a ChatGPT PC.)
- [ ] Licencia vencida y licencia alterada: vuelve a solo lectura; los datos siguen visibles.
- [ ] Cambiar el reloj hacia adelante y atrás: no se obtienen ventas gratis (hallazgo de CPC-9).
- [ ] Sin internet: se comporta según su estado de licencia.
- Aviso: el instalador de prueba usa una clave pública efímera; la clave de CI no debe aceptarse en el instalador final (pendiente).

### 3.8 Respaldo
- [ ] Existe la tarea programada de respaldo (`Get-ScheduledTask *Nexora*`).
- [ ] Respaldo manual: aparece un archivo en la carpeta elegida (por defecto `C:\ProgramData\Nexora POS Local\Backups`).
- [ ] **Restaurar** ese respaldo en una base desechable de la misma VM: vuelven las ventas de prueba. (Nadie ha restaurado un respaldo real aún.)
- [ ] Respaldo diario fuera de la PC con alerta a las 48 h: **PC-20 no existe**; marcar "no aplica".

### 3.9 Actualización N a N+1 con rollback
Necesita dos instaladores del producto de versiones consecutivas.
- [ ] Instalar N, hacer 2-3 ventas de prueba. Anotar totales y hash de `secrets.json`.
- [ ] Ejecutar el instalador N+1 sobre N: conserva ventas, usuarios y respaldos; servicios en Running; versión nueva visible.
- [ ] Antes de migrar exige cerrar ventas y hace un respaldo.
- [ ] **Rollback:** provocar un fallo (por ejemplo un N+1 de prueba hecho para fallar, pedido a ChatGPT PC; no toque el código aquí). Esperado: vuelve a N, servicios Running, datos intactos.
- [ ] Repetir con la tienda instalada al lado: la tienda no cambia.

### 3.10 Desinstalar
- [ ] Desinstalar el producto (Aplicaciones o `Uninstall.exe`) **diciendo NO a borrar datos**: desaparecen los servicios `NexoraLocal*` y la carpeta del programa; **se conserva** `C:\ProgramData\Nexora POS Local` (state.json, secrets.json, base, `Backups`).
- [ ] La tienda sigue funcionando (servicios, puertos, hash de `secrets.json`, datos).
- [ ] Reinstalar el producto sobre los datos conservados: recupera las ventas.
- [ ] Desinstalar **pidiendo borrar datos** (dos confirmaciones): borra solo base y respaldos locales del producto; nunca los de la tienda ni los externos. Solo en VM.
- [ ] `Uninstall.exe /S`: por defecto **conserva** los datos.

### 3.11 Persistencia tras reinicio
- [ ] Tras reiniciar (3.4), las ventas, el usuario y la licencia siguen ahí.
- [ ] La tarea de respaldo sigue programada.

### 3.12 Windows 10 frente a Windows 11
Repetir **3.1, 3.2, 3.3, 3.4, 3.9 y 3.10** en las dos versiones y anotar diferencias.
- [ ] Windows 10 (anotar compilación; verifique que sigue siendo una versión con soporte) funciona igual.
- [ ] Windows 11 (compilación 22000 o más; anotar 22H2/23H2/24H2) funciona igual.
- A vigilar: PowerShell 5.1 en ambos; el guion automático no corre en Windows 10; SmartScreen avisará porque el instalador **no está firmado** (PC-17), anótelo con captura; antivirus o Defender que bloquee el `.exe` o PostgreSQL.

---

## 4. Plantilla de evidencia

**Regla: sin captura o salida de comando no cuenta como probado.** Un "funcionó" escrito no vale. La captura debe mostrar fecha, hora y ventana; la salida de comando se guarda como texto (`comando > evidencia\paso-3-1.txt`) o con la transcripción del guion.

Guarde los archivos como `evidencia\<fecha>\<paso>_<resultado>.png`. Copie la tabla y llene **una fila por cada casilla** de la sección 3.

| Fecha y hora | Windows (versión y compilación) | VM (cuál) o PC real | Paso (ej. 3.3 modo /S) | Resultado (OK / FALLA / BLOQUEADO) | Captura o salida (nombre de archivo) | SHA del commit y SHA-256 del instalador | Notas |
|---|---|---|---|---|---|---|---|
| 2026-__-__ __:__ | W11 (compilación ____) | VirtualBox ___ | 3.1 servicios Running | | `3-1-servicios.png` | `____` / `____` | |
| | | | | | | | |

Datos de cabecera de cada tanda: quién la hizo, rama y SHA del commit del que salió el instalador, versión (`instalador/VERSION`), SHA-256 del `.exe`, si estaba firmado (hoy no) y si hubo reinicio entre pasos.

Si algo falla: copie el mensaje exacto, el código de salida (`-PassThru` o `$LASTEXITCODE`) y los registros del instalador. El repositorio trae `instalador/diagnosticar-instalacion.ps1`; úselo **solo dentro de la VM**.

---

## 5. Qué mueve cada resultado en `LISTO_PARA_VENDER`

Referencia: sección 7 de `docs/piloto/LISTO_PARA_VENDER.md` (rama `origin/claude-pc/piloto`). La actualiza Claude PC o la dueña **después de ver la evidencia**; esta guía no la toca.

| Fila | Hoy | Puede pasar a ✅ solo con evidencia de... | Se queda igual si... |
|---|---|---|---|
| PC-18 Instalador local aislado | 🟡 | 3.1, 3.2, 3.3 y 3.10 completas en Windows **10 y 11** limpios, incluida la salida con código 4 en `/S` sin colgarse | `/S` se cuelga (🟡 con el defecto anotado) o falta Windows 10 |
| PC-22 Prueba en Windows 10 y 11 limpios | 🔴 | `resultado.json` del guion en Windows 11 con resultado `correcto` **más** la matriz manual 3.1-3.12 en Windows 10 y 11 con la tabla llena | Solo una versión, o sin `resultado.json`: máximo 🟡 |
| PC-16 Impresión térmica y gaveta | 🟡 | 3.6 completa con impresora y gaveta reales, con fotos de los tickets | Solo en VM o sin gaveta: sigue 🟡 |
| Cookies y sesión: producto y tienda no se pisan | 🟡 | 3.2 (cookies) con capturas de ambas sesiones | Sin prueba con ambos instalados |
| Actualización con rollback (parte de PC-18) | 🟡 | 3.9 con rollback real demostrado | Solo actualización, sin rollback probado |
| PC-19 Licencia | 🔴 | **No sube con esta prueba.** 3.7 solo muestra el solo lectura; falta el emisor, la atadura a empresa y máquina y rotación de claves | Sigue 🔴 |
| PC-20 Respaldo fuera de la PC | 🔴 | No aplica: no existe. 3.8 prueba solo el respaldo y la restauración locales | 🔴 |
| PC-17 Instalador firmado | 🔴 | No aplica: no hay certificado | 🔴 |

**Importante:** aun con todo en verde, la versión Local **no queda lista para vender**: PC-17, PC-19, PC-20 y PC-21 siguen abiertos. Esta prueba solo puede cerrar PC-18 y PC-22.

---

## 6. Qué NO se probó todavía

- **Nada se ha ejecutado en Windows 10 ni 11 reales y limpios.** El guion `Windows11-Coexistence.ps1` solo pasó contratos estáticos; nunca corrió y no existe ningún `resultado.json`.
- El instalador del producto local se **compiló en CI** (run 40132396864), pero nunca se instaló.
- Windows 10 no tiene guion automático; todo es manual.
- El guardia de `/D=` y el defecto de `/SD` solo se leyeron en el código; falta verlos funcionar.
- Impresora y gaveta: nunca con equipo real.
- Actualización N a N+1 y rollback del producto local: solo leídos, nunca ejecutados.
- Licencia: no existe el emisor real; solo se prueba con una licencia de prueba.
- Respaldo fuera de la PC (PC-20), IA y soporte desde la versión local (PC-21) e instalador firmado (PC-17): no existen.
- Esta guía **tampoco se ha probado**: puede tener errores de comandos o rutas. Quien la use primero debe corregir lo que encuentre y anotarlo en la tabla.
