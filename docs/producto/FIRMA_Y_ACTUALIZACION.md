# PC-17: firma del instalador y actualización automática

Estado: **nada de esto existe todavía en el repositorio** (verificado, ver sección 2). Este documento dice qué hay que comprar, qué hay que construir y cómo probarlo. Todo dato externo (precios, plazos, políticas de proveedores) está marcado "(por confirmar con el proveedor)": quien lo escribió no tuvo acceso a internet.

## 1. Qué significa "firmar" y por qué Windows avisa

Firmar un programa es ponerle un sello digital que dice dos cosas: "este archivo lo publicó esta empresa" y "nadie lo modificó después". El sello sale de un **certificado de firma de código** que una empresa certificadora entrega solo después de comprobar quién eres. Es distinto del candado HTTPS de una página web y distinto de la clave de licencias de Nexora (PC-19).

Sin sello, Windows no sabe quién hizo el instalador. Por eso muestra "Editor desconocido" y, en muchas PC, la pantalla azul de SmartScreen ("Windows protegió su PC"). El cliente tiene que pulsar "Más información" y "Ejecutar de todas formas"; muchos se asustan y no instalan. Con sello, aparece el nombre de la empresa como editor. Ojo: el sello quita el "editor desconocido", pero SmartScreen puede seguir avisando un tiempo hasta que el programa gane reputación (ver sección 3).

## 2. Qué hace el repositorio HOY (verificado) y qué falta

Búsqueda hecha en `instalador/`, `apps/web/src-tauri/`, `scripts/`, `.github/` y `docs/producto/` de: sign, firma, updater, pubkey, minisign, signtool, certificate, latest.json, Authenticode.

| Pieza | Estado | Evidencia |
|---|---|---|
| Firma Authenticode del instalador NSIS | **No existe** | `instalador/build.ps1:411-421` llama a `makensis` y calcula SHA-256, sin paso de firma. `instalador/installer/FitStore.nsi:36` solo define `OutFile`. |
| Firma del desinstalador (`Uninstall.exe`) | **No existe** | `FitStore.nsi:287` hace `WriteUninstaller` sin `!uninstfinalize` para firmarlo. |
| Firma del `.exe` de Tauri | **No existe** | `apps/web/src-tauri/tauri.conf.json:28` `bundle` solo trae `active`, `targets: ["nsis"]` e `icon`; sin `windows.certificateThumbprint` ni `signCommand`. `docs/producto/ESCRITORIO_PC16.md:12` lo confirma: NSIS "sin firma". |
| Tauri updater (plugin, claves minisign, `latest.json`) | **No existe** | `apps/web/src-tauri/Cargo.toml:11` solo depende de `tauri`; no hay plugin updater en `Cargo.toml`, `capabilities/default.json` ni `tauri.conf.json` (sin `plugins.updater`, `pubkey` ni `createUpdaterArtifacts`). `scripts/product-desktop-config.mjs` no toca nada de eso. |
| Secretos de firma en CI | **No existen** | `.github/workflows/ci.yml:139-146` compila Tauri con URL ficticia "sin publicar"; el único secreto es `JWT_SECRET` de pruebas (línea 31). |
| Clave Ed25519 de licencias (PC-19) | Solo la **pública** de prueba | `ci.yml:134-135` (`NEXORA_LICENSE_PUBLIC_KEY`). La privada vive en la nube y nunca en el repo (`docs/producto/LICENCIA_LOCAL.md:15`). |
| Actualización del servidor local | **Sí, pero manual** | El `.exe` NSIS detecta "actualizar" (`FitStore.nsi:143`), guarda una copia previa y revierte si falla (`FitStore.nsi:75`, `159`; `instalador/scripts/Rollback-FitStoreUpdate.ps1`, `Recover-FitStoreUpdate.ps1`). Hay que ejecutar el instalador nuevo a mano; no hay aviso ni descarga automática. |
| Única firma que sí se verifica | La del runtime de Microsoft (VC++), no la nuestra | `instalador/build.ps1:336-338`. |
| Estado declarado | Pendiente | `docs/producto/INSTALADOR_LOCAL.md:5` y `ESCRITORIO_PC16.md:21`: firma y actualizaciones quedan para PC-17..PC-21. Plan: `PLAN_MAESTRO_TODO.md` PC-17 (en `origin/nexora-cloud`): "lo compra la dueña". `EVALUACION_APP_ESCRITORIO.md` también lista firma, canal de actualización y reversión como pendientes. |

**Son TRES llaves distintas; no se sustituyen entre sí:**

1. **Certificado Authenticode** (se compra a una certificadora): firma los `.exe`/`.msi` para Windows y SmartScreen. Hoy: no existe.
2. **Par de claves minisign del updater de Tauri** (lo genera el equipo, sin costo, con `tauri signer generate`): la pública va en `tauri.conf.json`, la privada en secretos de CI. Verifica que una actualización descargada es nuestra. Hoy: no existe.
3. **Clave Ed25519 de licencias** (PC-19): decide si una instalación puede vender. Hoy: solo una pública de prueba en CI.

Además hay **dos productos** que actualizar: el servidor local NSIS (PC-18) y la app de escritorio Tauri (PC-16). El updater de Tauri solo cubre el segundo; el primero necesita su propio mecanismo (ver 4.2, paso 6).

## 3. Qué certificado debe comprar la dueña

Todo lo de esta sección es (por confirmar con el proveedor).

**Opciones**

- **OV (validación de organización)**: certificado de código estándar. Desde 2023 las reglas de la industria exigen que la clave privada esté en un dispositivo protegido (token USB físico o HSM en la nube), no en un archivo `.pfx` descargable (por confirmar con el proveedor). Orden de magnitud: unos cientos de dólares por año (orden de magnitud, por confirmar).
- **EV (validación extendida)**: más comprobaciones, también con token/HSM. Históricamente daba reputación SmartScreen inmediata; varias fuentes indican que esa ventaja se redujo (por confirmar con el proveedor y con Microsoft). Orden de magnitud: más caro que OV (por confirmar).
- **Servicio de firma en la nube de Microsoft (Trusted Signing, hoy Artifact Signing)**: Microsoft guarda la clave y firma desde CI con certificados de vida corta; suele ser la opción más barata por mes (orden de magnitud: decenas de dólares al mes, por confirmar). Requisitos: empresa verificable y disponibilidad por país/tipo de organización (por confirmar si acepta una empresa de República Dominicana).
- **Firma en la nube de las propias certificadoras** (clave en su HSM, firma por API): evita el token físico y sirve en CI (por confirmar con el proveedor).

**Reputación SmartScreen**: aun firmado, un editor nuevo puede ver avisos hasta acumular descargas sin problemas (por confirmar). Se reduce firmando siempre con el mismo certificado, sin cambiar el nombre del editor y publicando desde un dominio estable.

**Recomendación para un negocio pequeño dominicano**: primero consultar si el servicio en la nube de Microsoft acepta la empresa; si no, comprar un **OV con firma en la nube/HSM del proveedor** (sin token físico que viaje por correo y quede en una sola PC). EV solo si el proveedor confirma una ventaja real de SmartScreen que justifique la diferencia de precio. Evitar certificados `.pfx` sueltos "baratos": ya no cumplen las reglas.

**Documentos que normalmente piden** (por confirmar con el proveedor): registro mercantil y RNC vigentes; documento de identidad del representante (cédula/pasaporte), a veces con videollamada o foto; teléfono y correo de la empresa verificables en un registro público o por llamada; carta de autorización si firma otra persona; en algunos casos número D-U-N-S (gratis pero tarda en emitirse; por confirmar si lo exigen); dirección física comprobable.

**Plazos** (orden de magnitud, por confirmar): de días a un par de semanas para OV; EV y D-U-N-S pueden tomar más. Empezar el trámite cuanto antes: es lo que más tarda.

El nombre que aparezca como editor será el de la empresa registrada tal como figure en los documentos; hay que decidir cuál (ver decisiones).

## 4. Plan técnico "cuando llegue el certificado"

### 4.1 Dónde vive el secreto
Nunca en el repositorio ni en archivos del proyecto. Con firma en la nube: credenciales de API como **secretos del entorno de CI** (GitHub Environments con aprobación manual, rama protegida). Con token físico: queda atado a una PC, por lo que se firma en un runner autoalojado o a mano; preferir firma en la nube. La clave privada minisign del updater: secreto de CI (`TAURI_SIGNING_PRIVATE_KEY` y su contraseña), con copia cifrada guardada por la dueña. Si se pierde, los clientes instalados no podrán aceptar actualizaciones y habría que reinstalar a mano.

### 4.2 Pasos de build/CI a agregar (nada de esto está hecho)
1. **Firmar el instalador NSIS** (`Nexora-POS[-Local]-Setup-*.exe`) después de `makensis` en `instalador/build.ps1:411`: `signtool sign /fd SHA256 /tr <URL de sello de tiempo del proveedor> /td SHA256 ...` (o el CLI del servicio elegido). Siempre con **sello de tiempo**, para que la firma siga válida cuando el certificado venza.
2. **Firmar también el desinstalador**: en `FitStore.nsi`, `!uninstfinalize` (y `!finalize` para el instalador) invocando signtool. Es la causa clásica de un `Uninstall.exe` sin firma dentro de un instalador firmado. Orden obligatorio: calcular el SHA-256 (`build.ps1:421`) **después** de firmar.
3. **Firmar los binarios incluidos en el paquete** que se ejecutan en la PC (ejecutables de servicio propios y de terceros que no vengan firmados).
4. **Tauri**: en `tauri.conf.json`, `bundle.windows.signCommand` (o `certificateThumbprint`) para firmar el `.exe` y el instalador NSIS que genera Tauri. Añadir `"createUpdaterArtifacts": true` y `plugins.updater` con `pubkey` y `endpoints`; añadir `tauri-plugin-updater` en `Cargo.toml` y el permiso `updater:default` en `capabilities/default.json`.
5. **Updater de Tauri**: generar el par con `tauri signer generate`; la pública va en el config; el CI exporta `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)` al compilar. Cada release publica el instalador, su `.sig` y un `latest.json` (versión, notas, URL, firma) en un alojamiento HTTPS estable controlado por Nexora. La app compara versión y verifica la firma minisign antes de instalar.
6. **Actualización del servidor local (PC-18)**: no la cubre el updater de Tauri. Opciones: (a) la API local consulta el mismo `latest.json`, descarga el `Setup.exe` firmado, verifica Authenticode y SHA-256 y lo lanza en modo silencioso (reutiliza las copias previas y la reversión existentes); (b) solo avisar "hay versión nueva" y que una persona la instale. Recomendado empezar por (b).
7. Un paso de CI que **falle si un artefacto de release no está firmado** (`Get-AuthenticodeSignature`).

### 4.3 Cómo verificar
- `signtool verify /pa /v <archivo>` y/o `Get-AuthenticodeSignature <archivo> | Format-List` (esperado: `Status: Valid`, `SignerCertificate` con el nombre de la empresa, sello de tiempo presente). Repetir para `Setup.exe`, el `Uninstall.exe` ya instalado y los `.exe`/`.msi` de Tauri.
- Clic derecho > Propiedades > Firmas digitales en una PC limpia.
- Updater: alterar un byte de la descarga o del `.sig` y comprobar que la app lo **rechaza**.

### 4.4 Plan de pruebas en Windows limpio (VM 10 y 11, sin el certificado instalado)
1. Descargar el instalador con el navegador (para que lleve la marca de "descargado de internet") y abrirlo: anotar si sale SmartScreen, qué editor muestra y qué dice. Repetir con un instalador sin firmar como referencia. La reputación puede cambiar con el tiempo.
2. Instalar versión N, crear datos de prueba, publicar N+1 en el canal y comprobar que la actualización avisa, descarga, verifica la firma, instala y conserva datos y licencia.
3. **Reversión**: publicar una N+1 defectuosa y comprobar que se vuelve a N con los datos intactos (aprovechar `Rollback-FitStoreUpdate.ps1` en el servidor local).
4. **Actualización interrumpida**: cortar red y luego energía durante la descarga y durante la instalación; al reiniciar debe quedar N o N+1 completo, nunca a medias (`Recover-FitStoreUpdate.ps1`).
5. Firma inválida, archivo alterado o `latest.json` que apunta a una versión inferior: debe rechazarse (anti-downgrade).
6. Certificado vencido o revocado después de firmar: lo firmado con sello de tiempo debe seguir verificando.
7. Desinstalar: el `Uninstall.exe` aparece firmado y limpia todo.

## 5. Decisiones para la dueña

1. **¿Con qué nombre aparecerá el editor?** Recomendado: la razón social real tal como figura en el RNC (debe coincidir con los documentos).
2. **¿Qué tipo de certificado?** Recomendado: consultar primero el servicio de firma en la nube de Microsoft; si no acepta la empresa, un OV con firma en la nube del proveedor. EV solo si el proveedor demuestra ventaja.
3. **¿Quién hace la verificación de identidad?** Recomendado: el representante legal que figure en el registro mercantil, con cédula y teléfono disponibles.
4. **¿Presupuesto anual y fecha límite?** Recomendado: iniciar el trámite ya; es lo que más tarda.
5. **¿Dónde se alojan las descargas y `latest.json`?** Recomendado: un dominio de Nexora estable con HTTPS (cambiarlo afecta la reputación).
6. **¿Las actualizaciones son automáticas o solo avisan?** Recomendado: avisar y pedir confirmación en el servidor local (tiene base de datos); automática en la app de escritorio.
7. **¿Quién custodia la copia de la clave minisign del updater?** Recomendado: la dueña, cifrada, fuera del repositorio.

## 6. Lo que Claude PC NO pudo verificar

- No hay internet: no se comprobó ningún precio, política, plazo ni disponibilidad por país de las certificadoras, de Microsoft Trusted/Artifact Signing ni de SmartScreen. Todo está marcado "(por confirmar con el proveedor)".
- No hay Windows SDK/`signtool`, Rust ni NSIS en esta PC: no se compiló, firmó ni ejecutó ningún instalador. Las opciones de Tauri (`signCommand`, `createUpdaterArtifacts`, `plugins.updater`) y de NSIS (`!uninstfinalize`) se citan de memoria de la documentación y deben revalidarse contra la versión fijada de Tauri 2 y NSIS 3.10.
- No se probó SmartScreen, ni actualizaciones, ni reversión en una VM.
- La búsqueda en el repositorio es textual; no se leyó línea por línea `Install-FitStore.ps1` ni todo el script NSIS.
