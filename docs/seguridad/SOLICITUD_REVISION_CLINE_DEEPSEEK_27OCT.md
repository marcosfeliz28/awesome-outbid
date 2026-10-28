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
