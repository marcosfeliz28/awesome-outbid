# Cline y DeepSeek Harness — informe del Revisor (28-oct-2026)

Pedido de Claude PC por orden de Marcos (`docs/seguridad/SOLICITUD_REVISION_CLINE_DEEPSEEK_27OCT.md`, rama `claude-pc/cola2-26oct`). Solo lectura: clones y metadatos de npm leídos en carpeta temporal, nada instalado ni ejecutado. Sin credenciales. Fue lectura estática por búsqueda de patrones, no una auditoría línea por línea.

| Herramienta | Riesgo | Veredicto |
|---|---|---|
| Cline (CLI `cline` 3.0.74 / extensión) | medio | **Solo en sandbox** |
| DeepSeek Harness (`deepseek-ai/deepseek-harness` 0.2.1-rc.3) | alto | **Rechazado** la ventana de la laptop mientras no se identifique; el oficial, **solo en sandbox** |

**Ninguna garantiza «solo lectura».** Las dos son agentes que ejecutan comandos y editan archivos. El «solo lectura» tiene que venir del sistema (copia del repo sin credenciales de git, o carpeta montada de solo lectura), no de un modo de la herramienta.

---

## 1. Cline — solo en sandbox
- **Fuente:** `cline/cline` (Apache-2.0), commit `292a9e1`. Paquete npm `cline` 3.0.74: publicado por GitHub Actions (*trusted publisher*) con atestación de procedencia (no verificada criptográficamente), 5 dependencias.
- **Qué ejecuta solo:** `postinstall` del paquete es `node ./postinstall.mjs || true`; el script solo crea un enlace/copia del binario local, mueve un registro de su daemon y hace `chmod` (`apps/cli/script/postinstall.mjs:85-107`); no descarga nada. Al usarse arranca un demonio local («hub») y la CLI se actualiza sola en segundo plano (`apps/cli/script/postinstall.mjs:21-30`): **versión no fijada** salvo que se apague.
- **Telemetría:** la CLI/SDK exporta OpenTelemetry **solo** si `OTEL_TELEMETRY_ENABLED=1/true` (`sdk/packages/shared/src/services/telemetry-config.ts:17-18`) o la configuración remota de una cuenta lo activa (`remote-config/telemetry.ts:16`, por defecto `false`). **Pero la extensión de VS Code trae PostHog** (`apps/vscode/src/shared/services/config/posthog-config.ts:40-44`) con ajuste `unset|enabled|disabled` (`TelemetrySetting.ts:1`); no verifiqué qué hace «unset». Por eso: usar la CLI, no la extensión.
- **Hosts en el código:** `api.cline.bot`, `cline.bot`, `models.dev`, `openrouter.ai`, `api.openai.com`, `api.anthropic.com`, `mcp.linear.app`, `agent-plugins.org`, entre otros. Con Ollama local y sin iniciar sesión en una cuenta Cline, el tráfico a esos hosts no debería ocurrir, pero **no lo comprobé en ejecución**; hay que verlo en el sandbox.
- **Aprobación automática:** existen `--yolo` y `--auto-approve` (`apps/cli/src/main.test.ts:1134,1546`) y un «modo zen» que aprueba todas las herramientas (`apps/cli/src/runtime/run-zen.ts:23,84-101`). Nunca activar.
- **Condiciones mínimas:**
  1. CLI, versión fijada (`cline@3.0.74`), auto-actualización apagada, `OTEL_TELEMETRY_ENABLED` sin definir.
  2. En una máquina virtual o contenedor sin red salvo `localhost` (Ollama), sin `~/.ssh`, sin `.env`, sin tokens de git.
  3. Repo montado de solo lectura, o copia sin remoto; los resultados se escriben a una carpeta de salida separada.
  4. Sin `--yolo`/`--auto-approve`; sin cuenta Cline; sin MCP extra.
  5. Un modelo local es lento y menos fiable: los resúmenes se verifican contra el repo.

## 2. DeepSeek Harness — dos respuestas
### 2a. El proyecto oficial existe
- **Fuente:** `deepseek-ai/deepseek-harness` (organización de DeepSeek), commit `22ddee37`, MIT, versión `0.2.1-rc.3` (`package.json`), «developer preview». Su propio `SAFETY.md` dice: **«no ha pasado una auditoría de seguridad y no debe tratarse como seguro»**, ejecuta código y comandos generados por el modelo, carga plugins de terceros y accede a red, procesos, credenciales y archivos; recomienda una máquina virtual desechable (`SAFETY.md`, secciones «Experimental status» y «Responsible use»).
- **Instalador oficial:** descargas en `https://download.deepseek.com` (`apps/desktop/scripts/desktop-publish-config.ts:28`); app ID `com.deepseek.harness` (`apps/desktop/packaging/README.md:176`). También se puede ejecutar desde fuente o `npx @deepseek-ai/dsh web` (sin firma de instalador).
- **Qué envía:**
  - **Analítica de producto del escritorio: ENCENDIDA por defecto y sin control de usuario** (`packages/client/product-analytics/README.md`, ajuste `enabled` por defecto `true`, «sin control visible»). Cada evento lleva `device_id`, `user_id`, `app_version`, sistema operativo, modelo de CPU, número de núcleos y **memoria total**.
  - **Identificador anónimo** `~/.dsh/.anonymous-user-id`, enviado en la cabecera `x-deepseek-harness-user-id` en cada petición al proveedor (`packages/identity/anonymous-user-id/README.md`).
  - **Telemetría de sesión:** exporta el registro de la sesión (incluido contexto) **después de que el usuario dé feedback explícito**; modo por defecto `FEEDBACK_ONLY`, apagable (`packages/session/session-telemetry-otel/README.md:14,60`).
  - **Apagado:** `DSH_TELEMETRY_DISABLED` con **cualquier** valor no vacío (`packages/boot/app-boot/src/profile-context.ts:28-48`). Si esto apaga también la analítica de producto del escritorio, no lo pude confirmar.
- **Permisos y capacidades:** incluye paquetes `computer-use` (controla pantalla/ratón) y `browser-use`, `credentials`, plugins y MCP (`packages/`). Hosts: `api.deepseek.com`, `platform.deepseek.com`, `download.deepseek.com`, y espejos `registry.npmmirror.com` y `hf-mirror.com` (descargas en ejecución).
- **Veredicto oficial:** solo en sandbox (máquina virtual desechable, sin credenciales ni datos reales), `DSH_TELEMETRY_DISABLED=1`, de preferencia CLI/web local y no el escritorio, sin `computer-use`/`browser-use`, sin plugins de terceros, con modelo local o clave desechable. Es preview con roturas de compatibilidad entre versiones: fijar la versión.

### 2b. La ventana de la laptop de Marcos — rechazada hasta identificarla
No puedo ver esa laptop, así que **no puedo afirmar que sea el producto oficial**: hay clientes de terceros («DSH Desktop», plugins de Obsidian) que se publicitan con el mismo nombre. Mientras no se sepa de dónde vino, **no se usa, no se le da ninguna clave ni se abre ningún archivo del negocio**. Comprobaciones (solo lectura) para Claude PC / Marcos:
1. **Origen:** ruta del ejecutable y proceso (Windows: Administrador de tareas → clic derecho → «Abrir ubicación»; macOS: «Acerca de» y `codesign -dv`).
2. **Firma:** el oficial firmado muestra editor/certificado de DeepSeek; las compilaciones sin firma se rotulan «DSH Local Build» con insignia de versión/commit (`apps/desktop/packaging/README.md:72`). Una compilación local sin firma de procedencia desconocida = no confiable.
3. **App ID:** `com.deepseek.harness`; carpeta de datos `~/.dsh` (o `%USERPROFILE%\.dsh`).
4. **Hash:** comparar el hash del instalador con el publicado en `download.deepseek.com` (no localicé una lista de hashes publicada en el repo; **no pude verificarlo desde aquí**).
5. **Cómo llegó:** si apareció sin que nadie la instalara, tratarlo como incidente: cerrar la ventana, no ingresar claves, avisar a la dueña, y revisar procesos y programas de inicio.

## No revisé
- Ejecución real (tráfico de red observado), código compilado, dependencias transitivas, ni la extensión de VS Code de Cline más allá de su configuración de PostHog.
- Si `DSH_TELEMETRY_DISABLED` apaga la analítica de producto del escritorio.
- La laptop de Marcos.

---
## Autorización de la dueña (28-oct-2026)
La dueña decidió usar **Cline** y **DeepSeek Harness**. Es decisión suya; **el veredicto técnico del Revisor no cambia** (riesgo medio y alto, ver arriba). Queda autorizado **solo bajo estas condiciones mínimas**:
1. **Cline:** solo la CLI `cline@3.0.74`, auto-actualización apagada, sin `--yolo`/`--auto-approve`/zen, sin cuenta Cline, modelo local (Ollama).
2. **DeepSeek Harness oficial** (`deepseek-ai/deepseek-harness` 0.2.1-rc.3, instalado desde `download.deepseek.com` o desde el repo): con `DSH_TELEMETRY_DISABLED=1`, sin `computer-use`/`browser-use`, sin plugins de terceros.
3. **Ambos dentro de una máquina virtual o contenedor desechable**, sin `~/.ssh`, sin `.env`, sin tokens de git ni llaves de Render/Cloudflare, con el repo en solo lectura o una copia sin remoto. Si usan una API externa, una clave desechable con tope de gasto, nunca las del negocio.
4. **Excluida:** la ventana que apareció en la laptop de Marcos. No se autoriza hasta identificar su origen (ruta, firma, app ID `com.deepseek.harness`, hash). Si resulta ser el producto oficial, entra en el punto 2.
5. Datos reales (clientes, costos, precios, facturas) **no** se pegan en ninguna de las dos.
