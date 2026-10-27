# Auditoría visual 27 oct · chatgpt-pc/visual-integracion-27oct

Fecha: 2026-10-27. Alcance: solo lectura. No se instalaron dependencias, no se ejecutaron tests, no se desplegó nada.

Refs usadas (tras `git fetch`):

- `origin/chatgpt-pc/visual-integracion-27oct` = `2a0beec6` (head, commit único nuevo: `test(mercancia): alinear salida al control de pestañas`)
- `origin/producto-nexora` = `78888542` (incluye `1a04cd33`, "Utilidad neta y rentabilidad de caja con ITBIS incluido")
- `origin/claude-pc/itbis-una-regla` = `1a04cd33` (ya contenido en producto-nexora)
- Punto de bifurcación común de visual y producto: `c0945874`

Nota de método: la diferencia directa `producto-nexora..visual` mezcla lo que visual no tiene de producto con lo que visual cambió. Para atribuir cambios se comparó también contra el punto de bifurcación `c0945874`.

## Hallazgos por severidad

### ALTA · H1 · El e2e de Mercancía no coincide con el componente ni con el contrato de accesibilidad

- `tests/e2e/store.spec.ts:901-902` (y la aserción `aria-selected` de la línea siguiente) busca `getByRole("tablist", { name: "Tipo de movimiento" })` y `getByRole("tab", { name: "SALIDA" })`.
- `apps/web/src/Merchandise.tsx:665` ahora es `role="group"`, y los botones ENTRADA/SALIDA (`:670`, `:678`) usan `aria-pressed`, sin rol `tab` ni `tablist`.
- `tests/accessibility-contract.test.ts:528-531` exige justo lo contrario: `role="group"`, `aria-pressed`, y `not.toContain('role="tablist"')`.
- Resultado: el e2e de Mercancía (R9-codigos-2/3) fallará por timeout en el locator de `tablist`. Pasa lo mismo en el merge V+P (árbol `1d9188e`): `Merchandise.tsx` no tiene `tablist` y `store.spec.ts` sí lo busca.
- El commit `2a0beec6` alineó el e2e al control de pestañas que la propia rama acaba de eliminar. Es una contradicción entre dos archivos del mismo branch.
- Corrección sugerida (no aplicada): en el e2e usar `getByRole("group", { name: "Tipo de movimiento" }).getByRole("button", { name: "SALIDA", exact: true })` y aserción `toHaveAttribute("aria-pressed", "true")`.
- Estado: inferido del código estático. No se ejecutó Playwright.

### MEDIA · H2 · La rama no incluye la regla ITBIS incluido que ya está en producto-nexora

- Diferencia `producto-nexora..visual` en reglas de dinero (no es un borrado hecho por visual, es el commit `1a04cd33` que visual no tiene):
  - `apps/api/src/reports.ts:556`: visual usa `netProfit(net, ...)` (sin ITBIS); producto usa `netProfit(revenue, ...)`.
  - `apps/api/src/cash.ts:498`: visual resta `s.taxTotal` en la rentabilidad del cuadre; producto no.
  - `packages/shared/src/index.ts` (`netProfit`): parámetro `net` en visual, `revenue` en producto. Mismo cálculo, distinto nombre.
  - `tests/api.test.ts:8083`: visual espera `profit: 2350`; producto espera `2890`.
  - `tests/utilidad-unica-postgres.test.ts:112`: producto tiene `expect(summary.body.netProfit).toBe(60)` y el test del cuadre (`cuadre ... profit ... 60`); visual no los tiene.
- Aclaración importante: respecto al punto de bifurcación `c0945874`, visual **no cambió** ninguna regla monetaria. Solo tiene la regla anterior a `1a04cd33`. Las pruebas de visual son coherentes con esa regla anterior.
- Merge de prueba: `git merge-tree --write-tree` entre visual y producto (`1d9188e`) termina sin conflictos. El árbol resultante conserva la regla de producto: `reports.ts:556` usa `revenue`, `api.test.ts:8084` espera `2890`, `cash.ts` no resta `taxTotal`.
- Riesgo: si se despliega el head de visual tal cual, se muestra la utilidad sin ITBIS. Hay que mergear producto-nexora en visual antes de publicar.
- Estado: no se ejecutaron las pruebas. Los valores 2350 y 2890 vienen de comentarios y aserciones en código, no de una corrida.

### BAJA · H3 · Aflojamientos menores de aserciones (no se borró ninguna aserción en la rama)

- `tests/assistant-exactitud.test.ts` (regex CSS del botón del asistente): el patrón exacto de espacios (`\) \.assistant-launcher \{ bottom: calc\(88px`) pasó a `\)\s+\.assistant-launcher\s*\{\s*bottom: calc\(88px`. Es más tolerante a formato, sin cambiar lo que se comprueba. Se verificó que `Assistant.css:365-377` contiene `body:has(.goods-mobile-bar...)` y `display: none`.
- `tests/accessibility-contract.test.ts:27`: `(page === "styles" && ...)` pasó a `(route === "styles" && ...)`. Es un renombrado; `App.tsx:958` contiene la nueva condición. Se añadió una aserción nueva en la línea 28-29.
- `tests/obsidian-lumina-f2.test.ts:84`: `page === "pos"` pasó a `safePage === "pos"`. Renombrado, la condición existe en `App.tsx`.
- `tests/cash-privacy.test.ts`: solo se añadieron pruebas (`+34` respecto a `c0945874`); ninguna aserción se borró ni se aflojó.

### INFO · H4 · Cambio positivo de orden determinista

- `apps/api/src/reports.ts:591-598`: el orden de vendedoras empatadas ahora tiene desempate por nombre (`byAmount || localeCompare`). Es el único cambio de `reports.ts` respecto a `c0945874`. Está cubierto por la prueba nueva de `tests/cash-privacy.test.ts`.

## Respuesta por punto de la orden

**(a) Pruebas sin comprobación perdida**
- `tests/cash-privacy.test.ts`: solo añade. Sin pérdidas.
- `tests/assistant-exactitud.test.ts`: un regex se hizo más tolerante a formato (H3). Sin pérdida de comprobación.
- `tests/accessibility-contract.test.ts`: renombrados (H3) y el bloque nuevo de Mercancía (líneas 524-535). El bloque nuevo contradice el e2e (H1).
- `tests/e2e/store.spec.ts`: el único cambio es el locator de SALIDA. Está roto (H1).
- Pruebas de mercancía en `tests/e2e/store.spec.ts` (R9-codigos-2/3): roto (H1).
- No se borró ninguna aserción respecto a `c0945874`. Las borradas están en la diferencia contra producto-nexora (H2), porque producto tiene pruebas que visual no tiene.

**(b) Reglas de dinero en `reports.ts`, `api.ts`, `productTenancy.ts`**
- `reports.ts`: respecto a `c0945874`, solo el desempate de orden (H4). Respecto a producto-nexora, las reglas ITBIS (H2). Sin cambio de regla propia de visual.
- `api.ts`: respecto a producto-nexora, añade `setTheme` (líneas 112 y 157-160). No toca dinero.
- `productTenancy.ts`: añade `productAssistantAvailable` (líneas 5-10). No toca dinero.

**(c) `git merge-tree` entre visual y `origin/claude-pc/itbis-una-regla` (`1a04cd33`)**
- Resultado: sin conflictos (exit 0, árbol `5039320d1ca128dc0b46460184cf872693b2040a`).
- Ningún conflicto en `reports.ts`, `cash.ts`, `packages/shared/src/index.ts`, `tests/api.test.ts` ni en otro archivo.
- Motivo: `1a04cd33` ya está contenido en producto-nexora (`git rev-list --count c0945874..1a04cd33` = 1, y el head de producto lo incluye). El merge de visual con `1a04cd33` equivale en la práctica al merge con producto (ver H2).
- Limitación: un merge sin conflictos textuales no garantiza que el resultado sea correcto (H1 se mantiene roto tras el merge).

## Qué no pude verificar

- No ejecuté `vitest` ni Playwright. No instalé dependencias, como pedía la orden. Todos los hallazgos son de lectura de código.
- No comprobé en runtime que `2350` (visual) o `2890` (producto) sean los valores reales que calcula el código. Solo comparé aserciones.
- No revisé los e2e nuevos de la rama (`lumina-adentro-b`, `lumina-reportes-config`, `pos-assistant-overlap`, `carrito-barra-movil`) ni los PNG de `docs/`.
- No revisé `vitest.config.ts` (`-3` respecto a producto) ni `docs/qa/VERIFICACION_FASE3_27OCT.md` (`-22` respecto a producto). Son diferencias contra producto, no contra la bifurcación.
- No revisé `nexora-cloud`, ni Render, ni producción. Fuera de alcance.
- No verifiqué si el e2e de Mercancía se ejecuta en el pipeline de CI.
