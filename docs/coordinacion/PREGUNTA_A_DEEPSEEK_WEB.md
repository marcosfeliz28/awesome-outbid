# Prueba de capacidades para DeepSeek web (chat.deepseek.com)

Activa DeepThink. Envía las pruebas una por una, en este orden, y pega cada respuesta completa. No incluyas datos del proyecto, claves ni archivos del repo: son ejercicios sintéticos.

## Prueba 1 · Función pura con pruebas
> Escribe en TypeScript una función pura `isValidLuhn(s: string): boolean` que valide números de tarjeta con el algoritmo de Luhn. Ignora espacios y guiones. Rechaza cadenas con letras. Incluye 5 pruebas con Vitest. Sin dependencias. Muestra solo el código.

## Prueba 2 · Componente React
> Escribe un componente React con TypeScript llamado `KpiCard` que reciba `label`, `value` y `state` (`"loading"`, `"error"` o `"ready"`). Debe mostrar un esqueleto en carga, un mensaje en error y el valor en listo. Sin librerías, con CSS en el mismo archivo y soporte de modo oscuro con `prefers-color-scheme`.

## Prueba 3 · Error de dinero
> Este código tiene un error. Dime cuál es y corrígelo:
> ```ts
> const total = 0.1 + 0.2;
> console.log(total === 0.3);
> ```
> Luego escribe una función `sumarPesos(centavos: number[]): number` que sume importes en centavos enteros sin errores de punto flotante.

## Prueba 4 · Límite de contexto (sin pegar nada grande todavía)
> ¿Cuántos tokens de contexto puedes manejar en una sola conversación? Si te pego 60.000 caracteres de código en un solo mensaje, ¿qué pasa? ¿Lo partes, lo truncas o lo rechazas? Responde en tres líneas.

## Prueba 5 · Honestidad sobre lo que no puedes hacer
> Responde sí o no, y una línea por cada punto: ¿puedes entrar a internet ahora mismo? ¿Puedes leer archivos de mi computadora? ¿Puedes ejecutar código y ver el resultado? ¿Recuerdas esta conversación mañana?

Cuando termines las cinco, pega aquí todas las respuestas tal cual, sin resumir.

## Prueba 4b · Texto mediano (8.000 caracteres)
Copia el contenido completo de `docs/coordinacion/TEXTO_PRUEBA_8000_DEEPSEEK.txt` y pégalo en DeepSeek con esta pregunta al final:
> ¿Cuál es la última palabra clave del texto? ¿Cuántos caracteres aproximados recibiste? Responde en dos líneas.

## Prueba 4c · Texto grande (500.000 caracteres)
Sube el archivo `docs/coordinacion/TEXTO_PRUEBA_500000_DEEPSEEK.txt` como adjunto en DeepSeek web (no lo pegues: es demasiado para el cuadro de texto) y pregunta:
> ¿Cuál es la última palabra clave del texto? ¿Cuántos caracteres aproximados recibiste? ¿Lo recibiste completo o lo truncaste? Responde en tres líneas.
