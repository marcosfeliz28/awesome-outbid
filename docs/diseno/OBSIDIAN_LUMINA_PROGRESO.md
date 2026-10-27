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
# Integración Lumina Motion — ChatGPT PC, 27-oct-2026

Base `producto-nexora` c6148bac; portada Motion adaptada desde
`chatgpt-nube/lumina-motion` c2cb6e0d. El producto muestra N y los grupos
Vende, Controla y Decide; en modo tienda se conservan sus textos y categorías.
La bóveda V2 conserva sus pestañas, formulario y lógica de acceso. La N y los
grupos también aparecen en 390 px; el video no se reproduce en la entrada.

Validación: 31 pruebas focales aprobadas, ESLint y build web; la suite completa
de `pnpm check` ejecutó 1001 pruebas aprobadas y 11 omitidas (respaldo incluido);
capturas nuevas
en `obsidian-lumina/motion/capturas-pc/` para 1440 y 390 px, normales y con
movimiento reducido, con datos simulados. El script de captura verifica los
tres grupos, que no exista video y que no haya desbordamiento horizontal.
La inspección visual de la N no mostró recorte. Falta auditoría independiente
de contraste y foco y verificar los tres trabajos de CI del commit final. Las
capturas no prueban inicio de sesión contra una API real. No se desplegó.

## Adentro · lote B (ChatGPT nube, 26-oct-2026)

Rama `chatgpt-nube/lumina-adentro-b`, creada desde
`origin/claude/producto-mezcla-4` en `8ae06d8d`. Alcance asignado: Catálogo,
Inventario, Clientes, Reportes, Configuración, Mercancía/Equipos y Asistente.
No incluye caja/POS, tablero «Hoy» ni marco de administración, que pertenecen a
`chatgpt-pc/lumina-adentro-a`.

### Preparación e inventario

- Catálogo, Inventario, Clientes, Reportes y Configuración comparten
  `Heading`, `Filter` y `DataTable` en `Management.tsx`, además de `Button`,
  `Badge`, `Card`, `Field`, `TableFrame`, `Modal`, `Empty` y `Loading` de
  `@fitstore/ui`. El lote B reutilizará las primitivas y extensiones publicadas
  por ChatGPT PC; no añadirá un segundo sistema de componentes.
- Mercancía conserva su selector Entrada/Salida, revisión previa, operación sin
  conexión, escáner, lotes y barra móvil. Equipos conserva sus estados con
  texto y color, aprobación, revocación y equipo actual.
- El Asistente conserva diálogo, foco, cuota, apertura desde tarjetas,
  confirmación de anulaciones, Markdown seguro y límites. Su cambio visual se
  limita a sustituir colores directos por el tema compartido.
- No se cambiarán APIs, permisos, cálculos, pagos, NCF/DGII, base de datos,
  migraciones, Render ni despliegue.

### Contratos visuales y móviles identificados

- Una acción principal por vista; filtros y exportaciones quedan como acciones
  secundarias.
- Tablas numéricas con cifras tabulares, estados con texto además de color,
  foco visible y regiones desplazables alcanzables por teclado.
- A 390×844, Catálogo, Inventario y Clientes reutilizan el patrón de tarjetas
  de `DataTable`; las tablas financieras de Reportes conservan columnas y
  desplazamiento horizontal accesible.
- Configuración, Mercancía, Equipos y Asistente no tendrán láser, halo ni
  movimiento ambiental. `prefers-reduced-motion` continúa desactivando el
  movimiento no esencial.

### Base verificada antes de cambios visuales

Con Node 24, pnpm 11 y Prisma generado para este checkout:

- `pnpm typecheck`: aprobado.
- `pnpm lint`: aprobado.
- `pnpm build`: aprobado; Vite solo informa el aviso previo de tamaño de chunk.
- `pnpm test`: 152 archivos aprobados y 1 omitido; 998 pruebas aprobadas y 10
  omitidas. La evaluación local del asistente respondió 79/79 casos.

### Integración con el lote A

`origin/chatgpt-pc/lumina-adentro-a` quedó incorporada mediante el commit de
mezcla `43e75b9e`. El lote B conserva su selector claro/oscuro, su marco y las
primitivas existentes de `@fitstore/ui`; no introduce componentes paralelos.

### Implementación terminada

- **Catálogo:** título funcional, una acción principal, conteo y filtros en un
  panel único, y tarjetas legibles a 390 px.
- **Inventario:** filtros y Kardex ordenados, estado de existencias expresado
  con texto y color, y depósitos dentro de `TableFrame` desplazables.
- **Clientes:** directorio, conteo y búsqueda en una jerarquía única; en móvil
  cada cliente pasa a tarjeta sin ocultar compras, gasto ni última compra.
- **Reportes:** navegación lateral con nombre y estado actual, espacio de
  trabajo flexible, filtros y exportaciones secundarios, y tablas financieras
  desplazables en móvil.
- **Configuración y Equipos:** pestañas, resumen del negocio y estados de los
  equipos alineados con Lumina; «Editar configuración» es la única acción
  principal del resumen. Se conserva sin cambios el comportamiento conocido de
  «Guardar».
- **Mercancía:** entrada/salida, proveedor, escáner, revisión e historial usan
  las superficies compartidas; el modo activo conserva texto visible en tema
  oscuro y «Confirmar» mantiene la prioridad.
- **Asistente:** panel, mensajes, tablas, propuestas y formulario usan tokens
  compartidos. El lanzador y «Enviar pregunta» usan el acento esmeralda; se
  mantienen foco, cuota, preguntas desde tarjetas y Markdown seguro.

No se modificaron reglas fiscales o financieras, permisos, autenticación,
pagos, APIs, base de datos, migraciones ni flujos de negocio. Tampoco hubo
despliegue ni acceso a Render.

### Capturas comparativas

`docs/diseno/obsidian-lumina/adentro/` contiene 28 PNG: `antes-*` y
`despues-*` de Catálogo, Inventario, Clientes, Reportes, Configuración,
Mercancía y Asistente, en 1366×768 y 390×844. Se generaron contra servidores
locales con una empresa y datos simulados; no se usó el producto en vivo.

La prueba visual `tests/e2e/lumina-adentro-b.spec.ts` valida ambas anchuras, el
tema oscuro y que el documento no produzca desbordamiento horizontal. Las
tablas que requieren varias columnas conservan su desplazamiento interno.

### Revisión de Reportes, Configuración y Equipos (27-oct-2026)

- **Reportes:** auditado en 1366×768 y 390×844. Conserva una sola selección
  actual, grupos desplegables con `aria-expanded`, exportaciones secundarias,
  cifras tabulares, tabla desplazable y estados de carga, error, vacío,
  paginación y rango invertido. No necesitó cambios visuales. Las capturas
  `auditoria-reportes-rango-invalido-*` dejan evidencia del subestado que
  detiene la consulta y explica cómo corregir las fechas. La revisión
  adversarial posterior cerró una inconsistencia de ese subestado: con un
  rango invertido, Excel y PDF también quedan deshabilitados y el contador se
  reemplaza por «Corrige las fechas», en vez de presentar cero registros como
  si fuera un resultado válido.
- **Configuración:** la estructura visual, el resumen y los subestados de
  negocio, usuarios, bitácora y equipos ya cumplían la orden. Se añadió al
  grupo de secciones un nombre accesible y cada botón ahora expone su estado
  con `aria-pressed`, sin cambiar flujos ni permisos.
- **Equipos:** se verificaron los estados Pendiente, Aprobado y Revocado con
  texto y color, además del equipo actual y sus acciones existentes. La lista
  ahora usa `Loading` y `Empty` compartidos mientras carga o cuando una empresa
  todavía no registra equipos. Las capturas `auditoria-equipos-estados-*` y
  `auditoria-equipos-vacio-*` cubren ambos temas de contenido a 1366 y 390 px.

La prueba focal `tests/e2e/lumina-reportes-config.spec.ts` cubre estas tres
áreas con datos locales simulados: 2/2 escenarios aprobados. También pasaron
el typecheck y build web, ESLint, las 36 pruebas del contrato de accesibilidad
y las 12 pruebas de marca del producto. No se consultó el producto en vivo ni
se cambiaron API, base de datos, pagos, reglas fiscales o permisos.

### Verificación final

- `pnpm typecheck`, `pnpm lint` y `pnpm build`: aprobados. Vite conserva el
  aviso informativo previo por un chunk mayor de 500 kB.
- Suite completa: 152 archivos y 998 pruebas aprobadas; 1 archivo y 10 pruebas
  omitidas por su configuración explícita.
- Pruebas focales de accesibilidad, Asistente y contratos Lumina: 84/84
  aprobadas; pruebas focales de las siete áreas: 128/128 aprobadas.
- Inventario a 390 px: 5/5 escenarios e2e aprobados.
- Capturas y contrato visual del lote B: 2/2 escenarios e2e aprobados, tanto
  sobre la base anterior como sobre el resultado.
- La e2e general `accesibilidad.spec.ts` requiere API local en el puerto 3001;
  al ejecutar solo la previsualización web su preparación termina con
  `ECONNREFUSED`. El contrato estático de accesibilidad sí quedó aprobado
  (36/36) y la revisión visual confirma foco visible, contraste y navegación
  móvil en el alcance de este lote.
# Tokens visuales · 27-oct-2026

La rama `chatgpt-pc/visual-tokens-27oct` integra las bases de #16, #11, #13 y
#14 en una copia aislada y consolida las variables raíz de cada tema, conservando
los valores efectivos anteriores. La prueba nueva falló antes: esperaba un
`:root` y encontró tres; después pasó. Las 55 pruebas focales de tokens,
accesibilidad y Lumina y ESLint pasaron; el build web también. La integración
base tiene `verify` rojo por desbordes a 320 px: esta entrega no certifica que
esos fallos estén corregidos. Capturas y CI del último SHA pendientes.
# Marco Lumina · movimiento, 27-oct-2026

En `chatgpt-pc/visual-marco-27oct` se ajusta la línea decorativa de la cabecera
para que se anime una sola vez por carga y siga apagada con movimiento reducido.
La prueba falló antes porque la animación era infinita y pasó después; pasan 56
pruebas focales y ESLint. Este cambio no constituye el rediseño completo del
marco: capturas, navegación accesible y CI aún pendientes de revisión.
