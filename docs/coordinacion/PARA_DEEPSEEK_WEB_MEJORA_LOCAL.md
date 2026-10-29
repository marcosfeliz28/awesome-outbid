# Mensaje para DeepSeek web: mejorar nuestra IA local (sin datos del negocio)

Copia desde «Hola» hasta el final y pégalo en DeepSeek. No incluye código de la empresa, datos de clientes ni claves.

---

Hola. Necesito ayuda para hacer más rápido y más fiable un modelo local que corre en mi laptop. Te doy todos los datos técnicos. Responde con pasos concretos y, para cada cambio, di qué ganancia esperas y cómo se revierte.

**Hardware:** AMD Ryzen 7 8840U (8 núcleos físicos, 16 hilos), 31 GB de RAM DDR5, gráfica integrada AMD Radeon 780M (RDNA3, gfx1103). Windows 11.

**Software:** Ollama 0.40.12 para Windows. Modelo: Qwen 2.5 Coder 14B cuantizado Q4_K_M (unos 9 GB). Lo uso para escribir funciones pequeñas con pruebas y borradores de texto.

**Configuración actual (Modelfile):**
```
FROM qwen2.5-coder:14b
PARAMETER num_ctx 8192
PARAMETER num_thread 8
PARAMETER temperature 0.2
SYSTEM """ (reglas fijas de trabajo, unos 1.300 caracteres) """
```
Variable de entorno: `OLLAMA_KEEP_ALIVE=24h`.

**Lo que medí (con una pregunta corta de unas 50 palabras de entrada y 160 de salida):**
- Generación: unos 6 tokens por segundo. Con 2.500 tokens de salida, unos 7 minutos.
- Lectura de entrada: 15 tokens por segundo sin caché; más de 2.000 tokens por segundo cuando el prefijo (las reglas del SYSTEM) ya está en caché.
- El log del servidor muestra solo buffers de CPU. No hay ninguna capa en la GPU, aunque el Modelfile antes pedía `num_gpu 99`.
- Con `num_ctx 16384` el caché de atención ocupaba unos 3 GB.

**Mis preguntas, en orden:**
1. ¿Cómo puedo usar la Radeon 780M con Ollama 0.40 en Windows? ¿Vulkan o ROCm? Dame la secuencia exacta, cómo comprobar que la GPU se usa de verdad (qué línea buscar en el log) y los riesgos: qué pasa si el controlador se cae o si el modelo se corrompe.
2. Con la misma CPU, ¿qué variables de entorno o parámetros de Ollama aceleran la generación en CPU? Por ejemplo `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE` (q8_0 o q4_0), `OLLAMA_NUM_PARALLEL=1`, `num_batch` o `num_thread`. Para cada una: efecto esperado y forma de medirlo.
3. ¿Conviene otra cuantización del mismo modelo para CPU (por ejemplo Q5_K_M o Q4_0), o mantener Q4_K_M? Dame la ganancia de velocidad frente a la pérdida de calidad, y ojo: cambiar la cuantización significa bajar otra variante del modelo; dime si eso es necesario.
4. Para tareas de código con prueba primero, ¿qué formato de instrucción reduce las respuestas inventadas y las vallas de Markdown que no pedí? Dame dos ejemplos de instrucción de sistema cortos.
5. Dame un plan de medición con tres números antes y después (tokens por segundo de salida, de entrada en caché y tiempo total de una tarea de 300 tokens), para saber si cada cambio ayudó.

Al final, resume en una tabla: cambio, ganancia esperada, riesgo, cómo se revierte, y si necesita mi permiso. No me des pasos que borren modelos ni archivos.
