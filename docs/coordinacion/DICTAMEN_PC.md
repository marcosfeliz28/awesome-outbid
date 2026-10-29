# Dictamen de Claude PC sobre el bloque 9 (tareas 49–56)

Fecha: 29-oct-2026. Medido en la laptop (Ryzen 7 8840U, 31 GB RAM, Radeon 780M integrada, Windows 11).

## (a) Modelo local y capacidad real
- Modelo: `qwen-optimizado` (base qwen2.5-coder 14B, Q4_K_M, 14.8 B parámetros). Ocupa 9–12,5 GB en disco según la versión; contexto 16 384; temperatura 0,2.
- Tiempos medidos: tarea corta (L3) 30 s; tarea de glosario (L4) 137 s; la primera carga del modelo tardó más que el límite del puente (corregido con `OLLAMA_KEEP_ALIVE=24h`, que mantiene el modelo cargado 24 h).
- Velocidad en tokens por segundo: no medida todavía.
- Límites reales:
  1. No lee archivos: solo recibe el texto que el script le pasa (el runner ya inserta el contenido de los archivos de entrada, con recorte a 6 000 caracteres por archivo).
  2. No ve pantallas ni imágenes: no sirve para revisar UI o capturas.
  3. No ejecuta nada: no corre `pnpm check`, `vitest` ni `eslint`. Hoy no existe un bucle que aplique un parche y lo pruebe.
  4. Una tarea a la vez, y la calidad varía de una llamada a otra (temperatura 0,2).
  5. Ya se vio: borradores con datos inventados o alcance incompleto (L3, y una guía con pasos que no existían). Todo requiere revisión.

## (b) Veredicto por tarea
| # | Tarea | Veredicto | Motivo y tiempo estimado |
|---|---|---|---|
| 49 | `t()` con respaldo en español | puede con ayuda | Función pura y prueba: el modelo puede escribirla. Depende de que las tareas 25–27 (`es.json`/`en.json`) existan; hoy no lo verifiqué. ~1 h de revisión mía. |
| 50 | 14 funciones de COLA_FORJA | puede con ayuda | 3 hechas (`nx-brand`, `nx-plural`, `nx-fecha`), 11 pendientes. Cada una: borrador del modelo, prueba, revisión mía. ~30 min por función. |
| 51 | Selector ES/EN en la portada | no puede | Requiere juicio de UI y tocar la portada web; sin verificación visual. |
| 52 | Formulario «Pedir un cambio» | no puede | Depende de una ruta de API que hoy no verifiqué; la regla pide parar y avisar. |
| 53 | Animaciones CSS (4 primeras) | no puede (sin verificación visual) | El modelo puede escribir el CSS, pero no verifica el resultado ni la preferencia de movimiento reducido en el navegador. Lo puedo hacer yo con el navegador. |
| 54 | Textos de ayuda GV | no puede | Toca `Gv.tsx`; requiere juicio sobre el negocio y revisión de las pruebas de GV. |
| 55 | Vista de impresión de factura | no puede | Requiere captura y revisión visual; riesgo de tocar cálculos. |
| 56 | Pruebas extra de funciones puras | puede con ayuda | Solo `tests/`. Puede escribirlas; yo debo correrlas, porque el modelo no las ejecuta. ~20 min por prueba. |

## (c) Tareas más grandes que sí podría construir
Ninguna hoy sin un bucle de prueba. Con el bucle (aplicar parche, correr `vitest` y `pnpm check`, devolver el error al modelo) podría con funciones puras de tamaño medio, como las de COLA_FORJA. Sin ese bucle, no recomiendo asignarle nada de tamaño mayor a una función.

## (d) Cómo auditaré lo que construya el modelo
1. Script que rechaza cambios fuera de la lista permitida (dinero, mercancía, auth, migraciones, `.github/`, `render.yaml`, `CLAUDE.md`, variables de entorno) y cambios de más de 5 archivos.
2. Correr `vitest` del archivo nuevo y `pnpm check` en la laptop antes de subir.
3. Leer el diff completo, y verificar que la prueba falla antes de la función y pasa después.
4. LISTA solo con los 3 CI en verde del SHA exacto.

## Propuesta concreta
- Empezar por 50 (funciones puras de Forja) y 56 (pruebas), con el bucle del punto (c). Antes, construir el bucle (script de aplicar y probar). Ese bucle es mi trabajo, no del modelo.
- 51–55 quedan fuera hasta que Norexos 1 los reparta a mí o a un agente con navegador.
- Pido a Norexos 1 que confirme esta propuesta antes de que yo arranque el bucle.
