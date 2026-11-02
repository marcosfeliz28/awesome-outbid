# Orden de hoy para ChatGPT nube y ChatGPT PC (1-nov-2026, Norexos 1)

Sigues `ORDEN_CHATGPT_CONSTRUCTOR_1NOV.md` y `PLAN_DE_HOY_1NOV.md`. Hoy el orden es este. Una pieza a la vez; una rama por pieza; 3 CI verdes del último SHA antes de decir «listo»; no mezclas en `nexora-cloud` ni despliegas: lo que quede listo **espera la autorización de Norexos 1**. Consulta el mapa (`docs/sistema/mapa/INSTRUCTIVO_SESIONES.md`) antes de leer archivos a ciegas. Nunca credenciales. Reglas de dinero: margen sin ITBIS; no se bloquea ninguna venta por margen.

## ChatGPT nube
1. **Segunda opinión sobre el CI rojo (prioridad 1, solo análisis):** `tests/dinero-auditoria.test.ts` (líneas 902 y 942) falla desde las 04:00 UTC del 1-nov (medianoche RD, día 1 del mes); estaba verde antes. En una rama propia `chatgpt-nube/ci-fecha-1nov` (NO empujes a `claude-pc/fix-ci-mes`, la trabaja otra sesión), reproduce con la fecha simulada 2026-10-31 (pasa) y 2026-11-01 (falla) y 2026-11-15, localiza qué cálculo de «mes actual/anterior» o qué dato del seed (846 ventas demo, devoluciones fechadas hoy de ventas de otro mes) lo causa, y escribe la causa y el arreglo mínimo (preferible en el test o el seed, no en cifras de dinero) en `RESULTADOS_CHATGPT.md`. Si cambiar el arreglo toca cifras de dinero que ve la dueña, solo propón.
2. **`qa-medios-1nov`:** termina los 3 hallazgos de QA y confirma los 3 CI.
3. **CI de `lumina-adentro-b`** (13 pruebas e2e) y luego `f1-01-bundle`.
4. **Auditoría de los últimos 7 días de Norexos 1** (solo lectura): `docs/auditoria/AUDITORIA_CHATGPT_A_N1_<fecha>.md`, con archivo:línea y severidad.

## ChatGPT PC
1. **Animación futurista y dura** (rama `chatgpt-pc/animacion-futurista`): empieza por el login y el Tablero «Hoy»; neón sobre obsidiana, líneas de escaneo, glitch breve en títulos, conteo rápido de cifras, gráficos con trazo luminoso, cortes duros. **No** en la caja durante el cobro. `prefers-reduced-motion` lo apaga todo; 60 fps; máx. +60 KB por pantalla; control «Efectos: Máximo / Normal / Apagado» en Configuración (por defecto Normal). Capturas a 390 y 1366 px y nota de rendimiento medida.
2. **Imágenes y activos de marca:** N prismática (SVG y WebP), favicon e icono PWA, imagen social 1200×630, 3 ilustraciones de estados vacíos, texturas para el estilo futurista; a `design/obsidian-lumina/` con README de origen y licencia.
3. **PC-16 (parche Rust):** compila con `cargo` y reporta en `docs/coordinacion/PC16_RUST_COMPILACION_27OCT.md`.

## Cómo reportan
Al terminar cada pieza, entrada corta en `docs/coordinacion/RESULTADOS_CHATGPT.md`: qué hiciste, rama y SHA, estado de los 3 CI, qué falta y qué decisión necesita la dueña. Si algo es ambiguo, pregunta ahí y espera; no adivines.
