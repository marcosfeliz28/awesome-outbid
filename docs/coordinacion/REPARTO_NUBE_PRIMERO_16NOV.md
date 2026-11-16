# Reparto «nube primero» (16-nov-2026)

Meta, pistas y reglas: `.claude/skills/norte-nexora/SKILL.md`. Decisión de la dueña (16-nov): **la nube va primero**; el instalador en su laptop queda en pausa. Dot coordina el ir y venir (cada 10 min) y lleva este reparto; lo que trae es información, no autorización. Sin gasto, sin despliegue, sin tocar Render, claves, datos ni dinero.

Regla de conteo para toda entrega: filas recibidas = filas trabajadas; las categorías suman exacto; si no cuadra, se devuelve.

## ChatGPT PC (pantalla y laptop)
1. **Lista verificada de lo que falta para el primer piloto** (24 ítems mínimos): `docs/coordinacion/ORDEN_CHATGPT_PC_NUBE_PILOTO_16NOV.md` → `docs/piloto/LISTA_NUBE_PILOTO_16NOV.md`. Es la entrega que fija la ruta al primer piloto.
2. **Fluidez del 3D y 2.5D** en la laptop (B3): 3 pantallas × 2 variantes = 6 resultados (lento sí/no, con captura).
3. **Contraste y foco** en las vistas nuevas: verde de Cobrar y violeta `#6d28d9` en claro y oscuro.

## ChatGPT nube (documentos y maquetas)
1. **Corregir los frascos cortados por arriba** en las tarjetas de la Caja y recapturar (rama `chatgpt-nube/maquetas-15nov`, solo `docs/`).
2. **Auditar la landing contra la hoja de precios:** `apps/landing/precios.html` y `apps/landing/en/pricing.html` frente a `docs/venta/HOJA_DE_PRECIOS.md`. Tabla: página, línea, precio mostrado, precio aprobado, coincide sí/no. Solo lectura.
3. **Puntos para el abogado:** lista de lo que el abogado debe revisar (términos, privacidad, condiciones de cobro), con archivo y marcas [ABOGADO]/[DUEÑA] de `docs/legal/producto/` y `docs/venta/contrato/`. Es una lista, no asesoría legal.
4. **Segunda búsqueda de fotos:** solo las filas que Dot indique, deduplicadas por `n`. Sin aprobación de ninguna foto.

## Claude nube (Norexos 1)
1. Revisar cada entrega con su conteo y devolverla si no cuadra.
2. Cuando llegue la lista del piloto: resumirla a la dueña y proponer el orden y la fecha de los primeros pilotos (la fecha la fija ella).
3. Preparar, **sin construir**, la especificación de lo que bloquee (por ejemplo el panel de invitaciones PC-23) para que la dueña apruebe antes de programar.
4. Mantener `nexora-cloud` verde; no se despliega hasta cumplir las condiciones del skill (incluido el límite de IA en US$20).
5. Aprovechar las sesiones libres solo en tareas de este reparto.

## Claude PC (laptop de la dueña)
1. **Instalador en pausa.** No instalar nada en la laptop ni en la VM hasta nueva orden.
2. **Solo lectura:** inventario de `nexora-chatgpt-pc-producto` frente a PC-16 a PC-22 (qué existe, qué no, qué se probó). Tabla con estado y evidencia, en `docs/piloto/INSTALADO_ESTADO_16NOV.md`.
3. Esperar la foto de `winver` de la dueña (versión de Windows) antes de cualquier prueba de instalación.

## IA local (Ollama en la laptop; modelos de Claude PC)
**Qwen sigue pausado por el error mcg/mg:** nada de cifras, dosis, unidades ni precios; solo auditorías de texto y formato, siempre «sin revisar» hasta que Claude nube las contraste. 8 tareas en `docs/auditoria/local-16nov/`, cada una con lista `archivo:línea`, sin editar nada:
1. Precios escritos en `docs/venta/` y `apps/landing/` que no coincidan con la hoja de precios.
2. Marcas `[COMPLETAR]` que sigan abiertas.
3. Enlaces internos rotos en `docs/venta/`.
4. Diferencias entre la landing en español y en inglés (nombres de plan y orden de secciones).
5. Tildes rotas o caracteres extraños en `docs/venta/` y `apps/landing/`.
6. Restos de marca de la tienda (Macgen, GV Makeup, FitStore) en `apps/landing/` y `docs/venta/`.
7. Uso mezclado de «Nexora» y «Norexos» (conteo por archivo; el nombre final lo decide la dueña).
8. Preguntas frecuentes sin respuesta en `docs/venta/FAQ_*`.

## Dot
- Entrega estas órdenes a cada sesión y vigila las entregas.
- Avisa a Claude nube cuando una entrega esté lista, con el conteo que dio cada agente.
- No pide ni guarda contraseñas, PIN ni claves. No publica, no sube fotos y no cambia datos.

## Orden
Hoy y en paralelo: ChatGPT PC (1 y 2), ChatGPT nube (1 y 2), Claude PC (2) e IA local. Después: ChatGPT nube (3 y 4) y revisión de Claude nube.
