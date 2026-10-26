# Obsidian Lumina · comparación A / B / C y plan de aterrizaje

Fecha: 26-oct-2026. Solo lectura más una fusión de prueba local (`scratch/ol-merge`, no se sube). Sin Render, producción, credenciales ni workflows.

| Id | Rama | Commit | Base |
|---|---|---|---|
| A | `claude/obsidian-lumina-f1` | `2f998788` | `claude/producto-mezcla-4` (157 commits por delante de `producto-nexora` 2f147d2d) |
| B | `chatgpt-nube/obsidian-lumina-fase1` (PR #8) | `c594cdaf` | `producto-nexora` 2f147d2d |
| C | `chatgpt-nube/obsidian-lumina-fase2` (PR #9, borrador) | `8713df26` | B |

Tamaño propio: A = 21 archivos (CSS +475, 44 líneas de prueba, sin componentes nuevos). B = 19 archivos (CSS nuevo de 443 líneas, hook, galería, 4 primitivas, `Modal`). C = 19 archivos sobre B (Dashboard, Asistente, tablero ejecutivo, YearPie).

## 1. Capa de diseño: A contra B

### Tokens

| Tema | A | B |
|---|---|---|
| Dónde viven | Se reescriben los de `:root[data-theme="dark"]` y se añaden en `:root` (claro y oscuro) | Capa nueva `:root[data-admin-appearance]` en `adminAppearance.css`, solo se activa por atributo |
| Nombres existentes (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--primary`, `--focus`…) | Mismos nombres, valores nuevos. La prueba de contraste los lee tal cual | Mismos nombres, valores nuevos, pero solo con el atributo. La prueba de contraste no los ve (lee solo `:root` y `data-theme="dark"`) |
| Nombres nuevos | `--accent-violet`, `--accent-emerald`, `--action`, `--action-hover`, `--on-action`, `--surface-raised`, `--shell-bg`, `--border-strong`, `--*-soft`, `--radius*` | `--lumina-violet`, `--lumina-emerald`, `--lumina-radius`, `--lumina-space` |
| Fondo oscuro | `#05050a` (superficies `#0d0f18`, `#131726`) | `#05050a` (superficies `#0e1320`, `#151d2e`) |
| Esmeralda / violeta | `#43e3b1` / `#8b5cf6` (acción real `#7c3aed`, texto blanco 4.5:1) | `#43e3b1` / `#8b5cf6` |
| Alto contraste | No | Sí (`data-admin-appearance="contrast"`, `forced-colors`, impresión excluida) |
| Medición | 14 aserciones nuevas en `accessibility-contract.test.ts` (corren en `pnpm test`/CI) | Medición manual en la documentación y script Playwright aparte (`tests/obsidian-lumina.mjs`, no corre en CI) |

Los valores son casi iguales; los nombres nuevos no. Hay dos nombres para el mismo concepto (`--accent-emerald` / `--lumina-emerald`).

### Componentes

- A no crea componentes React. Añade clases: `.notice` (success, warning, danger, info), `.skeleton` (con `prefers-reduced-motion`), `.form-error`, estados con punto más texto, tablas de 13 px con cifras tabulares, franja del Resumen. Actualiza la Guía de estilos existente (`StyleGuide` en `Management.tsx`).
- B añade a `packages/ui`: `Card`, `Field` (etiqueta, ayuda y error enlazados por id), `Alert` (`.lumina-alert`), `TableFrame` (región con teclado) y corrige `Modal` para devolver el foco a quien lo abrió. Crea una segunda galería `AdminDesignSystem`.
- Son piezas distintas y se complementan. `Alert` y `.notice` son duplicados; `Field`, `TableFrame` y el foco del `Modal` son aportes de B que A no tiene.

### Marco (shell)

- A: `aria-current` en el menú; barra violeta del lugar actual; letra mínima 11 px; conexión con icono, texto y color; sidebar y topbar nuevos también en la caja (la caja conserva tamaño y disposición del contenido).
- B: `aria-current`, `aria-controls`, `aria-label` del `nav`, enlace «Saltar al contenido», `main` enfocable, botón de alto contraste que reemplaza al de claro/oscuro, apariencia del botón flotante de Nexora separada del acceso móvil a Mercancía.
- Solapamiento real: ambos añaden los mismos dos `aria-current` (git los une sin conflicto). El resto de B es más completo en accesibilidad; A es más completo en estilo del contenido.

### Aislamiento al producto multiempresa

- B aísla de verdad. `useAdminAppearance` activa el atributo solo si `PRODUCT_TENANCY_REQUIRED`, rol admin o manager y página distinta de POS; lo quita al salir. La tienda heredada, la caja y los roles cajera/vendedora conservan su aspecto y el selector claro/oscuro. Tiene prueba de regresión contra la base y control de tienda independiente. Costo: el administrador queda siempre en oscuro (se pierde el selector claro/oscuro), y conviven dos sistemas de tema (`data-theme` y `data-admin-appearance`).
- A no aísla: cambia el tema oscuro y los tokens claros para todos (tienda heredada, caja, producto), y la barra lateral y superior también en la caja. Solo el contenido está acotado con `.app-shell:not(.pos-shell)`. El selector claro/oscuro sigue. Es un solo sistema, pero toca a la tienda heredada sin que nadie lo haya decidido por escrito. Aislarlo costaría poco: el despliegue heredado y el producto son compilaciones distintas (`VITE_PRODUCT_TENANCY`), así que bastaría un atributo `data-product` puesto una vez en `main.tsx` y anteponerlo a las reglas nuevas.

### Cuál es mejor

Para el sistema de diseño de largo plazo, A como base: un solo sistema de tokens que ya usan los nombres que lee la prueba de contraste, respeta el selector claro/oscuro, tiene la prueba en CI y es sobre lo que Claude PC construye la fase 3 (catálogo, inventario, clientes, reportes, configuración). Las piezas de B que A no tiene y conviene traer: aislamiento (decisión de la dueña, ver §4), accesibilidad del marco (saltar al contenido, `aria-controls`, `nav` con nombre, `main` enfocable), foco del `Modal`, `Field`/`TableFrame`, alto contraste (opcional), el script de regresión. No traer: `adminAppearance.css` entero, que repite lo que A ya define con otros nombres y otra especificidad, ni la segunda galería.

### Conflictos y solapamientos (archivos)

- Conflicto de git al fusionar B en A: solo `apps/web/src/App.tsx`, un bloque en `<main>` (A+mezcla-4 añadieron el banner de modo soporte; B añadió `id="main-content"` y `tabIndex`). Se resuelve en un minuto. `tests/accessibility-contract.test.ts` se fusionó solo.
- Solapamiento sin conflicto de git pero con efecto visual: `apps/web/src/styles.css` (A) frente a `apps/web/src/adminAppearance.css` (B). Mismos selectores (`.nav-item`, `.nav-caption`, `.help-card`, `.breadcrumb`, `.global-search`, `.connection`, `.store-switch`, `.welcome-banner`, `.badge`, `.empty`, `table`, `th`, `.field`) con distintos tamaños (por ejemplo `.nav-item` 13 px en A y 12 px en B; `.nav-caption` 11 contra 10). Gana la regla de mayor especificidad, no la «correcta»: en el marco gana B (`[data-admin-appearance] .x`, 0,2,0 contra 0,1,0), en el contenido gana A (`.app-shell:not(.pos-shell) .x`, 0,3,0). El resultado es un híbrido que hay que revisar a ojo en 320 y 1440 px.
- Duplicados de función: `StyleGuide` (A) y `AdminDesignSystem` (B); `.notice` y `.lumina-alert`; tokens `--accent-*` y `--lumina-*`.
- `docs/coordinacion/TABLERO_NEXORA.md`: ambas ramas lo tocan; no dio conflicto.

## 2. Revisión de C (PR #9)

Todo lo siguiente está leído en el código, no en la documentación de C.

1. **Usa el asistente con herramientas.** `DailyBrief.generate()` hace `POST /assistant/ask` con una pregunta fija (`dailyBriefQuestion`). Es el mismo endpoint y las mismas herramientas autorizadas del servidor que el asistente de siempre; C no añade ni quita herramientas.
2. **Cuota.** El resumen con IA sí consume la cuota: el servidor reserva la consulta (`reserveAssistantQuery`) y además limita a 5 por minuto. El texto de la tarjeta lo dice («utiliza la cuota de tu plan»). Una nota: la documentación de C afirma que no se devuelve la cuota si falla, pero el servidor sí la devuelve cuando la respuesta queda `incompleta` (`remaining + 1`). Es un error de la documentación, no del código. «Preguntas desde tarjetas»: abrir la tarjeta solo escribe el borrador en el asistente (`AskNexora`, `Assistant` con `request`); no envía ni consume. Cuando la persona pulsa Enviar, esa pregunta sí cuenta como cualquier otra. Es cierto que «abrir no consume», pero no que «las preguntas desde tarjetas no consumen cuota»; conviene decirlo así.
3. **Margen y costos por rol.** No hay riesgo nuevo. El tablero ejecutivo solo se activa con `appearance.active` (producto, rol admin o manager) y `reports:read`. La ganancia solo se muestra con `profit:read`, igual que hoy. En el servidor, `GET /dashboard/summary` pasa por `safe()` (la vendedora nunca ve costos aunque tenga `profit:read`) y las herramientas de la IA se filtran con `actorSeesCost` (`assistantTools(canSeeCost)`), de modo que una pregunta de tarjeta no abre nada que el asistente no tuviera. Cajera y vendedora no ven el tablero ejecutivo. Las plantillas de pregunta son cerradas (sin importes, nombres ni ids).
4. **Disparos automáticos.** La IA no se dispara sola: `generate()` solo se llama desde el `onClick` del botón. Sí hay consultas automáticas que no son IA: `GET /dashboard/summary` del día cada 60 s (misma clave de caché que el tablero cuando el período es «Hoy») y un temporizador de 30 s que detecta el cambio de día. El resumen se descarta si cambian el día, el usuario, la sucursal o la visibilidad de ganancia.
5. **API y base de datos.** Cierto: C no toca `apps/api`, `packages/*` ni migraciones. Solo `apps/web`, docs, capturas y un script de prueba.
6. **Cifras frente a reportes.** Las cuatro métricas usan `revenue`, `grossProfit`, `invoices`, `ticketAverage` (y `inventoryRetail` sin permiso de ganancia) de `/dashboard/summary`, el mismo origen que `Dashboard.tsx` y que el reporte exportado (`reports.ts` línea 914 usa `summary.grossProfit`). No hay fórmula nueva. Dos observaciones que ya existían y C hace más visibles:
   - `grossProfit` = (ventas − ITBIS) − costo. El comparativo anual (`/dashboard/year`) y el margen de la dueña usan ventas − costo sin restar ITBIS. Con C, la primera tarjeta dice «Ganancia bruta … después de ITBIS neto» y el círculo anual (`YearPie`) dice «ganancia» con otra definición en la misma pantalla. Debe decidirse una definición antes de la fase 3 (regla de la dueña: margen sin restar ITBIS).
   - La lectura con IA usa `facturacion_por_usuario` (definición propia, por fecha de venta) y puede no cuadrar con las tarjetas. C lo advierte en pantalla, que es lo correcto.
7. **Otros riesgos.** (a) La alerta ejecutiva solo ofrece «Revisar alertas» con `alerts:write`; el panel anterior llevaba a Alertas a cualquiera que viera el tablero: cambio de comportamiento menor. (b) `Dashboard` pasa a abrir en «Hoy» y no en «Mes» cuando es ejecutivo: cambio de primera impresión que la dueña debería aprobar. (c) Los controles del tablero ejecutivo solo se prueban con `tests/obsidian-dashboard.mjs` (Playwright manual, no está en CI); `pnpm check` no ejercita el tablero. (d) `YearPie`: C documenta que conserva el mes al cambiar de año (error previo, no corregido). (e) C parte de la base vieja y descarta tres arreglos de `mezcla-4` si se fusiona tal cual (ver §3): `SetupChecklist`, `lastDaysStart(7)` y el porcentaje nulo («sin datos del período anterior»), además del renderizado de Markdown y del evento `nexora:abrir-asistente` en el asistente.

## 3. Fusión de prueba (`scratch/ol-merge`, solo local)

Desde A, `git merge` de B y luego de C, sin subir nada.

| Paso | Archivos en conflicto | Dificultad |
|---|---|---|
| A ← B | `apps/web/src/App.tsx` (un bloque) | Fácil (1 minuto): conservar el banner de soporte y el `id`/`tabIndex` de `main` |
| (A+B) ← C | `apps/web/src/Dashboard.tsx` (un bloque, 62 líneas), `apps/web/src/Assistant.tsx` (un bloque, 200 líneas) | Media (una hora, con cuidado): git mezcla mal los bloques JSX. Hubo que tomar el lado de C y reponer a mano lo de `mezcla-4`: `typeof m.trend === "number"` y el texto de período anterior, el import de `renderMarkdown` con el renderizado de mensajes, y el `useEffect` de `nexora:abrir-asistente`. `SetupChecklist` y `lastDaysStart` se conservaron solos |
| C solo en A (sin B) | No probado; C necesita `useAdminAppearance` de B (`appearance.active`) y las primitivas, así que no compila sin B | — |

Verificación sobre el resultado (commit local `f4219685`, 5 comandos, Node 22 en el entorno; el proyecto pide 24):

- `pnpm typecheck` (shared, ui, api, web): sin errores, tras `prisma generate`.
- `pnpm lint` (eslint): sin errores ni avisos.
- `pnpm --filter @fitstore/web build` y `pnpm --filter @fitstore/api build`: correctos.
- `tests/accessibility-contract.test.ts`: 36 de 36 aprobadas (incluye las 14 de contraste Lumina de A y la guarda de la Guía de estilos de B).
- Muestra adicional: `catalogo-web`, `product-billing-web`, `product-support-web`, `caja-web-ticket`, `web-privacy`, `assistant-n06`, `assistant-aud-ia`, `offline-review-web`: 70 de 70.

No se corrió: la suite completa (`pnpm test`, integración con PostgreSQL), los scripts Playwright `tests/obsidian-lumina.mjs` y `tests/obsidian-dashboard.mjs`, ni revisión visual. «Compila y pasa la prueba de contraste» no prueba que el híbrido CSS se vea bien.

## 4. Plan de aterrizaje recomendado

**Recomendación: A es la base; no fusionar B ni C tal cual.** Traer a A, en una rama de integración, lo útil de B y el tablero ejecutivo y el resumen de IA de C. La fusión de prueba demuestra que es viable (2 archivos con conflicto real), pero fusionar los tres crea dos sistemas de tema y un CSS híbrido que la fase 3 de Claude PC tendría que mantener.

Decisiones de la dueña que bloquean el plan (pedirlas antes):

1. ¿La tienda heredada y la caja deben cambiar de aspecto o conservar el actual? Si conservan, A necesita el atributo `data-product` (aislamiento, ~1 hora). Si cambian, no hace falta.
2. ¿El administrador conserva el selector claro/oscuro (A) o queda siempre en oscuro con alto contraste (B)? Recomendación: A, con alto contraste solo si se pide.
3. ¿Qué es «ganancia» en el tablero: con o sin restar ITBIS? Una sola definición para tarjeta, círculo anual y reportes.
4. ¿El tablero abre en «Hoy» (C) o en «Mes»?

Pasos y responsables:

1. **Claude PC**: sigue la fase 3 sobre A, sin esperar. Si cambia `App.tsx`, `Dashboard.tsx` o `Assistant.tsx`, avisar a Claude nube porque son los archivos en choque con C.
2. **Claude nube** (dueño de la integración): crear `claude/ol-integracion` desde A (una vez que `mezcla-4` esté donde se decida; A y C no pueden entrar a `producto-nexora` antes que `mezcla-4` sin repetir el conflicto de §3).
   a. Traer de B, solo estos archivos: los atributos del marco en `App.tsx` (saltar al contenido, `aria-controls`, `nav` con nombre, `main` enfocable), `packages/ui/src/index.tsx` (Card, Field, TableFrame y foco del `Modal`; mapear `Alert` a `.notice` de A en vez de `.lumina-alert`), `tests/obsidian-lumina.mjs` y su captura. No traer `adminAppearance.css` ni `AdminDesignSystem`.
   b. Traer de C: `ExecutiveDashboard.tsx/.css`, `dashboardQuestions.ts`, `Dashboard.tsx`, `Assistant.tsx`, `YearPie.tsx`, `tests/obsidian-dashboard.mjs`, repitiendo las tres reposiciones de `mezcla-4` descritas en §3. El interruptor `executive` debe salir de una condición propia (producto, rol admin o manager, `reports:read`) y no de `useAdminAppearance`; si se aplica la decisión 1, usar la misma condición.
   c. Reescribir los estilos de `ExecutiveDashboard.css` sobre los tokens de A (`--accent-*`, `--surface-raised`…); hoy usa los de B.
   d. `pnpm check` completo y la suite de integración; ejecutar los dos scripts Playwright; mirar capturas a 320, 390, 780, 1440.
3. **ChatGPT nube**: corregir en el PR #9 (o en uno nuevo contra la rama de integración) lo detectado en §2: corregir la afirmación de cuota (se devuelve si es `incompleta`), decir que enviar una pregunta de tarjeta sí consume cuota, y poner los scripts Playwright en CI o dejar escrito que son manuales. Cerrar o dejar en espera el PR #8 y actualizar el #9 cuando exista la rama de integración.
4. **Dueña**: responde las decisiones 1 a 4 y aprueba las capturas del tablero con datos de ejemplo.
5. **Claude nube** despliega en Render solo con los 3 CI en verde (`verify`, `windows-installer`, `render-images`) y con orden de la dueña. Este documento no autoriza ningún despliegue.

Alternativa más rápida pero con deuda: fusionar B y C completos sobre A (lo que hace `scratch/ol-merge`) y limpiar la duplicación en la fase 3. Sirve si hace falta ver el tablero ya, a cambio de que Claude PC tenga que decidir qué sistema de tokens usa en cada pantalla.

## Qué no se revisó

No se corrieron la suite completa ni las pruebas visuales; no se probó el asistente con un modelo real (la revisión de herramientas y permisos es de lectura de código); no se comprobó el CI remoto de B ni de C.
