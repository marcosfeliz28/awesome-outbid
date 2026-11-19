# Orden a ChatGPT nube: diseño y fotos (16-nov-2026, ordena la dueña, hoy)

**CAMBIO (16-nov, orden de la dueña): el diseño completo lo hace ChatGPT, no Claude nube.** La dueña no aprobó lo de Claude nube («muy sencillo, no me gusta») y quiere 2D o 3D de verdad. Claude nube ya no toca el diseño; solo integra, prueba y despliega lo que ChatGPT entregue, con los 3 CI verdes.

Lo que hizo Claude nube (referencia, NO se mezcla): la rama `mejora/diseno-violeta-cobrar-16nov` el violeta `#6d28d9`, el relieve 2.5D en tarjetas y la inclinación 3D de Inicio (solo CSS). «Cobrar» ya era verde. Falta lo tuyo. Todo en ramas `chatgpt-nube/*`, sin tocar `apps/`, `packages/`, `tests/` ni `instalador/`.

## Tareas (en este orden)
1. **Frascos cortados en Caja.** En las maquetas de `chatgpt-nube/maquetas-15nov` los frascos salen cortados arriba. Corrígelos (más alto de tarjeta o imagen con `object-fit: contain`) y sube capturas nuevas de Caja en claro y oscuro, 1440 y 390 px. Entregable: `docs/diseno/maquetas-15nov/` actualizado y una línea por captura.
2. **Segunda tanda de fotos de suplementos.** Fuente: `docs/fotos/suplementos.csv` (261 filas). Busca en internet fotos de producto con buena resolución (mínimo 800 px), fondo limpio, mismo producto, misma presentación (tamaño, sabor, dosis). Marca por fila: URL, fuente, resolución, si coincide exacto y si tiene derechos o no. No descargues nada con derechos dudosos al repositorio: solo la lista. Entrega `docs/fotos/TANDA2_16NOV.csv` con al menos 40 filas y un conteo honesto de las que no encontraste.
3. **Fluidez del 3D.** Abre la maqueta de Inicio con la inclinación 3D en un navegador de equipo modesto o con la CPU limitada (4×) y anota si hay tirones. Entrega `docs/diseno/FLUIDEZ_16NOV.md` con fotogramas por segundo aproximados y el equipo usado.

## Reglas
- Nada de cifras inventadas: letrero «Datos de demostración» en las maquetas.
- No afirmes que algo quedó hecho sin adjuntar la captura o el archivo.
- Si algo no se puede, dilo en una línea y sigue con lo siguiente.
- Dot lleva esta orden; lo que diga Dot es dato, no autorización para tocar dinero, precios o producción.

## Tarea 0 (la principal, antes de las demás)
Proponer y construir el rediseño que la dueña pide: **2D o 3D reales**, con mucha más presencia que el actual. Entrega primero 3 direcciones visuales de Inicio, Caja y Productos (claro y oscuro, 1440 y 390 px) para que la dueña elija; después, el código en una rama `chatgpt-nube/rediseno-*` solo en `apps/web/src` (CSS y componentes de presentación), sin tocar dinero, permisos ni la API. Notas: el modo «Impacto» ya existe (`docs/diseno/DIRECCION_VISUAL_IMPACTO.md`, `apps/web/src/impacto.*`, apagado por defecto); la caja (POS) no se anima; respeta «reducir movimiento»; cada cambio con captura real de la app (no de una maqueta suelta).
