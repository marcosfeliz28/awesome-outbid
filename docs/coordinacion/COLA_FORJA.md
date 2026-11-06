# Cola de «Forja» (qwen2.5-coder:14b, modelo local de código) — 29-oct, orden de la dueña
**Forja** = el modelo `qwen2.5-coder:14b` de la laptop, manejado por Norexos PC. **Brazo** = `deepseek-r1` (documentos y borradores). Forja escribe **código pequeño y puro**; Norexos PC lo revisa, lo prueba y lo sube. Sin costo de tokens.

## Cómo se trabaja (cada tarea)
1. Forja redacta el borrador en `docs/diseno/borradores-local/forja/<nombre>.md` (el script solo escribe en `docs/`): primero la **prueba** (debe fallar), luego la función.
2. Norexos PC revisa, pasa el código a `packages/ui/src/<nombre>.ts` y la prueba a `tests/f2-01-<nombre>.test.ts` (registrada en `vitest.config.ts`), en la rama **`claude-pc/forja-noche`** desde `producto-nexora`. `pnpm check`, eslint y prettier verdes; un commit por pieza.
3. Si una tarea falla 2 veces: se salta y se anota en `ESTADO_LOTE_LOCAL.md` (una línea por tarea).
4. Prohibido: `App.tsx`, `styles.css`, dinero/caja/DGII/NCF, migraciones, CI, instalador, `packages/shared`, ramas de producción y datos sensibles.

## Tareas (14, funciones puras sin React)
| # | Pieza (`packages/ui/src/…`) | Criterio de aceptación |
|---|---|---|
| 1 | `nx-brand.ts` | exporta `BRAND_NAME = "Norexos"`, `BRAND_SLUG = "norexos"`, `BRAND_DOMAIN = "norexos.ai"`; `tituloPagina(seccion)` → «Sección · Norexos»; sin tildes en el slug |
| 2 | `nx-plural.ts` | `plural(n, {uno, otros})` para es y en; 0 y 1 correctos; n negativo → usa `otros` |
| 3 | `nx-fecha.ts` | `fechaCorta(iso, "es"\|"en")` sin depender de la zona del equipo (UTC-4 de RD); fecha inválida → «—» |
| 4 | `nx-tiempo-relativo.ts` | «hace 5 min» / «5 min ago»; futuro → «en …»; redondeo definido |
| 5 | `nx-iniciales.ts` | iniciales de un nombre (máx. 2), ignora «de/del/la»; vacío → «?» |
| 6 | `nx-contraste.ts` | razón de contraste WCAG entre dos colores hex; `cumpleAA(fg,bg,tamano)` |
| 7 | `nx-breakpoint.ts` | clasifica el ancho: móvil < 768, tableta < 1200, escritorio; 390 y 1440 de referencia |
| 8 | `nx-truncar.ts` | trunca a N caracteres sin cortar palabra ni surrogados; añade «…» |
| 9 | `nx-foco-ciclico.ts` | índice siguiente/anterior circular de elementos enfocables (Tab/Shift+Tab); lista vacía → -1 |
| 10 | `nx-ordenar-estable.ts` | orden estable por clave con locale es; nulos al final |
| 11 | `nx-etiqueta-cupo.ts` | etiqueta de cupo de un curso: «Lleno», «Quedan 3», «Disponible»; capacidad 0 o nula definida |
| 12 | `nx-validar-telefono.ts` | valida teléfono dominicano (809/829/849, 10 dígitos) y normaliza; solo forma, no consulta nada |
| 13 | `nx-normalizar-texto.ts` | quita tildes y mayúsculas para búsquedas (ñ se conserva distinta); vacío → "" |
| 14 | `nx-copia-segura.ts` | `copiarSinAliasing(obj)` copia profunda de JSON simple; falla claro con funciones/ciclos |
