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
