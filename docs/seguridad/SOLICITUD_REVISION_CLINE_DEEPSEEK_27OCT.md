# Solicitud al Revisor · Cline y DeepSeek Harness como «manos» de solo lectura · 27-oct-2026

Pedido por Marcos (dueña). Lo que quiere: que Claude PC pueda usar herramientas de IA adicionales para tareas de solo lectura (análisis de logs, comparación de ramas, resúmenes), sin modificar el repo ni desplegar, y que el resultado se anexe a los trabajos.

## Herramientas a revisar
1. **Cline** (https://github.com/cline/cline): agente de código abierto, Apache 2.0. Instalación: `npm i -g cline` o Marketplace de VS Code/JetBrains. Propuesta: solo con un modelo local vía Ollama, sin clave de API en el chat, sin telemetría si se puede desactivar. Datos abiertos: no está claro en la página si envía telemetría por defecto.
2. **DeepSeek Harness**: apareció como ventana en la laptop de Marcos. Origen, versión y permisos NO verificados. Pedimos que se revise antes de cualquier uso.

## Condiciones que proponemos
- Solo lectura sobre el repo: nada de escribir en `producto-nexora` ni `nexora-cloud`.
- Sin claves ni datos reales en el entorno; si usan API externa, solo con código que se pueda compartir.
- Versiones fijas, telemetría apagada, sin hooks que aprueben permisos (el caso de oh-my-claudecode).
- Resultado de cada tarea en `docs/` de una rama `claude-pc/*`, con quién lo hizo.

## Pregunta al Revisor
¿Se pueden usar como herramientas de solo lectura? Indica para cada una: veredicto (aprobado / solo en sandbox / rechazado), riesgos, y condiciones mínimas. Responde en `docs/seguridad/PLUGINS.md` (rama nexora-cloud) o en la respuesta de esta solicitud.

## Ampliación (27-oct, noche): auditoría prioritaria de DeepSeek Harness
Marcos pide que se audite DeepSeek Harness antes de usarlo como «mano» nueva. Datos conocidos: ventana «DeepSeek Harness» visible en la laptop de la dueña (a las 8:20 p. m. RD, 27-oct); origen, instalador, versión, editor, ruta del ejecutable y permisos NO verificados. Pedimos: identificar el proveedor y el instalador oficial, verificar firma y hash, listar permisos y red que usa, si envía datos o telemetría y a dónde, y veredicto (aprobado / solo en sandbox / rechazado). Nada se usa hasta ese veredicto.

## Verificación local y uso autorizado (27-oct, ~8:40 p. m. RD)
- Marcos autorizó DeepSeek Harness **solo en modo lectura**, aceptando el riesgo, sin acceso a GitHub ni a repos privados.
- Verificación local (solo lectura): ejecutable `AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe`, firma válida de «Hangzhou DeepSeek Artificial Intelligence Co., Ltd.», versión 0.2.1-rc.3, SHA256 FD7D298F4BA03EE9BAB1719A892AFEAEF5C09BF50C574A592A64C85F64574C0C. Versión candidata, no estable.
- Observado: en una conversación previa de la app le pedía a Marcos `gh auth login` y la ruta de un repo privado. Esa conversación no se usó.
- Primera tarea en sesión nueva con «Read Only»: revisar `claude-pc/qa-bajos` (d9d79664) para listar pruebas e2e intermitentes. Respuesta pendiente.
- Veredicto del Revisor: pendiente. Pedido enviado a Nexora 4.

## Veredicto condicionado del Revisor (081dbb5, rama claude/revisor-plugins) y pausa
- Cline: riesgo medio. Autorizado solo como CLI cline@3.0.74, auto-actualización apagada, sin --yolo/--auto-approve, sin cuenta Cline, con Ollama local. No la extensión de VS Code.
- DeepSeek Harness: riesgo alto. Autorizado solo la versión oficial deepseek-ai/deepseek-harness 0.2.1-rc.3 con DSH_TELEMETRY_DISABLED=1, sin computer-use ni plugins de terceros.
- Condición de entorno: VM o contenedor desechable, sin ~/.ssh, .env, tokens de git ni llaves de Render o Cloudflare; repo solo lectura o copia sin remoto; sin datos reales.
- La ventana de la laptop de Marcos queda EXCLUIDA hasta identificarla completamente (app ID com.deepseek.harness, carpeta ~/.dsh, hash frente al instalador oficial).
- Hecho antes del veredicto: una tarea de solo lectura enviada a la ventana de la laptop («Revisar fallo CI…»). Pausada desde ahora. Sin respuesta registrada.
- Pendiente de Marcos: decidir si crea la VM o contenedor desechable. Sin ella no instalo Cline ni DeepSeek.

## Registro de lo enviado a DeepSeek Harness (requerido por el Revisor)
- Contenido: un solo mensaje de texto escrito por Claude PC. Incluye la instrucción de solo lectura, el nombre del repo público (github.com/marcosfeliz28/awesome-outbid), el nombre de la rama (claude-pc/qa-bajos) y el hash d9d79664. No contiene claves, tokens, contraseñas, datos de clientes, costos, precios ni facturas. No se adjuntó ningún archivo.
- Modelo: DeepSeek-V4-Pro (el que muestra la propia app). Modo: Read Only.
- Clave: ninguna. Claude PC no escribió ninguna clave. La app usa la cuenta que ya tiene abierta en la laptop de Marcos; no sé si esa llamada salió a api.deepseek.com o a otro endpoint.
- Respuesta de la app: empezó a analizar y mencionó que podía leer el contenido del repo por web. No se registró una respuesta final ni se aplicó ningún cambio.
- Estado: sesión pausada desde este registro. No se envía nada más a esa ventana.

## Solicitud de ampliación: DeepSeek Harness como auditor del software completo (27-oct, noche)
Marcos pide ampliar el uso de DeepSeek Harness a auditor del software completo. Pedimos al Revisor que indique si se autoriza, y en qué condiciones.
- Alcance propuesto: auditoría de solo lectura del repositorio completo, con hallazgos por severidad y archivo/línea.
- Condición de datos que el Revisor debe fijar: el código fuente sube a la cuenta y al servicio de DeepSeek. ¿Se autoriza con código del repo público únicamente? ¿Se excluyen configuraciones, `.env`, scripts con URLs internas y cualquier archivo con secretos?
- Condición de entorno: VM o contenedor desechable (sin resolver todavía).
- Mientras no haya veredicto y VM, Claude PC audita el software con sus propios agentes en solo lectura, y lo entrega en `docs/qa/`.

## Preparación de la exportación para auditoría de código (27-oct, noche)
- Exportación preparada desde origin/producto-nexora (78888542) con git archive, lista permitida: apps/api/src, apps/web/src, packages, tests, schema.prisma, package.json, lockfile y package.json de api/web. 404 archivos. Carpeta local, NO enviada.
- Chequeo de exclusiones: sin .env*, .csv, .xlsx, .jsonl ni .sql.
- Escáner de secretos: 320 coincidencias, casi todas contraseñas de prueba literales (p. ej. «FitStore-QA-2026!») en tests/api.test.ts y otras pruebas. No son credenciales de producción, pero según la condición del Revisor, si el escáner encuentra algo, NO se envía.
- Pendiente de decisión: (a) el Revisor decide si las contraseñas de prueba se sustituyen por variables de entorno en la exportación, o se excluye tests/, o se autoriza su envío sabiendo que son de prueba; (b) entorno: VM desechable, o decisión escrita de Marcos para correr en la laptop.
- Nada enviado a DeepSeek.
- Segunda exportación (sin tests/, 27-oct noche): 173 archivos. Escáner: 1 coincidencia, `apps/api/src/common.ts:191`, `password: "contraseña"` — es la etiqueta de un campo, no una credencial (falso positivo). NO enviada: requiere autorización del Revisor para el falso positivo o renombrarla.
- Decisión de Marcos «procede» (sin escrito explícito de riesgo para la laptop): pendiente de confirmación por escrito del riesgo de correr en la laptop sin VM.
- Exportación según la orden del Revisor (apps/*/src, schema.prisma, package.json y lockfiles; sin tests/ ni packages/): 166 archivos. Con el patrón del Revisor (password|secret|token|api_key = 'literal'): 1 coincidencia, apps/api/src/common.ts:191, `password: "contraseña"`. El Revisor indicó cero coincidencias en apps/*/src, así que hay discrepancia. NO enviada hasta que el Revisor confirme esa línea (etiqueta/valor de UI) o autorice renombrarla.
- Pendiente aparte (para Llaves, no para DeepSeek): confirmar si FitStore-QA-2026! y los demás literales de tests/ son válidos en producción; si lo son, rotarlos (repo público).
- Decisión de Marcos sobre la laptop sin VM: pendiente por escrito.
- Revisor (27-oct noche): falso positivo AUTORIZADO (apps/api/src/common.ts:125 en nexora-cloud, `password: "contraseña"` dentro del mapa de etiquetas de campos; no es secreto). Con 173 archivos sin tests/, el escáner queda limpio: exportación autorizada.
- Condición pendiente: aceptación escrita del riesgo por Marcos, con sus palabras, para correr DeepSeek Harness en la laptop sin VM. Debe decir: (a) que corre DeepSeek Harness en la laptop sin VM; (b) que la herramienta puede leer cualquier archivo de esa cuenta de Windows; (c) que usará una cuenta o sesión de Windows aparte, sin llaves ni sesiones abiertas de Render, Cloudflare o banco.
- Hasta que exista, NO se envía. Alternativa: VM o Windows Sandbox (no requiere esa aceptación).

## Aceptación escrita del riesgo por Marcos (27-oct, ~9:30 p. m. RD)
> «Acepto el riesgo de correr DeepSeek Harness en mi laptop sin VM. Entiendo que puede leer cualquier archivo de esta cuenta de Windows. Lo usaré desde una cuenta o sesión de Windows aparte, sin llaves ni sesiones abiertas de Render, Cloudflare o banco.»
- Cumple los tres puntos exigidos por el Revisor.
- Condición de ejecución: la app debe correr desde una cuenta o sesión de Windows aparte. La ventana actual está en la cuenta principal. Antes de enviar, debe confirmarse esa cuenta aparte.
- Exportación autorizada: 173 archivos (apps/*/src, schema.prisma, package.json y lockfiles; sin tests/ ni packages/). Escáner limpio tras autorizar el falso positivo de common.ts.
- Estado: aceptación registrada. Envío pendiente de confirmar la cuenta aparte.

## Decisión explícita de Marcos: envío desde la cuenta principal (27-oct, ~9:40 p. m. RD)
- Marcos responde «procede y punto»: decide enviar la exportación desde la cuenta principal de Windows, sin cuenta aparte. Esto supera la condición de su aceptación escrita (usar cuenta aparte); la decisión es suya y queda registrada.
- Exportación enviada: lista estricta del Revisor (apps/*/src, schema.prisma, package.json, pnpm-lock.yaml, apps/api/package.json, apps/web/package.json): 166 archivos. Carpeta: C:/Users/marco/AppData/Local/Temp/auditoria-codigo-revisor. Sin tests/, sin packages/, sin .env, CSV, XLSX, JSONL ni SQL. Escáner de secretos: 1 coincidencia autorizada (apps/api/src/common.ts:125 en nexora-cloud, `password: "contraseña"`, etiqueta de UI).
- Modo: Read Only, sesión nueva. No se hizo clic en 👍/👎. DSH_TELEMETRY_DISABLED=1 no se pudo verificar desde la interfaz.
- Hora de envío: ver registro siguiente.
- Estado al intentar el envío (27-oct, ~8:56 p. m. RD): NO enviado. La cuenta de DeepSeek muestra «Request quota exhausted» (ACCOUNT_QUOTA) en la sesión existente. El clic en «New Session» no abrió sesión nueva. La sesión antigua («Revisar fallo CI…») tiene 11 subtareas y un objetivo inactivo para auditar el repo público; no se escribió nada en ella. Pendiente: que Marcos decida si recarga la cuenta, cierra la sesión antigua y crea una nueva.
- Revisor (27-oct noche): la aceptación escrita de Marcos está registrada y la exportación de 166 archivos puede enviarse. Falta confirmar la cuenta de Windows: si usa cuenta aparte o la principal.
- Marcos respondió a esa pregunta con «conio procede y punto», sin elegir explícitamente cuenta. Pendiente: confirmación explícita de la cuenta (principal o aparte).
- Además, la cuenta de DeepSeek muestra «Request quota exhausted»: el envío no tendría respuesta aunque se confirme.
- NO enviado.
- Revisor (27-oct noche): la pregunta de cuenta queda cerrada. Marcos aceptó los riesgos por escrito y respondió «procede y punto», y se toma como decisión suya de enviar desde la cuenta principal. Sin cuenta aparte. Se mantienen: solo las 166 rutas, Read Only, DSH_TELEMETRY_DISABLED=1, sin 👍/👎, sin computer-use ni browser-use.
- Bloqueo real: cuota agotada en DeepSeek. No se evita con otra cuenta, otra clave ni otro modelo sin petición expresa de Marcos.
- NO enviado: falta recargar la cuenta de DeepSeek (decisión de Marcos).
- Revisor (27-oct noche): Marcos recargará la cuenta de DeepSeek él mismo, en la app o en platform.deepseek.com. Claude PC no pide ni pega claves ni datos de pago, y no genera claves nuevas. Cuando la app muestre cuota disponible, se envía la exportación de 166 archivos con las mismas condiciones.
- Estado: esperando la recarga de Marcos. NO enviado.
- 27-oct, ~9:04 p. m. RD: Marcos indica que cargará $20 de tokens y que seguimos con el trabajo. En la app se ve la pantalla de recarga (monto $2 seleccionado; pagos con PayPal o tarjeta). El pago lo hace Marcos; Claude PC no toca esa pantalla. Envío pendiente de que la app muestre cuota disponible.
