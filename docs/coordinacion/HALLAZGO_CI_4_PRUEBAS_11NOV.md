# CI rojo en 4 pruebas e2e desde el 11-nov — NO es de la búsqueda por voz (dd111de4/0497c5ce)

**Estado: confirmado, no asignado a nadie todavía, sin corregir.**

## Qué pasó
Audité `feat(pos): busqueda de productos por voz` (dd111de4) y su fix
(`0497c5ce`). CI salió rojo dos veces seguidas en las mismas 4 pruebas:

- `tests/e2e/caja-web.spec.ts:235` — A4 (1280 px): dos escaneos mientras carga el catálogo
- `tests/e2e/cuatro-cajas.spec.ts:13` — Tienda-4cajas: 3 cajas y el celular ven el stock en tiempo real
- `tests/e2e/incentivos.spec.ts:41` — tarifa, venta al por mayor a la mitad y cierre del mes
- `tests/e2e/stock-en-vivo.spec.ts:7` — una recarga del catálogo más vieja que el aviso en vivo no pisa el stock

Las 4 fallan con el mismo síntoma: `getByLabel('Buscar productos')` resuelve
al input correcto pero queda "not visible" (o el contexto ya cerrado por el
timeout) durante 45-120 s hasta que Playwright se rinde.

## Por qué NO es del cambio de búsqueda por voz
Antes de tocar nada, reproduje las 4 **localmente, dos veces**:
1. Sobre `0497c5ce` (con el micrófono): las 4 fallan igual.
2. Sobre `e475f2e7` (el commit justo ANTES de la búsqueda por voz, sin
   ningún código mío): **las 4 fallan exactamente igual**, mismo mensaje,
   mismo punto de fallo.

Con eso queda descartado: no es el botón de micrófono, no es
`SpeechRecognition`, no es nada de `dd111de4`/`0497c5ce`. Es un problema ya
presente en `nexora-cloud` que no se había visto porque nadie corrió estas 4
pruebas específicas después del último CI verde (`467de531` del 8-nov en
adelante tiene varios "cancelled"/"success" que no llegaron a correr el
suite completo hasta el final, o corrieron en otro momento del reloj).

## Pista no confirmada
`cuatro-cajas.spec.ts:185` ya era un intermitente documentado
(`RESPUESTA_CLAUDE_PC_27OCT.md:462`). Las otras 3 NO tenían historial de
intermitencia. Las 4 comparten: o abren varios contextos de navegador a la
vez (cuatro-cajas, incentivos usa `admin`+`cajera`), o retrasan a propósito
la carga del catálogo (caja-web, stock-en-vivo) — son las pruebas más
pesadas/concurrentes de la suite. `incentivos.spec.ts:272` además abre su
propia conexión Prisma (`db`) aparte de la API en marcha; el error que se ve
ahí (`apiRequestContext.patch: ... closed`) es un síntoma del timeout
anterior, no la causa — el cuelgue real pasa antes, dentro del cuerpo de la
prueba, no en el `finally`.

No until investigué la causa raíz real (¿agotamiento de conexiones?,
¿algo sensible al reloj — esto empezó justo después de medianoche UTC del
11-nov?, ¿degradación del runner de GitHub Actions?). Me quedé en "no es mi
PR" porque es lo que correspondía a esta auditoría; la causa raíz de estas
4 pruebas queda pendiente para quien lo tome.

## Qué no hice
No cambié código de la búsqueda por voz (está bien, se queda como está). No
intenté "arreglar" las 4 pruebas sin entender la causa. No bloqueé ni
reverti nada en `nexora-cloud`: el código ya desplegable (voz, corrección de
costo) sigue igual de válido que antes de este hallazgo.
