> **Estado (29-oct, Norexos 1):** las tareas 1–14 (primitivos F2-01 y funciones de movimiento) **ya las hizo el Taller (Norexos 3)** y están en `producto-nexora` (ef063f6a); **Brazo las salta**. Sigue con los **bloques 3, 4 y 5** (documentación, borradores ES/EN, inventario de «Nexora»).
> **Modelos:** `deepseek-r1` (7b o latest) para documentos y borradores; `qwen2.5-coder:14b` para código y pruebas pequeñas (si hay que escribir alguna función). Todo sale «sin revisar» hasta que Norexos PC lo contraste con el repo. Sin datos sensibles ni credenciales.

# Cola del lote local (28-oct, Nexora 1) — F2-01, primitivos pequeños y aislados

Modelo de referencia (misma forma, mismo estilo): `packages/ui/src/nx-status-badge.ts` y su prueba `tests/f2-01-nx-status-badge.test.ts`.
Salida de cada tarea: archivo nuevo `packages/ui/src/<nombre>.ts` + `tests/f2-01-<nombre>.test.ts` (rama `claude-pc/visual-f2-01`; el borrador del modelo local va primero a `docs/diseno/borradores-local/<nombre>.md` y **tú lo revisas** antes de pasarlo a código).
Criterio común: (1) la prueba falla antes de crear el archivo y pasa después; (2) `pnpm check`, eslint y prettier verdes en esos archivos; (3) solo funciones puras (clases/atributos ARIA/etiquetas), sin React ni estilos globales; (4) sin tocar `App.tsx`, `styles.css`, dinero, caja, CI ni ramas de producto; (5) nada inventado: lo que no se pueda confirmar, `[FALTA INFORMACIÓN]`.
Nombres permitidos: los tokens de `packages/ui/src/tokens.css` y lo ya exportado en `packages/ui/src`.

| # | Primitivo | Entrada | Salida | Aceptación específica |
|---|---|---|---|---|
| 1 | `nx-button` | `tokens.css` | `nx-button.ts` | variantes primary/secondary/danger/ghost, tamaños sm/md, estado `disabled` y `loading` con `aria-busy`; objetivo táctil ≥ 44 px |
| 2 | `nx-page-header` | `tokens.css` | `nx-page-header.ts` | título, subtítulo opcional y hasta 2 acciones; un solo `h1`; devuelve atributos, no estilos |
| 3 | `nx-app-shell` | `nx-page-header.ts` | `nx-app-shell.ts` | regiones `banner`, `navigation`, `main` con etiquetas ARIA en español; marca «saltar al contenido» |
| 4 | `nx-card` | `tokens.css` | `nx-card.ts` | superficie normal y «elevada»; sin sombras fuera de los tokens |
| 5 | `nx-field` | `tokens.css` | `nx-field.ts` | etiqueta, ayuda y error enlazados con `aria-describedby`; `aria-invalid` cuando hay error |
| 6 | `nx-empty-state` | `nx-card.ts` | `nx-empty-state.ts` | título, texto y una acción; `role="status"`; textos en español sin tildes rotas |
| 7 | `nx-toast` | `tokens.css` | `nx-toast.ts` | tipos éxito/aviso/error con `role` correcto (`status`/`alert`); duración por defecto 4 s, sin cierre automático en error |
| 8 | `nx-tabs` | `nx-button.ts` | `nx-tabs.ts` | `role="tablist"`/`tab`/`tabpanel`, navegación con flechas descrita como función pura (índice siguiente/anterior circular) |

Devuélveme por cada tarea: rama, commit y resultado de cada verificación. LISTA solo con los 3 CI en verde.

---
# COLA DE LA NOCHE (29-oct, orden de la dueña: «que trabaje toda la noche, sin costo de tokens»)
Se ejecuta **en orden, un bloque tras otro**, sin esperar a Nexora 1. Reglas de todo el lote: (1) cada salida nace como borrador «sin revisar» en `docs/diseno/borradores-local/` (o el archivo indicado) y **Claude PC la revisa** contra el repo antes de pasarla a código o a una rama; (2) pruebas que fallen antes y pasen después en todo lo que sea código; (3) funciones puras, sin React ni estilos globales; (4) **no tocar** `App.tsx`, `styles.css`, dinero/caja/DGII/NCF, migraciones, CI, instalador, `producto-nexora`, `nexora-cloud`; (5) sin datos sensibles; (6) lo no confirmable: `[FALTA INFORMACIÓN]`; (7) cada tarea termina con rama + commit + resultado de verificación en `docs/coordinacion/ESTADO_LOTE_LOCAL.md` (una línea por tarea). Si una tarea falla 2 veces, se salta y se anota; no se atasca la cola.

## Bloque 2 · Movimiento (funciones puras para la app animada) — rama `claude-pc/anim-puro`
| # | Pieza | Salida | Aceptación |
|---|---|---|---|
| 9 | `nx-motion-tokens` | `packages/ui/src/nx-motion.ts` | exporta 120/180/240 ms y la curva; `clampDuration(ms)` limita a 0–240 |
| 10 | `nx-reduced-motion` | `nx-reduced-motion.ts` | `effectiveDuration(ms, reduced)` devuelve 0 con movimiento reducido |
| 11 | `nx-stagger` | `nx-stagger.ts` | `staggerDelays(n, stepMs, maxMs)` con tope; n=0 → [] |
| 12 | `nx-tab-index` | `nx-tab-index.ts` | siguiente/anterior circular, Inicio/Fin; lista vacía → -1 |
| 13 | `nx-count-bump` | `nx-count-bump.ts` | decide si el contador rebota (solo si el número cambió y no hay movimiento reducido) |
| 14 | `nx-progress` | `nx-progress.ts` | porcentaje acotado 0–100 y etiqueta ARIA en español |

## Bloque 3 · Documentación (D7, D8, D16, D19, D20, D24, D25 y afines) — rama `claude-pc/docs-noche`
| # | Tarea | Salida | Aceptación |
|---|---|---|---|
| 15 | Guía de instalación para PC (D7) | `docs/instalacion/INSTALACION_PC.md` | comandos citados de `package.json` y scripts reales |
| 16 | Referencia de rutas de la API (D8) | `docs/api/RUTAS.md` | solo nombres de rutas y permisos de `apps/api/src`; sin implementación |
| 17 | Candidatos a código muerto (D16) | `docs/auditoria/CODIGO_MUERTO.md` | lista archivo:línea con motivo; **sin borrar nada** |
| 18 | Informe de rendimiento en lectura (D19) | `docs/auditoria/RENDIMIENTO_LECTURA.md` | solo de documentos existentes; sin cifras inventadas |
| 19 | Informe de seguridad en lectura (D20) | `docs/auditoria/SEGURIDAD_LECTURA.md` | solo de documentos existentes; sin claves |
| 20 | Tildes rotas (D24) | `docs/auditoria/TILDES_ROTAS.md` | hallazgos archivo:línea; sin cambios en código |
| 21 | Restos de marca «Nexora» (D25) | `docs/auditoria/RESTOS_MARCA.md` | conteo por zona y lista; sin cambios |
| 22 | Glosario de términos del negocio | `docs/GLOSARIO.md` | caja ciega, cuadre, crédito, traspaso, ITBIS, margen (fórmula de la dueña) |

## Bloque 4 · Internacional ES/EN (borradores para revisar) — rama `claude-pc/i18n-borrador`
| # | Tarea | Salida | Aceptación |
|---|---|---|---|
| 23 | Inventario de textos de GV | `docs/i18n/INVENTARIO_GV.md` | textos visibles de `Gv.tsx`/`GvCitas.tsx` con su clave propuesta |
| 24 | Inventario de textos del POS | `docs/i18n/INVENTARIO_POS.md` | solo lectura de `POS.tsx`; sin tocarlo |
| 25 | Borrador `es.json` | `docs/i18n/borrador/es.json` | claves de 23 y 24; texto original |
| 26 | Borrador `en.json` | `docs/i18n/borrador/en.json` | traducción literal, términos de dinero revisados por Claude PC |
| 27 | Función `t()` pura con respaldo | `packages/ui/src/nx-i18n.ts` + prueba | clave faltante → texto en español; sin dependencias |
| 28 | Guía de estilo ES/EN | `docs/i18n/GUIA_ESTILO.md` | tono, moneda RD$, fechas, plurales |

## Bloque 5 · Cambio de nombre a Norexos (solo lectura; no cambia código) — rama `claude-pc/marca-lectura`
| # | Tarea | Salida | Aceptación |
|---|---|---|---|
| 29 | Inventario por archivo de «Nexora» | `docs/marca/INVENTARIO_NEXORA.md` | archivo, líneas y clase: texto visible / variable / llave / servicio |
| 30 | Lista de lo que NO se renombra | `docs/marca/NO_RENOMBRAR.md` | servicio de Windows, carpeta, dominios Render, llaves de navegador, con ruta |
| 31 | Mapa de pruebas que comparan «Nexora» | `docs/marca/PRUEBAS_A_ACTUALIZAR.md` | archivo:línea de cada una |
| 32 | Textos públicos en inglés (landing) | `docs/venta/LANDING_EN_BORRADOR.md` | traducción de `docs/venta/LANDING_TEXTOS.md`, sin citar «e-CF» ni promesas de seguridad sin sustento |

## Bloque 6 · Si sobra tiempo (mismo trato) 
Repite la verificación de los bloques 2 a 5 contra el repositorio actual y corrige los borradores con los comandos reales; después, una prueba extra por cada función pura (casos límite). Avisa a Nexora 1 con un solo resumen: tareas hechas, saltadas y por qué.

## Bloque 7 · Tandas nuevas (pedido de Claude PC, 29-oct) — rama `claude-pc/cola-b7`
Solo lectura del repo; salida en `docs/`; sin tocar código. Si falta dato: escribir «NO ENCONTRADO», no inventar.
| # | Tarea | Entrada | Salida | Aceptación |
|---|---|---|---|---|
| 33 | Lista de permisos de la API | `apps/api/src/*.ts` | `docs/api/PERMISOS.md` | cada permiso (`gv:read`…) con las rutas que lo exigen |
| 34 | Variables de entorno | `apps/api/src`, `render.yaml`, `.env.example` | `docs/operacion/VARIABLES_ENTORNO.md` | nombre, para qué sirve, obligatoria sí/no; **sin valores ni claves** |
| 35 | Migraciones en orden | `apps/api/prisma/migrations` | `docs/api/MIGRACIONES.md` | una línea por migración: qué tabla/columna toca |
| 36 | Textos de error al usuario | `apps/api/src` | `docs/i18n/ERRORES_API.md` | mensaje en español, archivo:línea, clave propuesta |
| 37 | Pantallas y rutas del web | `apps/web/src` | `docs/diseno/MAPA_PANTALLAS.md` | ruta → componente → permiso necesario |
| 38 | Pruebas sin dueño claro | `tests/` | `docs/auditoria/MAPA_PRUEBAS.md` | prueba → área (GV, caja, instalador…); marcar las que requieren Postgres |
| 39 | Preguntas frecuentes de la dueña | `docs/operacion`, `docs/venta` | `docs/venta/FAQ_BORRADOR.md` | 15 preguntas con respuesta citando el documento fuente |
| 40 | Revisión de enlaces rotos en docs | `docs/**/*.md` | `docs/auditoria/ENLACES_ROTOS.md` | ruta citada que no existe, archivo:línea |

## Bloque 8 · Tandas nuevas (pedido de Claude PC, 29-oct) — rama `claude-pc/cola-b8`
Solo lectura del repo; salida en `docs/`; sin tocar código. Todo borrador lleva encabezado «Borrador sin verificar», rama+commit de la fuente y archivo:línea en cada cita. Si falta dato: «NO ENCONTRADO». Si no cubres todo, escribe «PARCIAL» y cuántos archivos miraste de cuántos.
| # | Tarea | Entrada | Salida | Aceptación (verificable) |
|---|---|---|---|---|
| 41 | Índice de documentos | `docs/**/*.md` | `docs/INDICE.md` | `wc -l` ≥ nº de .md bajo `docs/`; cada línea: ruta + título (primera línea `#`) |
| 42 | Modelos de datos en palabras simples | `apps/api/prisma/schema.prisma` | `docs/api/MODELOS.md` | `grep -c '^## '` = nº de `model` del schema; sin campos inventados |
| 43 | Eventos de auditoría | `apps/api/src` (llamadas a audit) | `docs/api/EVENTOS_AUDITORIA.md` | cada evento `gv_payment_void`… con archivo:línea; `grep -c` ≥ 20 o «PARCIAL» |
| 44 | Atajos y textos de la caja | `apps/web/src/POS.tsx` | `docs/i18n/INVENTARIO_POS_ATAJOS.md` | solo lectura; lista de textos visibles con línea |
| 45 | Dependencias y para qué sirven | `package.json` de la raíz y `apps/*` | `docs/auditoria/DEPENDENCIAS.md` | nombre, versión exacta, una línea de uso; `wc -l` ≥ nº de dependencias |
| 46 | Resumen de cada workflow de CI | `.github/workflows/*.yml` | `docs/operacion/CI_RESUMEN.md` | un apartado por job (`verify`, `windows-installer`, `render-images`) con pasos reales |
| 47 | Manual de la caja para cajera (borrador) | `docs/operacion`, `apps/web/src/POS.tsx` | `docs/venta/MANUAL_CAJA_BORRADOR.md` | pasos numerados; sin prometer funciones que no estén en el código |
| 48 | Lista de TODO/FIXME del código | `apps/**/src`, `tests/` | `docs/auditoria/TODOS.md` | `grep -rn 'TODO\|FIXME' apps tests \| wc -l` coincide con las líneas listadas |

## Bloque 9 · PROPUESTA DE CONSTRUCCIÓN — **NO EJECUTAR todavía: espera el dictamen de Claude PC** (una rama por tarea: `claude-pc/b9-<número>`)
**Pedido a Claude PC (orden de la dueña, 29-oct):** antes de empezar nada, escribe `docs/coordinacion/DICTAMEN_PC.md`: (a) modelo local y capacidad real de la PC ampliada (tamaño, velocidad, contexto); (b) para cada tarea 49–56: «puede / puede con ayuda / no puede», con motivo y tiempo estimado; (c) qué otras tareas de mayor tamaño sí podría construir; (d) cómo auditarás tú lo que construya el modelo local. Decides tú qué se le asigna. Después Norexos 1 analiza tu dictamen, desglosa de nuevo, **Norexos 4 (Revisor) lo verifica** y la dueña da su preaprobación al envío final.
**Reparto fijado por la dueña:** la PC (modelo local, capacidad ampliada) CONSTRUYE; Norexos 1 AUDITA y ARREGLA lo que falle; Claude PC revisa y sube. Nada se publica sin los 3 CI en verde y mi revisión del diff.
**Reglas de construcción (todas):**
1. Cada tarea trae su prueba (vitest) y debe pasar `pnpm check` en la laptop antes de subir. Sin prueba no se acepta.
2. **Prohibido tocar:** dinero (márgenes, precios, cobros, cuadre), mercancía/inventario, autenticación y permisos, migraciones de base de datos, `.github/`, `render.yaml`, `CLAUDE.md`, llaves y variables de entorno.
3. Cambios pequeños: máximo 5 archivos por tarea. Si necesita más, parar y avisar.
4. Al subir, el mensaje del commit dice: qué hizo, cómo lo probó, qué NO probó.
5. Primero escribir `docs/coordinacion/ESTADO_PC.md` con: modelo local, tamaño, velocidad aproximada y límites reales (para repartir bien lo siguiente).
| # | Tarea | Salida | Aceptación |
|---|---|---|---|
| 49 | `t()` de textos con respaldo en español y archivos `es.json`/`en.json` (de las tareas 25–27) | `packages/ui/src/nx-i18n.ts` + prueba | clave faltante → texto en español; `pnpm check` verde |
| 50 | Las 14 funciones puras de `COLA_FORJA.md` con su prueba cada una | `packages/ui/src/` o ruta indicada en esa cola | cada función con ≥3 casos incluidos los límite |
| 51 | Selector de idioma ES/EN en la portada pública (solo textos, sin tocar la caja) | componente web + prueba | cambia de idioma sin recargar; recuerda la elección en el navegador |
| 52 | Formulario «Pedir un cambio» (ticket) en la app: solo captura título y descripción y los guarda en la ruta que ya exista | componente + prueba | si no existe ruta de API, **parar y avisar** (no inventar API) |
| 53 | Animaciones del plan `docs/diseno/PLAN_APP_ANIMADA_29OCT.md` (las 4 primeras): CSS nativo, ≤240 ms, respetan «reducir movimiento» | componentes + prueba de la preferencia | no cambian la lógica de ninguna pantalla |
| 54 | Textos de ayuda de la pantalla GV (solo textos, sin cambiar reglas) | `Gv.tsx`/`GvCitas.tsx` | las pruebas existentes de GV siguen verdes |
| 55 | Vista de impresión de la factura: ajustar solo estilos | CSS + captura | cero cambios en cálculos |
| 56 | Pruebas extra de funciones puras ya existentes (casos límite) | `tests/` | `pnpm check` verde; no modifica código de producción |

## Bloque 10 · Más tareas de solo lectura (29-oct 16:40 UTC, Norexos 1) — rama `claude-pc/cola-b10`
**Aclaraciones:** (a) Tarea 46: SÍ puede leer `.github/workflows/*.yml`; lo prohibido era *modificarlos*. Salida solo en `docs/operacion/CI_RESUMEN.md`. (b) Tarea 47: NO leer `docs/operacion/` (tiene datos del negocio); hazla solo con `apps/web/src/POS.tsx` y `docs/venta/`, y llámala `docs/venta/MANUAL_CAJA_BORRADOR.md`. Mismas reglas del bloque 8 (encabezado «Borrador sin verificar», fuente rama+commit, archivo:línea, «PARCIAL» si no cubriste todo, «NO ENCONTRADO» si falta dato).
| # | Tarea | Entrada | Salida | Aceptación |
|---|---|---|---|---|
| 57 | Inventario de textos de Management (i18n) | `apps/web/src/Management.tsx` | `docs/i18n/INVENTARIO_MANAGEMENT.md` | textos visibles con línea; solo lectura |
| 58 | Inventario de textos del asistente y la ayuda | `apps/web/src/Assistant.tsx`, `SupportHelp.tsx`, `SupportAccess.tsx` | `docs/i18n/INVENTARIO_AYUDA.md` | textos con línea y clave propuesta |
| 59 | Traducción EN borrador de los textos de la ayuda (de la tarea 58) | salida de 58 + `docs/i18n/borrador/en.json` | `docs/i18n/borrador/en-ayuda.json` | misma cantidad de claves que el inventario; RD$ y NCF sin traducir |
| 60 | FAQ de GV para el personal (12 preguntas) | `apps/web/src/Gv.tsx`, `GvCitas.tsx` | `docs/venta/FAQ_GV_BORRADOR.md` | cada respuesta cita archivo:línea; sin prometer funciones inexistentes |
| 61 | Glosario ES→EN de términos del negocio | `docs/GLOSARIO.md`, `docs/i18n/borrador/es.json` | `docs/i18n/GLOSARIO_ES_EN.md` | cada término con su traducción y nota de uso; `wc -l` ≥ términos del glosario |

## Bloque 11 · Trabajo para la noche (29-oct 20:20 UTC, Norexos 1) — rama `claude-pc/cola-b11`
Solo lectura del repo (usa `origin/producto-nexora` para el código del producto y `origin/nexora-cloud` para docs); salida en `docs/`; sin datos sensibles, sin leer `docs/operacion/`. Mismas reglas: encabezado «Borrador sin verificar», fuente (rama+commit), archivo:línea, «PARCIAL» si no cubriste todo, «NO ENCONTRADO» si falta dato. Lee `docs/coordinacion/EDUCACION_MODELO_LOCAL.md` primero.
| # | Tarea | Entrada | Salida | Aceptación |
|---|---|---|---|---|
| 62 | Planes y comparativa de la portada en inglés | `docs/venta/LANDING_TEXTOS.md` | `docs/venta/LANDING_EN_PLANES.md` | sin «e-CF», sin promesas de seguridad, RD$ sin traducir; mismas secciones que el original |
| 63 | FAQ de la caja para cajeras (12 preguntas) | `apps/web/src/POS.tsx` (producto-nexora) | `docs/venta/FAQ_CAJA_BORRADOR.md` | cada respuesta cita archivo:línea; sin funciones inexistentes |
| 64 | Inventario de textos de la navegación y el inicio de sesión | `apps/web/src/App.tsx` | `docs/i18n/INVENTARIO_APP.md` | texto, línea y clave propuesta |
| 65 | Inventario de textos de Mercancía | `apps/web/src/Merchandise.tsx` | `docs/i18n/INVENTARIO_MERCANCIA.md` | texto, línea y clave propuesta |
| 66 | Borrador en inglés de los textos de Management (de la tarea 57) | `docs/i18n/INVENTARIO_MANAGEMENT.md` + `docs/i18n/borrador/en.json` | `docs/i18n/borrador/en-management.json` | mismas claves que el inventario; RD$, NCF e ITBIS sin traducir |
| 67 | Qué flujo cubre cada prueba de navegador | `tests/e2e/*.spec.ts` | `docs/auditoria/MAPA_E2E.md` | un renglón por spec: archivo, nº de pruebas, flujo; `ls tests/e2e | wc -l` coincide |
| 68 | Lista de revisión manual de la caja (checklist para probar antes de una entrega) | `apps/web/src/POS.tsx` + `tests/e2e/*caja*` | `docs/auditoria/CHECKLIST_CAJA.md` | casillas numeradas, cada una con la pantalla y el resultado esperado |

## Bloque 12 · Reposición de cola (29-oct 20:55 UTC, Norexos 1) — rama `claude-pc/cola-b12`
Mismas reglas que los bloques 8, 10 y 11 (solo lectura; salida en `docs/`; sin `docs/operacion/`; encabezado «Borrador sin verificar»; fuente rama+commit; archivo:línea; «PARCIAL» / «NO ENCONTRADO»). Código del producto: `origin/producto-nexora`. Nuevas lecciones en `EDUCACION_MODELO_LOCAL.md`: léelas antes.
| # | Tarea | Entrada | Salida | Aceptación |
|---|---|---|---|---|
| 69 | Revisión de `LANDING_EN_PLANES.md` contra el original | `docs/venta/LANDING_TEXTOS.md` y `LANDING_EN_PLANES.md` | `docs/venta/LANDING_EN_REVISION.md` | lista cada afirmación del inglés sin respaldo en el original (p. ej. «conforme a la DGII»: e-CF/DGII está FUERA de la versión 1); sin cambiar el original |
| 70 | Inventario de textos de reportes y panel | los `.tsx` de `apps/web/src` cuyo nombre contenga Dashboard, Report o Executive | `docs/i18n/INVENTARIO_REPORTES.md` | texto, línea, clave propuesta; `grep -c` ≥ 30 o «PARCIAL» |
| 71 | Inventario de textos de clientes y crédito | `.tsx` con Customer o Credit en el nombre | `docs/i18n/INVENTARIO_CLIENTES.md` | texto, línea, clave |
| 72 | Inventario de textos de configuración y primeros pasos | `.tsx` con Setting, Config, Onboard o First en el nombre | `docs/i18n/INVENTARIO_CONFIG.md` | texto, línea, clave |
| 73 | Textos de error de la API al usuario | `apps/api/src/*.ts` | `docs/i18n/ERRORES_API.md` | mensaje en español, archivo:línea, clave propuesta; nº de filas = nº de mensajes encontrados |
| 74 | Rutas de la API sin prueba que las nombre | `docs/api/PERMISOS.md`, `tests/` | `docs/auditoria/RUTAS_SIN_PRUEBA.md` | ruta → «nombrada en tests / no nombrada»; conteo por módulo; sin inventar |
| 75 | Mapa de componentes del paquete de interfaz | `packages/ui/src/` | `docs/diseno/MAPA_UI.md` | archivo, qué exporta, si tiene prueba (`tests/f2-01-*`); `ls packages/ui/src \| wc -l` coincide |
| 76 | Guía de inicio rápido para una dueña nueva (5 pasos, borrador) | los textos del asistente «Primeros pasos» del producto | `docs/venta/INICIO_RAPIDO_BORRADOR.md` | 5 pasos numerados con pantalla y archivo:línea; sin prometer funciones inexistentes |

## Bloque 13 · Reposición (29-oct 21:10 UTC, Norexos 1) — rama `claude-pc/cola-b13`
Mismas reglas de siempre (solo lectura; salida en `docs/`; sin `docs/operacion/` ni valores de variables/claves; encabezado «Borrador sin verificar»; fuente rama+commit; archivo:línea; «PARCIAL» / «NO ENCONTRADO»). Código del producto: `origin/producto-nexora`. Lo del bloque 12 que dependía de coincidencias por nombre (p. ej. «tiene prueba: no») puede dar falsos negativos: di en el encabezado cómo lo calculaste.
| # | Tarea | Entrada | Salida | Aceptación |
|---|---|---|---|---|
| 77 | Qué hace cada pantalla, en palabras simples | `docs/diseno/MAPA_PANTALLAS.md` + el `.tsx` de cada pantalla | `docs/venta/PANTALLAS_BORRADOR.md` | una frase por pantalla con archivo:línea; sin funciones inexistentes |
| 78 | Términos fiscales y dónde aparecen | `apps/` y `packages/` | `docs/i18n/TERMINOS_FISCALES.md` | NCF, ITBIS, RNC, DGII, e-CF: nº de apariciones por archivo (`grep -c`) y 1 ejemplo con línea |
| 79 | Mensajes de validación de formularios | `packages/shared/src` y `apps/api/src` (mensajes de zod/validación) | `docs/i18n/VALIDACIONES.md` | mensaje, archivo:línea, clave propuesta |
| 80 | Textos de notificaciones salientes (Telegram, correo, avisos) | `apps/api/src` | `docs/i18n/NOTIFICACIONES.md` | texto, archivo:línea; marca cuáles dicen «Nexora» y cuáles «Norexos» |
| 81 | Textos de recibos y PDF impresos | `apps/api/src` y `apps/web/src` (recibo, factura, PDF) | `docs/i18n/RECIBOS.md` | texto, archivo:línea, clave |
| 82 | Variables de entorno (nombres, no valores) | `apps/api/src`, `render.yaml`, `.env.example` | `docs/operacion/VARIABLES_ENTORNO.md` | nombre, para qué sirve, obligatoria sí/no; **cero valores** (`grep -E "=[^ ]"` no debe mostrar secretos) |
| 83 | Roles y permisos del producto | `apps/api/src` (definiciones de roles/permisos) | `docs/api/ROLES.md` | rol → permisos, archivo:línea; sin inventar roles |
| 84 | Preguntas frecuentes de administración (12) | `apps/web/src/Management.tsx` | `docs/venta/FAQ_ADMIN_BORRADOR.md` | cada respuesta cita archivo:línea |
