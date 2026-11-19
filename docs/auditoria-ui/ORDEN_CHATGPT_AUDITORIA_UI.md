# ORDEN PARA CHATGPT (PC y NUBE): corregir los hallazgos de la auditoría del software (19-nov-2026)

> **ACTUALIZACIÓN 19-nov (reparto de Claude, commit 488a9c63, rama `claude/reparto-auditoria-19nov`):** la auditoría se divide así: **Claude se queda con los hallazgos de datos, función y entrada** (115 filas, 47 altas: dinero, descuento global, ganancia, terminales, etc.) y **ChatGPT toma los de texto, ortografía, traducción, formato, diseño y contraste** (231 filas, 10 altas). Tu lista de trabajo es `docs/coordinacion/reparto-auditoria-19nov/CHATGPT.csv` (y el `LEEME.md` de esa carpeta). Cuando este documento mencione un punto de dinero, cifras, API, terminales, inventario o clientes (secciones «ChatGPT NUBE» puntos 1–2, 4, 6–8 y 10), **es de Claude: no lo toques**. ChatGPT NUBE y ChatGPT PC reparten entre ellos solo las 231 filas de `CHATGPT.csv` (NUBE y PC se reparten pantallas, idioma, contraste, móvil, formularios y textos de la interfaz; **si un texto sale del servidor (API), lo corrige Claude**, no ChatGPT).


Origen: 11 agentes revisaron el sistema en producción (solo lectura). Lista completa y ordenada por gravedad: `docs/auditoria-ui/TODOS_LOS_HALLAZGOS.csv` (346 filas: 57 altas, 137 medias, 128 bajas, 24 mínimas; columnas `id_global, area, pantalla, idioma, viewport, severidad, tipo, que_paso, como_repetir, esperado`). Un CSV por área en la misma carpeta. Rama con todo: `claude/bitacora-n2`.
La dueña pidió corregir **todo, hasta lo mínimo** (letra, acento, color, tamaño, diseño, entradas, reportes, uniformidad, español e inglés).

## Reglas fijas (no negociables)
1. Claude (Norexos 1) es la cabeza: audita, mezcla y **despliega**. ChatGPT **no despliega**, no cambia prioridades, no mezcla a `nexora-cloud`.
2. Ramas: ChatGPT NUBE → `chatgpt-nube/auditoria-ui-19nov`; ChatGPT PC → `chatgpt-pc/auditoria-ui-19nov`. Crea desde `origin/nexora-cloud` **ya actualizada** (Claude tiene una ventana de publicación del diseño web: espera su aviso de que `nexora-cloud` está libre; mientras tanto trabaja en la rama y haz merge sin rebase antes de entregar). Trae también `claude/gv-separado-reportes-18nov` (GV aparte) para no pisarla.
3. **GV (GV Productos/Servicios/Cursos) es OTRA empresa**: nunca se suma con Grupo Macgen. No rehagas lo de la rama `claude/gv-separado-reportes-18nov`; no la contradigas.
4. **Dinero:** todo cambio que toque cifras (descuentos, ganancia, totales, porcentajes) lleva prueba que **falle antes y pase después**, y no cambia precios ni existencias. Margen = (precio − costo)/precio sin restar ITBIS.
5. **No toques datos del negocio:** ni precios, costos, nombres de productos, existencias, clientes ni usuarios en la base de datos. Los hallazgos del área `catalogo_fotos` y los de datos (precio 0, costo 0, nombres provisionales, portugués, SKU) son de la dueña: **no los corrijas**, solo si es un error de código.
6. Un commit por punto, con el id del hallazgo en el mensaje (`H012`). Las 3 pruebas del CI (`verify`, `windows-installer`, `render-images`) verdes en el último SHA antes de reportar. Abre un PR hacia `nexora-cloud` y escribe en la descripción una tabla: id, estado (corregido / no se puede / ya estaba / necesita decisión), commit.
7. **Usa la mayor cantidad de agentes en paralelo** (orden de la dueña, planes ya pagados). Reparte por área; que cada agente tenga su lote de ids y sus archivos; sin choques.
8. Conteo obligatorio: «recibí N filas; corregidas A, no se puede B, ya estaban C, necesitan decisión D; A+B+C+D = N». Si no cuadra se devuelve.
9. No inventes. Si un hallazgo no se reproduce, dilo con el paso exacto que probaste. Nada de credenciales en commits ni en mensajes.
10. Pruebas visuales: capturas antes/después de cada cambio de diseño en 1440×900 y 390×844, tema claro y oscuro, español e inglés. Entrega las capturas en `docs/auditoria-ui/capturas/`.

## Reparto
### ChatGPT NUBE (servidor, cifras, datos, reportes) — prioridad en este orden
1. **Descuento global en caja** (alta): con 10 % y subtotal 4,700 descuenta 170 (solo la 1.ª línea) en vez de 470; el campo global muestra 0. Corregir en API y front que lo calcula; prueba de dinero.
2. **«Ganancia»**: tres cifras para lo mismo (tarjeta del dashboard 575,383 / 48.77 %, `grossProfit` 395,410 / 39.5 %, reportes 547,283 y 376,204). Definir UNA fórmula por nombre (bruta con ITBIS, bruta sin ITBIS, neta), unificar etiquetas y que dashboard y reportes usen la misma; documentar en `docs/sistema/`.
3. **Porcentajes** que suman 99 % (método del mayor resto) y gráficos con la cifra escrita.
4. **«Infinity en stock»** en servicios y cursos GV; precios de cursos VIP (CUR-004A–D) con número suelto: solo mostrar bien, sin cambiar precios.
5. **Reportes:** «Devoluciones y descuentos» muestra registro de auditoría crudo en inglés con UUID/JSON; métodos de pago en inglés (transfer/card/cash/cod → Transferencia/Tarjeta/Efectivo/Contra entrega); estados y acciones técnicas (login unapproved device, cash after close, terminal_registered, void/sale/count/adjustment) a texto en español; roles y permisos legibles (seller, gerente_gv, sale:write).
6. **Inventario:** tarjeta «activos sin costo» (1) vs 17 reales; «Ver lista» solo muestra 1; filtro almacén «Casa» no filtra; ordenar por columna; texto «Historial de recepciones» en modo Salida; botón exportar.
7. **Clientes/Cobros:** nombres duplicados por mayúsculas/acentos («ginette gomez» / «Ginette Gómez»): búsqueda y agrupación sin distinguir acentos ni mayúsculas (sin fusionar datos reales; propone el script y que lo apruebe la dueña); nombres de banco («POULAR», «popular», «Banco Popular»): normalizar al mostrar y en conciliación; referencias «1111»/«0000».
8. **Terminales:** cada login nuevo registra y aprueba un equipo solo (136 en una hora): limitar altas automáticas por usuario/hora y avisar; no borrar los existentes.
9. **Mensajes de error técnicos** de la API: «Revisa los campos: login debe tener al menos 1 caracteres…» (`apps/api/src/common.ts`), plurales («1 unidades»), doble punto final, y 429 («demasiadas peticiones») con mensaje claro.
10. Respaldo a Drive «No configurado»: solo mostrar aviso claro; no lo configures.

### ChatGPT PC (diseño, textos, idioma, accesibilidad, móvil)
1. **Idioma:** selector visible en login y en la barra (hoy está escondido en «Apariencia e idioma» del POS); traducir TODO (Caja, Inventario, Mercancía, Usuarios, Configuración, Reportes, Alertas, diálogos) a español e inglés; que el idioma del navegador (es-DO, es-ES, es-MX, en-US) se respete por defecto; sin mezclas.
2. **Formato uniforme:** una sola función para dinero (`RD$ 1,950.00`, con espacio y separadores; nunca `RD$ 5250` ni `RD$58,301.00`), una sola para fechas y horas (zona Santo Domingo, un solo estilo), plural correcto, «existencia» (no «stock»), mayúsculas coherentes, nombres iguales para lo mismo en toda la app.
3. **Contraste y tamaño:** «Ayer» y «Ventas de hoy» (2.84–3.07:1), «Editar/Restablecer/Desactivar» en oscuro (3.25:1), barra inferior, pistas de progreso; mínimo 4.5:1 en texto y 3:1 en gráficos; botones táctiles ≥ 44 px («Conectado», «Ver ayuda», selector de tema); GV con color distinto de Fajas.
4. **Teclado y móvil:** Tab que llega a «Cerrar» fuera de pantalla en el diálogo de cobro (atrapar foco); tablas de Reportes que desbordan en 390 px; barra inferior que tapa contenido; placeholder del buscador cortado; tarjetas tapadas por la barra de cobrar.
5. **Formularios:** login con «Entrar» habilitado y usuario vacío/solo espacios (deshabilitar y recortar espacios); límite de largo con aviso; «Anonimizar» con aspecto y confirmación de riesgo; botón «Cobrar» con aspecto desactivado si la caja está cerrada; el campo de descuento que convierte 150 en 15; validación visible en todos los campos.
6. **Textos:** ortografía y acentos (Automaquilaje, Cosmetico, LOréal, «tono por identificar» como texto de interfaz), mensajes en español claro, sin claves técnicas, sin `TELEGRAM_BOT_TOKEN` ni rutas de archivos dirigidas a la dueña; «Cada categoría cuenta» y demás títulos coherentes.
7. Mapa de calor, círculo anual y barras: cada barra con su cifra escrita; contraste medido.

## Cómo empezar (ambos)
1. `git fetch origin && git checkout -b <tu rama> origin/nexora-cloud` (si Claude no avisó que está libre, parte de `claude/bitacora-n2` solo para leer el CSV y de `origin/nexora-cloud` para el código).
2. Lee este archivo, `AGENTS.md`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` y `docs/sistema/README.md`.
3. Abre `TODOS_LOS_HALLAZGOS.csv`, filtra tu parte, parte los ids entre tus agentes y empieza por lo de severidad `alta`.
4. Reporta a Claude (Norexos 1) con el conteo del punto 8 y el PR. Claude audita, pasa `money-guard` y los 3 CI, y despliega con el OK de la dueña.
