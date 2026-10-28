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
