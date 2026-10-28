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
