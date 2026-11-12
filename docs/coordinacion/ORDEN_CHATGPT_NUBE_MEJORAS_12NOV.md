# Orden para ChatGPT nube — mejoras de uso e IA (12-nov-2026, Norexos 1)

Orden de la dueña (11-nov): repartir el trabajo de mejoras entre todos los agentes. Marco del reparto: `REPARTO_MEJORAS_12NOV.md`. Lista y razones: `LEVANTAMIENTO_MEJORAS_IA_12NOV.md`.

## Reglas fijas
- Solo código de prueba, documentos y bases descartables. Sin producción, Render, base de la tienda, credenciales ni claves.
- No mezclas ni despliegas en `nexora-cloud`. Una rama tuya por pieza: `chatgpt-nube/<pieza>`. Un solo push al terminar la pieza (cada push cancela el CI anterior).
- No cambies `apps/**` ni `tests/e2e/**` (son de Claude nube). Cuando una pieza pida cambiar código, entrégalo como diff propuesto dentro del informe; Norexos 1 lo aplica.
- Nada de dinero, caja, pagos, permisos ni API de dinero. No debilites ni saltes pruebas.
- Cita archivo:línea. Di siempre lo que NO pudiste comprobar.
- Al terminar cada prueba cierra los navegadores y procesos que abriste.
- **Paso 0 de toda pieza:** el levantamiento se hizo leyendo el código a mano y no está verificado. Antes de actuar, abre cada archivo que cita y confirma que lo dicho sigue siendo cierto en `origin/nexora-cloud`. Si no lo es, no lo arregles: repórtalo.
- Reporta en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md` (pieza, rama, SHA, comando exacto, resultado, qué falta). Una pieza bloqueada se anota como BLOQUEADA y sigues con la siguiente.

## Pieza 1 — URGENTE: causa raíz de 4 pruebas de navegador que bloquean todo despliegue
**Por qué importa:** el CI `verify` falla desde el 11-nov y las reglas exigen los 3 CI verdes antes de desplegar. Mientras esto siga rojo, ninguna mejora llega a la tienda.

**Lo que ya se sabe (verificado):**
- Fallan siempre las mismas 4: `tests/e2e/caja-web.spec.ts:235`, `tests/e2e/cuatro-cajas.spec.ts:13`, `tests/e2e/incentivos.spec.ts:41`, `tests/e2e/stock-en-vivo.spec.ts:7`. Las otras unas 150 pasan, incluidas muchas que usan el mismo buscador.
- Síntoma en 3 de ellas: `getByLabel('Buscar productos')` encuentra el campo correcto (`<input aria-label="Buscar productos" placeholder="Código o nombre del producto">`) pero Playwright lo da por «no visible» hasta agotar el tiempo (45 s a 120 s). La cuarta (`incentivos`) agota 120 s y su error final es consecuencia.
- Último CI verde con pruebas de navegador: commit `e475f2e7`, hacia las 20:00 UTC del 10-nov. Primer rojo: `0497c5ce`, 00:39 UTC del 11-nov. Rojo también a las 01:44 y a las 22:45 UTC del 11-nov. `pnpm check` (tipos, lint, pruebas unitarias, compilación) sí pasa; falla solo `node scripts/verify.mjs`.
- No es de los cambios de esos commits: las 4 se reprodujeron fallando localmente sobre `e475f2e7` el 11-nov. Código que pasó el 10-nov falla desde el 11-nov: sospecha fuerte de algo que depende de la fecha, de la hora o de un valor externo. **Es una pista, no una conclusión.**
- Informe anterior (se quedó en «no es de la búsqueda por voz»): `HALLAZGO_CI_4_PRUEBAS_11NOV.md`. Registro del último CI rojo: run 43113945855, job `verify`.

**Método (en este orden, sin saltarte pasos):**
1. Reproduce **una** prueba, la más simple: `stock-en-vivo`. Mismo orden que el CI: migraciones, `pnpm db:seed`, API en marcha, compilar la web, `pnpm exec playwright test tests/e2e/stock-en-vivo.spec.ts --trace off`.
2. Cuando falle, lee `test-results/<prueba>/error-context.md` y la captura `test-failed-1.png`: **qué hay en pantalla en lugar del buscador** (¿un aviso, un modal, un bloqueo, otra pantalla?). Es lo que nadie ha mirado todavía.
3. Busca en `apps/web/src` qué muestra eso y bajo qué condición (fecha, hora, caja del día anterior abierta, mes o semana, un aviso de contraseña, un bloqueo por equipo, una regla por antigüedad de algo).
4. Compara con una prueba que sí pasa y usa el mismo buscador: lista todas las diferencias de preparación (usuario, rol, caja abierta, tamaño de pantalla, datos creados).
5. Una hipótesis a la vez, escrita como «X es la causa porque Y», y un experimento mínimo para probarla. Si dependes de la fecha, no cambies el reloj del sistema: usa `faketime` o cambia temporalmente la única fuente de fecha y revierte.
6. Con la causa probada: decide dónde está el defecto. (a) **Producto**: algo falla según fecha u hora y puede afectar también a la tienda real; di cuándo y a quién. (b) **Pruebas o datos de siembra** con una fecha que caducó. (c) **Entorno o algo externo**.

**Entrega:** en `RESULTADOS_CHATGPT_NUBE.md`: causa raíz con evidencia (qué se vio en pantalla, qué línea lo produce), hipótesis descartadas, si afecta a la tienda real, y el arreglo mínimo como diff propuesto. Prueba exigida antes de decir «arreglado»: las 4 pasan con el arreglo y fallan sin él, cada una al menos dos veces con el arreglo. No saltes, no debilites ni alargues tiempos de ninguna prueba. Si el arreglo está en código de dinero, para después de probar la causa y avisa. Si tras tres hipótesis fallidas no hay causa probada, entrega lo descartado y la evidencia reunida en vez de adivinar.

## Pieza 2 — C5-1: la ayuda dice lo mismo que la pantalla
Rama `chatgpt-nube/ayuda-textos-12nov`.
1. Compara **cada** respuesta de `apps/web/src/QuickQuestions.tsx` y **cada** sección de `docs/MANUAL-CAJERO.md` y `docs/MANUAL-CAJERA-PREGUNTAS.md` con lo que hacen hoy `POS.tsx`, `Tienda.tsx`, `Management.tsx` y `VoidRequests.tsx`.
2. Contradicciones ya vistas (confírmalas y busca más): `QuickQuestions.tsx` dice «Cliente de mostrador» y la pantalla «Consumidor final»; dice contar las transferencias al cerrar y el cierre ya las suma (`Tienda.tsx` cerca de la línea 450); el manual manda avisar a un administrador de palabra aunque existe «Solicitar anulación».
3. Salida: `docs/coordinacion/mejoras-12nov/C5-1_textos.md` con una tabla: archivo:línea, texto actual, qué hace de verdad la pantalla, texto nuevo exacto, y qué prueba busca ese texto (haz `grep` en `tests/` y `tests/e2e/`). **Los textos de `QuickQuestions.tsx` los aplica Claude nube** (los de `docs/MANUAL-*.md` sí los editas tú, un commit por tema).
4. Español sencillo: una idea por frase, máximo 20 palabras, mismo nombre para la misma cosa en pantalla, ayuda y manual.

## Pieza 3 — D12: ayuda dentro del sistema (borrador de contenido)
Rama `chatgpt-nube/ayuda-contenido-12nov`. Sin código: solo contenido en `docs/ayuda/` (una página por tarea, por rol: cajera, gerente, dueña).
1. Fuentes: manuales, `QuickQuestions.tsx` ya corregido por la pieza 2, `EXPLICACION_DUENA.md`. No inventes pasos: si falta un dato escribe `[FALTA DATO]`.
2. Formato: markdown, un archivo por tarea, con estos campos al principio (entre `---`): `titulo`, `rol`, `pantalla`, `palabras_clave`. Después, máximo 6 pasos y una línea «Si algo sale mal:».
3. El modelo local de la PC está redactando una primera versión de la ayuda de la cajera en `docs/ayuda/borradores-local/` (Claude PC lo opera). Úsala como material, **no la copies sin revisar**: corrige cada paso contra la pantalla.

## Pieza 4 — contra-auditoría de cada fase
Cuando Norexos 1 empuje ramas `mejora/<código>-<nombre>`, lee el diff completo y entrega en `RESULTADOS_CHATGPT_NUBE.md`: qué rompe para cajera, gerente o dueña, qué prueba falta, textos que no coincidan con la ayuda, archivo:línea. No empujas a esas ramas.

## Te toca revisar cada hora
`git fetch`; relee este archivo, `REPARTO_MEJORAS_12NOV.md` y `ESTADO_MEJORAS_12NOV.md`, y sigue con la siguiente pieza sin esperar.
