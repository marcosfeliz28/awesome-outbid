# Nexora POS: borrador de accesibilidad (puntos 13, 14 y 15)

Marco: WCAG 2.1 nivel AA. Repo: `nexora-wt`, rama `nexora-cloud`. Revisión **solo de lectura** del código y cálculo de contraste con script (`scratchpad/contrast.js` y `c2.js`, fórmula de luminancia relativa WCAG). **Nada se ejecutó en un navegador**: lo que depende de render real (orden de foco, anuncios del lector de pantalla) está marcado "por verificar".

Convención: las rutas son relativas a `apps/web/src/` salvo que se indique. Severidad: Alta = bloquea o puede causar un error de venta; Media = barrera real; Baja = mejora.

## 1. Resumen

| Tema | Estado |
|---|---|
| `lang="es"` en `apps/web/index.html` | Correcto |
| Viewport (sin `user-scalable=no` ni `maximum-scale`) | Correcto, se permite zoom |
| Modales (Radix Dialog en `packages/ui/src/index.tsx`) | Trampa de foco, Esc y retorno de foco los da Radix. Correcto |
| Clicables que no son botón/enlace (div/span con onClick) | Ninguno encontrado |
| Botones solo-ícono sin nombre | Ninguno encontrado (los revisados tienen `aria-label`) |
| Texto atenuado `--muted` | Cumple, salvo sobre `--primary-soft` en tema claro (4.13) |
| Contraste de colores fijos (hex) | **Varios fallos**, ver sección 3 |
| Borde de campos | **Falla 3:1** en ambos temas (1.20 y 1.34) |
| Foco de checkbox/radio | **No se ve** |
| Atajos F2/F4/F8/F12 | **Se disparan con un modal abierto** |

## 2. Hallazgos de teclado, formularios, ARIA e imágenes

| # | Sev. | Archivo:línea | Hallazgo | Corrección propuesta | Prueba |
|---|---|---|---|---|---|
| T1 | Alta | `POS.tsx:405-422` | El listener global (captura) ejecuta F4, F8 y F12 aunque haya un modal abierto. Con el cobro abierto, F8 llama `saveHeld()`, guarda la venta en espera y vacía el carrito debajo del pago. F4 abre el selector de cliente encima. Solo el redirigido de teclas imprimibles (`POS.tsx:488-493`) revisa `[role="dialog"]`. (WCAG 2.1.1, 3.3.4) | Al inicio de `onKey.current`: `if (document.querySelector('[role="dialog"]') && e.key !== "Escape") return;` (permitir F2 solo si el diálogo no es de cobro). Un lector de códigos no envía F-keys, así que no choca; el choque es con modales. | Playwright: abrir cobro, `keyboard.press("F8")`, afirmar que el carrito sigue con sus líneas y que no hay segundo diálogo. |
| T2 | Media | `POS.tsx:419`, `App.tsx:444` | F12 abre DevTools en el navegador si `preventDefault` falla (p. ej. Firefox con DevTools abiertas) y las F-keys en laptops exigen la tecla Fn; no hay atajo alternativo. (2.1.4 no aplica porque no son teclas de carácter, pero hay que ofrecer alternativa) | Mantener F-keys y mostrar siempre los botones con `<kbd>` (ya existe en "Cobrar"). Añadir `Ctrl+Enter` como alternativa de cobrar. Documentar en el modal de ayuda `App.tsx:~800`. | Prueba simple: `getByRole("button",{name:/Cobrar/})` es alcanzable con Tab y se activa con Enter. |
| T3 | Media | `App.tsx:444` | `Ctrl+K` compara `e.key === "k"`: con Bloq Mayús o Shift llega "K" y no abre. | `e.key.toLowerCase() === "k"`. | Unitaria: simular `keydown` con key "K" y ctrlKey. |
| T4 | Media | `Management.tsx:2559`, `Tienda.tsx:824`, `Merchandise.tsx:1512`, `Tienda.tsx:585`, `Management.tsx:264` | `<input type="file" hidden>` dentro de `<label>`: `hidden` lo saca del orden de tabulación. Subir foto de comprobante o logo solo se puede con mouse/touch. (2.1.1) | Sustituir `hidden` por una clase `sr-only` (visualmente oculta, enfocable) y mostrar foco en la etiqueta con `label:focus-within`; o usar `<Button onClick={() => ref.current.click()}>`. Tienda.tsx:585 ya usa un Button: verificar que el input sí se dispare desde teclado. | Playwright: `page.keyboard.press("Tab")` hasta "Subir foto" y afirmar `:focus-within`; `setInputFiles` luego Enter. |
| T5 | Media | `styles.css:100-213` (regla global `input,select,textarea {outline:none}` en 180) y `196` | `outline:none` en todos los inputs. Para texto el foco cambia el borde a `--primary` (5.70:1, cumple) pero para `input[type=checkbox]` y radio solo cambia `border-color` (invisible en un casilla con `accent-color`) y una sombra `#7c3aed15` casi transparente. El foco del checkbox no se ve. (2.4.7, 1.4.11) | Añadir: `input[type="checkbox"]:focus-visible, input[type="radio"]:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }` (ver `--focus` en sección 3). | Playwright: `locator.focus()` y afirmar `toHaveCSS("outline-style","solid")`. |
| T6 | Media | `styles.css:208-211` | El anillo de foco de botones/enlaces `#a78bfa` da 2.72:1 sobre blanco (tema claro) y 2.58 sobre `--bg`; exige 3:1 (1.4.11). En oscuro cumple (6.31). | Usar una variable `--focus`: claro `#6d28d9`, oscuro `#a78bfa`. | Script `c2.js`; axe `color-contrast` no cubre foco, usar aserción de color. |
| T7 | Media | `App.tsx:741` | El campo de la paleta de comandos (`Ctrl+K`) está en un `<label className="field">` sin texto: solo tiene `placeholder`. Nombre accesible vacío. (1.3.1, 4.1.2, 3.3.2) | `aria-label="Buscar pantalla"` en el input. | axe regla `label`. |
| T8 | Media | `Merchandise.tsx:~1535` (campos de mapeo de columnas, `<input>` dentro de `<label>` con texto suelto) y `Merchandise.tsx:1044` (cantidad con `id="goods-qty-N"`) | Por verificar a mano: la cantidad por línea usa `id` pero no se vio `<label htmlFor>` ni `aria-label`. | Añadir `aria-label={"Cantidad de " + producto}`. | axe regla `label`. |
| T9 | Media | `Merchandise.tsx:~233-240` | `<ul role="listbox">` contiene `<li>` que contiene `<button role="option" aria-selected="false">`. El `li` rompe la relación listbox-option, y `aria-selected="false"` fijo no cambia nunca. Es un patrón de lista de resultados, no un listbox navegable por flechas. | Quitar `role="listbox"` y `role="option"`/`aria-selected`; dejar `ul > li > button` (lista normal) con `aria-label`. | axe reglas `aria-required-children`, `aria-allowed-role`. |
| T10 | Media | `App.tsx:553-558`, `styles.css:2950-2962` | En celular el menú lateral se oculta con `transform: translateX(-100%)`, pero sigue en el orden de tabulación (los enlaces fuera de pantalla reciben foco). Abierto, no hay trampa de foco ni `inert` en el contenido; Esc lo cierra solo vía listener global `App.tsx:448`. | Con el menú cerrado: `visibility:hidden` (en el breakpoint) o atributo `inert`. Abierto: llevar el foco al primer enlace y devolverlo al botón "Abrir menú". | Playwright (viewport 390): `Tab` desde el botón de menú no debe enfocar un enlace del `<aside>` con menú cerrado. |
| T11 | Baja | `App.tsx:~594-640` (menú de cuenta), `App.tsx:~609` (nav) | El botón "cuenta" no tiene `aria-expanded`/`aria-haspopup`; el menú no cierra con Esc ni al salir con Tab. Los botones de navegación no marcan la página actual (`aria-current="page"`). | `aria-expanded={account}`; en el listener de Escape (`App.tsx:448`) añadir `setAccount(false)`; `aria-current={page===n.id ? "page" : undefined}`. | Aserción: `getByRole("button",{name:/cuenta/i})` tiene `aria-expanded`. |
| T12 | Media | `helpers.tsx:33-56` | El aviso (toast) se crea ya con `role="alert"/"status"`: muchos lectores no anuncian una región viva insertada junto con su contenido. Desaparece a los 6 s (`setTimeout`, sin pausa ni limpieza del temporizador anterior), lo que corta mensajes de error largos (2.2.1) y un aviso nuevo puede cerrarse antes por el temporizador viejo. | Contenedor `aria-live="polite"` (y otro `role="alert"`) siempre presente en `Toasts` y rellenar el texto; guardar el id del timeout y cancelar el anterior; pausar con foco/hover; los errores no deben caducar solos. | Playwright: provocar `toast(msg,true)` y esperar `getByRole("alert")` con el texto. |
| T13 | Media | `App.tsx:~478-505` | La sesión se cierra a los N min de inactividad sin aviso previo ni forma de extender (2.2.1). Con carrito armado se pierde el trabajo. | Aviso 60 s antes con botón "Seguir trabajando". | Por verificar con la dueña si es requisito. |
| T14 | Baja | `POS.tsx:974` | `aria-live="polite"` en la fila del total (texto "Total a cobrar" + monto): se relee la fila entera con cada escaneo. | `aria-atomic="true"` y poner el `aria-live` solo en el monto. Bien: ya existe en el contador de resultados `POS.tsx:704`. | Aserción de atributo. |
| T15 | Baja | `Management.tsx:85-100` (DataTable) y `Dashboard.tsx:344` | `<th>` sin `scope="col"`; sin `<caption>`; encabezados en mayúsculas por JS (`toUpperCase`) que algunos lectores deletrean. Las columnas de acciones usan botones con `aria-label` (bien). El contenedor `.table-wrap` con scroll horizontal no es enfocable en navegadores viejos. | `scope="col"`; usar `text-transform: uppercase` en CSS; `tabIndex={0}` y `role="region" aria-label` en `.table-wrap`. | axe regla `scrollable-region-focusable`. |
| T16 | Baja | `POS.tsx:2208`, `Merchandise.tsx:162` y `POS.tsx:2205` | `<video>` del escáner sin nombre; el error de cámara (`<p className="form-error">`) en `POS.tsx:2203` no tiene `role="alert"`. La alternativa por teclado existe (lector y buscador, mensaje correcto). | `aria-label="Vista de la cámara"` y `role="alert"` en el error. | axe + aserción de rol. |
| T17 | Baja | `packages/ui/src/index.tsx:41`, `App.tsx` (`help-symbol`, `brand-icon`) | Adornos de texto "✦" y "n•" se leen como símbolo. Íconos lucide (versión 0.468) no agregan `aria-hidden` solos y la mayoría de los usos no lo ponen (sí en `Search`, `Camera` de Merchandise). | `aria-hidden="true"` en adornos; para íconos, pasar `aria-hidden` o envolver en un componente `Icon`. | axe no lo marca; aserción `svg:not([aria-hidden])` dentro de botones con texto. |
| T18 | Baja | `index.html:6` y `App.tsx` | `<title>` fijo: no cambia por pantalla (SPA con hash). (2.4.2) | `document.title = current.label + " · Nexora POS"` al navegar. | `expect(page).toHaveTitle(/Punto de venta/)`. |
| T19 | Baja | `styles.css` (`font-size:8px` en `.nav-caption` 476, `.trend` 1032, `.cart-security` 2049; 9px en `.eyebrow`, `.connection`) | Textos de 8-9 px: no es un fallo de AA por sí solo, pero a la distancia de una caja y en celular son ilegibles, y suman a los fallos de contraste. | Mínimo 11-12 px para texto informativo. | Revisión visual. |

## 3. Contraste (WCAG 1.4.3 texto normal 4.5:1, 1.4.11 componentes 3:1)

Variables base: claro `--text #1b2134`, `--muted #64748b`, `--border #eaeaf2`, `--primary #7c3aed`, `--green #059669`; oscuro `--text #e2e8f0`, `--muted #9ba6ba`, `--border #293247`, `--primary #a78bfa`, `--green #34d399`.

### 3.1 Pares que cumplen (para no tocarlos)
texto/fondo 15.2 (claro) y 15.5 (oscuro); `--muted` sobre blanco 4.76, sobre `--surface-soft` 4.56 y sobre `--bg` 4.52 (justo); oscuro 6.45-7.80; botón primario blanco/`#7c3aed` 5.70; `--primary` como texto 5.70/6.31; `.badge.success` 4.95; `.badge.pink` 5.05; `.badge.danger` 4.80; `.form-error` 4.80; toasts oscuros; badges en tema oscuro 7.0-8.0; `.button.danger` 4.83.

### 3.2 Pares que fallan

| Sev. | Archivo:línea | Tema | Par (texto/fondo) | Relación | Reemplazo propuesto |
|---|---|---|---|---|---|
| Alta | `styles.css:249` `.button.success` (botón **Cobrar**) | claro y oscuro | `#fff` / `#059669` | **3.77** | fondo `#047857` (5.48) |
| Alta | `styles.css:3789` `.goods-mode button.active` | oscuro | `#fff` / `--primary #a78bfa` | **2.72** | en oscuro `color:#0b0f19` (7.04) o fondo `#6d28d9` (7.1 con blanco) |
| Alta | `styles.css:208` anillo de foco | claro | `#a78bfa` / blanco | **2.72** (mín. 3) | `--focus: #6d28d9` en claro; mantener `#a78bfa` en oscuro |
| Alta | `styles.css:100-195` borde de `input/select/textarea` | claro | `--border #eaeaf2` / blanco | **1.20** (mín. 3) | `--input-border: #7b8498` (3.75 sobre blanco, 3.56 sobre `#f8f9fc`) |
| Alta | `styles.css:100-195` borde de campos | oscuro | `#293247` / `#151b2b` | **1.34** | `--input-border: #6b7894` (3.87; 3.57 sobre `#1b2235`) |
| Media | `styles.css:300` `.badge.warning`, `.metric-icon.orange`, `.alert-symbol.orange`, `.alert-counter` (1082) | claro | `#b96c0b` / `#fff5e6` | **3.73** | `#92400e` (6.57) |
| Media | `styles.css:343` `.green-text`, `620` `.connection`, `1039` `.trend.positive` | claro | `#059669` / blanco | **3.77** | `#047857` (5.48) |
| Media | `styles.css:349` `.danger-text` | claro / oscuro | `#e04556` / blanco | **4.07** / 4.21 | claro `#c92e43` (5.31); oscuro `#f87171` (6.20) |
| Media | `styles.css:1042` `.trend.negative`, `1547` ícono error | claro / oscuro | `#dc4f60` | **3.94** / 4.36 | claro `#c92e43`; oscuro `#f87171` |
| Media | `styles.css:628` `.connection.offline` | claro / oscuro | `#b96c0b` | **4.03** / 4.26 | claro `#92400e` (7.09); oscuro `#fbbf24` (10.3) |
| Media | `styles.css:4021` `.goods-warning`, `4440` `.equipment-legacy` (claro) | oscuro (`.goods-warning`) | `#b45309` / `#151b2b` | **3.42** | oscuro `#fbbf24` (10.3). `.equipment-legacy` ya tiene override oscuro `#fbbf24`; en claro `#b45309`/blanco = 5.02, cumple |
| Media | `styles.css:3977` `.goods-line.unmatched .goods-match` | oscuro | `#92400e` / `#2b2111` | **2.42** | override oscuro `#fbbf24` (9.47) |
| Media | `styles.css:476` `.nav-caption`, `748` `.app-footer`, `1282` `.rank`, `2049` `.cart-security` | claro | `#a6aab8` / blanco-bg | **2.2-2.3** | `--muted` (`#64748b`, 4.5-4.8) |
| Media | `styles.css:1954` `.cart-line-total button` (botón de quitar línea) | claro | `#c1c4d1` / blanco | **1.74** | `--muted` o `#8a93a6` si es solo ícono (3.09 cumple 1.4.11) |
| Media | `styles.css:593` `.breadcrumb span` (separador "/"), `1131` `.dashboard-alert > svg` | claro | `#cbd0df`, `#bcc0ce` | 1.54 / 1.82 | decorativos: marcar `aria-hidden`; si informativos, `#8a93a6` (3.09) |
| Media | `styles.css:816` `.welcome-banner p` | claro | `#90809f` / `#fdf1f7` aprox. | **3.31** | `#6b5b7d` (5.59) |
| Media | `styles.css:337` `.eyebrow.light`, `2331` `.cash-main p`, `2631` `.login-art p`, `2637` `.login-art > small`, `2646` `.login-stats > span` | claro | lavanda `#dac4fb`-`#e5d6fc` sobre degradado violeta `#7c3aed`-`#9455dc` | 2.89-4.17 | texto `#f3ecff`-`#ffffff`; sobre el extremo claro del degradado oscurecer éste a `#6d28d9` |
| Baja | `--muted` sobre `--primary-soft` | claro | `#64748b` / `#f2ecfe` | **4.13** | `--muted-on-soft: #586274` (5.33) donde un texto atenuado vaya sobre `--primary-soft` |
| Baja | `styles.css:3794` `.goods-mode button.active.exit` | claro/oscuro | blanco / `#db2777` | 4.60 (justo) | `#be185d` (6.04) para margen |
| Info | `.cash-main .badge` (2323), `.charge-button kbd` (2029), `.login-art .brand-pos` (2621) | ambos | blanco / `#ffffff18`-`#ffffff25` | el script marca 1.0 porque no compone transparencias | por verificar a ojo sobre el fondo real (blanco semitransparente sobre violeta/verde) |

Notas: `button:disabled { opacity:.45 }` está exento (componentes inactivos). Las 67 coincidencias "bajo 4.5" del script incluyen falsos positivos (reglas sin fondo propio o texto blanco sobre degradado/imágenes); solo se listan arriba las que se pudieron resolver con el fondo real. Los ~20 pares con fondo en degradado o semitransparente quedan **por verificar con herramienta de navegador**.

### 3.3 Variables nuevas sugeridas (`styles.css`, bloque `:root` línea 59 y `:root[data-theme="dark"]` línea 79)

```css
:root {                       /* claro */
  --focus: #6d28d9;
  --input-border: #7b8498;
  --success-strong: #047857;
  --danger-text: #c92e43;
  --warning-text: #92400e;
}
:root[data-theme="dark"] {
  --focus: #a78bfa;
  --input-border: #6b7894;
  --success-strong: #047857; /* botón; texto verde en oscuro ya usa --green #34d399 */
  --danger-text: #f87171;
  --warning-text: #fbbf24;
}
```

Prueba de contraste (aserción simple, sin dependencias) en Vitest: leer los hex anteriores, calcular la razón con la función de `scratchpad/c2.js` y afirmar `>= 4.5` (texto) o `>= 3` (bordes/foco).

## 4. Imágenes (punto 13, texto alternativo)

| Sev. | Archivo:línea | `alt` actual | Evaluación | Corrección |
|---|---|---|---|---|
| Baja | `POS.tsx:740` miniatura en tarjeta de producto | `p.name` | Aceptable, pero la tarjeta es un `<button>` que ya muestra el nombre en texto: se lee dos veces | `alt=""` (decorativa dentro del botón con nombre) |
| Baja | `POS.tsx:834` miniatura en el carrito | `""` | Correcto (el nombre está al lado) | Ninguna |
| Baja | `Management.tsx:323` miniatura en tabla | `""` | Correcto | Ninguna |
| Baja | `Management.tsx:479` detalle de producto | `detail.name` | Correcto (es la imagen principal) | Ninguna |
| Baja | `Management.tsx:1895` tarjeta de liquidación | `c.name` | Repite el nombre que sigue en texto | `alt=""` |
| Media | `Tienda.tsx:532` comprobante (blob) dentro de botón con `title` | "Evidencia del pago" | Sin dato que distinga un comprobante de otro; el botón no tiene `aria-label` (el `title` no basta para muchos lectores). Si `blobUrl` falla se muestra texto "No disponible" (bien) | `aria-label="Ver foto de la evidencia del pago de {referencia}"` en el botón y `alt=""` en la imagen |
| Baja | `Tienda.tsx:603` vista previa al subir | `""` | Correcto, el nombre del archivo está en `<small>` | Ninguna |
| Baja | `Tienda.tsx:816` logo del negocio | "Logo del negocio" | Útil, pero mejor con el nombre: `alt={"Logo de " + nombre}` | Ajuste menor |
| Baja | `Prints.tsx:78` logo del ticket | `""` | Correcto, el `<h2>` trae el nombre | Ninguna |

No hay `<img>` sin atributo `alt` (el repo cumple 1.1.1 en `alt` presente). Fondos CSS con `background-image` y SVG de `public/products` no se auditaron.

## 5. Pruebas sugeridas

`@axe-core/playwright` **no está en el repo** (se buscó en `package.json`); sí hay `@playwright/test` ^1.55 y `tests/e2e/*.spec.ts`. Propuesta (añadir `pnpm add -D @axe-core/playwright -w`, versión exacta a fijar):

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"]) {
  test(`axe en ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme); // ajustar a la clave real
    // iniciar sesión con el helper de tests/e2e/apoyo.ts y abrir #pos
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations).toEqual([]);
  });
}

test("F8/F12 no actúan con un modal abierto", async ({ page }) => {
  // agregar un producto, abrir cobro (F12), pulsar F8
  await page.keyboard.press("F8");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".cart-item")).toHaveCount(1);
});

test("el foco de un checkbox es visible", async ({ page }) => {
  const box = page.getByRole("checkbox").first();
  await box.focus();
  expect(await box.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
});
```

Axe `color-contrast` no evalúa degradados ni transparencias: complementar con el script de la sección 3.

## 6. Lo que no se pudo verificar

- Nada se ejecutó en navegador: no hay confirmación del orden real de tabulación, ni de anuncios con lector de pantalla (NVDA/VoiceOver/TalkBack).
- Colores con degradado o transparencia (login, tarjeta de caja, `charge-button kbd`).
- Si `saveHeld()` con el cobro abierto realmente vacía el carrito en producción (se deduce del código, `POS.tsx:340-376`).
- Etiquetas de `Merchandise.tsx:1044` y `1535`, y menús/pantallas que no estaban en la lista (Dashboard, Prints, realtime, Login completo).
- Efecto del zoom 200 % y reflujo a 320 px (1.4.4, 1.4.10), y modo de contraste forzado (`forced-colors`, no hay reglas en el CSS).
- Cumplimiento de la "Guía de estilos" (`App.tsx` pantalla `styles`) como referencia de diseño.
