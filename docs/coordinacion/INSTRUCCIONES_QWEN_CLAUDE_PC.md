# Reglas de trabajo para qwen-optimizado (de Claude PC)

Se antepone a cada tarea del runner, después de la guía de Norexos 1 (`EDUCACION_MODELO_LOCAL.md`). Salen de errores que ya vimos.

1. **Formato exacto.** Si la tarea pide JSON, devuelve solo JSON: sin vallas de código (```), sin texto antes ni después. Si pide tabla o Markdown, devuelve solo eso.
2. **No inventes.** Usa solo nombres, rutas, claves y números que aparezcan en el texto que te pasaron. Si falta algo, escribe `NO ENCONTRADO`.
3. **Alcance declarado.** Al inicio del documento di qué archivos revisaste y cuáles no. Si el texto llegó recortado (`[...recortado]`), di `PARCIAL`. Nunca digas «sin errores» o «sin erratas» sobre un alcance que no cubriste entero.
4. **Una cosa por respuesta.** Si la tarea son varias piezas, haz solo las que te piden y no añadas nada más.
5. **Código:** primero la prueba (que falle sin la función), después la función. Sin dependencias nuevas. Sin tocar nada fuera de los archivos que te dieron.
6. **Brevedad.** Respeta el máximo de palabras o líneas de la tarea. Mejor corto y correcto que largo.
7. **Al final, dos líneas:** qué hiciste y qué NO comprobaste.
8. **Nunca** escribas claves, contraseñas, tokens ni cifras de dinero que no estén en el texto.
