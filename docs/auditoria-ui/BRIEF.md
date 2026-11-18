# Auditoría de calidad del software Nexora POS (18-nov-2026) — instrucciones para cada agente

Objetivo: encontrar la MAYOR cantidad posible de errores, de todo tipo y tamaño (letra, ortografía, acentos, color, contraste, tamaño, alineación, diseño, cortes de texto, errores de entrada, cifras que no cuadran, botones que no hacen nada, mensajes confusos, inconsistencias entre pantallas, fallos en español (es-DO, es-ES, es-MX) y en inglés (en-US)).

## Reglas duras (se rompen = se cancela la tarea)
1. **SOLO LECTURA. No cambies NADA en el sistema real.** Prohibido: guardar, confirmar, crear, editar, anular, cobrar, cerrar caja, subir archivos, importar, PATCH/POST/PUT/DELETE. Puedes abrir pantallas, filtrar, buscar, cambiar fechas, abrir ventanas, escribir datos inválidos en campos SIN pulsar el botón que guarda, y ejecutar/ver reportes (solo ver/exportar a pantalla, no enviar a nadie). Si dudas de si un botón guarda: no lo pulses y anótalo como duda.
2. **Nunca imprimas ni repitas credenciales.** El usuario y la clave están en las variables de entorno NEXORA_CLAUDE_USER y NEXORA_CLAUDE_PASSWORD (úsalas en el código, no las muestres). Para llamadas GET a la API: `python3 /home/user/awesome-outbid/docs/coordinacion/claude-nube/entrar.py` deja el token en /tmp/nexora_tok (usa solo GET; si da 401 repite el comando).
3. Sitio: https://nexora-pos-web.onrender.com (API en /api). Es producción: no hagas más de unas pocas peticiones por segundo y no recargues en bucle.
4. No toques git, ni archivos fuera de tu carpeta de salida, ni precios, ni inventario.

## Herramientas
- Chromium y Playwright ya instalados: `require('playwright')` en Node (o python playwright). `chromium.launch()` sin opciones. NO ejecutes `playwright install`. Inicia sesión por el formulario con las variables de entorno. Capturas con deviceScaleFactor 1.
- Prueba escritorio 1440×900 y móvil 390×844; tema claro y oscuro si existe; idioma: busca selector de idioma; si no existe anótalo como hallazgo y prueba con `locale: 'en-US'`, `'es-DO'`, `'es-ES'` y `'es-MX'` en el contexto del navegador.
- Mira las capturas con Read para juzgar color, tamaño, alineación y texto cortado.

## Entrega
- Archivo CSV UTF-8: `/home/user/awesome-outbid/docs/auditoria-ui/<tu_area>.csv` con columnas: `id,area,pantalla,idioma,viewport,severidad(alta|media|baja|minima),tipo(texto|ortografia|color|contraste|tamano|diseno|entrada|funcion|dato|traduccion|formato),que_paso,como_repetir,esperado,captura`
- Capturas en `/tmp/claude-0/-home-user-awesome-outbid/3ba19465-dbde-5459-a44f-40c1ceee85e7/scratchpad/qa/<tu_area>/` (nombres claros) y pon la ruta en la columna `captura`.
- Mínimo esperado: cubre TODAS las pantallas de tu área y apunta todo, hasta lo mínimo (una coma, un acento, 2 px). Sé específico: pantalla exacta, texto exacto, valor esperado.
- Respuesta final: tabla corta con conteo de hallazgos por severidad, las 5 peores cosas y qué pantallas NO pudiste revisar y por qué. No inventes: si no puedes comprobarlo, dilo.
