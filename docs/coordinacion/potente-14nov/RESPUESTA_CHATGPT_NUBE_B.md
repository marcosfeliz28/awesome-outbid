# Revisión independiente de estética, facilidad de uso e idiomas

**Fecha de la revisión:** 14-nov-2026

**Base:** `origin/nexora-cloud` `ed5826f9f2b680243443239abf76adcc19f3f05b`

**Rama:** `chatgpt-nube/potente-14nov-b`
**Alcance:** lectura de código y estilos, investigación web pública y documentos. No se abrió Nexora en un navegador, no se construyó la aplicación y no se abrieron catálogos ni respuestas de otras IA.

> **Límite obligatorio:** todas las propuestas de este informe están **no vistas en pantalla** en Nexora. Las referencias visuales de competidores son capturas comerciales públicas; no equivalen a probar sus productos.

## Resumen para la dueña

Nexora ya tiene más base visual de la que parece: tipografía legible, tema claro/oscuro, tarjetas, estados, controles táctiles, foco de teclado, reducción de movimiento y una caja que separa catálogo y carrito. No recomiendo reemplazar esa base ni convertirla en una interfaz oscura llena de neón. La versión más potente debe sentirse avanzada por su orden, velocidad y capacidad de anticipar, no por efectos decorativos.

La prioridad visual debería ser una interfaz **serena, nítida y reconocible**: menos opciones simultáneas, una jerarquía fuerte, fotos de producto útiles, total y acción principal siempre visibles, paneles configurados por rol y explicaciones en el momento exacto. La cajera debe aprender el flujo en minutos; la dueña debe poder profundizar sin recibir una pared de menús y tablas.

El mayor salto comercial sería combinar cuatro ideas observadas en el mercado: la facilidad para personal nuevo que comunica Shopify, el POS visual de Loyverse/Kyte, la administración e inventario profundo de Lightspeed y el contexto fiscal dominicano que ofrecen Alegra y los proveedores locales. Nexora puede diferenciarse con una experiencia bilingüe completa, IA verificable y discreta, y una identidad dominicana de alta calidad.

## Método y criterio de evidencia

- Se consultaron **16 productos**: cinco referencias globales, cuatro latinoamericanas y siete dominicanas. Cada fila incluye URL y fecha de consulta.
- Los datos de producto son declaraciones de sus propias páginas comerciales; se atribuyen como tales y no se presentan como verificación independiente.
- Para cuatro productos se inspeccionaron capturas públicas de interfaz: ManguPOS, POS DO, Loyverse y Kyte. Las demás conclusiones visuales se limitan a lo que muestran o describen sus páginas.
- La comparación con Nexora sale únicamente de `apps/web/src` y `packages/ui` en la base indicada. Las líneas pueden moverse después de esa base.
- Escala de esfuerzo: **P** = hasta 2 días; **M** = 3–7 días; **G** = más de una semana. Es una estimación de diseño e implementación, no una cotización.

## Mercado observado

| Producto y región | Qué muestra o comunica sobre apariencia y uso | Fuente pública y fecha del dato |
|---|---|---|
| Square · global | Organiza el producto por tipo de negocio, combina terminales de mostrador y móviles y reúne pagos, inventario, clientes, turnos y analítica. La familia de hardware comunica continuidad entre caja, mano y panel. | [Square POS](https://squareup.com/us/en/point-of-sale), consultado 14-nov-2026. |
| Shopify POS · global | Declara una interfaz intuitiva que el personal nuevo aprende en minutos, pantallas y flujos personalizables, inventario y perfiles unificados, operación con caída de internet y el asistente Sidekick. | [Shopify POS](https://www.shopify.com/pos), publicado/consultado 14-nov-2026. |
| Lightspeed Retail · global | Prioriza inventario profundo, reposición, transferencias, análisis accionable, POS de mano y flujos por industria. Presenta la profundidad como decisiones guiadas, no como una sola tabla gigante. | [Lightspeed Retail POS](https://www.lightspeedhq.com/pos/retail/), consultado 14-nov-2026. |
| Clover · global | Combina software, hardware y aplicaciones configurables; destaca reportes en tiempo real, permisos individuales, terminal virtual y tareas diarias accesibles desde cualquier lugar. | [Clover POS](https://www.clover.com/pos-systems), consultado 14-nov-2026. |
| Loyverse · global/multilingüe | Su captura pública usa una cuadrícula fotográfica y un ticket lateral en tableta y móvil. Declara modo sin conexión, panel desde cualquier dispositivo y disponibilidad en más de 30 idiomas. | [Loyverse](https://loyverse.com/es), consultado 14-nov-2026; captura pública `point-of-sale.webp` revisada ese día. |
| Alegra POS · Latinoamérica/RD | Promete aprendizaje rápido sin conocimiento previo, terminal en tableta o computadora, ventas e inventario en tiempo real, varios almacenes y e-CF 31/32 validado por DGII. | [Alegra POS RD](https://www.alegra.com/rdominicana/pos/), publicado 13-nov-2026 y consultado 14-nov-2026. |
| Siigo POS · Colombia/Latinoamérica | Comunica venta y facturación en segundos, inventario visible, responsable de apertura/cierre de caja y configuración en minutos; dice que se aprende en el primer intento. | [Siigo POS](https://www.siigo.com/sistema-pos/), consultado 14-nov-2026. |
| Vendty · Colombia/Latinoamérica | Ofrece web, escritorio, móvil y tableta; modo híbrido sin internet, inventario centralizado y operación para cadenas. La página separa claramente solución de comercio y restaurante. | [Vendty](https://vendty.com/), consultado 14-nov-2026. |
| Kyte · Brasil/Latinoamérica | La captura pública usa fondos claros, acento verde menta, tarjetas fotográficas y el carrito siempre a la derecha en escritorio. Declara POS fácil, celular como lector, gráficas claras e IA para descripciones. | [Kyte en español](https://www.kyteapp.com/es), consultado 14-nov-2026; captura pública principal revisada ese día. |
| ARCADIGPOS · República Dominicana | Declara POS táctil, múltiples idiomas, roles configurables, inventario multi-almacén, NCF y reportes. Su mensaje visual gira alrededor de “futuro” y “POS inteligente”. | [ARCADIGPOS](https://arcadigpos.com/), consultado 14-nov-2026. |
| ManguPOS · República Dominicana | La captura pública muestra navegación lateral oscura, catálogo en tarjetas, cliente y carrito en columnas separadas, total destacado en violeta. Declara búsqueda inteligente, inventario y NCF/e-CF. | [ManguPOS](https://mangupos.com/pos), consultado 14-nov-2026; captura pública `images/screenshots/pos.png` revisada ese día. |
| CopoSys · República Dominicana | Promete una interfaz que un empleado aprende en minutos, asistente de configuración, POS táctil/teclado y operación offline-first; especifica una pantalla mínima de 1280×720. | [CopoSys](https://coposys.com.do/), consultado 14-nov-2026. |
| POS DO · República Dominicana/Caribe | La captura pública usa navegación lateral simple, tarjetas de indicadores, gráfica central y una columna de órdenes actuales. Ofrece temas, pantalla de cliente, roles y flujo de restaurante. | [POS DO](https://www.pos.com.do/), consultado 14-nov-2026; captura pública `landing/dashboard.png` revisada ese día. |
| DOMI POS · República Dominicana | Declara POS táctil ultrarrápido en vista dividida o panel deslizable, categorías con colores, 21 reportes, siete roles y cuadre por denominaciones. | [DOMI POS](https://domipos.app/), consultado 14-nov-2026. |
| PointSeller · República Dominicana | Comunica cobro táctil, código de barras, NCF/e-CF, cuadre por turno, más de 150 reportes, varias sucursales y soporte local en español. | [PointSeller](https://cde-software.com/software-pos), consultado 14-nov-2026. |
| Poszy · República Dominicana | Reúne caja, inventario, clientes y e-CF; ofrece variantes, almacenes, conteos, crédito, auditoría por empleado y planes con varias sucursales desde web y Android. | [Poszy](https://poszy.com/), consultado 14-nov-2026. |

### Patrones visuales útiles y límites

1. **Caja dividida, no laberinto.** ManguPOS, Loyverse y Kyte muestran catálogo a un lado y ticket/carrito al otro. Esto coincide con la estructura de Nexora y valida mejorarla, no sustituirla.
2. **Fotos para reconocer; texto para confirmar.** Loyverse y Kyte dan mucho peso a la imagen, pero conservan nombre y precio. Nexora debe evitar depender solo del color o de la foto.
3. **Administración por resumen + detalle.** POS DO presenta métricas arriba, gráfica central y órdenes accionables a la derecha. Es más fácil de recorrer que una página inicial formada solo por tablas.
4. **Un color de marca dominante.** Los ejemplos observados usan un acento principal consistente y superficies claras. El aspecto futurista útil viene de espacio, jerarquía y respuesta inmediata, no de muchos degradados.
5. **La profundidad se revela por capas.** Lightspeed, Shopify y los productos dominicanos anuncian funciones extensas, pero sus páginas conducen por tareas y sectores. Nexora debe hacer lo mismo dentro de la administración.

## Qué tiene hoy Nexora por código y estilos

### Fortalezas que conviene conservar

- **Tema adaptable sin destello:** sigue el tema del equipo hasta que la persona elige y aplica color antes del primer render (`apps/web/src/theme.ts:1-53`, `apps/web/src/main.tsx:16-23`).
- **Base legible:** tamaño base 16 px, mínimo 14 px y altura de línea 1.5 (`packages/ui/src/tokens.css:72-80`); Inter y Plus Jakarta Sans forman una jerarquía coherente (`apps/web/src/styles.css:59-85`, `:162-192`).
- **Accesibilidad concreta:** controles de 44 px, foco visible, enlace para saltar contenido y reducción de movimiento (`packages/ui/src/nx-primitivos.css:1-42`, `:183-199`; `apps/web/src/styles.css:200-250`).
- **Caja con arquitectura correcta:** búsqueda, preguntas, ventas en espera, cámara, categorías, estado de inventario, catálogo y carrito etiquetado están separados (`apps/web/src/POS.tsx:962-1112`).
- **Catálogo visual:** foto, estado de existencia, categoría, variantes, precio y stock están en cada tarjeta (`apps/web/src/POS.tsx:1610-1684`).
- **Respuesta a tamaños reales:** la caja pasa a una columna por debajo de 900 px y fija “Cobrar” en móvil; hay reglas específicas para 390 px, 1366×768 y objetivos táctiles (`apps/web/src/styles.css:5612-5652`, `:5685-5783`, `:6361-6365`, `:6664-6755`).
- **Administración profunda existente:** reportes agrupados en ventas, caja, crédito, clientes, inventario, vendedoras y margen, con paginación, ayuda y exportación (`apps/web/src/Management.tsx:2721-2854`, `:2856-3012`).
- **IA con límites comprensibles:** “Preguntar a Norexos” declara solo lectura, muestra fuentes de datos usadas y preguntas restantes (`apps/web/src/AssistantPanel.tsx:23-87`). Además existen preguntas rápidas deterministas sin IA (`apps/web/src/QuickQuestions.tsx:179-181`).

### Brechas visibles en el código

- **Demasiados destinos al mismo nivel:** el arreglo principal reúne resumen, POS, ventas, anulaciones, transferencias, mensajero, productos, inventario, compras, caja, gastos, clientes, promociones, reportes, alertas, incentivos, GV e IA (`apps/web/src/App.tsx:210-300`). Los permisos ocultan lo que no corresponde, pero una administradora puede recibir una lista muy larga.
- **Dos capas de tokens que pueden divergir:** `packages/ui` define base/semántica/componente (`packages/ui/src/tokens.css:1-69`), mientras la aplicación conserva otra lista extensa de colores y superficies (`apps/web/src/styles.css:59-109`). Las tres hojas se importan juntas (`apps/web/src/main.tsx:9-12`).
- **Estilos y pantallas muy concentrados:** `styles.css` llega a 6,828 líneas, `Management.tsx` a 4,814 y `POS.tsx` a 3,094 en esta base. Esto no es un defecto visual por sí solo, pero aumenta el riesgo de inconsistencias al evolucionar la experiencia.
- **Bilingüismo no preparado:** el paquete web no declara una biblioteca ni catálogo de traducciones (`apps/web/package.json:12-29`); navegación, POS y mensajes están escritos directamente en español (`apps/web/src/App.tsx:210-300`, `apps/web/src/POS.tsx:962-1112`). El formato de fecha fija `es-DO` en al menos un flujo (`apps/web/src/DriveBackup.tsx:63-70`).
- **IA visualmente básica:** la experiencia principal es un `textarea`, un botón y una respuesta en texto (`apps/web/src/AssistantPanel.tsx:41-87`). Es segura y clara, pero aún no se siente integrada a las decisiones de cada pantalla.
- **Administración potente pero densa:** productos presenta varias importaciones/acciones antes de la tabla (`apps/web/src/Management.tsx:297-387`) y reportes puede reunir decenas de opciones (`apps/web/src/Management.tsx:2721-2810`). Hace falta revelar profundidad según intención y rol.

## Dirección visual: “Norexos Aura”

La propuesta no es “más efectos”; es una interfaz que parece adelantada porque entiende el contexto.

- **Superficies tranquilas:** fondo ligeramente frío, tarjetas blancas/oscuras bien separadas y un solo violeta de marca. Verde solo para éxito, ámbar para atención y rojo para riesgo.
- **Jerarquía de tres niveles:** tarea actual, información necesaria ahora y detalle bajo demanda. Lo secundario se oculta en paneles o menús, nunca en texto diminuto.
- **Densidad elegible:** “Cómoda” para formación y táctil; “Compacta” para administración experta. La letra no baja de 14 px.
- **Movimiento con propósito:** transiciones cortas para confirmar cambio de pantalla, alta o cobro; todo respeta `prefers-reduced-motion`.
- **Iconos + palabras:** ningún icono crítico sin texto o etiqueta accesible. La estética futurista no sacrifica claridad.
- **Español primero, inglés completo:** el idioma cambia el producto entero, no solo el menú. Moneda, fecha, comprobante y vocabulario dominicano siguen el país de la empresa.

## Propuestas

Todas las fichas tienen **Visto en pantalla en Nexora: no**.

### B-01 · Un solo sistema visual y una galería de componentes

- **Competidores:** Shopify y Clover sostienen experiencias coherentes entre caja, móvil y administración; Kyte y POS DO muestran un acento dominante y superficies repetibles.
- **Nexora hoy:** hay tokens compartidos (`packages/ui/src/tokens.css:1-80`) y primitivos accesibles (`packages/ui/src/nx-primitivos.css:1-199`), pero la aplicación conserva otro conjunto de variables (`apps/web/src/styles.css:59-109`) y carga tres hojas visuales (`apps/web/src/main.tsx:9-12`).
- **Propuesta:** consolidar color, espacio, radio, sombra, tipografía, densidad y estados en `packages/ui`; documentar botones, campos, tablas, tarjetas, diálogo, navegación, gráficos, carga, vacío y error en una galería mantenida. Prohibir nuevos colores sueltos salvo tokens semánticos.
- **Esfuerzo:** G · **Toca dinero:** no.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** comparación visual automatizada en claro/oscuro a 390, 768, 1366 y 1600 px; contraste AA; búsqueda de colores fuera de tokens; revisión manual de la galería.

### B-02 · Navegación por rol, tarea y frecuencia

- **Competidores:** Square organiza por tipo de negocio; POS DO usa pocos destinos principales; Clover ajusta aplicaciones y permisos al negocio.
- **Nexora hoy:** la navegación puede reunir 18 destinos (`apps/web/src/App.tsx:210-300`) y luego filtra por permiso (`apps/web/src/App.tsx:682-686`). El lateral fijo mide 225 px (`apps/web/src/styles.css:493-510`).
- **Propuesta:** para cajera: Caja, Ventas, Clientes y Ayuda; para almacén: Inventario, Compras y Traspasos; para gerente/dueña: Inicio, Operación, Administración, Finanzas y Configuración, con grupos plegables, “Recientes” y favoritos. Ctrl/Cmd+K sigue siendo acceso universal.
- **Esfuerzo:** M · **Toca dinero:** no; solo acceso visual a rutas ya autorizadas.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** matriz de roles contra permisos actuales; máximo cinco destinos primarios por rol; recorrido de las cinco tareas más comunes sin más clics que hoy; teclado y lector de pantalla.

### B-03 · Caja “velocidad tranquila”

- **Competidores:** Loyverse y Kyte muestran catálogo fotográfico + ticket persistente; ManguPOS separa búsqueda, cliente y carrito; Shopify enfatiza aprendizaje en minutos.
- **Nexora hoy:** ya separa catálogo y carrito (`apps/web/src/POS.tsx:962-1112`) y usa 340 px para el carrito en escritorio (`apps/web/src/styles.css:1739-1747`).
- **Propuesta:** conservar la división, pero dar prioridad visual constante a: búsqueda/escáner, cliente, productos, total y Cobrar. Reducir acciones secundarias a una banda “Más”; mostrar cada línea con foto pequeña, variante, cantidad y total; usar confirmaciones de una frase. El total y Cobrar no desaparecen al desplazarse.
- **Esfuerzo:** M · **Toca dinero:** no en esta fase; se conserva exactamente el cálculo y flujo actuales.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** prueba visual a 1280×720, 1366×768 y 390×844; tres artículos visibles y Cobrar accesible; venta completa con teclado, lector, tacto y lector de pantalla; instantáneas de totales idénticos antes/después.

### B-04 · Tarjetas de producto que se reconocen de un vistazo

- **Competidores:** Loyverse y Kyte usan imágenes grandes con nombre/precio; ManguPOS usa tarjetas y estado de existencias.
- **Nexora hoy:** las tarjetas ya incluyen foto, categoría, nombre, variantes, precio, stock y estados (`apps/web/src/POS.tsx:1622-1680`), con dos columnas en móvil (`apps/web/src/styles.css:5654-5675`).
- **Propuesta:** proporción de foto consistente, nombre de dos líneas, variante principal y precio con números tabulares; estado agotado con texto/patrón además de color; modo lista compacto para catálogos grandes; selector cómodo/compacto guardado por equipo.
- **Esfuerzo:** M · **Toca dinero:** no; solo presenta el precio existente.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** catálogo de prueba con nombres largos, sin foto, 1/20 variantes, agotado y bajo stock; reconocimiento a 1 metro; contraste y zoom 200 %; no depender del color.

### B-05 · Inicio distinto para cajera, gerente y dueña

- **Competidores:** POS DO usa KPIs, gráfica y órdenes actuales; Lightspeed convierte datos en reposición y acciones; Clover destaca tendencias en tiempo real.
- **Nexora hoy:** el tablero ya tiene banner, KPIs y gráfica (`apps/web/src/Dashboard.tsx:330-457`) y la navegación conoce rol/permisos (`apps/web/src/App.tsx:682-686`).
- **Propuesta:** cajera ve “Abrir/continuar caja”, pendientes y atajos; gerente ve cajas, autorizaciones y alertas; dueña ve ventas, margen autorizado, inventario, caja y tres acciones recomendadas. Cada tarjeta responde “qué pasó / por qué importa / qué puedo hacer”.
- **Esfuerzo:** G · **Toca dinero:** no si reutiliza lecturas actuales; cualquier nueva métrica financiera requiere orden separada.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** fixtures por rol; ninguna tarjeta filtra datos sin permiso; tareas críticas visibles sin desplazamiento a 1366×768; cifras comparadas con sus reportes fuente.

### B-06 · Primer día guiado y ayuda dentro de la tarea

- **Competidores:** CopoSys describe un asistente paso a paso; Shopify y Siigo prometen aprendizaje rápido; Clover ofrece configuración acompañada.
- **Nexora hoy:** el lateral ofrece una tarjeta de ayuda (`apps/web/src/App.tsx:1053-1063`), hay mensajes vacíos accionables en productos (`apps/web/src/Management.tsx:383-387`) y preguntas rápidas en caja (`apps/web/src/POS.tsx:1001-1009`).
- **Propuesta:** recorrido opcional por rol, checklist de primer día, ayuda contextual “¿Cómo hago esto?” y modo práctica con datos de ejemplo claramente rotulado. Nunca bloquear a una persona experta con tutoriales.
- **Esfuerzo:** M · **Toca dinero:** no; el modo práctica debe estar aislado de datos reales.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** una empleada nueva completa abrir caja, buscar, agregar, elegir cliente y llegar al cobro con guía; puede omitir/reanudar; analítica de pasos solo con datos no sensibles.

### B-07 · Administración por espacios de trabajo, no por páginas gigantes

- **Competidores:** Lightspeed presenta inventario, compra y análisis como flujos conectados; Square y Clover separan capacidades sin perder búsqueda global.
- **Nexora hoy:** `Management.tsx` concentra productos, inventario, promociones, reportes y administración; productos expone varias acciones juntas (`apps/web/src/Management.tsx:297-387`) y reportes agrupa decenas de opciones (`apps/web/src/Management.tsx:2721-2810`).
- **Propuesta:** espacios “Catálogo”, “Inventario”, “Ventas y clientes”, “Caja y pagos”, “Equipo”, “Reportes” y “Configuración”. Cada uno abre con resumen, acciones frecuentes y búsquedas/filtros guardados; el detalle avanzado queda en panel lateral o pestaña.
- **Esfuerzo:** G · **Toca dinero:** no en el rediseño; las acciones conservan contratos existentes.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** mapa de información con todas las rutas actuales; ninguna función perdida; pruebas de permisos; cinco tareas administrativas completadas con menos cambios de contexto.

### B-08 · Tablas modernas con vista cómoda, compacta y móvil real

- **Competidores:** Lightspeed destaca manejo de inventario voluminoso; Poszy y PointSeller venden profundidad de operación. Una administración potente necesita densidad controlada.
- **Nexora hoy:** las tablas se desplazan horizontalmente (`apps/web/src/styles.css:1343-1367`) y algunas se convierten en tarjetas móviles (`apps/web/src/styles.css:6664-6733`).
- **Propuesta:** cabecera fija, columnas configurables, filtros visibles como chips, vistas guardadas, selección múltiple segura, columna de acción persistente y dos densidades. En móvil usar tarjetas solo para lo esencial; detalle en panel, no una tabla encogida.
- **Esfuerzo:** G · **Toca dinero:** no; acciones masivas sobre dinero quedan fuera.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** 1,000 filas de prueba; teclado, lector de pantalla, zoom 200 %, 390 px; rendimiento de desplazamiento; columnas y filtros sobreviven recarga por persona/equipo.

### B-09 · IA integrada, explicable y nunca dominante

- **Competidores:** Shopify muestra Sidekick; Kyte usa IA para descripciones; Lightspeed anuncia herramientas de IA para comercio.
- **Nexora hoy:** el asistente es de solo lectura, explica datos usados y cuota (`apps/web/src/AssistantPanel.tsx:23-87`), pero vive como una página de texto separada. Las preguntas rápidas deterministas ya cubren 30 respuestas (`apps/web/src/QuickQuestions.tsx:179-181`).
- **Propuesta:** botón “Preguntar sobre esta pantalla” en reportes, inventario y ventas; sugerencias cortas según contexto; respuestas con tarjetas, período, fuente y enlace al dato. Acciones sugeridas nunca se ejecutan sin confirmación y permiso. Mantener preguntas rápidas como primera opción barata y segura.
- **Esfuerzo:** G · **Toca dinero:** no en modo lectura; cualquier escritura necesita otra orden y confirmación explícita.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** conjunto de preguntas por rol; cero exposición de costo/margen sin permiso; fuente y período siempre visibles; respuesta útil también sin IA mediante preguntas rápidas.

### B-10 · Español e inglés completos, con español dominicano primero

- **Competidores:** Loyverse declara más de 30 idiomas; ARCADIGPOS anuncia múltiples idiomas; los productos globales localizan experiencia y catálogos.
- **Nexora hoy:** no hay dependencia de internacionalización en el paquete web (`apps/web/package.json:12-29`); textos están incrustados en navegación y caja (`apps/web/src/App.tsx:210-300`, `apps/web/src/POS.tsx:962-1112`) y algunas fechas fijan `es-DO` (`apps/web/src/DriveBackup.tsx:63-70`).
- **Propuesta:** catálogo de mensajes tipado `es-DO`/`en`, español como idioma inicial, selector por persona, formatos con `Intl`, glosario dominicano (caja, comprobante, NCF/e-CF, ITBIS, cédula/RNC) y traducción de ayuda, validaciones, recibos y estados; los nombres de productos no se traducen automáticamente.
- **Esfuerzo:** G · **Toca dinero:** no; moneda e impuestos se formatean, no se recalculan.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** prueba que falla si queda texto funcional sin catálogo; pseudoidioma para detectar cortes; capturas espejo ES/EN a 390/1366; formatos RD$/fecha y términos fiscales aprobados.

### B-11 · Legibilidad como función: tamaño, contraste y densidad

- **Competidores:** las capturas de Kyte y POS DO usan mucho espacio y bloques claros; Shopify vende facilidad para personal nuevo.
- **Nexora hoy:** tiene base 16 px/mínimo 14 px (`packages/ui/src/tokens.css:72-80`), foco visible (`apps/web/src/styles.css:232-250`) y objetivos táctiles móviles (`apps/web/src/styles.css:6736-6755`).
- **Propuesta:** preferencias “Texto normal/grande”, “Cómoda/compacta” y “Contraste reforzado”; conservar AA como mínimo, usar números tabulares y no reducir tipografía para hacer caber contenido. El modo oscuro debe ser oscuro neutro, no violeta sobre negro.
- **Esfuerzo:** M · **Toca dinero:** no.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** WCAG AA automatizado y manual; zoom 200/400 %; sol directo y poca luz en dispositivo real; no truncar totales, nombres ni estados.

### B-12 · Estados del sistema que den confianza

- **Competidores:** CopoSys comunica offline-first; Shopify y Loyverse explican continuidad sin conexión; Poszy muestra estados de e-CF.
- **Nexora hoy:** la barra distingue en línea/sin conexión y pendientes (`apps/web/src/App.tsx:1124-1149`); la caja anuncia inventario local/en línea (`apps/web/src/POS.tsx:1064-1077`); existen skeletons, vacíos y toasts compartidos (`packages/ui/src/nx-primitivos.css:100-137`).
- **Propuesta:** lenguaje visual único para guardando/guardado/pendiente/error/recuperado, centro de sincronización entendible y recibos de acción (“Venta guardada en este equipo; se enviará al volver internet”). Ningún error se comunica solo por color o por un toast que desaparece.
- **Esfuerzo:** M · **Toca dinero:** no; solo refleja estados reales existentes.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** simulación de red lenta, caída, reintento, conflicto y recuperación; lector de pantalla; historial de estados críticos; correspondencia exacta con la cola local.

### B-13 · Capa fiscal dominicana visible y comprensible

- **Competidores:** Alegra muestra e-CF 31/32 y validación DGII; ManguPOS, CopoSys, DOMI POS, PointSeller y Poszy convierten NCF/e-CF y reportes fiscales en parte central del producto.
- **Nexora hoy:** la base documental confirma que el recibo es documento no fiscal y que no emite NCF/e-CF (`docs/sistema/README.md:13-18`). El pie actual comunica “Documento interno” (`apps/web/src/App.tsx:1255-1258`).
- **Propuesta:** sin fingir cumplimiento, crear un centro visual “Fiscalidad RD” con estado honesto: no configurado, en preparación, certificado, contingencia, enviado, aceptado o rechazado. Hasta implementar fiscalidad, mostrar claramente “Documento no fiscal” y una hoja de ruta, nunca sellos que sugieran homologación.
- **Esfuerzo:** P para transparencia visual actual; G para producto fiscal real · **Toca dinero/fiscalidad:** sí en la implementación real, por lo que requiere orden y validación separadas.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** revisión por especialista fiscal dominicano; estados de prueba DGII; recibos y e-CF de sandbox; ninguna pantalla afirma certificación antes de tenerla.

### B-14 · Identidad de producto vendible sin perder claridad

- **Competidores:** Square, Shopify y Clover son reconocibles en hardware y software; Kyte mantiene un lenguaje visual propio; los proveedores dominicanos hacen visible su adaptación local.
- **Nexora hoy:** la marca aparece en lateral, búsqueda, pie y asistente (`apps/web/src/App.tsx:1023-1028`, `:1119-1123`, `:1255-1258`; `apps/web/src/AssistantPanel.tsx:43-50`). El tema usa violeta como acento (`apps/web/src/styles.css:59-70`).
- **Propuesta:** conservar violeta, crear iconografía/ilustración propia sobria, tono verbal directo y plantillas coherentes para login, inicio, ayuda, carga y venta. “Futurista” significa datos claros, IA explicable y transiciones precisas; no partículas, neón ni fondos que compitan con precios y nombres.
- **Esfuerzo:** M · **Toca dinero:** no.
- **Visto en pantalla en Nexora:** no.
- **Comprobación:** inventario de marca en todas las pantallas, prueba de reconocimiento sin logotipo, revisión con la dueña y cinco empleadas, y contraste/legibilidad antes de aprobar cualquier ilustración.

## Orden recomendado

| Fase | Piezas | Resultado esperado |
|---|---|---|
| 1 · Fundamento visual | B-01, B-11, B-14 | Una identidad coherente y legible antes de rediseñar pantallas. |
| 2 · Caja prioritaria | B-03, B-04, B-12 | Venta más clara en 390 y 1366 px sin cambiar cálculos. |
| 3 · Facilidad diaria | B-02, B-05, B-06 | Cada rol ve menos ruido y aprende más rápido. |
| 4 · Administración profunda | B-07, B-08 | Potencia sin paredes de opciones ni tablas encogidas. |
| 5 · Producto internacional | B-10, B-09 | Español/inglés completos e IA integrada con evidencia. |
| 6 · Venta en RD | B-13 | Transparencia fiscal inmediata y cumplimiento real solo tras proyecto separado. |

### Cinco primeras decisiones visuales

1. Aprobar el principio “avanzado por orden, no por efectos”.
2. Unificar tokens y componentes antes de seguir agregando CSS por pantalla.
3. Prototipar la caja a 1366×768 y 390×844 sin tocar lógica.
4. Prototipar navegación de cajera, gerente y dueña con máximo cinco destinos primarios.
5. Elegir densidad cómoda como predeterminada y compacta como opción.

## Lo que no haría todavía

- No aplicaría un rediseño masivo de una vez; migraría por componente y pantalla con comparación visual.
- No usaría modo oscuro como estética obligatoria ni texto pequeño para parecer “profesional”.
- No traduciría con reemplazos automáticos; primero se crea el catálogo y el glosario.
- No convertiría la IA en una ventana flotante que tape la caja; debe aparecer en contexto y cerrarse sin perder trabajo.
- No anunciaría NCF/e-CF, homologación o certificación hasta tener evidencia legal/técnica real.
- No copiaría la apariencia exacta de ningún competidor; los patrones son referencia, no plantilla.

## Autoauditoría y límites

- Revisé 16 proveedores: 5 globales/multilingües, 4 latinoamericanos y 7 dominicanos. Cada dato tiene URL y fecha.
- Inspeccioné capturas comerciales públicas de cuatro productos; no inicié sesión ni envié información a ningún proveedor.
- Todas las propuestas dicen **“Visto en pantalla en Nexora: no”** y aportan competencia, evidencia `archivo:línea`, esfuerzo y comprobación.
- La mayor parte del informe (B-01 a B-12 y B-14) es estética y facilidad de uso; B-13 se incluye porque afecta la venta del producto dominicano, pero queda separado de la ejecución visual.
- No abrí la aplicación, no ejecuté compilaciones ni pruebas funcionales y no presento esta revisión como validación visual real.
- No abrí la rama `consulta/catalogo-13nov` ni documentos de respuestas de otras IA. Solo se leyó `REVISION_USO_PC_13NOV.md` porque la orden de la dueña lo indicó expresamente, además de las reglas generales obligatorias del repositorio.
- No cambié código, pruebas, dinero, precios, permisos, Render, producción, la base de la tienda ni credenciales. No se desplegó ni mezcló nada.
