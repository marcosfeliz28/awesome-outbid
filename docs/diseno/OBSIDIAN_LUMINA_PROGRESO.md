# Obsidian Lumina · progreso

Dirección aprobada por la dueña: «Obsidian Lumina» equilibrado (ejecutivo,
elegante, minimalista, futurismo sutil). Referencia:
`origin/chatgpt-pc/obsidian-lumina-prototype`, carpeta `design/obsidian-lumina/`.

Reglas de uso del color: **violeta = acción y lugar actual**, **esmeralda =
estado y foco**. Nunca decoración permanente. Ningún cambio de reglas fiscales,
pagos, seguridad, permisos, API ni base de datos.

## Fase 1 · auditoría, sistema compartido y marco de administración

Rama `claude/obsidian-lumina-f1` (desde `claude/producto-mezcla-4`).

### 1. Auditoría (antes)

Capturas en `docs/diseno/obsidian-lumina/f1/antes-*.png` (1366×768 y 390×844).
Tamaños medidos en el navegador con la app sembrada.

**Marco (barra lateral y barra superior)**

- Letra diminuta en todo el marco: menú 11 px, «TU NEGOCIO» 8 px, ruta 10 px,
  «En línea» 9 px (8 px por debajo de 1250 px), rol de la cuenta 8 px, sucursal
  8 px, pie 9 px. Por debajo de 12 px no se lee bien en una caja con luz de tienda.
- Lugar actual marcado solo por color (fondo violeta claro + punto). Sin
  `aria-current`: el lector de pantalla no sabía en qué pantalla estaba.
- En celular «En línea / Sin conexión» se ocultaba con `display: none`: el
  botón quedaba solo con el icono y sin nombre accesible.
- 18 opciones en una lista plana, sin grupos; tres usan el mismo icono de
  camión (Mercancía, Envíos del mensajero, Compras).
- Tema oscuro azul pizarra (`#0b0f19`/`#151b2b`): no es la base obsidiana
  aprobada; superficies y bordes sin jerarquía (todo al mismo nivel).

**Jerarquía y tipografía**

- Títulos en Plus Jakarta a 750 con `letter-spacing: -0.04em`: las palabras se
  juntan («Tucatálogo, conpersonalidad», «Ventasdelañopormes»).
- El título de cada pantalla es un eslogan («A la medida de tu negocio», «Tu
  catálogo, con personalidad») y no coincide con la ruta (Configuración,
  Productos). Encima, una etiqueta en mayúsculas espaciadas («TU NEGOCIO, CON
  CLARIDAD») que no aporta información.
- Encabezados de tabla a 8 px, celdas 11 px, etiquetas de estado 8–10 px.
- Números: solo `.amount` y KPI usan cifras tabulares; las tablas no.

**Resumen (Dashboard)**

- Lo primero es una pancarta decorativa (bolsa, chispas, boleto) de 200 px; los
  indicadores (KPI) quedan por debajo de la gráfica anual y del día: fuera de la
  primera pantalla en 1366×768.
- La torta anual queda descolgada (gran hueco a la izquierda) y en celular el
  globo de detalle se pinta como un fantasma encima de la torta.
- Botones de cabecera de 40 px de alto y 10 px de letra.

**Configuración, catálogo, inventario, clientes, reportes**

- Componentes mezclados: en Configuración hay texto suelto fuera de la tarjeta
  («Las ventas a crédito…», «Sin logo») con otro tamaño y otra alineación.
- Varias acciones del mismo peso en la cabecera de Productos (Plantilla,
  Importar Excel, Importar inventario, Nuevo producto); la primaria se distingue
  solo por el relleno.
- Errores de formulario con fondo rosa claro fijo también en tema oscuro.
- Pestañas activas marcadas solo por color.

**Panel de operadora (`/plataforma`)**

- Hoja de estilos aparte, solo tema claro, sin la marca ni el tema oscuro del
  producto; ocupa la pantalla con una tarjeta pequeña y mucho gris.

**Caja (POS)** — fuera del alcance visual de esta fase, pero anotado: los
nombres
de producto de las tarjetas también juntan palabras («BCAARecovery»).

### 2. Qué cambió

`apps/web/src/styles.css`

- **Tokens.** Mismos nombres de siempre (los lee
  `tests/accessibility-contract.test.ts`); el tema oscuro pasa a Obsidian
  Lumina: `--bg #05050A`, `--surface #0D0F18`, `--surface-soft #131726`,
  `--text #EEF0F8`, `--muted #A3ABC2`, `--focus` y `--positive-text` esmeralda
  `#43E3B1`, `--primary #A78BFA` (violeta legible como texto). Nuevos, en claro
  y oscuro: `--surface-raised`, `--shell-bg`, `--border-strong`,
  `--accent-violet` (`#8B5CF6`), `--accent-emerald` (`#43E3B1`), `--action`,
  `--action-hover`, `--on-action`, `--emerald-soft`, `--warning-soft`,
  `--danger-soft`, `--danger-border`, `--radius-sm/--radius/--radius-lg`.
- **Tema claro** se conserva (el interruptor ya existía; las pruebas e2e
  parten de él). El tema predeterminado sigue siendo claro: pasar a oscuro por
  defecto cambia lo que ve la cajera y queda como decisión de la dueña (fase 2).
- **Marco** (barra lateral y superior, también en la caja, sin cambiar su
  ancho ni su alto): letra mínima 11 px, menú 13 px, lugar actual con barra
  violeta + peso + `aria-current="page"` (App.tsx), conexión como píldora con
  icono distinto + texto + color; en celular el texto queda para el lector.
- **Componentes:** botones (primario `--action`, secundario con borde ≥ 3:1,
  fantasma legible, peligro `#B91C1C`), avisos `.notice` (success/warning/
  danger/info: borde + color + texto), `.form-error` con tokens en ambos temas,
  esqueleto `.skeleton` (sin animación con `prefers-reduced-motion`),
  diálogos sobre `--surface-raised`. La «Guía de estilos» (solo desarrollo)
  muestra la paleta nueva, los avisos y el esqueleto.
- **Contenido de administración** (todo bajo `.app-shell:not(.pos-shell)`):
  títulos sin palabras pegadas, letra de cuerpo 13 px, tablas 13 px con cifras
  tabulares y encabezado 11 px, etiquetas 11 px con punto en los estados,
  pestaña activa con subrayado violeta, tarjetas de radio 16 px, estado vacío
  sobrio. Resumen: la pancarta pasa a una franja sobria con una sola línea de
  luz violeta→esmeralda y sin ilustración.
- Los tamaños grandes de botones y KPI se aplican desde 781 px: en un celular
  de 320 px la barra y las tarjetas siguen cabiendo (prueba `fuentes.spec.ts`).

**La caja** conserva flujos, textos, teclas, selectores (`.product-card`,
`.cart-items`, `.connection`, `.main-content`) y su disposición: ninguna regla
de contenido nueva la alcanza. Con el tema oscuro toma los colores obsidiana;
el contraste queda cubierto por las mismas pruebas de tokens (texto 16.8:1,
atenuado 8.3:1, foco esmeralda 11.7:1 sobre superficie).

### 3. Capturas

`docs/diseno/obsidian-lumina/f1/` — `antes-*` y `despues-*`:
`dashboard-desktop-{dark,light}` (1366×768), `dashboard-mobile-{dark,light}` y
`menu-mobile-dark` (390×844), `products-desktop-dark`,
`settings-desktop-dark`, `pos-desktop-dark` (la caja, para comparar que no se
movió).

### 4. Pruebas

- Nueva: «Obsidian Lumina · contraste de los tokens nuevos» en
  `tests/accessibility-contract.test.ts` — base `#05050A`, acentos aprobados,
  texto ≥ 4.5:1 sobre las cinco superficies, controles e indicadores ≥ 3:1,
  acción primaria, avisos y botón de peligro, en claro y oscuro.
- typecheck, lint y build en verde; unitarias en verde salvo las que levantan
  su propio PostgreSQL embebido (no arrancan como root en este contenedor; no
  tocan la interfaz).
- E2E en verde: `accesibilidad`, `acerca-de`, `fuentes`, `pos-pantalla`,
  `plataforma-panel`, `u1-pos`, `store`, `contrasenas`
  (`product-onboarding` necesita el PostgreSQL embebido, igual que arriba).

### Referencia de marca: animación del prototipo (commit 75524e49)

El prototipo trae el prisma flotando y el rayo verde–violeta en bucle, en CSS
nativo y con `prefers-reduced-motion`. **Solo** para fondos de bienvenida o de
la entrada (login). Nunca en pantallas operativas: caja, tablero, tablas.

## Fase 2 · propuesta

1. **Resumen:** KPI arriba (primera pantalla en 1366×768), luego la gráfica;
   arreglar la torta descolgada y el globo fantasma en celular; quitar la
   franja de eslogan o convertirla en el estado del día.
2. **Títulos que dicen dónde estás:** el `h1` igual a la ruta (Productos,
   Configuración…) y la frase como subtítulo; quitar las etiquetas en
   mayúsculas («TU NEGOCIO, CON CLARIDAD») — tocar textos de Management.tsx y
   las pruebas que los citen.
3. **Menú agrupado** (Vender · Mercancía · Dinero · Clientes · Ajustes) con
   iconos distintos para Mercancía, Compras y Envíos.
4. **Catálogo, inventario, clientes, reportes y Configuración:** una acción
   primaria por cabecera (las demás en «Más»), texto suelto dentro de sus
   tarjetas, `Loading` con esqueleto en tablas.
5. **Entrada (login)** con el fondo animado del prototipo (con
   `prefers-reduced-motion`), sin tocar el flujo: PIN de caja y contraseña web
   siguen separados y validados en el servidor.
6. **Panel de operadora** (`/plataforma`) con los mismos tokens y tema oscuro.
7. **Decisión de la dueña:** ¿tema oscuro por defecto? (afecta la caja;
   requiere ajustar las e2e que hoy parten del claro).

## Fase 3 · Catálogo, Inventario, Clientes, Reportes y Configuración (Claude PC, 26-oct)

Rama `claude-pc/obsidian-lumina-f3`, sacada de `claude/obsidian-lumina-f1` (`2f998788`). Sin desplegar. Notas por pantalla: `OBSIDIAN_LUMINA_F3_CATALOGO.md`, `_INVENTARIO.md`, `_CLIENTES.md`, `_REPORTES.md`, `_CONFIG.md`; prueba de aceptación y capturas: `_PRUEBAS.md` y `_CAPTURAS.md`.

### Qué cambió
- **Contrato común (`admin-ui.tsx` y `admin-ui.css`).** `MoreMenu` («Más»: una sola acción principal por cabecera, las demás dentro del menú; Escape, clic fuera y salir con Tab lo cierran y el foco vuelve al botón) y `TableSkeleton`. `Heading` ganó `eyebrow`, `more` y `className`, todos opcionales: Caja, Promociones e Historial de ventas se ven exactamente igual.
- **Las cinco pantallas.** El título es la ruta (Productos, Inventario, Clientes, Reportes, Configuración), sin eslogan ni etiqueta en mayúsculas; la acción principal es una sola; el texto suelto quedó dentro de tarjetas; esqueletos de tabla al cargar; cifras tabulares; estados con color y texto; pestañas con subrayado y `aria-pressed`; áreas táctiles de 44 px en celular (40 px en escritorio) con reglas acotadas a cada pantalla; sin desplazamiento horizontal de la página a 390 px.
  - **Productos:** Nuevo producto es lo principal; Plantilla, Importar Excel e Importar inventario van en «Más».
  - **Inventario:** «Almacén» con su espacio y su etiqueta, celdas de precio, fecha y SKU sin saltos de línea, bajo y agotado con texto.
  - **Clientes:** tarjetas por fila en celular (la tabla ya no se corta); la privacidad no se tocó.
  - **Reportes:** Excel principal y PDF en «Más» (**cambio de comportamiento declarado:** ambos se desactivan con el rango de fechas invertido, antes estaban siempre activos); catálogo de reportes plegable en celular; la tabla se desplaza dentro de su propio contenedor.
  - **Configuración:** tarjetas con título y descripción, avisos de crédito como avisos con color y texto, pestañas de 44 px en cuadrícula 2×2 en celular, espacio sobre la barra inferior.
- **Diálogo compartido (`packages/ui`).** `Modal` tiene una opción nueva `restoreFocus`, **apagada por defecto**: sin ella el diálogo se comporta exactamente como antes. Solo «Importar inventario» (Productos) la usa. Esto protege a la caja de las cajeras; una primera versión devolvía el foco en los ~39 diálogos de la aplicación y se corrigió.

### Lo que NO se tocó
`POS.tsx`, `Tienda.tsx` (caja, cobro, cierre), GV, pagos, la parte fiscal (`FormalReports.tsx`, `NcfSequenceSettings`), seguridad y permisos, la API, la base de datos y las migraciones, `.github/` y Render. Ninguna consulta, clave de consulta ni comprobación de permisos cambió.

### Pruebas
- Nuevas: `tests/e2e/lumina-f3.spec.ts` (82 casos: título, desplazamiento, área táctil, una acción principal, «Más» con teclado, foco, contraste, cifras tabulares, movimiento reducido y la caja intacta, a 1366 y 390 px, en claro y oscuro), `lumina-f3-arreglos.spec.ts`, `lumina-f3-modal-foco.spec.ts` y `tests/modal-foco-caja.test.ts`.
- **El criterio 4b se acotó a propósito:** exige «Más» solo en las pantallas que tienen acciones secundarias (Productos y Reportes); en Inventario, Clientes y Configuración comprueba que no hay un «Más» vacío. Está explicado en la prueba y en `_PRUEBAS.md`.
- Resultados: ver «Resultado final» al pie de esta sección.

### Riesgos y pendientes
- **El contraste de varios textos se calculó o estimó**, no se midió con una herramienta como `axe` (no está instalada); la prueba usa una función propia que ignora degradados e imágenes.
- **Importar Excel** vive en «Más» (un campo de archivo dentro de un menú que se cierra); ninguna prueba cubre la importación completa desde ahí.
- Los botones de icono de Kardex se agrandaron a 44 px en celular; falta revisarlos dentro del modal de Kardex.
- Los estados fiscales aparecen en texto crudo en Reportes (`not_issued`): no hay un mapa de etiquetas en el código y no se inventó uno.
- La suite `product-reportes-arreglos-postgres` falla en esta PC en la corrida completa por un bloqueo de archivos de Windows al borrar su carpeta temporal (`EBUSY`); pasa sola (8 de 8). El CI de GitHub (Linux) es la comprobación válida.
- El aspecto nuevo va para la tienda y el producto, pero esta fase parte del producto: pasarlo a `nexora-cloud` es una fase aparte, con pruebas, sin desplegar en horas de caja y avisando antes.

### Resultado final (verificado en esta PC, base de datos temporal propia, sin tocar la tienda)
- **Prueba de aceptación visual:** `lumina-f3.spec.ts`, `lumina-f3-arreglos.spec.ts` y `lumina-f3-modal-foco.spec.ts`: **91 pasan, 0 fallan, 0 inestables** (la prueba original daba 54 pasan y 28 fallan sobre la base antes del rediseño).
- **Regresión de la caja de las cajeras:** `pos-pantalla`, `u1-pos`, `caja-borrador`, `caja-detalles`, `caja-web`, `cuatro-cajas`, `fuentes`, `accesibilidad` e `importar-inventario`: **61 de 61**. Y, antes, 51 de 51 en `pos-pantalla`, `u1-pos` y los `caja-*` al aislar el cambio del diálogo compartido.
- `pnpm check` completo: **966 pruebas pasan, 11 se omiten**; falla una suite (`product-reportes-arreglos-postgres`) por un bloqueo de archivos de Windows al borrar su carpeta temporal (`EBUSY`) debido a procesos de PostgreSQL embebido que quedaban abiertos de corridas anteriores; sola pasa (8 de 8). La verificación válida es el CI de GitHub.
- **Capturas** en `docs/diseno/obsidian-lumina/f3/`: `antes-*` y `despues-*` de las cinco pantallas a 1366×768 y 390×844 (dos temas en Productos y Configuración, `-claro`), y el menú «Más» abierto a 390 px (`despues-menu-mas-mobile.png` y `despues-menu-mas-mobile-reportes.png`), sin recortes.

### Defectos menores que quedan (de las capturas finales)
1. Configuración en celular: las cuatro pestañas en 2×2 con alineación desigual.
2. Reportes en escritorio: la tabla de detalle se desplaza dentro de su contenedor y la columna del NCF queda parcialmente fuera hasta desplazar.
3. En celular la barra fija «Mercancía» cubre unos 70 px del final; en Configuración ya hay espacio inferior, en las demás pantallas falta comprobarlo.

### Verificación del CI de GitHub (26-oct, Claude PC)
El trabajo `verify` del CI falló en `54864cda` (paso `node scripts/verify.mjs`, integración y e2e) y la base `2f998788` lo pasa. No se pudo leer el registro (pide autenticación). Se reprodujo en esta PC, con bases temporales propias, en tres partes:
- **e2e `store.spec.ts`:** 44 de 44.
- **Otras 22 e2e** (incluidas `product-onboarding`, `plataforma-*`, `credito`, `contrasenas`, `incentivos`, `almacenes`): 50 pasan y 1 falla una vez, `privacidad-sesion` G9 «el cierre por inactividad también borra clientes y catálogo del navegador», con el reloj simulado y la máquina cargada; pasa 3 de 3 al repetirla sola. Esa misma prueba también falló una vez, con la misma carga, en la corrida larga de otra pantalla. **Probable prueba inestable bajo carga, sin descartar un fallo intermitente real del cierre por inactividad** (ese código no cambió con el rediseño).
- **Integración (31 archivos):** sin regresión. Fallos de esta PC que también salen en la base: `drive-backup` (no hay `pg_dump`) y `alertas-postgres` (se agota el tiempo de preparación). `api.test.ts` da 182 de 182 en una base limpia (una vez falló «evalúa vencimiento, rotación y presupuesto», `tests/api.test.ts:1064`, que depende de datos y de la hora).
- `apps/api` es idéntico a la base; solo cambiaron `apps/web`, `packages/ui/src/index.tsx` (la opción `restoreFocus`, apagada por defecto), las pruebas e2e y los documentos.
- Diferencias con el CI que esta reproducción no cubre: PostgreSQL 17 en el puerto 5434 contra PostgreSQL 18 embebido, Linux contra Windows, y el orden (el CI corre primero la integración y después las e2e sobre la misma base). Si el CI vuelve a fallar, buscar en su registro «evalúa vencimiento» y «cierre por inactividad».
## Fase 2 · tablero ejecutivo «Hoy», resumen con IA y accesibilidad del marco

Rama `claude/obsidian-lumina-f2`, sobre `claude/obsidian-lumina-f1` (A). Sigue
el plan de `docs/diseno/OL_COMPARACION_26OCT.md` y las decisiones de la dueña
del 26-oct. Sin cambios de API, base de datos, pagos, permisos ni acceso.

### 1. Qué se trajo y de dónde

**De B (`chatgpt-nube/obsidian-lumina-fase1`), solo accesibilidad y primitivas,
sobre los tokens de A** (no se importó `adminAppearance.css`, ni
`useAdminAppearance`, ni `AdminDesignSystem`, ni el alto contraste):

- `packages/ui`: `Card` (región con título enlazado), `Field` (etiqueta, ayuda y
  error enlazados con `aria-describedby`/`aria-invalid`), `TableFrame` (región
  con nombre y alcanzable con el teclado) y `Modal` que devuelve el foco a quien
  lo abrió. `Alert` no se trajo: es `.notice` de A. `TableFrame` ya se usa en la
  tabla «Productos destacados» del Resumen; `Card` y `Field` quedan listas para
  la fase 3.
- Marco (`App.tsx`): enlace «Saltar al contenido», `nav` con nombre,
  `aria-controls` del botón del menú, `main` enfocable (`id="main-content"`).
  Estilos nuevos al final de `styles.css` con los tokens de A. La caja conserva
  `.main-content`, `.product-card`, `.cart-items`, `.connection`, F2/F4/F8/F12.

**De C (`chatgpt-nube/obsidian-lumina-fase2`, PR #9):** `ExecutiveDashboard.tsx`,
`dashboardQuestions.ts`, `Dashboard.tsx`, `Assistant.tsx`, `YearPie.tsx` y
`tests/obsidian-dashboard.mjs` (Playwright manual, ver riesgos).
`ExecutiveDashboard.css` se reescribió sobre los tokens de A (`--border-strong`,
`--accent-violet`, `--radius-sm`…), sin el prefijo `[data-admin-appearance]`.

**Condición propia del tablero ejecutivo** (`App.tsx`, `executiveDashboard`):
producto (`PRODUCT_TENANCY_REQUIRED`) **y** rol admin o gerente **y** permiso
`reports:read`. No depende de ningún hook de apariencia. La cajera, la vendedora
y la tienda heredada ven el Resumen de siempre, abierto en «Mes».

### 2. Decisiones de la dueña aplicadas

- Abre en **«Hoy»**; «Mes» sigue en el selector.
- La administración conserva el selector **claro/oscuro** (un solo sistema de
  tema, `data-theme`). La caja y las cajeras arrancan en **claro** (el valor
  inicial ya era claro; no se cambió).
- **Ganancia = (precio − costo)/precio, sin restar ITBIS.** El API devuelve
  `grossProfit` = venta neta de ITBIS − costo. En el cliente la ganancia bruta se
  calcula `revenue − costTotal` (`profitOf`, `ExecutiveDashboard.tsx`) en la
  tarjeta del Resumen (también el modo no ejecutivo), en el texto «Tu día, en
  claro» y la pregunta de la tarjeta a Nexora ya no dice «ITBIS neto». El
  margen y el círculo anual ya usaban ventas − costo.
- **Resumen con IA:** solo se pide al pulsar el botón (un único `generate()`,
  verificado en prueba). El texto dice que esa consulta cuenta en la cuota, que
  **abrir una tarjeta con «Pregúntale a Nexora» no gasta cuota y que enviar la
  pregunta sí**; el mismo aviso aparece en el asistente al llegar desde una
  tarjeta. El servidor ya filtra costos y márgenes para vendedoras y aplica la
  cuota y el límite por minuto.

### 3. Arreglos de la mezcla 4 conservados

- Porcentaje nulo: `typeof m.trend === "number"` y «sin datos del período
  anterior». También `lastDaysStart(7)` y `SetupChecklist`.
- Markdown del asistente (`renderMarkdown`), y ahora también en la lectura con
  IA del tablero.
- Evento `nexora:abrir-asistente`: **no existe en A** (llegó con
  `claude/producto-mezcla-4`, commits `0c946f6d` y siguientes, aún no en f1).
  Se añadió el mismo `useEffect` de 7 líneas en `Assistant.tsx`, idéntico al de
  mezcla 4 para que la mezcla no choque; quien lo emite (`QuickQuestions`) llega
  con esa rama.

### 4. Otros cambios

- `Assistant.css`: el botón flotante «Pregúntale a Nexora» quedaba sin fondo
  (blanco sobre blanco) porque `button:not(.button)` de `styles.css` tiene la
  misma especificidad; se refuerza el selector. Error previo, visible en A.
- Texto «Interpretación de IA · hora · Contrasta…» sin doble punto.

### 5. Conflictos

`Dashboard.tsx` y `Assistant.tsx` chocaron con A como en la fusión de prueba
(C reformateó los archivos). Se tomó C completo y se repusieron a mano los
arreglos de la sección 3. `App.tsx` no chocó (se aplicó a mano). No hay otros.

### 6. Pendiente para Claude (cambio de API, no hecho aquí)

- `GET /dashboard/summary` (`apps/api/src/reports.ts`, ~línea 545):
  `grossProfit = netSales − costTotal` resta el ITBIS. Debe ser
  `revenue − costTotal`. El reporte exportado (línea ~914) usa
  `summary.grossProfit` y mostraría la fórmula vieja.
- `netProfit` (`netProfit(net, cost, expense, fees)`) también parte de la venta
  neta de ITBIS; la franja financiera del Resumen lo muestra tal cual. Decidir
  si «Ganancia neta» también pasa a ventas − costo − gastos − comisiones.
- Cuando el API cambie, `profitOf` pasa a leer `grossProfit` y se borra la
  conversión del cliente.

### 7. Capturas (`docs/diseno/obsidian-lumina/f2/`)

`antes-*` (rama A) y `despues-*` (esta rama), 1366×768 y 390×844, claro y
oscuro: `dashboard-{desktop,mobile}`, `resumen-ia-…`, `pregunta-tarjeta-…`.
Las cifras son **datos de ejemplo simulados** en el navegador (la empresa de
prueba no tiene ventas); no son datos reales.

### 8. Pruebas

- Nueva: `tests/obsidian-lumina-f2.test.ts` (16 pruebas: primitivas, marco,
  condición del tablero, «Hoy», arreglos de mezcla 4, solo tokens de A, fórmula
  de ganancia, IA solo con botón). `accessibility-contract.test.ts` sin cambios
  y en verde.
- `pnpm typecheck`, `pnpm lint`, build web y api en verde (Node 22; el proyecto
  pide 24).
- E2E contra PostgreSQL 16 local: ver la entrega.

### 9. Riesgos abiertos

- `tests/obsidian-dashboard.mjs` es Playwright manual y no corre en CI. Se
  adaptó (sin el botón de alto contraste de B; salida con `LUMINA_OUT`) y pasa
  contra el producto en desarrollo (`LUMINA_TEST_URL=http://127.0.0.1:5180`,
  `VITE_PRODUCT_TENANCY=required`). El tablero ejecutivo solo existe en el
  producto, así que las e2e de la tienda no lo ejercitan.
- La ganancia del cliente y la del servidor difieren hasta que Claude cambie el
  API (sección 6); la exportación seguirá con la fórmula vieja.
- El panel del asistente mantiene sus colores propios (azul oscuro) en claro y
  oscuro; no se rediseñó.
- La alerta del tablero solo ofrece «Revisar alertas» con `alerts:write`
  (comportamiento de C).

> Nota (26-oct): tras fusionar `producto-nexora` (8ae06d8d), el Modal devuelve el foco en todos los diálogos por decisión de producto; se retiró la opción `restoreFocus` y sus dos pruebas (`lumina-f3-modal-foco`, `modal-foco-caja`).
