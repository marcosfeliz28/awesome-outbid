# Auditoría Visual, Dirección de Movimiento, Sistema de Diseño y Cotización de Ingeniería — Nexora POS («Obsidian Lumina»)

**Preparado por:** Gemini (Auditoría Principal de Producto, UI/UX y Arquitectura Frontend)  
**Para:** Propietaria de Nexora POS, Equipo de Asistentes de Diseño (ChatGPT PC con Canva/Runway y ChatGPT Nube) y Equipo de Ingeniería / Claude  
**Estética Base Aprobada:** *Obsidian Lumina* (Obsidiana profunda, Violeta Imperial, Esmeralda Operativo y «N» Prismática)  
**Restricción Técnica Crítica:** Aplicación PWA con límite duro de **2,00 MiB por archivo JS** (actualmente el bundle principal pesa **2,11 MiB** y debe reducirse mediante partición de código y carga diferida).

---

## Resumen Ejecutivo: ¿Por qué el rediseño actual todavía se siente «robótico» y «barato»?

Al inspeccionar las **27 capturas** del paquete (`EN-VIVO-*`, `antes-*` y `despues-*`), el diagnóstico es contundente: **Claude aplicó un «maquillaje de plantilla» superficial sin resolver la arquitectura visual ni la cohesión del producto**. 

Los 5 pecados capitales que hacen que la interfaz actual se perciba amateur o «pobretona» en lugar de un software empresarial exclusivo son:

1. **Esquizofrenia de identidad visual (dos productos distintos pegados a la fuerza):**
   - La portada (`EN-VIVO-portada-1440x900-normal.png`) presume el nuevo isotipo **«N» metálico-prismático**, pero al iniciar sesión en cualquiera de las pantallas internas (`despues-catalogo-desktop.png`, `despues-dashboard-desktop-dark.png`, `despues-pos-desktop-dark.png`), el encabezado superior izquierdo sigue mostrando el **logo viejo e infantil** (un cuadrado morado plano con una `n` minúscula y un punto rosado).
   - Además, coexisten dos estilos internos incompatibles: las pantallas del grupo *Valeria Rivera* (`despues-dashboard-*`, `despues-pos-*`, `despues-products-*`, `despues-settings-*`) usan botones violetas (`#7C3AED`) y fondos negros lisos, mientras que las pantallas del grupo *Administración visual* (`despues-catalogo-*`, `despues-inventario-*`, `despues-clientes-*`, `despues-reportes-*`, `despues-configuracion-*`, `despues-mercancia-*`) cambian repentinamente los botones primarios a un **verde menta chillón (`#1ED794`)**, agregan una cuadrícula blanca tosca de fondo y ponen un borde superior de 2 px que parece sacado de una plantilla gratuita de panel administrativo.
2. **Colisiones graves de interfaz en móvil (390 px) que bloquean botones operativos:**
   - En las 6 vistas móviles nuevas (`despues-catalogo-movil.png`, `despues-inventario-movil.png`, `despues-clientes-movil.png`, `despues-reportes-movil.png`, `despues-configuracion-movil.png`, `despues-mercancia-movil.png`), se apilaron dos elementos flotantes gigantes en la parte inferior: una barra morada fija de ancho completo (`Mercancía`) y el botón flotante verde (`Pregúntale a Nexora`).
   - Esto provoca que el botón **`Pregúntale a Nexora` tape físicamente los botones `Editar` y `Anonimizar`** en `despues-clientes-movil.png`, tape los datos de lote y vencimiento en `despues-inventario-movil.png`, tape el encabezado de tabla y el botón `Excel` en `despues-reportes-movil.png`, y tape el botón `Subir logo` en `despues-configuracion-movil.png`.
3. **Portada con contenido duplicado, «N» encerrada en una caja negra y cero movimiento real:**
   - En `EN-VIVO-portada-1440x900-normal.png`, debajo de *«Todo bajo control»*, aparecen tres tarjetas horizontales (*Vende / Controla / Decide*) e, inmediatamente debajo, al lado de la «N», **se repiten exactamente las mismas tres tarjetas con el mismo texto en vertical**. Esa redundancia delata generación automática sin dirección de arte.
   - La «N» prismática no flota sobre el fondo: está **encerrada dentro de un recuadro JPEG negro con bordes grises redondeados** que corta el haz de luz láser en seco.
   - Además, `EN-VIVO-portada-1440x900-normal.png` y `EN-VIVO-portada-1440x900-reduced-motion.png` son **idénticas píxel por píxel**: no hay refracción viva, ni pulso lumínico, ni diferencia visual entre ambos estados.
4. **Controles HTML crudos sin estilizar y descuidos tipográficos:**
   - En `despues-inventario-desktop.png` y `despues-inventario-movil.png`, el selector de archivo muestra el control nativo del navegador en inglés: **`Choose File No file chosen`**.
   - En `EN-VIVO-portada-390x844-normal.png`, aparece una **barra de desplazamiento blanca gigante de Windows/Chrome** a la derecha que destruye el fondo obsidiana, y los enlaces `Mostrar contraseña` y `¿Olvidaste tu contraseña?` tienen el subrayado `<u>` por defecto de HTML de los años 90.
   - En `despues-reportes-desktop.png`, la columna `TOTAL` muestra `18,400` sin el prefijo `RD$` ni decimales `.00`.
5. **Gráficos cortados e ilustraciones genéricas de catálogo:**
   - En `despues-dashboard-desktop-dark.png` y `light.png`, el gráfico circular de *«Ventas del año por mes»* está **cortado por la mitad en el borde inferior de la tarjeta** y usa colores arcoíris (rojo, naranja, verde oliva) ajenos a *Obsidian Lumina*.
   - En `despues-pos-desktop-dark.png` y `despues-products-desktop-dark.png`, los productos usan 4 dibujos vectoriales planos sobre **cuadrados blancos puros (`#FFFFFF`)** que encandilan en modo oscuro.

---

## 1. Veredicto por Pantalla (Evaluación de las 27 Capturas)

### Tabla Resumen de Calificaciones (Escala 1 a 10)

| Captura(s) Evaluada(s) | Jerarquía Visual | Calidad «Premium» | Coherencia | Densidad de Detalle | Accesibilidad | Claridad para Caja | Promedio |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Portada Escritorio** (`EN-VIVO-portada-1440x900-normal.png` y `reduced-motion.png`) | 6,0 | 5,5 | 6,5 | 5,0 | 7,5 | 7,0 | **6,3** |
| **2. Portada Móvil** (`EN-VIVO-portada-390x844-normal.png` y `reduced-motion.png`) | 6,5 | 5,0 | 6,0 | 5,0 | 6,5 | 7,5 | **6,1** |
| **3. Punto de Venta (Antes vs. Después)** (`antes-pos-desktop-dark.png` y `despues-pos-desktop-dark.png`) | 7,0 | 5,0 | 5,5 | 6,0 | 7,0 | 8,0 | **6,4** |
| **4. Tablero «Hoy» Oscuro Escritorio** (`despues-dashboard-desktop-dark.png`) | 6,0 | 4,5 | 5,5 | 4,5 | 7,0 | 7,0 | **5,8** |
| **5. Tablero «Hoy» Claro Escritorio** (`despues-dashboard-desktop-light.png`) | 6,5 | 5,0 | 6,0 | 4,5 | 8,0 | 8,0 | **6,3** |
| **6. Tablero «Hoy» Móvil (Oscuro y Claro)** (`despues-dashboard-mobile-dark.png` y `light.png`) | 5,5 | 4,5 | 5,0 | 4,5 | 6,0 | 6,5 | **5,3** |
| **7. Menú Lateral Móvil** (`despues-menu-mobile-dark.png`) | 7,0 | 5,5 | 5,5 | 5,0 | 7,5 | 7,5 | **6,3** |
| **8. Catálogo v1 (60 prod.)** (`despues-products-desktop-dark.png`) | 7,0 | 5,5 | 6,0 | 6,5 | 7,5 | 7,5 | **6,7** |
| **9. Catálogo v2 Escritorio** (`despues-catalogo-desktop.png`) | 6,5 | 5,0 | 4,5 | 5,0 | 7,0 | 7,0 | **5,8** |
| **10. Catálogo v2 Móvil** (`despues-catalogo-movil.png`) | 5,0 | 4,0 | 4,5 | 4,5 | 4,5 | 5,5 | **4,7** |
| **11. Inventario Escritorio** (`despues-inventario-desktop.png`) | 5,5 | 4,0 | 4,5 | 5,5 | 6,0 | 6,0 | **5,3** |
| **12. Inventario Móvil** (`despues-inventario-movil.png`) | 4,5 | 3,5 | 4,0 | 5,0 | 4,0 | 5,0 | **4,3** |
| **13. Clientes Escritorio** (`despues-clientes-desktop.png`) | 6,5 | 5,0 | 4,5 | 5,0 | 7,0 | 7,0 | **5,8** |
| **14. Clientes Móvil** (`despues-clientes-movil.png`) | 4,5 | 4,0 | 4,5 | 4,5 | 3,5 | 4,5 | **4,3** |
| **15. Reportes Escritorio** (`despues-reportes-desktop.png`) | 6,5 | 5,0 | 5,0 | 5,0 | 7,0 | 6,5 | **5,8** |
| **16. Reportes Móvil** (`despues-reportes-movil.png`) | 4,0 | 3,5 | 4,5 | 4,5 | 3,5 | 4,5 | **4,1** |
| **17. Configuración v1 (`settings`)** (`despues-settings-desktop-dark.png`) | 7,0 | 5,5 | 6,0 | 6,0 | 7,5 | 7,0 | **6,5** |
| **18. Configuración v2 Escritorio** (`despues-configuracion-desktop.png`) | 6,0 | 5,0 | 4,5 | 5,0 | 7,0 | 6,5 | **5,7** |
| **19. Configuración v2 Móvil** (`despues-configuracion-movil.png`) | 5,0 | 4,0 | 4,5 | 4,5 | 4,5 | 5,5 | **4,7** |
| **20. Mercancía Escritorio** (`despues-mercancia-desktop.png`) | 6,5 | 5,0 | 5,0 | 5,5 | 7,0 | 7,0 | **6,0** |
| **21. Mercancía Móvil** (`despues-mercancia-movil.png`) | 5,0 | 4,0 | 4,5 | 5,0 | 4,5 | 5,5 | **4,8** |
| **22. Asistente IA Escritorio** (`despues-asistente-desktop.png`) | 5,0 | 3,5 | 4,0 | 4,0 | 5,5 | 6,0 | **4,7** |
| **23. Asistente IA Móvil** (`despues-asistente-movil.png`) | 4,5 | 3,5 | 4,0 | 4,0 | 5,0 | 5,5 | **4,4** |

---

### Diagnóstico Detallado Pantalla por Pantalla: ¿Qué se ve «robótico» y por qué?

#### 1. Portada en Vivo — Escritorio (`EN-VIVO-portada-1440x900-normal.png` y `EN-VIVO-portada-1440x900-reduced-motion.png`)
* **Qué se ve robótico:**
  1. **Duplicación absurda de bloques de texto:** En la columna izquierda hay 3 tarjetas (`VENDE / Caja ágil / Cobros y turnos`, `CONTROLA / Inventario claro / Entradas y existencias`, `DECIDE / Datos útiles / Reportes y alertas`). Justo 24 píxeles más abajo, dentro del contenedor de la «N», vuelven a aparecer **3 tarjetas con el mismo texto exacto** (`Vende / Caja y cobros`, `Controla / Inventario y turnos`, `Decide / Reportes y alertas`). Ningún diseñador humano repite el mismo argumento de venta dos veces en la misma esquina.
  2. **La «N» prismática está enjaulada:** En lugar de integrarse al lienzo obsidiana con transparencia alfa, la imagen de la «N» es un archivo cuadrado con fondo negro sólido encerrado dentro de un borde gris (`1px solid rgba(255,255,255,0.08)`), que a su vez está metido dentro de otra caja con borde gris. El rayo láser turquesa/violeta choca contra el marco cuadrado como una foto pegada en Word.
  3. **Logo superior diminuto y desconectado:** En la barra superior izquierda, la misma foto cuadrada de la «N» se encogió a ~36×36 px junto a la palabra `NEXORA` en tipografía plana sin tracking (espaciado entre letras) refinado y una pastilla `POS` verde opaca.
  4. **Cero diferencia entre `normal` y `reduced-motion`:** Ambas capturas son idénticas. La cuadrícula de fondo (`background-size: 40px 40px`) es uniforme en toda la pantalla en lugar de desvanecerse radialmente (`mask-image: radial-gradient(...)`).
  5. **Enlaces con subrayado nativo de navegador:** `Mostrar contraseña` y `¿Olvidaste tu contraseña?` usan `text-decoration: underline` simple sin `text-underline-offset` ni transición de color.

#### 2. Portada en Vivo — Móvil (`EN-VIVO-portada-390x844-normal.png` y `EN-VIVO-portada-390x844-reduced-motion.png`)
* **Qué se ve robótico:**
  1. **Barra de scroll blanca intrusiva:** En el borde derecho de los 390 px aparece una barra de desplazamiento blanca/gris nativa de ~14 px de ancho que rompe por completo el acabado de aplicación nativa (PWA).
  2. **Pérdida de atmósfera:** Al empujar el titular *«Todo bajo control»* hacia abajo del pliegue sin ninguna luz ambiental detrás de la tarjeta de login, la pantalla parece un formulario genérico de Bootstrap en modo oscuro.

#### 3. Punto de Venta — Antes vs. Después (`antes-pos-desktop-dark.png` y `despues-pos-desktop-dark.png`)
* **Qué se ve robótico:**
  1. **Cambio cosmético mínimo:** Comparando `antes-pos-desktop-dark.png` con `despues-pos-desktop-dark.png`, el rediseño apenas puso un borde verde alrededor de `En línea` en la barra superior y oscureció el fondo de `#0D1017` a `#07080C`.
  2. **Cuadrados blancos deslumbrantes en las tarjetas de producto:** Las miniaturas de *BCAA Recovery*, *Bandas Resistance*, *Base Skin Glow* y *Biker Short* tienen un fondo blanco puro `#FFFFFF` de ~160×130 px dentro de tarjetas oscuras. Eso genera fatiga visual severa y rompe la estética premium.
  3. **Botón `+` mal posicionado:** El botón circular negro `+` flota sobre la esquina inferior derecha del recuadro blanco del producto con un borde blanco tosco, pareciendo un parche superpuesto.
  4. **Botón `Cobrar (F12)` apagado y sin jerarquía:** En la esquina inferior derecha, el botón más importante de toda la aplicación (`Cobrar`) tiene un verde pantano apagado (`#114232`) con texto verde oscuro de bajo contraste que parece deshabilitado, aunque no explica con claridad visual cómo abrir la caja con un clic directo en el botón principal.

#### 4. Tablero «Hoy» / Resumen (`despues-dashboard-desktop-dark.png`, `despues-dashboard-desktop-light.png`, `despues-dashboard-mobile-dark.png`, `despues-dashboard-mobile-light.png`)
* **Qué se ve robótico:**
  1. **Tarjeta hero vacía de datos reales:** El bloque superior ocupa 180 px de altura para decir *«Tu tienda está en movimiento. Pequeñas decisiones. Grandes resultados. Todo lo que necesitas para vender mejor, en un solo lugar»*, con una barra multicolor diminuta abajo a la izquierda que no tiene leyenda ni valores. En un tablero ejecutivo («Hoy»), el dueño de negocio quiere ver al instante **Ventas de hoy, Ticket promedio, Margen neto y Estado de cajas**, no un eslogan motivacional genérico que ocupa media pantalla.
  2. **Gráfico polar/circular mutilado y con paleta arcoíris:** En las 4 capturas (escritorio y móvil, claro y oscuro), el gráfico de *«Ventas del año por mes»* está **cortado por la mitad inferior** y utiliza colores de librería por defecto (rojo `#EF4444`, fucsia `#EC4899`, naranja `#F97316`, verde lima `#65A30D`) que destruyen la paleta *Obsidian Lumina*.
  3. **Lista de meses desalineada:** En `Enero Bruta RD$ 0.00 Neta RD$ 0.00` hasta `Mayo Bruta RD$ 448,350.00 Neta RD$ 199,235.00`, los importes no están en columnas tabulares alineadas a la derecha; el texto baila horizontalmente según el largo del número.
  4. **Emoji estándar en el saludo:** En `Hola, Valeria ✨`, el destello es un emoji plano del sistema en vez de un icono vectorial animado o un destello prismático SVG de la marca.
  5. **Versión clara (`despues-dashboard-desktop-light.png` y `mobile-light.png`) lavada y sin contraste táctil:** El fondo es blanco plano con bordes grises casi invisibles (`#E5E7EB`); pierde toda la riqueza de capas de vidrio esmerilado y sombras suaves multicapa.

#### 5. Menú Móvil (`despues-menu-mobile-dark.png`)
* **Qué se ve robótico:**
  1. **Cajón lateral sin desenfoque (`backdrop-filter`) ni sombra de elevación:** El menú se superpone sobre la pantalla de atrás con un corte negro duro sin oscurecer gradualmente el fondo ni aplicar vidrio esmerilado.
  2. **Lista plana interminable:** Hay 12 ítems seguidos (*Mercancía, Resumen, Punto de venta, Ventas, Solicitudes de anulación, Conciliar transferencias, Envíos del mensajero, Productos, Inventario, Compras, Caja, Gastos, Clientes, Promociones*) sin agrupación semántica (Operación Diaria vs. Catálogo y Almacén vs. Finanzas y Control) ni contadores de notificaciones pendientes (ej. cuántas solicitudes de anulación hay por aprobar).

#### 6. Catálogo de Productos (`despues-catalogo-desktop.png`, `despues-catalogo-movil.png` vs. `despues-products-desktop-dark.png`)
* **Qué se ve robótico:**
  1. **Choque entre dos versiones de la misma pantalla:** `despues-products-desktop-dark.png` tiene el título *«Tu catálogo, con personalidad»* y botón `+ Nuevo producto` en violeta a la derecha; en cambio, `despues-catalogo-desktop.png` cambia el título a *«Catálogo de productos»*, pone el botón `+ Nuevo producto` en **verde menta brillante a la izquierda** de los botones secundarios (`Plantilla`, `Importar Excel`, `Importar inventario`) e introduce una cuadrícula de fondo demasiado visible.
  2. **Botones de acción de tabla mudos y apretados:** En la columna `ACCIONES`, los 3 botones (`ojo`, `impresora/etiqueta`, `inventario`) son cajitas cuadradas con bordes grises pegadas entre sí sin etiquetas ni diferenciación de color al pasar el cursor.
  3. **Colisión crítica en móvil (`despues-catalogo-movil.png`):** El botón flotante verde `Pregúntale a Nexora` tapa el indicador `12 unidades` de la fila `STOCK`, y la barra morada inferior `Mercancía` tapa la fila de acciones del producto.

#### 7. Inventario (`despues-inventario-desktop.png` y `despues-inventario-movil.png`)
* **Qué se ve robótico:**
  1. **Control nativo en inglés sin estilizar:** En la sección *«Levantamiento inicial de Almacén»*, el campo *«Excel de Almacén»* renderiza literalmente **`Choose File No file chosen`** con tipografía nativa del navegador en lugar de una zona de arrastre (*dropzone*) en español (`Arrastra tu archivo Excel aquí o haz clic para seleccionarlo`).
  2. **Cinco bloques apilados sin jerarquía ni pestañas:** En una sola página vertical se apilan *Existencias por almacén*, *Dónde está la mercancía* (tabla vacía sin estado vacío ilustrado), *Nombres de almacenes*, *Traspasar mercancía*, *Levantamiento inicial de Almacén* e *Historial de traspasos* (otra tabla vacía sin mensaje de estado vacío).
  3. **Doble colisión en escritorio y móvil:** En `despues-inventario-desktop.png`, la píldora flotante `Pregúntale a Nexora` **tapa por completo el botón `Renombrar Tienda`** de la sección *Nombres de almacenes*. En `despues-inventario-movil.png`, tapa los datos del producto y la tabla *Dónde está la mercancía* se corta horizontalmente (`Valor a cos...`).

#### 8. Clientes (`despues-clientes-desktop.png` y `despues-clientes-movil.png`)
* **Qué se ve robótico:**
  1. **Botón destructivo (`Anonimizar`) con el mismo color que `Editar`:** En la columna `ACCIÓN`, `Editar` y `Anonimizar` tienen exactamente el mismo estilo violeta/gris. `Anonimizar` es una acción irreversible sobre datos personales y jamás debe verse igual que `Editar`.
  2. **Falta de avatares e indicadores de fidelidad/crédito:** La fila muestra texto plano (`Cliente de referencia`) sin iniciales en avatar cromático, sin etiqueta de estado de crédito y con un correo de prueba `cliente@example.invalid`.
  3. **Bloqueo total en móvil (`despues-clientes-movil.png`):** El botón flotante `Pregúntale a Nexora` se posa **exactamente encima de los botones `Editar` y `Anonimizar`**, haciendo imposible tocarlos en un teléfono.

#### 9. Reportes (`despues-reportes-desktop.png` y `despues-reportes-movil.png`)
* **Qué se ve robótico:**
  1. **Cifras sin formato monetario:** En la tabla *Ventas detalladas*, la columna `TOTAL` dice `18,400` a secas, sin `RD$` ni `.00`, y alineada a la izquierda en vez de a la derecha.
  2. **Ausencia de resumen visual (KPIs o mini-gráfico):** Al abrir *Ventas detalladas*, solo hay una fila solitaria (`2026-10-26 | 12 | 18,400`) con un gran espacio negro vacío debajo, sin tarjetas de resumen del período filtrado (*Total facturado, ITBIS retenido, Ticket promedio, Transacciones*).
  3. **Colisión severa en móvil (`despues-reportes-movil.png`):** La barra morada `Mercancía` y el botón `Pregúntale a Nexora` **tapan el título `Ventas detalladas` y el botón de descarga `Excel`**.

#### 10. Configuración (`despues-configuracion-desktop.png`, `despues-configuracion-movil.png` y `despues-settings-desktop-dark.png`)
* **Qué se ve robótico:**
  1. **Regresión de información entre versiones:** En `despues-settings-desktop-dark.png` se veían claramente las 5 reglas operativas de la tienda (`Descuento vendedor: 10%`, `Sin rotación: 60 días`, `Por vencer: 60 días`, `Margen bajo: 15%`, `Devolución: 30 días`). En `despues-configuracion-desktop.png` se agregaron dos botones gigantes (`Básico` / `Avanzado`) con un morado pastel (`#A78BFA`) que no combina con el botón verde menta `Editar configuración`, y se ocultaron las métricas operativas dejando la tarjeta vacía.
  2. **Subida de logo pobre:** Dice simplemente `Sin logo [Subir logo (hasta 200 KB)]` en una esquina inferior, en vez de mostrar un marco de previsualización del ticket de 80 mm y del encabezado de la tienda.
  3. **Colisión en móvil (`despues-configuracion-movil.png`):** El botón `Pregúntale a Nexora` **tapa el botón `Subir logo (hasta 200 KB)`**.

#### 11. Mercancía (`despues-mercancia-desktop.png` y `despues-mercancia-movil.png`)
* **Qué se ve robótico:**
  1. **Exceso de cajas anidadas con bordes luminosos:** Hay 5 contenedores uno debajo del otro, todos con el mismo borde izquierdo/superior degradado, compitiendo por la atención al mismo tiempo, en vez de guiar al operador en un flujo numerado claro: **Paso 1: Origen/Proveedor → Paso 2: Escaneo/Búsqueda de Artículos → Paso 3: Verificación y Confirmación de Entrada**.
  2. **Zona de escaneo apagada:** El recuadro punteado *«Escanea o busca los productos que llegaron»* tiene muy bajo contraste y parece un espacio roto en lugar de un visor de escáner activo listo para recibir pistola lectora de códigos de barras o cámara.

#### 12. Asistente IA «Pregúntale a Nexora» (`despues-asistente-desktop.png` y `despues-asistente-movil.png`)
* **Qué se ve robótico:**
  1. **Doble borde verde neón defectuoso en el campo de texto:** El `<textarea>` bajo `TU PREGUNTA` tiene simultáneamente un borde interior verde y un `outline` exterior verde brillante con las rayitas diagonales nativas del navegador en la esquina inferior derecha (`resize: both`).
  2. **Preguntas sugeridas que parecen texto suelto:** `Cuadre de hoy`, `¿Quién facturó hoy y quién no?`, `¿Cómo anulo una factura?` y `Productos por agotarse` están escritos en una cuadrícula de texto blanco sin pastillas (chips), sin iconos y sin bordes interactivos; parecen subtítulos estáticos, no botones sugeridos.
  3. **Cero personalidad de inteligencia artificial:** El panel es un rectángulo gris oscuro plano sin iluminación ambiental, sin icono de destello prismático de Nexora y sin diferenciación visual respecto a un formulario de contacto común.

---

## 2. Mejoras Concretas y Priorizadas (con Productos de Referencia y Especificaciones Visuales)

### Prioridad ALTA (Impacto Inmediato en Valor Percibido y Usabilidad)

#### A1. Eliminar la colisión de botones flotantes en móvil y escritorio (Layout & Navegación Móvil)
* **Qué cambiar:**
  1. Eliminar por completo la barra morada gigante fija inferior `Mercancía` que aparece pegada en todas las pantallas móviles (`despues-catalogo-movil.png`, `despues-inventario-movil.png`, `despues-clientes-movil.png`, `despues-reportes-movil.png`, `despues-configuracion-movil.png`).
  2. Reemplazarla por una **Barra de Navegación Inferior estilo App Nativa (*Bottom Tab Bar*) de 64 px de alto** con cristal esmerilado (`backdrop-filter: blur(20px)`), que contenga los 5 accesos clave del negocio: **Hoy**, **Caja (POS)**, **Catálogo**, **Inventario** y **Más (Menú)**, dejando el **Asistente Nexora** como un icono prismático integrado en la barra superior derecha (junto a notificaciones) o como un botón compacto de `44×44 px` con `bottom: 80px` que se oculta automáticamente al hacer scroll hacia abajo.
  3. Agregar un `padding-bottom: 96px` a todos los contenedores de página en móvil (`390 px`) para garantizar que ningún botón de tabla (`Editar`, `Subir logo`, `Excel`) quede jamás cubierto.
* **Cómo se verá:** Limpio, ordenado y 100 % táctil como una aplicación financiera de iOS, donde cada tabla y botón respira sin superposiciones.
* **Producto de referencia:** **Mercury Mobile App** y **Shopify POS Mobile**.

#### A2. Unificar la Identidad «Obsidian Lumina» y el Isotipo «N» Prismático en todo el Sistema
* **Qué cambiar:**
  1. **Reemplazar el logo viejo (`n` minúscula morada)** de la esquina superior izquierda en todas las pantallas internas por el **nuevo Isotipo «N» Prismático** vectorizado/transparente (sin fondo cuadrado negro), acompañado del logotipo `NEXORA` en tipografía geométrica (`Plus Jakarta Sans` o `Outfit` en peso `700`, `letter-spacing: 0.08em`) y un badge `POS` con borde de cristal luminoso.
  2. **Unificar la paleta de colores de acción:** Prohibir la mezcla caótica entre botones violeta (`#7C3AED`) en unas pantallas y verde menta (`#1ED794`) en otras. Regla cromática única:
     - **Acción Primaria de Marca y Navegación:** Violeta Imperial Lumina (`linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)` con borde superior interno `rgba(255,255,255,0.28)` y sombra `0 8px 24px -4px rgba(124, 58, 237, 0.45)`).
     - **Acción Transaccional de Dinero / Confirmación de Cobro (`F12 Cobrar`, `Confirmar entrada`):** Esmeralda Joya (`linear-gradient(135deg, #10B981 0%, #059669 100%)` con brillo sutil).
     - **Acción Destructiva (`Anonimizar`, `Anular`):** Carmesí Alerta (`rgba(239, 68, 68, 0.12)` con texto `#F87171` y borde `rgba(239, 68, 68, 0.3)` en reposo; rojo sólido solo al confirmar).
* **Cómo se verá:** Coherencia absoluta desde la portada hasta el último rincón de Configuración; cada color comunica la naturaleza de la acción al instante.
* **Producto de referencia:** **Linear** y **Raycast Pro**.

#### A3. Rediseño Escultórico de la Portada (`EN-VIVO-portada-*`)
* **Qué cambiar:**
  1. **Eliminar la duplicación de las 3 tarjetas (*Vende / Controla / Decide*):** Dejar una sola fila de 3 **Tarjetas Interactivas de Cristal (*Bento Glass Cards*)** debajo del héroe, donde cada tarjeta muestra un micro-indicador vivo (ej. en *Vende*: `F2 Buscar · F12 Cobro instantáneo`; en *Controla*: `Sincronización multi-almacén en tiempo real`; en *Decide*: `Libro fiscal NCF y cuadre automático`).
  2. **Liberar la «N» Prismática de su caja negra:** Colocar la «N» como pieza escultórica central a **420×420 px** con **fondo 100 % transparente (canal alfa)**, de modo que el haz de luz láser diagonal cruce por detrás del cristal del formulario de inicio de sesión y proyecte un reflejo ambiental violeta/turquesa sobre el borde izquierdo de la tarjeta de login.
  3. **Estilizar la barra de scroll y enlaces:** Aplicar `scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) transparent;` para eliminar la barra blanca en móvil y estilizar `Mostrar contraseña` como un botón de icono de ojo dentro del propio input de contraseña.
* **Cómo se verá:** Una portada de software de alta gama valorado en miles de dólares, con profundidad espacial real y sin textos repetidos.
* **Producto de referencia:** **Vercel Enterprise Login** y **Linear Home**.

#### A4. Rediseño del Tablero «Hoy» (`despues-dashboard-*`) y Gráficos de Datos Ejecutivos
* **Qué cambiar:**
  1. **Reemplazar el banner vacío de texto por una Franja de Pulso Operativo en Vivo (4 KPIs con Sparklines):**
     - **Ventas de Hoy** (con comparativa porcentual respecto al mismo día de la semana anterior y mini-curva suave de horas pico).
     - **Utilidad / Margen Estimado** (con desglose rápido Bruta vs. Neta en tipografía tabular `JetBrains Mono` / `tabular-nums`).
     - **Turnos y Cajas Activas** (indicando cuántas cajas están abiertas y su estado).
     - **Alertas de Inventario** (productos por agotarse o por vencer en los próximos 30 días, con clic directo a reposición).
  2. **Corregir el gráfico cortado de «Ventas del año por mes»:** Sustituir esa rueda arcoíris mutilada por un **Gráfico de Barras Apiladas / Área Luminosa Mensual (Enero–Diciembre)** junto a un **Anillo de Distribución (Donut Chart) completo y centrado**, utilizando exclusivamente la escala cromática *Obsidian Lumina* (Violeta `#8B5CF6`, Índigo `#6366F1`, Cian `#06B6D4`, Esmeralda `#10B981`, Ámbar `#F59E0B`).
  3. **Alineación numérica perfecta:** Todas las cifras (`RD$ 448,350.00`) deben usar `font-variant-numeric: tabular-nums` alineadas a la derecha en columnas fijas, incluyendo el prefijo `RD$` y `.00` en `despues-reportes-desktop.png` (`RD$ 18,400.00`).
* **Cómo se verá:** Un centro de mando financiero digno de un banco digital moderno, claro tanto en modo oscuro para el dueño como en modo claro para supervisión en tienda.
* **Producto de referencia:** **Stripe Dashboard**, **Fey** y **Ramp**.

---

### Prioridad MEDIA (Profundidad, Detalles de Lujo, Modo Claro de Cajera y Asistente IA)

#### M1. Superficies, Capas de Vidrio, Sombras e Iluminación (*Depth & Materiality*)
* **Qué cambiar:**
  1. **Suavizar la cuadrícula de fondo:** En `despues-catalogo-desktop.png` y demás vistas nuevas, la cuadrícula blanca tiene una opacidad excesiva (~8 %) y cubre toda la pantalla como papel milimetrado. Reducir su opacidad a `2.5%` (`rgba(255,255,255,0.025)`) y aplicarle una máscara radial (`mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, #000 30%, transparent 100%)`) para que solo se intuya en la parte superior bajo el halo de luz.
  2. **Bordes especulares de 1 px (No bordes gruesos de 2 px):** Sustituir el borde superior grueso de 2 px en las tarjetas por un borde perimetral de `1px` con gradiente direccional (`border-image` o `background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)`) y `box-shadow: 0 16px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.1)`.
  3. **Modo Claro «Porcelana Cálida» para Cajeras (`despues-dashboard-desktop-light.png`):** Las cajeras trabajan horas frente a la pantalla en versión clara. En lugar de blanco hospitalario `#FFFFFF` sobre `#FFFFFF`, usar un lienzo base **Alabastro Frío (`#F8FAFC`)** con tarjetas en blanco puro (`#FFFFFF`), bordes `#E2E8F0` y sombras suaves tintadas en índigo (`0 4px 20px -2px rgba(15, 23, 42, 0.05)`), garantizando contraste mínimo de **7:1** en precios y totales.
* **Producto de referencia:** **Apple macOS Sequoia / visionOS Glass** y **Mercury Light Mode**.

#### M2. Miniaturas de Productos en POS/Catálogo y Dropzone Nativo en Inventario
* **Qué cambiar:**
  1. **Eliminar los cuadrados blancos puros de las fotos de producto en modo oscuro:** En `despues-pos-desktop-dark.png` y `despues-products-desktop-dark.png`, envolver las imágenes de producto en un contenedor con superficie translúcida (`background: radial-gradient(circle at center, rgba(139,92,246,0.12), rgba(15,17,26,0.9))`) o aplicar un filtro sutil de integración cuando la foto tenga fondo blanco, y colocar el botón `+` en la esquina inferior derecha de la tarjeta (junto al precio) como un botón táctil de `36×36 px` que se ilumina en violeta al pasar el ratón.
  2. **Reemplazar el input `Choose File No file chosen` en Inventario:** En `despues-inventario-desktop.png`, sustituir el `<input type="file">` crudo por un componente **Zona de Carga Interactiva (*Drag & Drop*)** en español: icono de hoja de cálculo iluminado, texto *«Selecciona o arrastra tu archivo Excel (.xlsx / .csv)»*, validación instantánea de columnas (`ID`, `EXISTENCIA`, `COSTO`, `PRECIODETALLE`) y barra de progreso animada.
  3. **Organizar Inventario en 3 Pestañas Claras:** En vez de 6 bloques largos apilados en una sola pantalla, dividir `Inventario` en 3 sub-pestañas limpias: **`1. Existencias y Ubicación`**, **`2. Traspasos entre Almacenes`** y **`3. Carga Masiva y Ajustes`**.
* **Producto de referencia:** **Shopify Admin (Products & Inventory)**.

#### M3. Rediseño Completo del Modal «Pregúntale a Nexora» (`despues-asistente-*`)
* **Qué cambiar:**
  1. **Quitar el doble borde verde neón y el tirador de redimensionamiento (`resize: none`):** Darle al campo de entrada una cápsula de cristal con un borde que hace una transición suave a un resplandor aurora (`box-shadow: 0 0 0 1px #8B5CF6, 0 0 20px -4px rgba(16, 185, 129, 0.35)`) solo cuando el usuario escribe, con botón de envío integrado dentro de la esquina inferior derecha del input (icono de flecha hacia arriba o `Enter ↵`).
  2. **Convertir las preguntas sueltas en Chips Interactivos con Icono:** Cada sugerencia (`📊 Cuadre de hoy`, `👩‍💼 ¿Quién facturó hoy y quién no?`, `🧾 ¿Cómo anulo una factura?`, `⚠️ Productos por agotarse`) debe ser una píldora clicable con `background: rgba(255,255,255,0.04)`, borde `1px solid rgba(255,255,255,0.08)` y efecto hover que eleva la píldora `2px`.
* **Producto de referencia:** **GitHub Copilot Chat** y **Raycast AI**.

---

### Prioridad BAJA (Pulido de Micro-detalles, Estados Vacíos e Ilustraciones)

#### B1. Estados Vacíos Ilustrados (*Empty States*) y Esqueletos de Carga (*Shimmer Skeletons*)
* **Qué cambiar:**
  1. Donde hoy dice secamente `Sin productos` o `Todavía no hay recepciones` (`despues-mercancia-desktop.png`) o hay tablas vacías (`Dónde está la mercancía` e `Historial de traspasos` en `despues-inventario-desktop.png`), incluir un micro-icono isométrico en línea fina con brillo violeta/esmeralda y una guía de 1 línea que explique qué ocurrirá cuando se registre el primer movimiento.
  2. Implementar **esqueletos de carga con barrido diagonal nacarado (*shimmer*)** que reflejen la geometría exacta de las tarjetas del POS y filas de tabla mientras carga la red.
* **Producto de referencia:** **Stripe Empty States** y **Linear Loading Skeletons**.

---

### Especificaciones Técnicas de Piezas Visuales Nuevas (Para producir con ChatGPT PC / Canva Pro / Runway)

Para que el equipo de diseño produzca las piezas sin adivinar nada, aquí están las especificaciones exactas:

1. **Pieza 1: Isotipo «N» Prismático Maestro con Fondo Transparente (`nexora-n-hero.webp` y `nexora-n-icon.svg`)**
   - **Composición:** Letra «N» arquitectónica esculpida en cristal de titanio ahumado y obsidiana, atravesada en diagonal (de abajo-izquierda a arriba-derecha a 32°) por un haz de luz refractada que divide el prisma central en facetas internas.
   - **Colorimetría exacta:** Cuerpo metálico `#1E2433` a `#94A3B8`, facetas internas en Violeta Imperial `#7C3AED` y Fucsia `#D946EF`, haz láser en Cian Esmeralda `#10B981` → `#06B6D4` con núcleo blanco `#FFFFFF`.
   - **Fondo:** **100 % transparente (Canal Alfa obligatorio)**. Prohibido exportar con fondo negro cuadrado.
   - **Tamaños y peso:**
     - Versión Héroe Portada: `840×840 px` (para mostrar a `420×420 px` en pantallas Retina 2x), formato **WebP sin pérdida de transparencia**, peso máximo **$\le 65\text{ KB}$**.
     - Versión Navbar / Favicon / App Icon: Vector **SVG puro** optimizado con SVGO (`32×32 px` y `64×64 px`), peso **$\le 4\text{ KB}$**.

2. **Pieza 2: Bucle de Refracción para la Portada en Vivo (`nexora-n-prism-loop.mp4` / `.webm` — Opcional para Runway Gen-3)**
   - **Composición:** A partir de la Pieza 1 estática, un barrido lento de luz cáustica interna que recorre las facetas diagonales de la «N» y hace brillar sutilmente el haz láser sin mover la cámara ni deformar la letra «N».
   - **Duración y ciclo:** **6,0 segundos**, bucle perfecto (*seamless loop*, el fotograma 0 y el fotograma 180 a 30 fps deben coincidir).
   - **Tamaño y peso:** `720×720 px`, codificado en **WebM (VP9) / MP4 (H.264)** sin pista de audio (`muted playsinline loop`), peso máximo estricto **$\le 280\text{ KB}$**, cargado de forma diferida (`lazy`) solo en escritorio cuando `prefers-reduced-motion: no-preference`.

3. **Pieza 3: Set de 6 Ilustraciones de Categorías / Placeholders de Producto para Modo Claro y Oscuro (`cat-*.svg`)**
   - **Composición:** En lugar de los 4 dibujos planos sobre recuadros blancos (`despues-pos-desktop-dark.png`), crear 6 pictogramas traslúcidos en estilo cristal isométrico (*Suplementos, Ropa deportiva, Maquillaje, Accesorios, Calzado, General*) sobre fondo transparente.
   - **Colorimetría:** Trazos en `#A78BFA` y `#34D399` con rellenos en `rgba(124, 58, 237, 0.12)`.
   - **Tamaño y peso:** SVG de `120×120 px`, peso **$\le 3\text{ KB}$ cada uno**.

---

## 3. Dirección de Movimiento, Tecnología Recomendada y Presupuesto de Peso (< 2,00 MiB)

### Filosofía: «Movimiento con Sentido Operativo» (Nunca decorativo vacío)
En un punto de venta y sistema de gestión empresarial, el movimiento tiene tres propósitos humanos y funcionales:
1. **Confirmar acciones de dinero e inventario al instante** (cuando la cajera escanea un código de barras con `F2` o cobra con `F12`, el ojo humano debe percibir qué artículo entró al carrito sin buscarlo).
2. **Preservar el contexto espacial entre pantallas** (que al cambiar de *Resumen* a *Reportes* la vista no dé un pantallazo brusco).
3. **Transmitir calma y precisión de ingeniería de punta** en la portada y en el tablero administrativo.

### Catálogo de Microinteracciones y Tiempos Exactos

| Momento / Elemento | Qué se mueve y cómo | Duración | Curva / Física | En `prefers-reduced-motion: reduce` |
| :--- | :--- | :---: | :--- | :--- |
| **1. Portada: Respiración del Prisma «N» y Halo** | Pulso radial de luz detrás de la «N» (`opacity: 0.45 → 0.75`, `scale: 0.98 → 1.02`) y reflejo especular que recorre el borde de la tarjeta de Login al enfocar un campo. | `6000 ms` (ciclo infinito) / `250 ms` (foco) | `ease-in-out` sinusoidal / `cubic-bezier(0.22, 1, 0.36, 1)` | Fijo en `opacity: 0.6`, `scale: 1`. Solo cambia el color del borde al enfocar (`0 ms`). |
| **2. Selector de Pestañas (`Clave` / `PIN de 6 dígitos`, `Stock actual` / `Conteos`)** | Pastilla activa deslizante (*sliding pill indicator*) que viaja detrás del texto de la pestaña seleccionada en lugar de parpadear. | `220 ms` | Spring físico (`stiffness: 420, damping: 32`) o CSS `cubic-bezier(0.16, 1, 0.3, 1)` | Cambio instantáneo de fondo sin deslizamiento (`0 ms`). |
| **3. Caja (POS): Escaneo o Clic en Producto (`+`)** | La tarjeta del producto hace un micro-impulso táctil (`scale: 0.97 → 1.0`), el contador del carrito (`0 artículos → 1 artículo`) hace un giro vertical numérico (*slot counter*) y la fila nueva en *Venta actual* entra con destello esmeralda suave. | `160 ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Sin escala; la fila aparece directamente con un borde verde de `150 ms` de opacidad. |
| **4. Transición entre Pantallas del Menú Lateral** | El contenido principal realiza un fundido cruzado con desplazamiento vertical mínimo (`opacity: 0 → 1`, `translateY(6px → 0px)`). La barra lateral permanece 100 % estática y anclada. | `180 ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Cambio directo de vista o fundido simple de `80 ms` sin `translateY`. |
| **5. Tablero «Hoy» y Reportes: Entrada de Cifras y Gráficos** | Las barras/arcos del gráfico crecen desde la base y los KPIs numéricos interpolan su valor en los primeros `450 ms` tras cargar los datos. | `450 ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Los gráficos y números se renderizan directamente en su estado final (`0 ms`). |
| **6. Panel «Pregúntale a Nexora» (Apertura / Cierre)** | Se despliega desde la esquina inferior con desenfoque progresivo y elevación elástica (`scale: 0.95 → 1`, `translateY(12px → 0)`). | `240 ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Apertura por opacidad simple (`100 ms`). |

---

### Evaluación de Tecnologías de Animación y Costo en Peso / Rendimiento

| Tecnología | Peso en Bundle (Min + Gzip) | Impacto en CPU / Memoria | Veredicto para Nexora POS |
| :--- | :---: | :---: | :--- |
| **1. CSS Nativo + Variables CSS + View Transitions API** | **`0 KB` de JS** (`~4 KB` en CSS) | **Mínimo** (100 % acelerado por GPU en el compositor del navegador) | **OBLIGATORIO COMO BASE (85 % de las animaciones).** Debe usarse para todos los hovers, brillos de bordes, esqueletos de carga, transiciones de pestañas y efectos de luz en la portada. |
| **2. Framer Motion (`LazyMotion` + `domAnimation`)** | **`~15 KB` Gzip** (`~48 KB` sin comprimir, cargado en chunk separado) | **Bajo** | **RECOMENDADO (15 % restante).** Solo si se importa mediante `<LazyMotion features={ loadFeatures }>` de forma asíncrona para transiciones de layout complejas (como la pastilla deslizante o el panel del Asistente). **Prohibido** importar el paquete completo `framer-motion` de forma síncrona en el bundle raíz. |
| **3. GSAP / Lottie-web** | `~65 KB – 150 KB` | Medio | **DESCARTADO.** Innecesario para las microinteracciones de un POS y engorda el bundle principal. |
| **4. Three.js / WebGL completo** | `~600 KB+` sin comprimir | Alto (consume batería en móviles y equipos de caja modestos) | **PROHIBIDO.** Rompería el límite de 2 MiB y ralentizaría las computadoras de caja en tienda. |

---

### Plan Quirúrgico para Bajar el Bundle Principal de 2,11 MiB a < 1,15 MiB (Límite Duro: 2,00 MiB)

El archivo principal de JavaScript hoy pesa **2,11 MiB**, superando el límite de **2,00 MiB** de la PWA. Para bajarlo de inmediato y además agregar el nuevo diseño y movimiento sin volver a cruzar jamás los 2 MiB:

1. **Partición de Rutas con `React.lazy()` / `import()` Dinámico (Ahorro estimado: ~850 KB en el archivo principal):**
   - La **Portada de Login**, el **Punto de Venta (Caja)**, el **Tablero «Hoy»**, **Reportes**, **Inventario/Catálogo**, **Configuración** y el **Asistente IA** no deben compilarse dentro de un único archivo `index-[hash].js`.
   - Configurar en `vite.config.ts` (o Webpack/Rollup) `build.rollupOptions.output.manualChunks` para dividir:
     - `chunk-core-vendor.js` (React, Router, Estado base): **~180 KB**.
     - `chunk-pos-caja.js` (Pantalla crítica para cajeras): **~250 KB**.
     - `chunk-admin-modules.js` (Catálogo, Inventario, Clientes, Configuración, Mercancía — cargados bajo demanda): **~420 KB**.
     - `chunk-charts-export.js` (Librerías pesadas de gráficos y exportación a Excel/PDF como `xlsx`, `jspdf` o `recharts`, que hoy están inflando el bundle principal aunque la cajera nunca abra Reportes): **~650 KB aislados en su propio archivo**, cargados **únicamente** cuando el usuario hace clic en *Reportes* o en el botón *Exportar Excel/PDF*.
     - `chunk-motion.js` (Motor de animaciones ligero, que **ni siquiera se descarga** si el dispositivo tiene activo `prefers-reduced-motion: reduce`): **~45 KB**.
2. **Guardia Automática de «Reducir Movimiento»:**
   ```ts
   // Hook centralizado useMotionPreference.ts
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   // En el CSS global:
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

---

## 4. Sistema de Diseño para Desarrolladores («Obsidian Lumina Design System»)

Para que cuando Nexora POS se venda o crezca, **cualquier programador externo pueda meterle mano con confianza sin inventar colores ni romper vistas móviles**, el código debe organizarse bajo una arquitectura de 3 capas de Tokens y Componentes Puros:

### 4.1. Arquitectura de Tokens en 3 Capas (`src/design-system/tokens/`)
Ningún componente en la aplicación debe tener colores fijos como `#1ED794` o `#111827` escritos a mano. Todo debe apuntar a variables CSS semánticas que cambian automáticamente entre **Modo Claro (Cajera)** y **Modo Oscuro (Administración)**:

```css
/* src/design-system/tokens/theme.css */
:root, [data-theme="light"] {
  /* Superficies - Modo Claro (Porcelana Cálida de Alto Contraste para Cajeras) */
  --nx-bg-canvas: #F8FAFC;
  --nx-bg-surface-1: #FFFFFF;
  --nx-bg-surface-2: #F1F5F9;
  --nx-bg-glass: rgba(255, 255, 255, 0.85);
  
  /* Bordes y Sombras */
  --nx-border-subtle: #E2E8F0;
  --nx-border-highlight: rgba(124, 58, 237, 0.25);
  --nx-shadow-card: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px 0 rgba(15, 23, 42, 0.04);

  /* Textos (Contraste WCAG AA/AAA >= 7:1) */
  --nx-text-primary: #0F172A;
  --nx-text-secondary: #475569;
  --nx-text-muted: #64748B;

  /* Acciones Semánticas Unificadas */
  --nx-brand-primary: #6D28D9;
  --nx-brand-primary-hover: #5B21B6;
  --nx-pos-charge: #059669;       /* Exclusivo para Cobrar F12 y Confirmar Entrada */
  --nx-status-danger: #DC2626;    /* Exclusivo para Anular / Anonimizar */
}

[data-theme="dark"] {
  /* Superficies - Modo Oscuro (Obsidian Lumina Ejecutivo) */
  --nx-bg-canvas: #06070B;
  --nx-bg-surface-1: #0D0F17;
  --nx-bg-surface-2: #141724;
  --nx-bg-glass: rgba(18, 21, 33, 0.72);

  /* Bordes Especulares y Sombras */
  --nx-border-subtle: rgba(255, 255, 255, 0.08);
  --nx-border-highlight: rgba(167, 139, 250, 0.35);
  --nx-shadow-card: 0 16px 40px -12px rgba(0, 0, 0, 0.65), inset 0 1px 0 0 rgba(255, 255, 255, 0.09);

  /* Textos */
  --nx-text-primary: #F8FAFC;
  --nx-text-secondary: #94A3B8;
  --nx-text-muted: #64748B;

  /* Acciones Semánticas Unificadas */
  --nx-brand-primary: #7C3AED;
  --nx-brand-primary-hover: #8B5CF6;
  --nx-pos-charge: #10B981;
  --nx-status-danger: #EF4444;
}
```

### 4.2. Estructura de Carpetas y Primitivos Reutilizables
Organizar `src/design-system/` con **12 componentes base documentados en Storybook**:
1. `<NxAppShell>` (Controla la barra lateral en escritorio, la barra inferior en móvil de 390 px, y reserva el espacio seguro para que ningún botón flotante pise tablas).
2. `<NxPageHeader>` (Título, migas de pan, subtítulo y botonera de acciones alineada a la derecha con jerarquía Primaria vs. Secundaria).
3. `<NxCard variant="default | glass | interactive | metric">` (Con borde especular de 1 px y soporte automático claro/oscuro).
4. `<NxButton variant="primary | pos-charge | secondary | ghost | danger" shortcut="F12">` (Con insignia de tecla física integrada para la caja).
5. `<NxDataTable>` (Con alineación numérica `tabular-nums` obligatoria en columnas de moneda `RD$`, transformación automática a tarjetas limpias en `< 640px` sin desbordes y estado vacío ilustrado).
6. `<NxFileDropzone>` (Reemplaza todos los `<input type="file">` nativos en inglés).
7. `<NxSegmentedControl>` (Para pestañas con indicador deslizante animado).
8. `<NxStatusBadge>` (Para estados de stock, NCF y conexión `En línea`).
9. `<NxMoney formatting="DOP">` (Formateador estricto que siempre imprime `RD$ X,XXX.XX` o respeta la regla de **«caja ciega»** mostrando `•••` cuando una cajera tiene turno abierto sin permiso de ver totales).
10. `<NxEmptyState>` (Con icono SVG e instrucción clara).
11. `<NxSkeleton>` (Esqueleto de carga geométrico).
12. `<NxAssistantDrawer>` (Panel del asistente desacoplado de las acciones de tabla).

### 4.3. Gobernanza y Calidad Automatizada
* **Storybook 8:** Cada uno de los 12 componentes tendrá su archivo `.stories.tsx` mostrando simultáneamente la vista **Escritorio Oscuro**, **Escritorio Claro (Cajera)** y **Móvil 390 px**.
* **Regla de CI/CD de Presupuesto de Peso:** Un script de verificación en `package.json` (`npm run check:bundle`) que falla automáticamente si cualquier archivo `.js` dentro de `dist/assets/` supera `1,90 MiB`.

---

## 5. Cotización de Esfuerzo y Hoja de Ruta en 3 Fases

### Desglose de Horas por Mejora (Diseño + Programación + Nivel de Riesgo)

| ID | Mejora / Entregable Técnico | Impacto | Horas Diseño (ChatGPT / Canva / Runway) | Horas Programación (Claude / Dev) | Nivel de Riesgo | Fase Recomendada |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **F1-01** | **Cirugía de Bundle Splitting (< 2,00 MiB):** Partición de rutas con `React.lazy`, extracción de librerías de reportes/Excel a chunks asíncronos y guardia de tamaño. | Crítico | 0 h | 6 h | Bajo (no altera lógica de negocio) | **Fase 1: Rápida** |
| **F1-02** | **Corrección de Colisiones en Móvil (`390 px`):** Eliminación de la barra morada `Mercancía` superpuesta, reubicación del botón `Pregúntale a Nexora` y barra inferior segura. | Alto | 2 h | 5 h | Bajo | **Fase 1: Rápida** |
| **F1-03** | **Unificación del Logo «N» Prismático y Tokens de Color:** Sustitución del logo viejo en todas las vistas internas, unificación de botones (`#7C3AED` / `#10B981`) y corrección de formato `RD$` en Reportes. | Alto | 3 h | 5 h | Bajo | **Fase 1: Rápida** |
| **F1-04** | **Rediseño de la Portada en Vivo:** Eliminación de las 3 tarjetas repetidas, integración de la «N» con fondo transparente, eliminación de scrollbar blanca móvil y enlaces modernos. | Alto | 4 h | 6 h | Bajo | **Fase 1: Rápida** |
| **F1-05** | **Limpieza de Controles Crudos (`Dropzone` en español y modal Asistente):** Reemplazo de `Choose File No file chosen` en Inventario y corrección del doble borde verde y chips del Asistente IA. | Alto | 2 h | 4 h | Bajo | **Fase 1: Rápida** |
| **F2-01** | **Sistema de Diseño «Obsidian Lumina DS» (Tokens + 12 Primitivos):** Creación de variables CSS para Modo Claro (Cajera) y Modo Oscuro (Admin), bordes especulares de 1 px y tarjetas de cristal. | Alto | 4 h | 12 h | Medio (requiere probar contraste en claro y oscuro) | **Fase 2: Media** |
| **F2-02** | **Rediseño del Tablero «Hoy» y Gráficos Ejecutivos:** Franja de 4 KPIs en vivo, corrección del gráfico circular cortado, nueva paleta cromática Lumina y alineación `tabular-nums`. | Alto | 4 h | 10 h | Medio | **Fase 2: Media** |
| **F2-03** | **Refinamiento Visual del Punto de Venta (POS) y Catálogo:** Contenedores translúcidos para fotos de producto (adiós al recuadro blanco deslumbrante), botón `+` ergonómico y mejora visual de `Cobrar F12`. | Alto | 5 h | 8 h | Medio (respetar estrictamente teclas F2–F12) | **Fase 2: Media** |
| **F2-04** | **Reorganización de Inventario (3 Pestañas) y Flujo Guiado de Mercancía:** Separación de los 6 bloques apilados de Inventario en pestañas limpias y estados vacíos ilustrados. | Medio | 3 h | 8 h | Bajo | **Fase 2: Media** |
| **F3-01** | **Motor de Movimiento con Sentido + `prefers-reduced-motion`:** Implementación de transiciones de vista, pastillas deslizantes, contadores animados en caja y bucle de luz Runway en la portada. | Medio | 6 h | 10 h | Bajo (con fallback estático obligatorio) | **Fase 3: Ambiciosa** |
| **F3-02** | **Documentación Interactiva en Storybook + Guía de Extensión para Terceros:** Catálogo vivo de los 12 componentes en claro/oscuro/móvil y pruebas automáticas de accesibilidad (contraste 4,5:1). | Medio | 2 h | 10 h | Bajo | **Fase 3: Ambiciosa** |
| **TOTAL** | **11 Paquetes de Mejora Completos** | — | **35 horas** | **84 horas** | — | **Total: 119 horas** |

---

### Resumen del Plan en 3 Fases

1. **Fase 1 — Rápida (Impacto Inmediato y Cero Errores Visuales): ~11 h Diseño + 26 h Programación (37 h totales)**
   - **Objetivo:** Que hoy mismo la portada impacte como un producto de lujo, que el bundle baje de **2,11 MiB a ~1,15 MiB**, que desaparezca el logo viejo en el interior, que ningún botón flotante vuelva a tapar tablas en móvil (`390 px`) y que no quede ni un solo control en inglés (`Choose File`).
2. **Fase 2 — Media (Arquitectura Premium, Tablero Ejecutivo y POS de Clase Mundial): ~16 h Diseño + 38 h Programación (54 h totales)**
   - **Objetivo:** Consolidar los tokens Claro/Oscuro (con un Modo Claro impecable para las cajeras), transformar el tablero «Hoy» con KPIs y gráficos completos sin cortes, eliminar los parches blancos en las fotos del POS y organizar Inventario/Mercancía por pestañas y pasos.
3. **Fase 3 — Ambiciosa (Movimiento con Sentido, Piezas Runway y Storybook para Venta de Software): ~8 h Diseño + 20 h Programación (28 h totales)**
   - **Objetivo:** Incorporar el ciclo de luz cáustica en la «N» de la portada, las microinteracciones físicas en el carrito de caja (con apagado automático en `prefers-reduced-motion`) y dejar el Storybook listo para que cualquier equipo de software comprador audite y extienda el código sin fricción.

---

## 6. Riesgos y Lo Que NO Se Puede Tocar (Zonas Sagradas)

Para proteger la operación real de las tiendas en República Dominicana, el equipo de programación y los asistentes de diseño tienen **estrictamente prohibido** alterar los siguientes puntos:

1. **Regla de Tema por Rol (Cajeras en Claro / Administración Libre):**
   - Las cajeras operan obligatoriamente en la **versión clara** para máxima legibilidad bajo iluminación fluorescente de tienda física; la administración conserva el selector **Claro / Oscuro**. El rediseño debe verificar que cada componente nuevo se vea igual de exclusivo en ambos temas.
2. **Atajos Físicos y Flujo Operativo de Caja Intocables:**
   - No cambiar las teclas rápidas de la caja (**`F2`** buscar producto, **`F4`** elegir cliente, **`F8`** funciones de espera/caja, **`F12`** cobrar), ni el orden de tabulación del teclado, ni el soporte de lector de código de barras USB/cámara.
3. **Regla de «Caja Ciega» y Permisos:**
   - Bajo ninguna circunstancia mostrar importes acumulados del turno, arqueos esperados ni métricas de ventas del día a un perfil de cajera con caja abierta. El componente `<NxMoney>` debe respetar siempre los permisos del rol activo.
4. **Fiscalidad y Reglas de Negocio Dominicanas (DGII):**
   - No tocar la lógica de cálculo de **ITBIS (18 %)**, secuencias de **Comprobantes Fiscales (NCF / e-CF)**, validaciones de **Cédula / RNC**, conciliación de transferencias bancarias, envíos de mensajero, ni el formato de impresión térmica de **ticket de 80 mm**.
5. **Presupuesto de Rendimiento (Límite Duro de 2,00 MiB por Archivo):**
   - Ninguna mejora visual puede introducir librerías pesadas en el bundle principal ni subir activos sin comprimir. Todo video o animación de portada debe cargarse de forma diferida (`lazy`) después del primer pintado (`LCP`) y desactivarse por completo cuando el sistema operativo o el navegador indique `prefers-reduced-motion: reduce`.
6. **Accesibilidad y Honestidad Comercial:**
   - Mantener contraste mínimo **4,5:1** en todo texto secundario y **7:1** en cifras de cobro, anillos de foco visibles al navegar con `Tab`, vista móvil de `390 px` sin desbordes horizontales, y **cero cifras de marketing inventadas o logotipos de terceros** en la portada.
