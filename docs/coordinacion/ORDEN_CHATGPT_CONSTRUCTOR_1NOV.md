# Orden de Norexos 1 a ChatGPT (nube y PC) — 1-nov-2026

Orden de la dueña: ChatGPT pasa a ser **el constructor** (las manos); Norexos 1 (Claude nube) es **el cerebro**: decide, audita, mezcla y despliega. Tú construyes en ramas, yo reviso en mi ronda. Léete antes `REORIENTACION_CHATGPT_1NOV.md`. Canal de respuesta: el archivo que se indica en cada pieza (yo lo leo cada ronda).

## Modo de trabajo (gasto mínimo, lento pero seguro)
- Una pieza a la vez, en el orden de abajo. Sin trabajos en paralelo, sin repetir el CI sin cambios nuevos. Modelo/modo más barato que alcance. Tómate el tiempo: calidad y que no se rompa nada antes que rapidez.
- Una rama por pieza (`chatgpt-nube/…` o `chatgpt-pc/…`), un commit por pantalla o arreglo, prueba que falle antes y pase después, CI verde en los 3 trabajos del último SHA, capturas a 390 px y 1366 px.
- No despliegas, no mezclas en `nexora-cloud`, no tocas Render, base de datos ni claves. No cambias flujos, teclas F2/F4/F8/F12, permisos, caja, pagos, NCF, API ni base. Arqueo ciego intacto.
- Reglas de dinero: margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %; no cambiar precios.

## Pieza 1 — Verificar lo que dejaste pendiente (primero)
Compara `COLA_CHATGPT_27OCT.md` y todas tus ramas `chatgpt-*` contra `origin/nexora-cloud` (por contenido, no por conteo de commits). Resultado en `docs/coordinacion/RESULTADOS_CHATGPT.md`: tabla «función/rama → ya está / falta / ya no hace falta (y por qué)». Marca las que NO son necesarias porque el rediseño actual ya las cubre. Luego retoma solo las necesarias, empezando por la CI de `lumina-adentro-b`, `qa-medios` y `f1-01-bundle`.

## Pieza 2 — Auditoría de lo hecho por Norexos 1 en los últimos 7 días (instrucción interna)
Audita, en solo lectura, todo lo que Claude nube y sus agentes subieron a `nexora-cloud` desde el 25-oct (`git log --since=2026-10-25`). Busca: errores de dinero (márgenes, ITBIS, devoluciones, monedas USD/DOP, incentivos GV), fallos de seguridad (`.claude/skills/seguridad-20/SKILL.md`), pruebas debilitadas o saltadas, migraciones no aditivas, cambios sin prueba, contradicciones con `AGENTS.md` y con las órdenes de la dueña, y documentos que afirman algo no comprobado. Entrega `docs/auditoria/AUDITORIA_CHATGPT_A_N1_<fecha>.md`: hallazgos con archivo:línea, severidad (alta/media/baja), evidencia y arreglo sugerido; al final, lo que NO pudiste comprobar. No corrijas código de Norexos 1; solo repórtalo. Sé duro: lo que no puedas demostrar, dilo.

## Pieza 3 — Las modificaciones fuertes del sistema que pediste antes
Retoma `BRIEF_DISENO_VISUAL_CHATGPT_PC_27OCT.md` y `ORDEN_DISENO_INTERNO_26OCT.md`: sistema visual (`docs/diseno/SISTEMA_VISUAL_NEXORA.md`), tokens, pantallas por prioridad (marco, tablero «Hoy», Catálogo/Inventario/Clientes, Reportes/Configuración, Mercancía/Equipos, Asistente). Solo lo que no esté ya en vivo según la Pieza 1.

## Pieza 4 — Imágenes y activos de marca (lo tuyo)
Genera en tu herramienta de imágenes: N prismática (SVG + WebP), favicon e icono PWA, imagen social 1200×630, 3 ilustraciones de estados vacíos, texturas/gradientes para el estilo futurista de la pieza 5. Sin texto con cifras de marketing no medidas, español, ≤200 KB por activo cuando sea posible. Súbelos a `design/obsidian-lumina/` y lista licencias/origen en un README.

## Pieza 5 — Animación MUY futurista y dura
Dirección de la dueña: **futurista, muy fuerte, nada tranquilo**. Parte de `docs/diseno/PLAN_APP_ANIMADA_29OCT.md`, de `docs/diseno/obsidian-lumina/motion/` y de la rama `claude-pc/anim-reportes` (Norexos 1 la mezclará cuando su CI esté verde; si no, compárate con ella para no duplicar).
- Estilo: neón sobre obsidiana, líneas de escaneo, glitch breve en títulos, barras y cifras que «cargan» con conteo rápido, gráficos que se dibujan con trazo luminoso, entradas con corte duro (nada de rebotes suaves), partículas/rejilla en el login y el Tablero, transiciones de pantalla tipo «salto».
- Dónde va fuerte: login, Tablero «Hoy», Reportes, Configuración, Asistente, pantalla de cierre de caja (solo al terminar, no durante).
- Dónde NO: caja/POS de la cajera durante el cobro (rápida y clara, sin movimiento en los flujos F2/F4/F8/F12), tablas de trabajo largas.
- Obligatorio: `prefers-reduced-motion` lo apaga todo; 60 fps en una laptop normal (usa `transform`/`opacity`, sin animar `width/height/top`); máximo +60 KB de JS/CSS por pantalla; foco y teclado intactos; ninguna animación bloquea un clic ni retrasa un cobro; un solo control «Efectos: Máximo / Normal / Apagado» en Configuración (administración), por defecto Normal.
- Entrega: rama `chatgpt-nube/animacion-futurista`, capturas y un clip corto por pantalla en `docs/diseno/capturas/<fecha>/`, y nota de rendimiento (medido, con su comando).

## Reparto de lo que hacía Norexos 1
Tuyo (constructor): piezas 1 a 5, más la preparación de `ventas-ciego` (sin mezclar).
De Claude PC (no lo toques): órdenes 106 (cierre propio de GV), 107 (rol lectura), 108 (prueba de acceso), parches `pq-*`.
De Norexos 1 (no lo toques): auditar y mezclar, desplegar, el CI de `nexora-cloud`, cajas y dinero en vivo.

## Cómo reportas
Al terminar cada pieza, una entrada corta en `RESULTADOS_CHATGPT.md`: qué hiciste, rama y SHA, estado de los 3 CI, qué falta, qué decisión necesita la dueña. Si algo es ambiguo, pregunta ahí y espera; no adivines.
