# 04b · Estética y privacidad (fase 4, 14-nov-2026)

Solo lectura. Nada aquí está aprobado ni se ha construido. Las propuestas nuevas se llaman **PC-VIS-xx** (estética) y **PC-PRIV-xx** (privacidad). Lo que ya existe en el catálogo del 13-nov (DIS-01…09, COM, SEG, MOD, EST) se cita por su ID y no se repite.

## Cómo leer esto

- **Visto en captura**: lo abrí yo en `capturas/*.png`. Son **páginas públicas de marketing**, no pantallas de caja en uso. Cuando digo «caja de muestra» es la imagen promocional que la empresa pone en su web, no la app real.
- **Solo texto**: viene de la tabla `02_TABLA_EMPRESAS.md`; no abrí esa captura.
- **No visto en pantalla**: todo lo de Norexos. **No ejecuté la app.** Lo que digo de Norexos sale de leer el código (`archivo:línea`, árbol actual, `git log -1` = `e959914`; el encargo decía `ed5826f`, las líneas pueden moverse unas pocas).
- **Contrastes**: calculados a mano con la fórmula WCAG; antes de aplicar, comprobarlos con una herramienta. Meta: texto normal ≥ 4,5:1, texto grande y bordes de control ≥ 3:1.
- **Esfuerzo**: P (horas, 1 archivo), M (1–3 días), G (una semana o más).
- **Toca dinero**: «sí» si cambia cómo se calcula, cobra, guarda o imprime un monto. Ninguna propuesta de estética cambia precios ni cálculos.

Capturas abiertas por mí (12): square, shopify, loyverse, kyte, vendty, poster-pos, treinta, facturapp, alegra-rd, tiendanube-pos, toast, zoho_inventory. **No abiertas** (uso solo el texto de la tabla 02): lightspeed, clover, sumup, fudo, alegra, siigo, bsale, erpnext.

## Resumen en una tabla

| ID         | Qué                                                                              | Esfuerzo | Dinero              |
| ---------- | -------------------------------------------------------------------------------- | -------- | ------------------- |
| PC-VIS-01  | Paleta concreta con roles: violeta = marca, verde = solo cobrar/dinero que entra | M        | no                  |
| PC-VIS-02  | Un solo tema oscuro, con 3 alturas de superficie                                 | M        | no                  |
| PC-VIS-03  | Cifras de dinero con estilo propio (RD$ pequeño, número grande, tabular)         | P        | no                  |
| PC-VIS-04  | Caja: distribución a 1366 px y a 390 px, pestañas «Favoritos / Ofertas / Todo»   | G        | no                  |
| PC-VIS-05  | Carrito tipo ticket: línea con foto, código gris, ITBIS con icono «%»            | M        | no                  |
| PC-VIS-06  | Barra de estado de la caja: conexión, ventas por subir, impresora                | M        | no                  |
| PC-VIS-07  | Panel de la dueña «Hoy en una mirada»: una cifra héroe y tres tarjetas           | M        | no                  |
| PC-VIS-08  | Tablas legibles: números a la derecha, cabecera fija, filas de 48 px             | M        | no                  |
| PC-VIS-09  | Un solo componente de vacío, carga y error con esqueletos                        | M        | no                  |
| PC-VIS-10  | Reglas de iconos: un juego, dos tamaños, siempre con texto                       | P        | no                  |
| PC-VIS-11  | Movimiento sutil con reglas: 4 animaciones permitidas y ninguna más              | P        | no                  |
| PC-VIS-12  | Primer arranque visual: lista de 5 pasos con progreso                            | M        | no                  |
| PC-VIS-13  | Recibo térmico con jerarquía fija en mm                                          | M        | sí (imprime montos) |
| PC-VIS-14  | Página de venta con pantallas reales del producto y tarjetas en RD$              | M        | no                  |
| PC-PRIV-01 | Bloqueo rápido con PIN en vez de cerrar la sesión                                | M        | no                  |
| PC-PRIV-02 | Botón «ocultar cifras» en el panel y en la caja                                  | P        | no                  |
| PC-PRIV-03 | «Ver como cajera»: vista previa de lo que ve cada rol                            | M        | no                  |
| PC-PRIV-04 | Datos de clientes: tapados por defecto también para quien puede verlos           | M        | no                  |
| PC-PRIV-05 | Bitácora en frases: «Ana cambió el precio de X de RD$ 900 a RD$ 850»             | M        | no                  |
| PC-PRIV-06 | Pantalla «Equipos y sesiones abiertas» con cierre a distancia                    | M        | no                  |

---

# A. ESTÉTICA

## Lo que se vio en la competencia (resumen de las 12 capturas abiertas)

1. **Un solo color de acción, el resto en grises.** Square (azul `≈#006aff` en «Contact sales» y «Add customer»), Kyte (verde menta en «Create your account» y en el «+» de la caja de muestra), Toast (naranja en los dos botones). Visto.
2. **Botón de cobro verde abajo a la derecha, ancho del ticket.** Vendty («Pagar $52,000» en la caja de muestra), Poster («Pay»), Loyverse (dos botones verdes abajo del ticket). Visto, pero en imágenes promocionales pequeñas.
3. **Ticket con jerarquía por peso, no por color.** Square: nombre en negrita, «SKU APP-46916» en gris pequeño, precio a la derecha, impuesto en su propia línea con un círculo y «%». Visto con claridad.
4. **Cifras en tarjetas flotantes.** Facturapp («Ventas de hoy RD$ 24,580 ↑ +18 % vs. ayer», tarjeta blanca con mini-gráfica verde), Zoho («4130 To be Packed» con icono en círculo de color), Tiendanube («Registrar venta» azul grande). Visto. Es el lenguaje que la dueña reconocerá como «moderno».
5. **Tema oscuro con un acento fuerte.** Facturapp (verde bosque casi negro + verde lima `≈#a3e635`), Shopify (caja de muestra oscura con botón azul). Visto; en Shopify el texto de la caja no se lee en la captura.
6. **Barra de periféricos.** Square: «✓ Reader ✓ 1 printer ✓ Scanner» arriba a la derecha de la caja. Visto.
7. **Contraejemplos.** Vendty: banner de oferta con cuenta regresiva, chat flotante y foto de asesora: ruidoso. Alegra RD: modal con cuenta regresiva roja que tapa toda la página. Loyverse y Tiendanube: aviso de cookies tapando media pantalla. Poster: letra del ticket diminuta. Visto.

---

## PC-VIS-01 · Paleta concreta con roles fijos

- **Competidores:** Square (página Retail de squareup.com, captura `square.png`): un azul para toda acción, negro para títulos, gris para lo secundario. Visto. Kyte (https://kyteapp.com, `kyte.png`): verde menta único. Visto. Ninguna de las 25 usa violeta (tabla 03 §3.2): el violeta es diferenciador.
- **Norexos hoy (no visto en pantalla):** dos sistemas de color (`apps/web/src/styles.css:59-87` y `packages/ui/src/tokens.css:1-70`); primario `#7c3aed` (`styles.css:66`, `tokens.css:5`); verde de cobrar `--success-strong #047857` (`styles.css:72`); foco violeta incluso sobre el botón verde (`styles.css:6589-6591`); color suelto `#ba9bea` en el ícono de vacío (`styles.css:1630`). Unificar los dos sistemas ya es **DIS-07**; esta propuesta da **los valores y las reglas de uso** que DIS-07 no fija.
- **Propuesta:** 4 roles y nada más:
  1. **Marca / acción general** = violeta. Botones primarios, enlaces, pestaña activa, foco.
  2. **Dinero que entra** = verde. _Solo_ «Cobrar», «Abonar», confirmación de venta y cifras positivas. Nunca en botones de navegación.
  3. **Atención** = ámbar (stock bajo, venta sin enviar). **Peligro** = rojo (anular, faltante de caja).
  4. **Todo lo demás** = grises neutros fríos.
- **CÓMO SE VERÍA**

  | Token                | Claro                             | Oscuro                                | Uso                           | Contraste (≈)                                                     |
  | -------------------- | --------------------------------- | ------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
  | `--nx-marca`         | `#6d28d9`                         | `#a78bfa`                             | botón primario, enlace        | blanco sobre `#6d28d9` ≈ 7,1:1; `#a78bfa` sobre `#161a26` ≈ 6,5:1 |
  | `--nx-marca-suave`   | `#f3eefe`                         | `#2a2342`                             | fondo de pestaña activa, chip | texto `#4c1d95` encima ≈ 10:1                                     |
  | `--nx-dinero`        | `#047857`                         | `#10b981` (botón) / `#34d399` (texto) | Cobrar, cifras positivas      | blanco sobre `#047857` ≈ 5,5:1; `#0b1f17` sobre `#10b981` ≈ 7:1   |
  | `--nx-atencion`      | texto `#92400e` / fondo `#fef3c7` | `#fde68a` / `#78350f`                 | stock bajo                    | ≈ 6,4:1 (ya declarado en `tokens.css:48-49`)                      |
  | `--nx-peligro`       | `#b91c1c`                         | `#f87171`                             | anular, faltante              | blanco sobre `#b91c1c` ≈ 6,5:1                                    |
  | `--nx-texto`         | `#151a2b`                         | `#e7eaf2`                             | cuerpo                        | ≈ 16:1 / ≈ 14:1                                                   |
  | `--nx-texto-2`       | `#55607a`                         | `#a7b0c3`                             | etiquetas, códigos            | ≈ 6:1 / ≈ 7:1                                                     |
  | `--nx-borde`         | `#e3e6ee`                         | `#2a3142`                             | separadores (decorativos)     | —                                                                 |
  | `--nx-borde-control` | `#8a93a8`                         | `#5f6a82`                             | borde de campos               | ≥ 3:1 sobre fondo                                                 |
  - Se pasa el primario de `#7c3aed` a `#6d28d9` (un paso más oscuro) para que el texto blanco pase de ≈ 5,7 a ≈ 7,1:1 y el violeta se vea «más caro». `#7c3aed` queda para ilustraciones.
  - Foco: anillo de 3 px **del color del propio botón al 40 %** + 2 px de separación; en el verde de cobrar, anillo verde, no violeta.

- **Esfuerzo:** M (solo variables y reemplazos; va junto con DIS-07). **Toca dinero:** no.
- **Cómo comprobar:** prueba que falle si aparece un hex fuera de `tokens.css` en `styles.css` (lista blanca para impresión); captura con Playwright en claro y oscuro de caja, panel y productos; revisar contraste con axe-core (`color-contrast` sin fallos).

## PC-VIS-02 · Un solo tema oscuro con tres alturas

- **Competidores:** Facturapp (https://facturapp.do/, `facturapp.png`): fondo verde casi negro, tarjetas blancas encima y un acento lima. Visto. Shopify POS (`shopify.png`): caja de muestra oscura con botón azul. Visto, ilegible de cerca.
- **Norexos hoy (no visto en pantalla):** dos negros para el mismo tema: `styles.css:89` (`--bg #0b0f19`, `--surface #151b2b`) y `tokens.css:28`, `:58` (`#14141f`, `#1c1c2b`); `--shadow: none` en oscuro (`styles.css:107`), así que las tarjetas solo se separan por borde. El tema ya sigue al equipo y se pinta antes de React (**MOD-08**, `apps/web/src/theme.ts`).
- **Propuesta:** un fondo y tres alturas (fondo → tarjeta → ventana emergente), cada una un poco más clara, en vez de sombras. Mismo matiz azul-pizarra en las tres para que no «ensucie».
- **CÓMO SE VERÍA**

  | Altura                 | Claro                                                          | Oscuro                      |
  | ---------------------- | -------------------------------------------------------------- | --------------------------- |
  | 0 · fondo de la app    | `#f6f7fb`                                                      | `#0e111a`                   |
  | 1 · tarjeta, carrito   | `#ffffff` + sombra `0 1px 2px #1118270d, 0 4px 12px #1118270a` | `#161a26` + borde `#232a3a` |
  | 2 · menú, ventana      | `#ffffff` + sombra `0 12px 32px #11182724`                     | `#1d2232` + borde `#2c3448` |
  | Velo detrás de ventana | `#0f172a66`                                                    | `#00000099`                 |
  - Las fotos de producto en oscuro: borde de 1 px `#ffffff14` para que no se pierdan sobre el fondo.
  - El botón Cobrar en oscuro **sube** de tono (`#10b981` con texto casi negro) para que siga siendo lo más brillante de la pantalla.

- **Esfuerzo:** M. **Toca dinero:** no.
- **Cómo comprobar:** misma captura en claro/oscuro a 1366 y 390 px; un `grep` que no encuentre `#0b0f19`, `#14141f`, `#1c1c2b` fuera de `tokens.css`; axe sin fallos en oscuro.

## PC-VIS-03 · Cifras de dinero con estilo propio

- **Competidores:** Facturapp: «RD$ 24,580» en monoespaciada con «+18 % vs. ayer» verde debajo. Visto. Zoho: número grande de color + etiqueta pequeña negra. Visto. Square: precios alineados a la derecha en negrita media. Visto.
- **Norexos hoy (no visto en pantalla):** `font-variant-numeric: tabular-nums` aparece en varias reglas sueltas (`styles.css:242`, `:465`, `:1135`, `:1341`, `:2264`) pero no en todas; el total es 23 px × 1,12 ≈ 26 px peso 750 (`styles.css:2160-2163`); en el panel, `CountUp` anima la cifra (`apps/web/src/impacto.tsx:72-87`). La escala de letra como tal es **DIS-05**; esto es solo el «estilo dinero».
- **Propuesta:** una clase `.nx-monto` con tres tamaños y el «RD$» más chico y gris, para que el ojo lea el número.
- **CÓMO SE VERÍA**

  ```
  Línea del carrito      RD$ 1,250.00      16 px, peso 600, RD$ 13 px gris
  Total a cobrar     RD$ 4,830.00          32 px escritorio / 28 px celular, peso 750
  Cifra héroe panel  RD$ 24,580            40 px escritorio / 32 px celular, peso 700
                     ↑ 18 % vs. ayer        14 px, verde dinero o rojo peligro, con flecha
  ```

  - Siempre `tabular-nums`, separador de miles «,» y dos decimales en caja; sin decimales en el panel cuando pase de RD$ 10,000 (lo decide la dueña).
  - Negativos: signo «−» real (U+2212) y color peligro; nunca solo color (accesible para daltonismo).

- **Esfuerzo:** P. **Toca dinero:** no (solo presentación; el texto que se lee en voz alta sigue siendo el mismo).
- **Cómo comprobar:** prueba de componente: `formatMoney(-50)` dibuja «−RD$ 50.00» con clase de peligro; captura de carrito con 1, 10 y 1,000 unidades sin que la columna «baile».

## PC-VIS-04 · Pantalla de caja a 1366 px y a 390 px

- **Competidores:** Square (`square.png`): buscador gris con icono de escáner, pestañas «Favorites / Clearance» subrayadas, cuadrícula de fotos y ticket a la derecha. Visto. Loyverse (https://loyverse.com/, `loyverse.png`): 4–5 columnas de fotos + mosaicos de color sólido abajo. Visto, pequeño y medio tapado por cookies. Vendty (https://vendty.com/, `vendty.png`): pestañas de categoría en verde, rejilla 5 columnas con precio en barra negra. Visto. Kyte (`kyte.png`): celular con 3 columnas de tarjetas, laptop con 5. Visto.
- **Norexos hoy (no visto en pantalla):** carrito fijo de 340 px y catálogo flexible (`styles.css:1743-1747`); 3 columnas fijas (`styles.css:1859-1863`); tarjeta con foto, insignia de agotado, «+», categoría, nombre, código, precio y existencia (03 §3.1, `POS.tsx:1645-1679`). Las capas de CSS que redefinen la caja son **DIS-08**; cantidades escritas son **COM-04**; ventas en espera para la cajera son **COM-02**.
- **Propuesta:** columnas que dependen del ancho, no fijas; pestañas encima de la cuadrícula; en celular, el carrito pasa a una barra inferior que se despliega.
- **CÓMO SE VERÍA — escritorio 1366 × 768**

  ```
  ┌────────────┬──────────────────────────────────────────────┬──────────────────────┐
  │ menú 72 px │ [🔍 Buscar o escanear…            ][⌨ F2]   │ Cliente: Consumidor ▾│
  │ (solo      │ Favoritos  Ofertas  Suplementos  Maquillaje  │──────────────────────│
  │ íconos con │ ─────────                                    │ ▢ Whey 2lb      ×1   │
  │ texto al   │ ┌────┐┌────┐┌────┐┌────┐                     │   GV-0123  RD$2,450  │
  │ pasar)     │ │foto││foto││foto││foto│  4 columnas          │ ▢ Faja M        ×2   │
  │            │ │Nom ││Nom ││Nom ││Nom │  tarjeta 180×220     │   FJ-0410  RD$3,600  │
  │            │ │RD$ ││RD$ ││RD$ ││RD$ │  foto 1:1            │──────────────────────│
  │            │ └────┘└────┘└────┘└────┘                     │ Subtotal   RD$5,141  │
  │            │ ┌────┐┌────┐┌────┐┌────┐                     │ % ITBIS    RD$  909  │
  │            │ …                                            │ TOTAL  RD$ 6,050.00  │
  │            │                                              │[  COBRAR  · F12   ]  │ 64 px
  │            │                                              │ Espera  Cotizar  ✕   │ 44 px
  └────────────┴──────────────────────────────────────────────┴──────────────────────┘
                                                                carrito 380 px
  ```

  - Cuadrícula: `repeat(auto-fill, minmax(168px, 1fr))` → 4 columnas a 1366 px, 5 a 1600 px, 3 a 1024 px.
  - Pestañas: 44 px de alto, texto 15 px peso 600, subrayado de 3 px violeta en la activa (Square). «Favoritos» la elige la dueña (fijar con una estrella en Productos).
  - Tarjeta: radio 12 px, foto cuadrada arriba, nombre 15 px peso 600 en máximo 2 líneas, precio 16 px peso 700 abajo a la izquierda, existencia 13 px gris abajo a la derecha. Toda la tarjeta es zona táctil (no solo el «+»).

- **CÓMO SE VERÍA — celular 390 × 844**

  ```
  ┌──────────────────────────────┐
  │ ☰  Caja · Ana     ● En línea │ 56 px
  │ [🔍 Buscar o escanear   📷 ] │ 48 px
  │ Favoritos Ofertas Suplem… →  │ 44 px, se desliza
  │ ┌──────┐┌──────┐             │
  │ │ foto ││ foto │ 2 columnas  │
  │ │Nombre││Nombre│ 175 px      │
  │ │RD$ … ││RD$ … │             │
  │ └──────┘└──────┘             │
  │ …                            │
  ├──────────────────────────────┤
  │ 3 artículos   RD$ 6,050.00 ▲ │ barra fija 64 px; tocar abre el carrito
  │ [        COBRAR          ]   │ 56 px, ancho completo menos 16 px por lado
  └──────────────────────────────┘
  ```

  - Margen lateral 16 px; separación entre tarjetas 12 px; ninguna zona táctil por debajo de 44 × 44 px.
  - El carrito abierto ocupa el 90 % del alto con el asa arriba; se cierra deslizando hacia abajo.

- **Esfuerzo:** G (toca la pantalla más usada; conviene hacerlo después de DIS-08). **Toca dinero:** no (no cambia el cálculo; sí hay que repetir las pruebas e2e de cobro).
- **Cómo comprobar:** e2e de cobro existentes en verde a 1366 y 390 px; capturas comparadas; medir con Playwright que `.charge-button` mide ≥ 56 px de alto y que ninguna tarjeta queda bajo 44 px; la dueña cobra una venta de prueba en el celular.

## PC-VIS-05 · Carrito como ticket legible

- **Competidores:** Square (`square.png`): miniatura 48 px, nombre negrita, «SKU …» gris pequeño, precio a la derecha, impuesto con icono «%» en círculo. Visto. Vendty: columnas «Cantidad / Producto / Total» con «⊖ 1 ⊕». Visto (pequeño).
- **Norexos hoy (no visto en pantalla):** línea de ITBIS propia (`POS.tsx:1298-1303`), «Total a cobrar» con `aria-live` (`POS.tsx:1304-1307`), botón Cobrar con ícono, texto y `F12` (`POS.tsx:1314-1324`), acciones grises «En espera / Cotizar / Limpiar» (`POS.tsx:1325-1338`). Ya está muy cerca de Square; faltan foto, jerarquía de tamaños y el icono del impuesto.
- **Propuesta:** cada línea en dos renglones con miniatura; resumen con iconos; el total separado por una línea gruesa.
- **CÓMO SE VERÍA**

  ```
  ┌──────────────────────────────────────┐
  │ [img] Proteína Whey 2 lb   RD$ 2,450 │ nombre 15 px/600 · precio 15 px/600 der.
  │ 40px  GV-0123 · Vainilla   [− 1 +]   │ 13 px gris · stepper 36 px de alto
  │──────────────────────────────────────│ separador 1 px borde
  │ Subtotal                 RD$ 5,141.53│ 14 px gris
  │ (%) ITBIS incluido       RD$   908.47│ círculo 20 px con «%»
  │ ⊘  Descuento             −RD$  0.00  │ solo si existe
  │══════════════════════════════════════│ 2 px texto
  │ TOTAL                  RD$ 6,050.00  │ 13 px versalitas / 32 px peso 750
  │ ┌──────────────────────────────────┐ │
  │ │ 💳  COBRAR RD$ 6,050.00   [F12]  │ │ 64 px, verde dinero, radio 12 px
  │ └──────────────────────────────────┘ │
  │  ⏸ Espera     📄 Cotizar    🗑 Limpiar│ 44 px, texto 14 px gris, sin borde
  └──────────────────────────────────────┘
  ```

  - El monto va **dentro** del botón (hoy está solo en `aria-label`, `POS.tsx:1319`): la cajera confirma sin mirar arriba.
  - «Limpiar» en gris y separado al extremo para no tocarlo por error; su color de peligro solo al pasar el ratón.
  - Línea recién agregada: fondo verde dinero al 12 % que se desvanece en 600 ms (ver PC-VIS-11).

- **Esfuerzo:** M. **Toca dinero:** no (muestra los mismos valores; probar que el texto del botón coincide con el total).
- **Cómo comprobar:** prueba que el texto de `.charge-button` contenga exactamente `formatMoney(total)`; captura con 1 y 12 líneas (desplazamiento interno, total siempre visible).

## PC-VIS-06 · Barra de estado de la caja

- **Competidores:** Square: «12:37 PM · ✓ Reader ✓ 1 printer ✓ Scanner» en la franja superior de la caja. Visto. Patrón de offline con límites claros (Square 72 h, Clover 7 días): solo texto (tabla 02, patrones 5).
- **Norexos hoy (no visto en pantalla):** un botón de conexión en la barra superior con «En línea / Sin conexión / Sincronizando · N» (`apps/web/src/App.tsx:1124-1150`); en la caja, «Stock actualizado en línea/localmente» (`POS.tsx:1076`). No hay estado de impresora ni de lector (03 §3.2: «Barra de periféricos: no encontrada»).
- **Propuesta:** en la caja, una franja fina con tres «píldoras» de estado y el nombre de la caja abierta. Verde = todo bien; ámbar = algo espera; rojo = no se puede.
- **CÓMO SE VERÍA**

  ```
  ┌───────────────────────────────────────────────────────────────────────┐
  │ Caja 1 · Ana · abierta 8:02 a. m.   ● En línea   ⬆ 0 por subir   🖨 Lista │ 36 px
  └───────────────────────────────────────────────────────────────────────┘
  sin internet:                         ● Sin conexión  ⬆ 3 por subir (ámbar)
  ```

  - Píldora: 28 px de alto, radio 999 px, punto de 8 px + texto 13 px peso 600; fondo del rol al 12 %.
  - «🖨 Lista» solo cuando exista impresión directa (**MOD-03**); hasta entonces, la píldora no se muestra (no inventar estado).
  - En celular, se reduce a tres puntos con su ícono en la barra superior; tocar abre el detalle.

- **Esfuerzo:** M. **Toca dinero:** no.
- **Cómo comprobar:** e2e con la red cortada (`context.setOffline(true)`): la píldora pasa a ámbar y cuenta la venta guardada; al volver, baja a 0.

## PC-VIS-07 · Panel de la dueña «Hoy en una mirada»

- **Competidores:** Facturapp: tarjeta «Ventas de hoy RD$ 24,580 ↑ +18 % vs. ayer» con mini-línea verde; tarjetas «Inventario · Stock al día · 120 productos ›» y «e-CF · Aprobado por DGII ✓». Visto. Zoho Inventory (https://www.zoho.com/inventory/, `zoho_inventory.png`): tres cifras con icono en círculo de color. Visto. Treinta (https://www.treinta.co/, `treinta.png`): balance con «Ingresos / Egresos» y lista con estado «Pagado» en verde, en la imagen del celular. Visto (pequeño).
- **Norexos hoy (no visto en pantalla):** tablero con franja KPI, `YearPie`, `DayCard` y cuadrícula de tarjetas (`apps/web/src/Dashboard.tsx:325`, `:366-385`); cuadrícula de 4 columnas (`styles.css:1098`); animación de entrada escalonada (`styles.css:6776-6826`). Que muestre RD$ 0.00 mientras carga es **DIS-01**; alertas agrupadas es **DIS-04**; 18 consultas a la vez es **EFI-05**.
- **Propuesta:** arriba, **una** cifra héroe (vendido hoy) con la comparación; debajo, tres tarjetas que llevan a una acción («Cuadre de caja», «Stock bajo: 7», «Por cobrar: RD$ …»); el resto, más abajo.
- **CÓMO SE VERÍA — escritorio 1366 px**

  ```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Buenos días, [nombre]                         sáb 14 nov · Tienda ▾  │ 24 px/700
  │ ┌──────────────────────────────────────┐ ┌──────────────────────────┐│
  │ │ Vendido hoy                          │ │ Margen de hoy            ││
  │ │ RD$ 24,580            ╱╲_╱‾‾ (línea) │ │ 32 %  ✓ sobre el 15 %    ││
  │ │ ↑ 18 % vs. sábado pasado · 31 ventas │ │ (solo con permiso)       ││
  │ └──────────────────────────────────────┘ └──────────────────────────┘│
  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
  │ │ ⬤ Caja       │ │ ⬤ Stock bajo │ │ ⬤ Por cobrar │  tarjetas 120 px   │
  │ │ 2 abiertas › │ │ 7 productos ›│ │ RD$ 18,300 › │  icono en círculo  │
  │ └──────────────┘ └──────────────┘ └──────────────┘  36 px, color rol  │
  │ Alertas (agrupadas, DIS-04) …                                        │
  └──────────────────────────────────────────────────────────────────────┘
  ```

  - Comparar contra **el mismo día de la semana anterior**, no contra ayer (un sábado contra un viernes engaña).
  - Celular 390 px: la cifra héroe a 32 px ocupa el ancho; las tres tarjetas se vuelven una fila deslizable de 160 px cada una.
  - En oscuro, la tarjeta héroe usa altura 2 (`#1d2232`) para destacar sin color extra.

- **Esfuerzo:** M. **Toca dinero:** no (lee los mismos datos; la regla del 15 % es la misma del negocio).
- **Cómo comprobar:** con datos de prueba, la cifra héroe coincide con el informe de ventas del día (comparar dos fuentes); captura en ambos anchos; con consulta fallida se ve el estado de error de PC-VIS-09, no un 0.

## PC-VIS-08 · Tablas y listas legibles

- **Competidores:** Zoho (tarjeta «Sales Order» con cabecera negra «Items · Qty · Status · Amt», importe a la derecha y puntos de color por estado). Visto. Treinta: lista con monto a la derecha y estado en verde. Visto (pequeño). Del resto no hay tablas visibles en las capturas.
- **Norexos hoy (no visto en pantalla):** `th` con `8px × escala` (que el mínimo sube a 14 px), mayúsculas espaciadas, `padding 13px 20px` (`styles.css:1353-1363`); `td` con `padding 17px 20px` (`styles.css:1364-1369`); en ≤ 768 px las tablas se vuelven tarjetas con la etiqueta de columna en cada celda (`apps/web/src/mobileTables.ts:1-25`, `styles.css:6689-6731`). Buena base.
- **Propuesta:** reglas fijas para toda tabla:
- **CÓMO SE VERÍA**

  ```
  Fecha ▾        Cliente           Método      Estado         Monto
  ─────────────────────────────────────────────────────────────────────  cabecera fija al desplazar
  14 nov 9:41    María P.          Efectivo    ● Pagada     RD$ 2,450.00  fila 48 px
  14 nov 9:12    Consumidor final  Transfer.   ● Por revisar RD$ 6,050.00  hover fondo marca-suave 50 %
  ```

  - Cabecera: 13 px peso 600, color texto-2, **sin** mayúsculas (se leen peor en español con tildes); fija (`position: sticky`).
  - Filas: 48 px de alto (40 px en modo «compacto» que la dueña puede activar); cuerpo 15 px; separador 1 px; sin cebra (el hover basta).
  - Números y montos **alineados a la derecha** con `tabular-nums`; fechas cortas «14 nov 9:41».
  - Estado: punto de 8 px + palabra (nunca solo color).
  - Celular: se mantiene la tarjeta de `mobileTables.ts`, pero con el monto arriba a la derecha en 17 px peso 700 y la etiqueta de columna a 13 px gris.

- **Esfuerzo:** M (CSS común + revisar las tablas con alineación propia). **Toca dinero:** no.
- **Cómo comprobar:** captura de Ventas, Productos y Bitácora en 1366 y 390 px; prueba que toda `td` con monto tenga `text-align: right`.

## PC-VIS-09 · Vacío, carga y error con un solo componente

- **Competidores:** en las capturas no se ve ningún estado vacío ni de error (son páginas de marketing). No visto.
- **Norexos hoy (no visto en pantalla):** tres estilos de vacío distintos: `.empty` con ícono en `#ba9bea` fijo (`styles.css:1619-1640`), `.empty-small` (`styles.css:1248`) y `.cart-empty-state` (`styles.css:5536-5556`); carga con `.loading` centrado de 160 px (`styles.css:1641-1645`); el token `--nx-esqueleto` existe (`tokens.css:54`, `:69`) pero no vi su uso en `styles.css`. «Algo falló» por pantalla es **EST-03**; el Resumen en 0 al cargar es **DIS-01**.
- **Propuesta:** un componente `<Estado tipo="vacio|cargando|error|sin-permiso">` con la misma forma en toda la app.
- **CÓMO SE VERÍA**

  ```
  CARGANDO (esqueleto, nunca un 0)        VACÍO                         ERROR
  ┌──────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
  │ ▒▒▒▒▒▒▒▒             │   │        ( 📦 )  48 px      │   │      ( ⚠ ) 48 px ámbar    │
  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒       │   │  Aún no hay ventas hoy    │   │  No se pudo cargar        │
  │ ▒▒▒▒▒  ▒▒▒▒▒▒        │   │  17 px / 600              │   │  Tus datos están a salvo. │
  │                      │   │  Las ventas aparecen aquí │   │  [ Reintentar ]  Detalles │
  │ pulso opacidad 1.2 s │   │  [ Ir a la caja ]         │   │  código: VENTAS-504       │
  └──────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
  ```

  - Esqueleto con la **forma** del contenido final (barras de 12–16 px de alto, radio 6 px), color `--nx-esqueleto`; pulso de opacidad 0,6 → 1 en 1,2 s; con «reducir movimiento», gris fijo.
  - Ícono en círculo de 64 px fondo neutro, ícono 28 px texto-2 (sin violeta suelto).
  - Título 17 px peso 600, texto 15 px texto-2, máximo 48 caracteres por línea; **un** botón de acción.
  - Error: siempre dice qué pasó, que no se perdió nada (si es cierto) y qué hacer; el código ayuda a soporte.

- **Esfuerzo:** M. **Toca dinero:** no.
- **Cómo comprobar:** e2e que intercepta `/dashboard` con 500 y espera el estado de error (no «RD$ 0.00»); `grep` sin `#ba9bea`.

## PC-VIS-10 · Reglas de iconos

- **Competidores:** Treinta: iconos de línea gruesa. Facturapp: iconos simples blancos dentro de círculos de 56 px. Kyte: barra lateral de iconos finos con texto debajo. Visto.
- **Norexos hoy (no visto en pantalla):** un solo juego, `lucide-react` (`apps/web/package.json:24`), usado en 13 archivos; tamaños variados (`size={14}`, `15`, `17`, `19`, `20` en `POS.tsx:1311-1336`, `App.tsx:1120-1140`, `Dashboard.tsx:373`). Íconos repetidos en el menú es **DIS-03**.
- **Propuesta:** dos tamaños y un grosor: 20 px en botones y listas, 24 px en menú y tarjetas; trazo 1,75 en todos (`strokeWidth`); ícono siempre con texto visible salvo en la barra de 72 px (allí, texto al pasar y en `aria-label`). Ícono en círculo (36 px, fondo del rol al 12 %) solo en tarjetas del panel.
- **CÓMO SE VERÍA:** menú escritorio: ícono 24 px + texto 15 px, fila 44 px, activo con fondo marca-suave y barra de 3 px a la izquierda. Celular: barra inferior de 4 íconos de 24 px con etiqueta de 14 px (el mínimo de la casa, `tokens.css:76`), zonas de 88 × 56 px; el resto del menú en «Más».
- **Esfuerzo:** P. **Toca dinero:** no.
- **Cómo comprobar:** regla de eslint o `grep` que solo permita `size={20|24}`; captura del menú.

## PC-VIS-11 · Movimiento sutil con reglas

- **Competidores:** las capturas son fijas; no se puede ver movimiento. Toast usa un óvalo dibujado a mano como adorno (visto) — es estático.
- **Norexos hoy (no visto en pantalla):** tokens de duración 120/180/240 ms y curva de salida (`tokens.css:33-38`); entrada escalonada del tablero que se apaga con «reducir movimiento» (`styles.css:6776-6826`); otros bloques de reducir movimiento (`styles.css:3024`, `:4061`, `:5775`, `:6593`); `CountUp` anima cifras con `requestAnimationFrame` (`impacto.tsx:72-87`) y solo en Impacto; **no comprobé** si `impactoActive()` mira «reducir movimiento».
- **Propuesta:** solo 4 animaciones permitidas en toda la app; cualquier otra se quita.

  | Qué anima                    | Cómo                                                                                        | Duración        | Con «reducir movimiento»         |
  | ---------------------------- | ------------------------------------------------------------------------------------------- | --------------- | -------------------------------- |
  | Producto agregado al carrito | fondo verde 12 % → transparente en la línea nueva; contador del carrito escala 1 → 1,15 → 1 | 600 ms / 180 ms | solo cambio de color, sin escala |
  | Ventana o cajón que abre     | opacidad 0 → 1 + desplazamiento 8 px                                                        | 180 ms          | solo opacidad, 0 ms              |
  | Venta cobrada                | marca ✓ que se dibuja (trazo) en círculo verde 72 px                                        | 240 ms          | ✓ fija                           |
  | Esqueleto                    | pulso de opacidad                                                                           | 1,2 s en bucle  | gris fijo                        |
  - Solo `transform` y `opacity` (ya es la regla de `tokens.css:32`). Nada se mueve solo más de una vez por acción.
  - Botón pulsado: escala 0,97 en 120 ms (ya existe algo parecido, `styles.css:6574`).

- **Esfuerzo:** P. **Toca dinero:** no.
- **Cómo comprobar:** Playwright con `reducedMotion: 'reduce'`: `getAnimations()` vacío en caja y panel; con normal, la línea nueva tiene la clase de destello.

## PC-VIS-12 · Primer arranque visual

- **Competidores:** Facturapp: «50 facturas al mes · Sin tarjeta» bajo el botón; promesa de facilidad. Visto. Poster: «✓ Set up in 15 minutes». Visto. Ninguna captura muestra el asistente por dentro. No visto.
- **Norexos hoy (no visto en pantalla):** «Primeros pasos» no está en este árbol, vive en `producto-nexora` (**EST-01**); arranque guiado en la instalada es **MOD-02**; modo práctica es **MOD-01**. Esta propuesta es solo **cómo se ve**.
- **Propuesta:** tarjeta fija arriba del panel hasta completarla, con 5 pasos y barra de progreso; cada paso abre la pantalla real con un recuadro que señala dónde tocar.
- **CÓMO SE VERÍA**

  ```
  ┌────────────────────────────────────────────────────────────────┐
  │ Deja lista tu tienda              ▓▓▓▓▓▓░░░░  3 de 5   [Ocultar]│ 20 px/700
  │ ✓ Datos del negocio y logo                                     │ fila 48 px
  │ ✓ Primer producto con foto                                     │ ✓ en círculo verde 24 px
  │ ✓ Usuarios y PIN                                               │
  │ ○ Abrir caja y cobrar una venta de práctica   [Empezar →]      │ paso actual, fondo marca-suave
  │ ○ Probar el recibo en tu impresora                             │
  └────────────────────────────────────────────────────────────────┘
  ```

  - Celular: misma tarjeta a ancho completo; los pasos hechos se colapsan en «3 hechos ▾».
  - Al terminar: una sola animación ✓ (PC-VIS-11) y la tarjeta desaparece.

- **Esfuerzo:** M (solo la parte visual; depende de EST-01/MOD-02). **Toca dinero:** no.
- **Cómo comprobar:** e2e con base vacía: la tarjeta aparece, cada enlace abre la pantalla correcta, desaparece al 5/5.

## PC-VIS-13 · Recibo térmico con jerarquía fija

- **Competidores:** no hay recibos en las capturas. Nexprint publica el QR oficial en el ticket (tabla 02, Cumplimiento RD; solo texto).
- **Norexos hoy (no visto en pantalla ni impreso):** componente térmico con clases `tp-*` (`apps/web/src/Prints.tsx:50-90`); logo por defecto `/logo-grupo-macgen.png` (`Prints.tsx:85`, ligado a **EST-14**); tamaños en línea con `style` (`Prints.tsx:119`, `:123`, `:142`); leyenda «DOCUMENTO NO FISCAL…» (`Prints.tsx:509-510`); aviso de privacidad y «¡Gracias por su compra!» (`Prints.tsx:632-633`); páginas de 80 y 58 mm (`styles.css:5181-5188`). Que 58 mm salga con letra más grande es **DIS-06**; impresión directa es **MOD-03**.
- **Propuesta:** fijar la jerarquía del recibo en una tabla de tamaños por papel (en vez de `style` sueltos) y una regla de solo negro.
- **CÓMO SE VERÍA (80 mm; entre paréntesis 58 mm)**

  ```
          [LOGO 1 bit, 40 mm (32 mm) de ancho]
             NOMBRE DEL NEGOCIO        12 pt (10 pt) negrita
        RNC · Dirección · Teléfono     8 pt (7 pt)
  ------------------------------------------------
  Recibo FS-000123        14/11/2026 9:41 a. m.   9 pt
  Cajera: Ana             Cliente: Consumidor final
  ------------------------------------------------
  2 x Faja M                          RD$ 3,600.00  9 pt, nombre en negrita
      FJ-0410  @ 1,800.00                          8 pt
  ------------------------------------------------
  Subtotal                            RD$ 5,141.53
  ITBIS incluido 18 %                 RD$   908.47
  ================================================
  TOTAL                RD$ 6,050.00   16 pt (14 pt) negrita
  Efectivo RD$ 7,000.00 · Devuelta RD$ 950.00
  ------------------------------------------------
  DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL   8 pt negrita, centrado
  Política de devolución / aviso de privacidad     7 pt
  ¡Gracias por su compra!                          9 pt
  ```

  - Márgenes 3 mm a cada lado; ancho útil 72 mm (48 mm); nada de grises (la térmica los imprime como puntos).
  - Logo convertido a 1 bit al subirlo (umbral 50 %) para que no salga como mancha.
  - Toda cifra con dos decimales, alineada a la derecha y misma fuente monoespaciada que hoy si existe; si no, `tabular-nums`.

- **Esfuerzo:** M. **Toca dinero:** sí (imprime montos: hay que verificar que cada cifra impresa coincide con la venta, sin cambiar el cálculo).
- **Cómo comprobar:** impresión a PDF de 80 y 58 mm de la misma venta y comparar cifra por cifra con la venta guardada (3 lecturas, regla de la casa); prueba de que el `font-size` de 58 mm ≤ 80 mm (cierra DIS-06); impresión real en la térmica de la tienda (no hecha).

## PC-VIS-14 · Página de venta con pantallas reales

- **Competidores:** Facturapp: foto de un dueño de colmado dominicano + tres tarjetas flotantes con cifras en RD$ y sello «Aprobado por DGII». Visto. Tiendanube (https://www.tiendanube.com/mx/canales/punto-de-venta, `tiendanube-pos.png`): azul a azul marino, titular blanco con segunda línea en cursiva serif, tarjeta de producto flotante y botón «Registrar venta». Visto. Square y Kyte: la pantalla del producto en un marco de iPad/laptop. Visto. Contraejemplos: modal de Alegra RD con cuenta regresiva (visto), banner de Vendty (visto).
- **Norexos hoy (no visto en pantalla):** `apps/landing/index.html` y `apps/landing/landing.css`; los colores más usados son `#0b0f19`, `#a78bfa` y **`#5b3fc4`** (otro violeta que el `#7c3aed` de la app); no encontré `<img>` de pantallas en `index.html`. Esto es exactamente **DIS-09**; aquí solo se describe **cómo se vería**.
- **Propuesta:** héroe oscuro con el violeta de la app, captura real de la caja en un marco de laptop y del celular encima, y dos tarjetas flotantes con datos ficticios en RD$.
- **CÓMO SE VERÍA — escritorio 1366 px**

  ```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ ◆ Norexos     Funciones  Precios  Ayuda          [Entrar] [Pruébalo] │ 72 px
  │                                                                      │ fondo #0e111a
  │ HECHO EN RD PARA TIENDAS                ┌───────────────────────┐    │ etiqueta 13 px, espaciado 1.5
  │ Vende, cuadra y controla                │  [captura real caja]  │    │ titular 56 px/750 blanco
  │ tu tienda desde un solo lugar.          │   en marco laptop     │    │ 2ª línea en #a78bfa
  │ Funciona sin internet y avisa si ┌──────┴──┐ ┌────────────────┐ │    │ texto 19 px #a7b0c3
  │ algo no cuadra.                  │ celular │ │Vendido hoy     │ │    │ tarjeta flotante blanca
  │ [ Pruébalo gratis → ]  ▶ Ver demo│ captura │ │RD$ 24,580 ↑18 %│ │    │ botón 56 px #6d28d9
  │                                  └─────────┘ └────────────────┘ │    │
  └──────────────────────────────────────────────────────────────────────┘
  ```

  - Un solo violeta (`#6d28d9` botón, `#a78bfa` texto sobre oscuro) igual al de la app.
  - Celular 390 px: titular 36 px, texto 17 px, captura del celular sola debajo del botón, sin la laptop.
  - Nada de modales, cuentas regresivas ni chat flotante encima del contenido; el aviso del plazo DGII, si va, como franja fina arriba que se cierra.
  - Las capturas se generan con Playwright desde la base de demostración (sin datos reales de la tienda).

- **Esfuerzo:** M. **Toca dinero:** no.
- **Cómo comprobar:** Lighthouse ≥ 90 en rendimiento y accesibilidad; `grep` sin `#5b3fc4`; ninguna captura contiene nombres de clientes reales.

---

# B. PRIVACIDAD Y CONTROL DE ACCESO EN EL USO DIARIO

Base ya existente (03 §4): la cajera no ve costos ni márgenes (`apps/api/src/common.ts:368-370`), ni el esperado de caja; PIN de 4–6 dígitos con bcrypt (`apps/api/src/security.ts`). Ya propuestos y no repetidos: **SEG-01** (2FA), **SEG-03** (aviso de cambio de precio), **SEG-04** (agentes sin PIN), **SEG-05** (PIN fáciles), **SEG-08** (avisar antes de cerrar sesión con ventas sin enviar), **SEG-10** (bitácora con sello), **EST-11** (permisos con nombre), **D5** (permisos en español).

## PC-PRIV-01 · Bloqueo rápido con PIN en vez de cerrar la sesión

- **Competidores:** PIN personal de 4–6 dígitos por cajero y PIN de gerente (Square, Shopify; tabla 02, patrones 6; solo texto). Facturapp: PIN por cajero + turno (tabla 02 parte 2, patrones 2; solo texto, https://facturapp.do/precios/).
- **Norexos hoy (no visto en pantalla):** por inactividad la sesión **se cierra** tras `sessionTimeoutMinutes` (30 por defecto, 1–480; `apps/web/src/App.tsx:874`, `apps/api/src/admin.ts:92`, `apps/api/src/auth.ts:358-359`), con aviso «¿Sigues ahí?» 60 s antes (`App.tsx:109-148`); existe «Cambiar de usuario con PIN» (`App.tsx:1213`, `:1348-1356`). Entre que la cajera se aparta y pasan 30 min, la pantalla queda abierta con su usuario.
- **Propuesta:** dos plazos: **bloqueo** a los 3 min sin tocar (configurable 1–10) que tapa la pantalla y pide el PIN de quien estaba o deja entrar a otra con su PIN (reusa el cambio de usuario); **cierre** a los 30 min como hoy. El carrito no se pierde al bloquear. Botón «🔒 Bloquear» visible en la barra (atajo `Ctrl+L`).
- **CÓMO SE VERÍA**

  ```
  ┌─────────────────────────────────────┐   fondo: la caja desenfocada 16 px + velo 60 %
  │            🔒  Caja 1               │
  │      Bloqueada · Ana (9:41 a. m.)   │   17 px/600
  │         ● ● ○ ○                     │   puntos de 14 px
  │   ┌───┐ ┌───┐ ┌───┐                 │
  │   │ 1 │ │ 2 │ │ 3 │   teclas 72×64 px, 24 px/600, radio 12 px
  │   ├───┤ ├───┤ ├───┤                 │
  │   │ 4 │ │ 5 │ │ 6 │                 │
  │   …   ┌───┐                         │
  │   ⌫   │ 0 │  ✓                      │
  │   Entrar como otra persona ›        │   14 px enlace
  └─────────────────────────────────────┘
  ```

  - El desenfoque no deja leer montos ni nombres del carrito.
  - 5 intentos fallidos → espera de 30 s y aviso a la dueña en la bitácora.
  - Celular: el mismo teclado a ancho completo, teclas 96 × 64 px.

- **Esfuerzo:** M. **Toca dinero:** no (no cambia la venta; probar que el carrito sobrevive al bloqueo).
- **Cómo comprobar:** e2e con reloj falso: a los 3 min aparece el bloqueo; el PIN correcto vuelve con el mismo carrito; PIN de otra usuaria entra con su caja (regla existente `App.tsx:1353-1355`); a los 30 min, cierre como hoy.

## PC-PRIV-02 · Botón «ocultar cifras»

- **Competidores:** ninguna de las 25 lo publica en lo revisado (no visto). Es común en apps de banca; se propone por el uso real: la dueña mira el panel delante de clientes o empleadas.
- **Norexos hoy (no visto en pantalla):** el panel muestra las cifras siempre (`apps/web/src/Dashboard.tsx:366-385`); no encontré opción de ocultarlas (`grep` sin resultados de «Ocultar/EyeOff» en `Dashboard.tsx` y `KpiStrip.tsx`).
- **Propuesta:** ícono de ojo junto al saludo: cambia todos los montos del panel y de los informes por «RD$ •••••» hasta tocarlo otra vez; se recuerda en ese equipo. No es seguridad (los datos siguen llegando), es discreción.
- **CÓMO SE VERÍA:** `Vendido hoy  RD$ •••••  ↑ 18 %` — el porcentaje sí se ve; puntos del mismo ancho que la cifra para que nada salte; ícono 20 px en botón de 44 × 44 px.
- **Esfuerzo:** P. **Toca dinero:** no.
- **Cómo comprobar:** prueba de componente: con el modo activo, ningún texto del panel coincide con `/RD\$\s?[\d,]+/`; captura.

## PC-PRIV-03 · «Ver como cajera»

- **Competidores:** Kyte: permisos con ejemplos concretos (ver pedidos ajenos, dar descuentos, crear productos) (https://kyteapp.com/pricing; tabla 02, solo texto). Lightspeed hasta 21 roles; Alegra roles personalizables (solo texto).
- **Norexos hoy (no visto en pantalla):** roles de fábrica y permisos (`packages/shared/src/index.ts:762-784`, citado en 03 §4; no lo reabrí); costos ocultos en servidor para quien no es administración (`apps/api/src/common.ts:368-370`, citado en 03). La dueña edita permisos como lista de códigos; ponerles nombre en español ya es **EST-11** y **D5**.
- **Propuesta:** en la pantalla de un rol, botón «Ver como este rol» que abre una vista previa de solo lectura de la caja y del menú con lo que ese rol ve, y una lista en frases: «Puede: vender, abrir su caja, crear clientes. No puede: ver costos, ver lo esperado en caja, aprobar transferencias.»
- **CÓMO SE VERÍA:** dos columnas a 1366 px (izquierda la lista «Puede ✓ / No puede ✕» en 15 px; derecha una miniatura de la caja al 50 % con una franja ámbar «Vista previa — rol Vendedora»); en celular, la lista arriba y el botón «Abrir vista previa» abajo.
- **Esfuerzo:** M. **Toca dinero:** no (solo lectura; el servidor sigue decidiendo).
- **Cómo comprobar:** e2e: la vista previa de Vendedora no muestra ninguna columna «Costo»; la lista coincide con los permisos guardados (compararlos por dos caminos).

## PC-PRIV-04 · Datos de clientes tapados por defecto, también para quien puede verlos

- **Competidores:** sin fuente en la tabla 02 sobre cómo muestran teléfono o cédula. No visto.
- **Norexos hoy (no visto en pantalla):** quien no tiene permiso recibe teléfono y cédula con `•••••••123` y el correo como `a•••@…`, y sin historial de compras (`apps/api/src/common.ts:282-311`, también `apps/api/src/sales.ts:4277-4278`); el recibo por WhatsApp no usa un dato tapado como destinatario (`apps/web/src/POS.tsx:2433`); el recibo trae aviso de privacidad (`Prints.tsx:632`). Quien **sí** tiene permiso ve todo siempre, a la vista de quien esté al lado.
- **Propuesta:** para los roles con permiso, mostrar también tapado y un botón «👁 Mostrar» por campo que lo destapa 30 s y deja constancia en la bitácora («Gerente vio la cédula de María P.»). Formato visual igual al que ya usa el servidor.
- **CÓMO SE VERÍA:** `Teléfono  •••••••123  [👁 Mostrar]` (texto 15 px, botón 36 px de alto, ícono 20 px); al destapar, el número se ve 30 s con una barra fina que se vacía (sin animación si «reducir movimiento»).
- **Esfuerzo:** M (un endpoint para destapar con registro). **Toca dinero:** no.
- **Cómo comprobar:** prueba de API: sin llamada de destapar, la ficha llega tapada a gerencia; con ella, llega completa y aparece la fila en la bitácora.

## PC-PRIV-05 · Bitácora en frases

- **Competidores:** sin fuente en la tabla sobre bitácoras legibles; Facturapp publica «cierre a ciegas» y Fudo PIN para anulaciones (solo texto). No visto.
- **Norexos hoy (no visto en pantalla):** pestaña «Bitácora» (`apps/web/src/Management.tsx:4379`) que pide `/audit-log` (`Management.tsx:4218-4219`) y muestra Fecha, Usuario, **Acción como código** en una insignia, Entidad y Referencia como id (`Management.tsx:4541-4560`). La dueña lee «sale.void · sale · 8f3a…».
- **Propuesta:** traducir cada acción a una frase con el antes y el después, filtros por persona, día y tipo, y color por riesgo.
- **CÓMO SE VERÍA**

  ```
  Hoy
  09:41  ● Ana anuló la venta FS-000118 (RD$ 2,450.00) · motivo: «cliente cambió»   rojo
  09:12  ● Luis cambió el precio de «Faja M» de RD$ 1,900 a RD$ 1,800              ámbar
  08:02  ● Ana abrió la Caja 1 con RD$ 3,000.00                                    neutro
  [Persona ▾] [Tipo ▾] [Hoy ▾]                                       Exportar
  ```

  - Fila 48 px; hora 13 px `tabular-nums`; frase 15 px con el nombre en negrita; punto de 8 px por riesgo + palabra en lector de pantalla.
  - Celular: hora arriba de la frase; filtros en una hoja que sube desde abajo.
  - La referencia (id) queda en «Detalles» para soporte.

- **Esfuerzo:** M (diccionario de acciones + datos de antes/después donde ya se guardan). **Toca dinero:** no.
- **Cómo comprobar:** prueba que todo `action` conocido tenga frase (falla si aparece uno nuevo sin traducir); comparar 20 filas con la tabla cruda.

## PC-PRIV-06 · «Equipos y sesiones abiertas»

- **Competidores:** sin fuente hoy en la tabla (no verificado). Patrón común en servicios web («cerrar sesión en todos los equipos»).
- **Norexos hoy (no visto en pantalla):** aprobación de equipo nuevo con PIN (`apps/web/src/realtime.tsx:537-538`, citado en 03 §4); identidad del terminal en ventas (`Management.tsx:2067`, `terminalIdentity`); plazo de sesión en servidor (`apps/api/src/auth.ts:358-414`). No encontré una pantalla que liste las sesiones abiertas. El segundo factor ya es **SEG-01**.
- **Propuesta:** en Ajustes, lista de equipos aprobados y sesiones abiertas (persona, equipo, última actividad, «este equipo») con «Cerrar sesión» por fila y «Cerrar todas menos esta». Al entrar desde un equipo nuevo, aviso en el panel de la dueña.
- **CÓMO SE VERÍA:** tabla con las reglas de PC-VIS-08: `💻 Caja tienda · Ana · activa hace 2 min · [Cerrar]`; la fila «este equipo» con insignia marca-suave; botón de peligro abajo, con confirmación que escribe la cantidad («Cerrar 4 sesiones»).
- **Esfuerzo:** M. **Toca dinero:** no (pero cerrar una sesión con ventas sin enviar debe respetar **SEG-08**).
- **Cómo comprobar:** e2e con dos contextos de navegador: cerrar el segundo desde el primero lo saca en la siguiente petición; el primero sigue.

---

## No comprobado

- **No ejecuté la app**: ningún color, tamaño, desbordamiento ni regla ganadora de la cascada se vio en pantalla; todo lo de Norexos sale del código.
- **8 capturas no abiertas** (lightspeed, clover, sumup, fudo, alegra, siigo, bsale, erpnext): uso solo la descripción de la tabla 02.
- Las capturas son páginas de marketing; las «cajas de muestra» son imágenes promocionales, no apps en uso. Los hex de competidores son aproximados a ojo.
- Contrastes calculados a mano; falta pasarlos por una herramienta.
- No vi el recibo impreso ni la página de venta en el navegador.
- No reabrí `packages/shared/src/index.ts` (roles) ni `realtime.tsx`; esas líneas vienen de 03.
- No comprobé si `impactoActive()` respeta «reducir movimiento» ni dónde se usa `--nx-esqueleto`.
- Árbol leído: `e959914` (no `ed5826f` como decía el encargo).
