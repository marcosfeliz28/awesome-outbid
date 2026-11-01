# Auditoría estática del instalador de PC sin internet (Parte 1)

Fecha: 1-nov-2026 · Rama: `claude-pc/instalador-sin-internet` · Alcance: solo lectura, sin cambios de código.
Orden: `docs/coordinacion/ORDEN_INSTALADOR_SIN_INTERNET_1NOV.md`, parte 1.

**Límite de esta auditoría:** se hizo leyendo el código y el CI. No hay Windows aquí, así que nada de esto está probado en una PC instalada. Las referencias son `archivo:línea` del repositorio en esta rama.

Nota de método: las búsquedas principales fueron directas con `grep` sobre el código. Al final se revisó también el mapa `graphify` (`graphify query`): no cambió ninguna conclusión; el único resultado de red (`apps/web/src/QuickQuestions.tsx`) solo llama a la API interna.

## Resumen

- **Instalar y arrancar no necesita internet.** Los descargas (Node, PostgreSQL, WinSW, vc_redist) ocurren al **compilar** el instalador, con SHA-256 fijo, no al instalarlo (`instalador/build.ps1:294, 302, 322, 325`; `instalador/dependencias.lock.json`). El instalador NSIS trae su payload; `Install-FitStore.ps1` no contiene ninguna descarga (busqueda de `Invoke-WebRequest`, `DownloadFile`, `curl`, `winget` en `instalador/scripts` y `instalador/installer`: solo aparece `Invoke-WebRequest` local a `127.0.0.1` en `scripts/FitStore.Common.ps1:494`).
- **Lo que sí sale a internet está todo condicionado y degrada**, nada bloquea el arranque: Telegram, Resend (correo), Google Drive, tasa del dólar y Sentry. Ver tabla.
- **Lo más grave para el día a día (degrada, no bloquea):** la tasa del dólar. Un cobro en dólares exige una tasa registrada (`apps/api/src/sales.ts:500-504`). En el instalador la tasa no se busca sola (ver punto 1.4), así que alguien debe escribirla en Configuración. Sin ella, los cobros en US$ se rechazan con mensaje claro.
- **Riesgo real que el CI no cubre:** el job `windows-installer` solo corre pruebas estáticas y de portabilidad (`.github/workflows/ci.yml:106-150`, paso `pnpm instalador:validar`). Ninguna instalación real ocurre en el runner. Las pruebas de instalación real (`instalador/tests/Windows-Smoke.ps1`, `Windows-Smoke-Real-Sql.ps1`) hay que correrlas a mano en una PC Windows.

## 1. Qué necesita internet hoy

| # | Caso | Dónde (archivo:línea) | ¿Cuándo sale? | ¿Bloquea o degrada? | ¿Modo sin conexión? |
|---|------|------------------------|---------------|---------------------|---------------------|
| 1.1 | Descarga de Node, PostgreSQL, WinSW, vc_redist | `instalador/build.ps1:294, 302, 322, 325` (`Get-VerifiedDownload`, `curl.exe` en `:78`) | Solo al **compilar** el instalador | No aplica al cliente | Sí: el payload ya viene dentro del `.exe` |
| 1.2 | `pnpm install` / `pnpm db:generate` | `instalador/build.ps1:205, 207` | Solo al compilar | No aplica al cliente | No aplica |
| 1.3 | Fuentes web (Google Fonts) | `apps/web/src/styles.css:1-10, 11-52` | Nunca: las fuentes vienen empaquetadas (`@fontsource-variable/inter`, `plus-jakarta-sans`, `apps/web/package.json:18-19`). El comentario `styles.css:7` deja constancia de que se quitó el `@import` de Google | — | Ya resuelto |
| 1.4 | Tasa del dólar (`open.er-api.com`) | `apps/api/src/usd-rate.ts:10, 93`; activador `usd-rate.ts:76` | Solo si la variable `USD_RATE_AUTO=1`. Esa variable **no está en el repo** (`render.yaml` no la define). En el instalador no se define, así que **no sale a internet** | Si estuviera activa, degrada: captura el error y sigue (`usd-rate.ts` bloque `catch`) | Sí: la tasa se escribe a mano en Configuración (`apps/api/src/admin.ts:129`, `apps/web/src/Management.tsx:4128`) |
| 1.5 | Correo (Resend) | `apps/api/src/notifications.ts:69, 88, 89` | Solo si hay `RESEND_*` configurado (`notifications.ts:54-71`, `enabled: !!apiKey && !!to`) | Degrada: sin clave no envía nada (`notifications.ts:784`) | Sí: queda sin enviar; no hay cola local que se reintente sola cuando vuelva la red (ver §5) |
| 1.6 | Telegram (avisos) | `apps/api/src/notifications.ts:46, 822-830` | Solo si hay `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (`notifications.ts:43-48`) | Degrada: `NotificationWorker` sale si no está habilitado (`notifications.ts:888`) | Igual que 1.5 |
| 1.7 | Respaldo a Google Drive | `apps/api/src/drive-backup.ts:81, 127-131, 198` | Solo si la clínica conectó su cuenta (`drive-backup.ts:715`, `connected = !!row.refreshTokenEnc`) | Degrada: el respaldo **local** (`Backup-FitStore.ps1`) no depende de esto | Sí: el respaldo local funciona sin red |
| 1.8 | Sentry (errores del navegador) | `apps/web/src/monitoring.ts:6-9, 104-105` | Solo si `VITE_SENTRY_DSN` existe **al compilar**. `build.ps1` no la define (búsqueda sin resultados) | No aplica | Sí: `initMonitoring` devuelve `false` sin dsn |
| 1.9 | URL fija de Render | `apps/api/src/notifications.ts:88` (`https://nexora-pos-web.onrender.com`), solo para enlaces del correo | Solo al armar correos | Degrada (enlaces de correo apuntan a la nube, no a la PC) | Sí, pero el enlace no abre en la PC: ver §5 |
| 1.10 | WhatsApp | `apps/web/src/POS.tsx:2402-2408` (`https://wa.me/...`) | Solo al pulsar el botón | Degrada: abre una pestaña nueva; no es carga de la app | Sí en el sentido de que la app funciona; el botón necesita red |
| 1.11 | Avisos de licencias | `apps/web/src/App.tsx:146` (`fetch("/licencias.txt")`) | Local (mismo servidor) | No degrada | Sí |
| 1.12 | Actualizaciones de la app (PWA) | `apps/web/src/pwaUpdate.ts`, `apps/web/src/App.tsx:721` (`/api/health`) | Local | No degrada | Sí |
| 1.13 | Verificación de licencia / activación | Búsqueda por `licencia|license|activaci|activation` en `apps/api/src` e `instalador/`: **sin resultados** | — | — | No hay licencia que verificar |
| 1.14 | IA | Búsqueda por `openai|anthropic|generativelanguage` en `apps/` y `instalador/`: **sin resultados** | — | — | No aplica |
| 1.15 | SMS / WhatsApp Business API | Búsqueda por `twilio|whatsapp|graph.facebook`: **sin resultados** (solo el enlace `wa.me` de 1.10) | — | — | No aplica |

Notas:
- Los hosts de `localhost` del instalador (`Install-FitStore.ps1:179, 265, 461-462`, `Configure-Network.ps1:182-205`, `FitStore.nsi:79`) son la propia PC, no internet.
- `Configure-Network.ps1:185` arma URLs con las IP locales de la PC para la red de la tienda. Eso es LAN, no internet.
- `instalador/runtime/web-server.mjs:122` usa `https://fitstore.local` solo como base para parsear la URL. No hay salida.

## 2. Qué trae empaquetado

- **Node 24.21.0**, **PostgreSQL 18.6-5**, **WinSW 2.12.0**, **vc_redist 14.44.35211**: descargados con SHA-256 en build (`dependencias.lock.json`) y copiados a `runtime\` (`Install-FitStore.ps1:59, 319` busca `runtime\vc_redist.x64.exe`).
- **Dependencias de la API**: `apps/api/node_modules` se arma con `pnpm deploy` y se revisa contra el lock (`build.ps1:45-60`, `tools/verify-deploy-lock.mjs`). `Install-FitStore.ps1:194` ejecuta `node_modules\.bin\tsx.cmd` local.
- **Prisma**: `prisma generate` en build (`build.ps1:265`), y las migraciones se aplican con el `prisma` local: `scripts/FitStore.Common.ps1:508-516` (`prisma migrate deploy --schema prisma\schema.prisma`). No hay red.
- **Fuentes de la web**: empaquetadas por Vite (`styles.css:11-52`).
- **Chequeos de PostgreSQL**: `Install-FitStore.ps1:323` exige `postgres.exe, pg_ctl.exe, initdb.exe, psql.exe, pg_dump.exe, pg_restore.exe, createdb.exe, dropdb.exe`.
- **Creación de la base** sin red: `initdb` con contraseña temporal (`Install-FitStore.ps1:86-108`), luego migraciones y el dueño (`New-OwnerAccount`, `Install-FitStore.ps1:194+`).

Conclusión: **la base se crea y se migra sin red** según el código. No está probado en Windows.

## 3. Lo nuevo de hoy sin internet

- **Reportes PDF** (`apps/api/src/receipt-pdf.ts`, `income-report.ts`, `formal-report.ts`, `reports.ts`): usan `pdfkit` (`apps/api/package.json:32`) con las **fuentes estándar de PDF** `Helvetica` y `Helvetica-Bold` (`receipt-pdf.ts:188-260`). No se cargan archivos de fuente ni de red. Las tildes y la ñ entran en WinAnsi. Riesgo: símbolos fuera de WinAnsi (por ejemplo, algunos emojis) saldrían mal. No hay evidencia de que se usen.
- **Reportes Excel** (`exceljs`, `apps/api/package.json:29`; `xlsx-guard.ts`): generación local, sin recursos remotos.
- **Gráficas**: `Dashboard.tsx`, `IncomeByDay.tsx`, `PaymentMixPie.tsx`, `YearPie.tsx`, `Management.tsx`: son componentes del propio proyecto. **No encontré** `chart.js` o similares cargados por CDN. Pendiente confirmar la librería exacta en `apps/web/package.json` (ver §6).
- **Moneda USD / RD$ de GV**: la tasa es manual en el instalador (punto 1.4). `sales.ts:489-509` rechaza el cobro si no hay tasa configurada (`bad("No hay tasa del dólar en Configuración…")`) o si cambió más de 0.00005 y no es venta offline con tolerancia del 2 % (`sales.ts:497-500`). **Riesgo:** una PC nueva sin tasa no puede cobrar en dólares hasta que alguien la escriba. Eso es lo esperado por diseño, pero conviene avisarlo en el manual.
- **Animaciones**: no encontré Lottie, CDN ni `@import url(https://…)` en `apps/web/src` (búsqueda `lottie|cdn|https://` sin resultados fuera del `wa.me`). No revisé una por una cada animación de hoy: pendiente.
- **Mapa y guías**: no localicé una librería de mapas (`leaflet|mapbox|google.com/maps|openstreetmap` sin resultados). No revisé el contenido de las guías línea por línea: pendiente.

## 4. CI (estado observado)

- Rama `claude-pc/instalador-sin-internet`: **sin ejecuciones de CI** (`list_workflow_runs` vacío).
- Último run completo con job `windows-installer` en `success` (run 41310725634, rama `claude-pc/cola2-26oct`): `pnpm install`, `db:generate`, `PGBIN`, `vitest tests/portabilidad.test.ts`, `pnpm instalador:validar`. Todo en verde.
- Run 41311346961 (rama `chatgpt-nube/qa-medios-1nov`): `windows-installer` en `success`; el job `verify` falla en `pnpm check` (paso 11). **No es parte de esta auditoría**, pero hay que saberlo antes de desplegar.
- Runs de `nexora-cloud` del 1-nov: la mayoría `cancelled` por concurrencia (2193-2204).

## 5. Lo que no se puede resolver sin Windows (o sin pruebas de instalación)

- Si el servicio `FitStoreAPI` arranca con la cuenta de servicio y el firewall correcto. Hay una tarea abierta en el ORDEN de ChatGPT (W3: API y web como LocalSystem) que afecta este punto.
- Si el certificado HTTPS autofirmado (`Configure-Network.ps1`) lo acepta Edge/Chrome sin aviso en una PC limpia.
- Si `prisma migrate deploy` corre bien con el `node.exe` empaquetado en una ruta con espacios o acentos (el usuario de Windows de la dueña).
- Si los reportes PDF salen con tildes correctas en la PC real.
- Si el respaldo local (`Backup-FitStore.ps1`) escribe en la carpeta destino sin el permiso de otro usuario (W2 de ChatGPT).
- **Correos y avisos que quedan pendientes sin internet**: no hay cola en disco que los reenvíe al volver la red. Hay que confirmarlo leyendo `NotificationWorker` (`notifications.ts:874+`) con más detalle.
- **Enlaces de correo** apuntan a `https://nexora-pos-web.onrender.com` (`notifications.ts:88`). Un enlace desde la PC local no abre la app local. Propuesta: usar la URL de la PC cuando `APP_PUBLIC_URL` no esté definida en el instalador.

## 6. Plan de prueba en una PC Windows limpia sin red

Objetivo: comprobar que el instalador funciona sin internet y que lo nuevo de hoy (reportes PDF/Excel, USD, animaciones, guías) también.

Preparación (la hace la dueña o ChatGPT PC):
1. PC Windows 11 limpia (o VM). Anotar el nombre de la PC.
2. Desactivar Wi-Fi y desconectar el cable. Confirmar en PowerShell: `Test-NetConnection 1.1.1.1 -Port 443` debe fallar.
3. Ver si queda algo de la instalación vieja: carpeta `C:\Program Files\...FitStore` o servicios `FitStoreAPI`/`FitStoreWeb`. Si hay algo, **avisar antes de tocarlo**.
4. Copiar el `Nexora-POS-Setup-<versión>.exe` generado en el build. No instalar nada más.

Ejecución:
5. Ejecutar el instalador como administrador. Anotar cada pantalla y el texto de error si aparece.
6. Crear el negocio de prueba: nombre «Prueba Instalador», correo `prueba@nexora.local`, contraseña y PIN de 6 dígitos que la dueña escribe en privado (no se guardan en el repositorio).
7. Abrir `https://localhost:4173`: aceptar el certificado, comprobar tildes y ñ en todas las pantallas.
8. Vender (efectivo, y en dólares sólo si se escribió la tasa en Configuración). Abrir y cerrar caja.
9. Generar un reporte en PDF y uno en Excel. Abrir ambos con el lector local y comprobar tildes.
10. Revisar la pantalla de GV: cursos en dólares y en pesos con la tasa manual.
11. Comprobar que las animaciones y las guías cargan sin red.
12. Apagar la PC, encenderla, verificar que los servicios arrancan y la app responde.
13. Probar `Windows-Smoke.ps1` (como administrador): respaldo, restauración aislada, conteos, servicios, HTTPS y firewall.
14. Desinstalar desde «Aplicaciones» y comprobar que los respaldos de `BackupPath` se conservan.

Resultado esperado: cada paso sin error, sin pedir red, y las capturas de cada pantalla. Dónde guardar resultados: `docs/coordinacion/PRUEBA_INSTALADOR_27OCT.md` (y enlace desde `RESULTADOS_CHATGPT.md`), según la orden.

## 7. Arreglos mínimos propuestos (no aplicados)

1. Definir `APP_PUBLIC_URL` en el instalador para que los enlaces de correo apunten a la PC (`notifications.ts:88`). Pequeño, con prueba de contrato.
2. Mostrar en Configuración un aviso claro cuando la tasa del dólar esté vacía, para que la caja no falle a mitad de venta (`sales.ts:500-504` ya lo dice, pero solo al cobrar).
3. Agregar un paso al CI que pruebe el servicio en Windows sin red, o dejarlo como paso manual documentado en `docs/instalacion/INSTALACION_PC.md`.
4. Confirmar por escrito que `USD_RATE_AUTO` debe quedar sin definir en el instalador (hoy no lo está: correcto).
