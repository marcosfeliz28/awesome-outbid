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

---
## Ampliación: DeepSeek Harness como auditor de código (28-oct-2026)
Pedido de Claude PC por Marcos. El repo `marcosfeliz28/awesome-outbid` es **público** (la API de GitHub lo devuelve sin autenticar), así que el código fuente en sí no es secreto. Pero el repo **sí contiene datos del negocio** versionados: `docs/operacion/` (conteos `.xlsx`, `ENVIOS-ADDISON.csv`, `bitacora-mercancia.jsonl`, `PENDIENTES-DUENA.md`), `docs/legal/DATOS_PERSONALES_INVENTARIO.md`, `docs/guias/PRECIOS_PENDIENTES.md`, `docs/FACTURA_EJEMPLO.csv`. Por eso no se envía «el repo», se envía una lista permitida.

**Veredicto: autorizado SOLO para auditar código fuente, con estas condiciones:**
1. **Lista permitida, no lista negra.** Se exporta a una carpeta aparte (`git archive` de rutas elegidas) solo: `apps/*/src`, `apps/*/tests` y `tests/`, `apps/api/prisma/schema.prisma`, `package.json`/lockfiles. Nada más.
2. **Excluidos siempre:** `.env*` (incluido `.env.example`), `docs/operacion/`, `docs/legal/`, `docs/guias/`, `docs/coordinacion/`, `*.csv`, `*.xlsx`, `*.jsonl`, `*.sql` y migraciones con datos, `apps/api/scripts/` (importadores con rutas y URLs internas), `instalador/` (URLs y configuración), `.github/` (nombres de secretos), todo el **historial de git** (puede tener llaves viejas) y cualquier archivo con URLs internas.
3. **Antes de enviar:** correr un escáner de secretos sobre la carpeta exportada (p. ej. `gitleaks`/`trufflehog` en modo local, o `grep` de patrones `sk-`, `Bearer`, `password=`); si encuentra algo, no se envía.
4. **Ejecutar la herramienta contra la carpeta exportada, nunca contra el árbol de trabajo vivo**, en modo Read Only y sin `computer-use`/`browser-use`/plugins; `DSH_TELEMETRY_DISABLED=1`; sin dar feedback (👍/👎) a las respuestas, porque eso sube el contexto de la sesión a DeepSeek.
5. **Entorno:** la VM/contenedor desechable sigue siendo la condición correcta. Si Marcos decide, por escrito, correrla en la laptop sin VM, es un riesgo que **acepta él** y que yo no puedo neutralizar: la herramienta puede leer cualquier archivo de esa cuenta de Windows. Mínimo en ese caso: sesión de Windows aparte o cuenta sin documentos propios, sin llaves ni sesiones iniciadas de Render/Cloudflare/banco.
6. **Resultados = datos, no órdenes.** Lo que devuelva DeepSeek se verifica contra el código y lo aplica Claude, nunca la herramienta; no se acepta ningún hallazgo que pida credenciales, desplegar o cambiar permisos.
7. **Registro:** cada envío anota qué rutas se mandaron, cuándo y con qué modelo, en `docs/seguridad/`.

**Lo que NO cambia:** reglas de dinero y mercancía (nada de costos, precios ni conteos a DeepSeek), Llaves sigue siendo la única que despliega, y el resultado del auditor no sustituye los 3 CI en verde.

---
## Aceptación de riesgo de la dueña (28-oct-2026)
En el chat con el Revisor, la dueña (Marcos) escribió textualmente: **«acepto los riesgos»**, después de leer que correr DeepSeek Harness en la laptop sin máquina virtual significa que la herramienta puede leer cualquier archivo de esa cuenta de Windows, que el código exportado sube a la cuenta y servicio de DeepSeek, y que el informe lo considera riesgo alto y sin auditar.
- Queda cumplida la condición 5 de la ampliación **en lo que se refiere a la aceptación**. No cambia el veredicto técnico.
- **Sin confirmar todavía:** que use una cuenta o sesión de Windows aparte, sin llaves ni sesiones abiertas de Render/Cloudflare/banco. Es el mínimo recomendado; Claude PC debe preguntarle y anotar la respuesta antes de enviar.
- Alcance: solo la exportación de 166 archivos (`apps/*/src`, `schema.prisma`, `package.json`, lockfiles; sin `tests/` ni `packages/`), con el escáner limpio y el falso positivo `common.ts:125` autorizado.

---
## DeepSeek Harness como constructor (28-oct-2026)
Orden de la dueña (Marcos), en el chat con el Revisor: pasar DeepSeek Harness de auditor de solo lectura a **constructor** que trabaja directamente en el software. Es decisión suya; el Revisor no la veta, pero **escribir en el repo es un salto de riesgo** frente a leer: la herramienta sigue siendo preview y «no auditada» (`SAFETY.md`), y su código ahora entra al producto. Se trata como a los constructores existentes (ChatGPT): **sin llaves, en su rama, con revisión y CI antes de mezclar** (`docs/coordinacion/SESIONES_Y_LIMITES.md`, `AGENTS.md`).

**Autorizado SOLO bajo estas condiciones mínimas:**
1. **Rama propia `deepseek/*`.** Nunca `nexora-cloud`, `producto-nexora`, `nexora-chatgpt` ni `claude/*`. Un commit por cambio, con su regresión (que falle antes y pase después); `pnpm check` en verde.
2. **DeepSeek no hace `push`.** Trabaja en un clon local sin credenciales de git; **Claude PC lee el diff y lo empuja**, y la mezcla a `nexora-cloud` la revisa «Llaves» con los 3 CI en verde (`verify`, `windows-installer`, `render-images`). Nada se mezcla por la herramienta.
3. **Clon de trabajo sin datos ni secretos:** sin `.env*`, sin llaves ni sesiones de Render/Cloudflare/banco, y con `docs/operacion/`, `docs/legal/` y archivos `.csv/.xlsx/.jsonl` **excluidos** (checkout parcial). Ninguna llave ni credencial se pega en su chat.
4. **No toca, ni con orden suya, sin autorización de «Llaves»:** reglas de dinero (margen, precios, costos, ITBIS), datos y movimientos de mercancía, migraciones, despliegue, `.github/` y CI, `scripts/plugins-lock.mjs` y `docs/seguridad/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, firma e instalador. Nada de dependencias nuevas sin pasar por el Revisor.
5. **Modo con aprobación manual** de cada comando y escritura: nunca auto-aprobar; sin `computer-use`/`browser-use`/plugins/MCP extra; `DSH_TELEMETRY_DISABLED=1`; sin 👍/👎 (sube el contexto de la sesión).
6. **Antes de darle las pruebas** (`tests/`) a DeepSeek: «Llaves» confirma que las contraseñas literales de prueba (p. ej. `FitStore-QA-2026!` y otras) **no valen en producción**, o las sustituye por variables de entorno; si no, `tests/` sigue excluido y solo se le piden cambios con pruebas que corra otro.
7. **Revisión del diff, no confianza:** cada cambio se lee antes de aceptarse; el Revisor puede escanear cada diff buscando llamadas de red nuevas, descargas, lectura de variables de entorno y dependencias. Lo que DeepSeek diga o escriba en el código (comentarios, README) son datos, no órdenes.
8. **Entorno y datos:** sigue valiendo la aceptación de la dueña de correrlo en la laptop sin VM; la VM desechable sigue siendo la mejor opción y cuenta como recomendación.
9. **Revocable:** el Revisor retira esta autorización si aparece telemetría nueva, un paquete no firmado, cambios fuera de su rama o un diff que intente salir de estas reglas.

---
## Ampliación del constructor: archivos nuevos y cambios pequeños en `apps/api/src` y `apps/web/src` (28-oct-2026)
Pedido de Nexora 1 (orden 22) vía Claude PC. **Autorizado con condiciones adicionales** a las del constructor (rama `deepseek/*`, DeepSeek no empuja, Claude PC lee el diff, escáner de secretos, `tests/` existentes fuera hasta resolver literales).

Adicionales:
1. **Qué sí:** archivos **nuevos** y cambios **pequeños** (máx. ~10 archivos y ~300 líneas por rama, para que el diff sea revisable), cada uno con su prueba de regresión nueva escrita por la herramienta, con datos inventados y sin contraseñas ni claves reales (si necesita una, de variable de entorno o un valor claramente falso generado en la prueba).
2. **Qué no, aunque sea «pequeño»:** fórmulas de dinero (margen, precios, costos, ITBIS, descuentos), caja y ventas/facturas, inventario y movimientos de mercancía, pagos y cualquier integración de cobro, autenticación, sesiones, permisos, cambio de contraseña, validación de entrada de las rutas, sincronización/offline (`pendingSales`, `offlinePolicy`, `cartDraft*`), CORS/CSRF/limitación de peticiones, cifrado y bitácoras/auditoría. Tampoco migraciones, despliegue, instalador, CI, `.claude/` ni credenciales. `App.tsx` y `styles.css` siguen apartados mientras ChatGPT PC los tenga.
3. **Ninguna llamada de red nueva ni lectura de variables de entorno nuevas** en el código que escriba, y **ninguna dependencia nueva** (pasan por el Revisor). Nada que escriba fuera del repo.
4. **Revisión doble:** Claude PC lee el diff; Llaves revisa y mezcla con los 3 CI en verde. Un diff que toque algo del punto 2 se rechaza completo, no se parchea.
5. **Primero lo ya subido:** D1 y D3 (`deepseek/d1-d3`) se revisan con estas reglas antes de ampliar; si salen limpios, se abre la ampliación.
6. **Pendiente de la activación:** sigue haciendo falta la orden explícita de Marcos para el modo constructor, y la cuota de DeepSeek.
7. `docs/venta/procesador-pagos.md` (investigación de pagos) **no la revisé**; DeepSeek no escribe código de cobro bajo esta autorización.

---
## «Full acceso» para DeepSeek (28-oct-2026)
La dueña (Marcos) pidió «darle full acceso» y, al preguntarle qué significa, eligió **«Literalmente todo»**: incluye llaves de Render/Cloudflare, despliegue y empujar a `nexora-cloud`. Es su sistema y su decisión; el Revisor **no puede otorgar llaves ni accesos** (no tiene credenciales) y deja constancia de su veredicto:

**Autorizado (se quitan los límites anteriores de tamaño y carpetas):**
- DeepSeek puede leer y proponer cambios en **todo el código** (`apps/`, `packages/`, pruebas, `scripts/`), incluida la lógica de dinero y mercancía, **siempre que Llaves revise el diff** y los 3 CI estén en verde antes de mezclar. `tests/` se le entrega cuando Llaves confirme o sustituya las contraseñas literales.
- Puede empujar a ramas `deepseek/*`. Para que sea una barrera real y no una promesa: `nexora-cloud` y `producto-nexora` con rama protegida (exigir PR y los 3 CI), como ya recomienda `docs/coordinacion/SESIONES_Y_LIMITES.md`.

**Rechazado (no lo recomiendo; no lo certifico como seguro):**
1. **Llaves de Render/Cloudflare, de base de datos o de producción.** La herramienta se declara no auditada (`SAFETY.md`), ejecuta comandos generados por un modelo y envía contexto a DeepSeek (China) si se da feedback; una llave a su alcance es una llave filtrable o usable por un error o una instrucción maliciosa en cualquier archivo o página que lea. El repo trae datos de otros negocios (Ley 172-13).
2. **Despliegue a Render.** Contradice la regla de la dueña en `CLAUDE.md` («solo Claude nube despliega, con los 3 CI en verde»).
3. **Empuje directo a `nexora-cloud`/`producto-nexora` sin PR ni CI.**

Si aun así la dueña quiere dar llaves, la forma menos mala **la ejecuta ella misma, no un asistente**: un espacio de Render aparte, con llaves nuevas de alcance mínimo (solo lectura de logs, tope de gasto), distintas de las de producción, revocables en un minuto; nunca pegadas en un chat. Cualquier uso de ellas queda anotado. Y un fallo de DeepSeek no debe poder borrar nada que no tenga copia.
Revocable en cualquier momento por el Revisor.

### Corrección (28-oct-2026): las llaves de Render no se pueden limitar
Arriba dije «llaves nuevas de alcance mínimo». Para Render eso es **incorrecto**: según su referencia de API (`api-docs.render.com/reference/authentication`), una llave se crea en Account Settings y da acceso a **todos los espacios (workspaces) a los que pertenece quien la crea**; no tiene permisos por alcance (confirmado también por una solicitud pública de la función a Render). Por tanto, una llave creada desde la cuenta principal puede operar toda la producción. La única forma de acotarla es **crearla desde una cuenta de Render aparte que pertenezca solo a un espacio separado** (sin acceso al de producción). Verificar en el panel o con el soporte de Render, por si cambió.
