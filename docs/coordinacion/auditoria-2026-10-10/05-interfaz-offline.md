# Auditoría 05 · Interfaz, flujo de caja, modo sin conexión y usabilidad real

**Alcance:** Nexora POS, rama `origin/nexora-cloud` @ `3e5521c` (worktree desacoplado, ya eliminado).
**Fecha:** 2026-10-10. **Auditor:** independiente, solo lectura (no se modificó ni se empujó nada; no se tocó Render ni producción).

**Entorno de prueba:** PostgreSQL 16 propio (`/var/lib/postgresql/aud-ui-05`, puerto 55977), migraciones y semilla de demostración (`SEED_DEMO_PASSWORD`), API compilada (`node dist/main.js`, `NODE_ENV=production`, puerto 3977), vista previa de Vite con la PWA y su service worker (puerto 4977). Recorrido con Playwright 1.63 y el Chromium de `/opt/pw-browsers`, en escritorio (1280×800, 1366×768 y 1920×1080) y en celular (390×844, táctil). axe-core 4.10.2 inyectado para WCAG 2.1 A/AA. Se usaron los roles cajera (`vendedor@`), gerente (`gerente@`), administradora (`admin@`) y almacén (`almacen@`). Todo se limpió al final: servidores detenidos, clúster borrado y worktree eliminado.

Los scripts del recorrido quedan en `scratchpad/aud-scripts/` (`s1`…`s16`) para repetirlo. Las capturas están en `capturas/` y se citan como `[NN]`.

> Nota de entorno (no es un hallazgo): a mitad de la sesión, otro proceso del contenedor terminó el proceso de la API (Prisma respondió «Response from the Engine was empty» y hubo 500 en cadena). Se reinició con otro nombre de proceso y se repitieron las pruebas afectadas. Ningún resultado de este informe depende de ese corte.

## Resumen

| Severidad | Nº |
|---|---|
| BLOQUEANTE | 0 |
| ALTO | 5 |
| MEDIO | 9 |
| BAJO | 13 |

**Lo que funciona bien (verificado):**
- La venta con lector es correcta: el foco vuelve solo al buscador, Enter funciona y el escaneo con el foco en un descuento también.
- Los mensajes de «Código no encontrado», «sin stock (quedan 0)» y código de 2 productos son claros.
- El doble clic en «Finalizar venta» crea una sola venta (FS-0000847).
- El PIN de gerente para un descuento sobre el límite funciona, y el motivo es obligatorio.
- Contraentrega con PIN y pago mixto funcionan.
- Ventas en espera se guardan y se recuperan.
- El cambio obligatorio de contraseña tiene reglas visibles y errores en español.
- El traslado de caja entre equipos funciona.
- Sin conexión:
  - Con red cortada o servidor caído, la caja pasa a «Offline» en unos 180 ms y guarda la venta local.
  - Con la respuesta perdida no se duplica: 1 sola venta en el servidor.
  - Al recargar sin conexión, el service worker sirve la app con el catálogo local.
  - La sincronización al volver es automática.
- axe-core: 0 violaciones WCAG A/AA en inicio de sesión, POS (tema claro y oscuro), cobro, selector de cliente y Caja.
- Rendimiento percibido aceptable: inicio de sesión visible en 3,4 s con 3G rápido y CPU ×4. Sin desbordes horizontales de página a 390 px (las tablas se desplazan dentro de su contenedor).

---

## ALTO

### A1. El ticket impreso siempre dice «Vendido a: Consumidor final», también en crédito y contraentrega
- **Pasos:**
  1. Cajera, POS: escanea un artículo, F4 y elige una clienta (p. ej. Ana Herrera).
  2. Cobrar, Crédito / contraentrega, PIN de gerente, Finalizar venta.
  3. Pulsa «Imprimir factura» (o deja que salga sola con impresión automática).
- **Resultado:** el ticket dice «Vendido a: Consumidor final» y «Pendiente RD$ 300.00» `[40]`. Pasa lo mismo en la venta mixta `[14]`. La alerta del servidor sí registra la deuda a nombre de «Ana Herrera».
- **Causa:** `apps/web/src/POS.tsx:1763` llama a `clearCart()`, que pone `customerId: null` (`apps/web/src/api.ts:146`), antes de dibujar el recibo. Después, `POS.tsx:1820` busca al cliente con ese `customerId` ya vacío, y `Prints.tsx:326` escribe «Consumidor final». Por la misma causa, el enlace de WhatsApp y el de correo salen sin destinatario.
- **Impacto en la cajera:** el comprobante en papel de un crédito o contraentrega no identifica al deudor. No sirve como constancia del saldo ni para el mensajero, y la clienta que pidió su nombre o RNC en el ticket no lo recibe.
- **Arreglo:** antes de `clearCart()`, guardar el cliente en el recibo (`setReceipt({...sale, customer})`) y que `InvoicePrint` use `receipt.customer`. Añadir una prueba E2E que imprima un ticket de crédito y compruebe el nombre.

### A2. Un conflicto de una venta sin conexión de una cajera no tiene salida y le impide cerrar su caja
- **Pasos:** con `allowOfflineSales=true`, como en la semilla:
  1. La cajera, sin conexión, vende las 3 unidades de Jogger Relax (cobra RD$ 3,150 en efectivo).
  2. Mientras tanto, la gerente vende 1 en línea.
  3. La cajera vuelve a tener conexión.
- **Resultado:**
  - Aviso «1 ventas requieren revisión en Caja». En Caja: «Requiere revisión · Stock insuficiente para Jogger Relax», y la única acción es «Reintentar» `[27]`.
  - Al cerrar la caja: «Sincroniza o resuelve las ventas pendientes de este dispositivo antes de cerrar la caja.» `[29]`.
  - La gerente no aparece en «Cambiar vendedor con PIN», que solo lista a «Camila López» `[30b]`.
  - Si la gerente entra con su usuario en ese equipo, no ve la venta: el panel filtra por `userId` (`Management.tsx:1415-1419`).
  - «Descartar» exige `sale:manage` (`Management.tsx:1666`). La API exige, además, que quien descarta sea quien envió la venta (`apps/api/src/offline-sales.ts:45-70`). Nadie puede descartar el conflicto de una cajera.
- **Impacto:**
  - El dinero ya está en la gaveta y la venta no existe en el servidor.
  - La cajera no puede cerrar su caja en ese equipo hasta que alguien repare el stock y ella pulse «Reintentar». La pantalla no le dice que esa es la salida.
  - Para los conflictos que «Reintentar» no puede resolver (venta de más de 48 h, «ventas sin conexión desactivadas» si la dueña cambió el ajuste, cliente anonimizado) el bloqueo es permanente.
  - Si cierra en otro equipo, o borra los datos del navegador, la venta desaparece en silencio y el cuadre sale con sobrante. En `[59]` hay un sobrante que incluye esa venta.
- **Arreglo:**
  - Permitir que un gerente, en el equipo de la cajera y con su PIN, vea, reprecie o descarte las ventas locales de otros usuarios. La API debe aceptar el descarte de `sale:manage` sobre la evidencia de otro usuario de la sucursal.
  - Mostrar en cada conflicto un texto de acción, por ejemplo «Pide a gerencia que ajuste el inventario de X y pulsa Reintentar».
  - Subir al servidor el detalle de la venta en conflicto (artículos, pagos), no solo la alerta, para que se pueda cuadrar.

### A3. Sin conexión, el cierre por inactividad deja a la cajera sin poder entrar ni vender, y borra el carrito
- **Pasos:**
  1. Cajera con 2 artículos en el carrito.
  2. Se va el internet y pasan 30 minutos sin tocar la pantalla (reloj adelantado con `page.clock`).
- **Resultado:**
  - Sale «¿Sigues ahí?» `[31]` y, al vencer, la pantalla de inicio de sesión `[32]`.
  - Al entrar sin conexión: «Sin conexión con el servidor.» `[33]`.
  - Al volver la conexión y entrar, el carrito está vacío (0 líneas).
- **Causa:** `apps/web/src/App.tsx:582-636` (inactividad, que llama a `endSession`), `api.ts:268-277` (`clearSession` vacía el carrito y marca la sesión vencida) e inicio de sesión solo en línea (`App.tsx:298`).
- **Impacto:** precisamente durante un corte, que es cuando la caja debería seguir vendiendo con la opción activada, una pausa de 30 minutos (almuerzo, poca clientela) cierra la caja hasta que vuelva el internet. La guía del primer día dice «no cierres sesión», pero no avisa de que el cierre por inactividad hace lo mismo.
- **Arreglo:**
  - Sin conexión, bloquear la pantalla en vez de cerrar la sesión, y desbloquear con el PIN de la cajera validado localmente con un hash guardado al iniciar sesión, o con la contraseña contra un verificador local.
  - No borrar el carrito al bloquear.
  - Pausar el contador mientras haya carrito o cobro abierto, o guardarlo como venta en espera local.

### A4. Si se escanea mientras carga el catálogo, los códigos se pegan y se pierden los artículos
- **Pasos:**
  1. Abrir o recargar el POS con `/api/products` lento (4 s, simulado).
  2. Escanear 3 códigos seguidos con el foco en el buscador.
- **Resultado:**
  - Cada escaneo muestra «Cargando el catálogo… se agregará al terminar.».
  - El buscador acumula `770000003700877000000010167700000037015` `[34]`.
  - Al terminar la carga: «Código no encontrado: 7700000037008770000…» y el carrito queda vacío `[34b]`.
- **Causa:** `POS.tsx:630-636`. Mientras el catálogo carga, `enter()` solo guarda `"enter"` y no limpia ni selecciona el texto, así que el siguiente escaneo se pega al anterior. Además, `pendingScan` (`POS.tsx:579`) guarda un único escaneo pendiente: con el camino `scan()`, el segundo sustituye al primero.
- **Impacto:** al abrir la caja, o tras cada recarga o actualización automática, y con un catálogo real (páginas de 200, internet lento), la cajera cree que los artículos «se agregarán» y no se agregan. Si no revisa el carrito, que además apenas se ve (A5), cobra de menos.
- **Arreglo:** durante la carga, guardar una cola de códigos (`string[]`), vaciar el buscador después de cada Enter y procesar la cola en orden al llegar el catálogo. Se puede usar la copia local del catálogo en IndexedDB mientras llega la nueva.

### A5. El carrito casi no se ve: 0 líneas completas a 1366×768 y, en celular, a más de 9.000 px de distancia
- **Pasos:** administradora o cajera en una pantalla de 1366×768 (monitor típico de caja). Escanear 5 artículos distintos.
- **Resultado:**
  - El área del carrito mide 140 px y cada línea 173 px: ninguna línea se ve completa y se ve la primera, no la última escaneada `[57-1366]`.
  - A 1920×1080, 1 de 5 líneas completas `[57-1920]`.
  - En 390 px el carrito empieza en y≈9.219 px, después de las 60 tarjetas `[barrido-390-pos]`. Para revisar cantidades o descuentos hay que desplazarse por todo el catálogo. El botón fijo «Cobrar · RD$» sí ayuda.
- **Causa:** `styles.css:1954-1959` (`.cart-items` con `min-height:140px`), líneas altas con dos campos de descuento siempre visibles (`POS.tsx:917-968`) y ningún `scrollIntoView` a la línea agregada.
- **Impacto:** la cajera no puede comprobar de un vistazo lo que entró. Esto, sumado a A4, a M2 (avisos que se pisan y sin sonido) y a los códigos ambiguos, aumenta el riesgo de cobrar de más o de menos.
- **Arreglo:**
  - Líneas compactas de unos 56 px, con los descuentos detrás de un botón «Descuento».
  - Desplazar automáticamente a la última línea y resaltarla un instante.
  - Más alto para el carrito en escritorio.
  - En celular, un cajón o pestaña «Carrito (n)» fijo en vez de ponerlo al final del catálogo.

---

## MEDIO

### M1. El carrito vive solo en memoria: se pierde con F5, al actualizarse la app, al cambiar de vendedor o al cerrarse por inactividad
- **Pasos:** 2 artículos en el carrito y F5. El carrito queda en 0 (s8).
- **Causa:** `api.ts:88-156` (zustand sin `persist`). `vite.config.ts` usa `registerType: "autoUpdate"` y `main.tsx` llama a `registerSW({ immediate: true })`. En modo automático, vite-plugin-pwa ejecuta `window.location.reload()` al activarse un service worker nuevo, así que cada despliegue recarga las 4 cajas sin avisar. «Cambiar vendedor con PIN» vacía el carrito (`App.tsx:985`), y el cierre por inactividad también (A3).
- **Impacto:** carrito perdido delante de la clienta. Hay que volver a escanear todo.
- **Arreglo:** guardar el carrito, el cliente, el descuento global y la marca de venta al por mayor en IndexedDB, por usuario. Pasar a `registerType: "prompt"` y recargar solo con el carrito vacío o tras confirmar.

### M2. Hay un solo espacio para avisos y no hay sonido: un error se pisa con el siguiente escaneo
- **Pasos:**
  1. Escanear un código inexistente: aparece «Código no encontrado…».
  2. Escanear otro válido enseguida: el aviso pasa a «Proteína Whey Isolate agregado.» y el error desaparece (s2).
  3. Además, el error «Selecciona o crea el cliente antes de cobrar.» queda encima de la ventana de cobro ya abierta y tapa su título `[18]`.
- **Causa:** `helpers.tsx:40-81` muestra un solo aviso a la vez, y no hay ninguna señal de sonido (`grep AudioContext` sin resultados).
- **Impacto:** con el lector, la cajera mira a la clienta, no a la pantalla. Los errores pasan desapercibidos.
- **Arreglo:**
  - Cola de avisos en la que los errores no los sustituye un aviso informativo.
  - Pitido corto distinto para «agregado» y para «error», activable en Ajustes.
  - Cerrar los avisos de validación al abrir la ventana correspondiente.

### M3. Sin conexión hay pantallas que se quedan cargando para siempre, y Caja esconde las ventas guardadas en el equipo
- **Pasos:** sin conexión, abrir POS, «En espera», «Ventas» y «Caja».
- **Resultado:**
  - «En espera» y «Ventas» se quedan en «Cargando datos…» sin fin `[23]`.
  - En «Caja» no aparece el panel «Ventas guardadas en este dispositivo» aunque la barra superior dice «Offline · 1» `[24]`. «Mis incentivos» tampoco aparece.
- **Causa:** las consultas tienen `networkMode` «online» por defecto y React Query las pausa: `isPending` queda en `true` y `QueryState` muestra el cargando (`helpers.tsx:89`). Esto incluye la consulta local de IndexedDB `pending-sales` (`Management.tsx:1415-1419`).
- **Impacto:** el manual (§8) manda revisar «Caja › Ventas guardadas en este dispositivo», que sin conexión no se muestra. La ruedita infinita hace pensar que la app está colgada.
- **Arreglo:**
  - `networkMode: "always"` para las consultas locales (Dexie).
  - En `QueryState`, si `fetchStatus === "paused"`, mostrar «Sin conexión: esta información necesita internet» con «Reintentar».

### M4. El selector de cliente no tiene búsqueda y el cliente es obligatorio en cada venta
- **Pasos:** F12 sin cliente, o F4. Se ve una lista plana de todos los clientes, sin campo de búsqueda `[11]` `[17]`.
- **Causa:** `POS.tsx:1203-1227`. El servidor obliga al cliente siempre (`apps/api/src/admin.ts:633,666`, `requireCustomer: true`).
- **Impacto:** con cientos de clientes reales, cada venta de mostrador exige desplazarse por la lista. La guía sugiere crear «Consumidor final», que queda perdido entre la «C» y la «D».
- **Arreglo:** buscador por nombre, teléfono o cédula con foco automático y Enter para elegir. Cliente predeterminado «Consumidor final» fijado arriba y elegible con una tecla.

### M5. El cierre ciego contradice lo que promete: tras cerrar, la cajera ve los totales del sistema
- **Pasos:** la cajera cierra con efectivo 5×1000, tarjeta 0 y transferencia 0.
- **Resultado:**
  - Primero aparece «Para cerrar con estos conteos, agrega una nota que explique la situación.», que ya revela un descuadre.
  - Tras cerrar, el cuadre que se le muestra e imprime dice «3-Tarjetas 2,800.00» (lo del sistema, no lo que ella declaró), «10-Total en venta efectivo 1,900.00» y «Créditos vendidas 300.00» `[59]`.
  - La pantalla de Caja dice que los esperados y las diferencias «se mostrarán únicamente a administración» (`Management.tsx:1540`). La ventana de cierre dice «La comparación aparece después de cerrar» (`Tienda.tsx:195`). El manual (§7) dice «la cajera no debe verlo».
- **Impacto:** los textos se contradicen. Con el tiempo, la cajera aprende cuánto espera el sistema. El cuadre impreso no distingue lo declarado de lo esperado en tarjeta y transferencia, y eso confunde.
- **Arreglo:** decidir la política. Si la cajera no debe ver los esperados, imprimir para ella un cuadre sin las líneas del sistema y reservar el completo a gerencia. Si sí debe verlos, cambiar los textos de la pantalla y del manual. En los dos casos, imprimir «Declarado / Sistema / Diferencia» por método.

### M6. Devoluciones y reimpresión: el formulario es incómodo y no se puede reimprimir el ticket de 80 mm
- **Pasos:** administradora › Ventas › Devolver `[43]`.
- **Resultado:**
  - Un solo artículo por devolución: para varios hay que repetir el formulario (`Management.tsx:2895-2907`).
  - No muestra el importe que se va a reembolsar antes de guardar.
  - Al guardar dice solo «Cambios guardados.» (`helpers.tsx:156`), sin número de nota ni monto, y no imprime la nota.
  - Si la caja no tiene efectivo, el error es claro («No hay suficiente efectivo en la caja para este reembolso…»).
  - Desde Ventas no se puede reimprimir el ticket térmico, solo el PDF tamaño carta. La guía del primer día lo admite.
  - La búsqueda de Ventas es solo por número de factura: buscar «Lucía» devuelve 0 filas (`Management.tsx:2589-2593`).
- **Impacto:** devoluciones lentas y con riesgo de error delante de la clienta. No se puede volver a dar un ticket perdido.
- **Arreglo:**
  - Devolución de varias líneas con el total calculado a la vista.
  - Aviso con «Nota NC-… por RD$…» e impresión automática en 80 mm.
  - Botón «Reimprimir ticket» en el detalle de la venta.
  - Búsqueda por cliente.

### M7. «Limpiar» vacía el carrito con un toque, sin confirmación ni deshacer
- **Dónde:** `POS.tsx:1053`, entre «Cotizar» y el borde del panel. Comprobado: 1 línea, un clic, 0 líneas.
- **Impacto:** un toque por error (en tableta o celular) borra una venta grande.
- **Arreglo:** confirmación si hay más de 1 artículo, o un aviso con «Deshacer» durante 8 s.

### M8. El ticket no muestra la variante: dos «Shaker FitStore» no se distinguen
- **Dónde:** `POS.tsx:1595-1603`: `snapshot.name = product.name` sin talla, color, sabor ni tono `[14]`.
- **Impacto:** la clienta y el control en la puerta no ven qué talla o tono se cobró. Las devoluciones se complican.
- **Arreglo:** usar `name + " · " + attrLabel(attributes)` en el snapshot y en el PDF.

### M9. Los manuales no coinciden con las pantallas en el modo sin conexión
- **`docs/MANUAL-CAJERO.md`:**
  - §8 habla de «Sin conexión», pero la pantalla dice «Offline» (`App.tsx:809`).
  - §8 dice «Gerencia revisa cliente, stock, precio y pago antes de reintentar», y la gerencia no puede ver ni descartar esas ventas (A2).
  - §8 manda a «Caja › Ventas guardadas…», que sin conexión no aparece (M3).
  - Las capturas, según el propio manual, son del lote P2 y no de la interfaz final.
  - §7 promete un cierre ciego que el cuadre impreso no cumple (M5).
- **`docs/GUIA_PRIMER_DIA.md` (rama `claude/guia-primer-dia`, `0f8c83d`):**
  - Coincide con la interfaz en botones y textos: Abrir caja, Trasladar caja aquí, «¿Sigues ahí?», Offline, Venta al por mayor, Cerrar y arquear, «agrega una nota…», reportes e incentivos. Todos existen.
  - No dice que el cierre por inactividad sin conexión impide volver a entrar (A3).
  - No dice qué hacer con un conflicto que bloquea el cierre (A2).
  - Su consejo de crear «Consumidor final» no basta: el ticket imprime «Consumidor final» siempre (A1).
- **Arreglo:** actualizar los dos documentos después de corregir A1, A2, A3 y M3, y regenerar las capturas (`docs/CAPTURAS_MANUAL.md`).

---

## BAJO

| ID | Hallazgo | Dónde / evidencia | Arreglo propuesto |
|---|---|---|---|
| B1 | Botón de conexión y sincronización de 15×15 px en celular (único acceso a «Sincronizar» fuera de Caja). Iconos de tabla de 28×36 px. Campo de descuento global de 34×22 px. | `App.tsx:790-812`, salida de s3 | Área táctil ≥ 44 px; en móvil, mostrar «Offline · n» como chip. |
| B2 | Textos en inglés: «Offline», tipos de alerta crudos («offline conflict», «low stock», «receivable»). | `App.tsx:809`, `Management.tsx:2504` `[51]` | «Sin conexión»; tabla de etiquetas en español. |
| B3 | Nombres propios fijos en el cobro: «Sólo Marcos o Genesis podrán registrar…» (sin tilde, a diferencia del manual). | `POS.tsx:2009-2015` | Sacarlo de Ajustes o usar «la administración». |
| B4 | Cada vez que entra una cajera hay un 403 `/api/dashboard/summary` (se dibuja «Resumen» antes de redirigir al POS). Es ruido en consola y en Sentry. | `App.tsx:405` (página inicial `dashboard`), `502-510` | Elegir la página inicial según los permisos antes del primer render. |
| B5 | Bundle: chunk principal de 1,01 MB (320 KB gzip) más recharts de 374 KB (110 KB gzip), cargado al iniciar sesión incluso para la cajera, que no ve gráficos. `manualChunks.react-vendor` sale vacío. Precache de 2,03 MB. Percepción: inicio de sesión en 3,4 s (3G rápido y CPU ×4) y catálogo en 4,0 s; con 4G, 1,1 s y 2,0 s. | `vite.config.ts` (`manualChunks`), salida del build | `React.lazy` para Dashboard, Reportes e Incentivos; corregir el chunk de React. |
| B6 | Atajos globales F7, F9 y F10 sacan del POS (F10 está junto a F12, «Cobrar»). El carrito se conserva en memoria. El tabulador recorre hasta 120 tarjetas antes de llegar al carrito (hay enlace de salto). | `App.tsx:559-577` | Desactivar F7, F9 y F10 dentro del POS o pedir confirmación; `tabindex` agrupado en la cuadrícula. |
| B7 | «Venta al por mayor» no cambia el precio aunque el modelo tiene `wholesalePrice`. El nombre puede inducir a error (el título solo aparece al pasar el ratón). | `Incentives.tsx:90-112`, `catalog.ts:164` `[38]` | Renombrar a «Marcar como venta al por mayor (incentivo ½)». |
| B8 | Las alertas de stock bajo repiten el nombre sin la variante: «Glutamina Pure: 3 unidades» dos veces. | Resumen `[02]` | Incluir la variante (sabor, talla). |
| B9 | La lista «En espera» no muestra cliente ni total, solo fecha y artículos. | `POS.tsx:1368-1395` `[41]` | Añadir cliente, total y quién la guardó. |
| B10 | En celular, el botón «Cobrar» muestra «F12» y tocar una tarjeta no da ningún aviso (en escritorio sí: «X agregado.»). | `POS.tsx:1063-1079`, `choose()` | Ocultar `kbd` en táctil; aviso o vibración al agregar. |
| B11 | El texto de ejemplo del usuario en el inicio de sesión es «mfeliz» (parece un usuario real). No hay forma de cambiar la contraseña desde la app (la guía manda a llamar a soporte). No hay «mostrar contraseña». | `App.tsx:341` | Texto genérico; «Cambiar mi contraseña» en el menú de la cuenta. |
| B12 | Importar factura: un código de barras exacto de una variante con descripción distinta obliga a elegir la variante a mano («la descripción no coincide»). | Mercancía `[56]` | Si el código identifica una sola variante, preseleccionarla y mostrar la diferencia de descripción como aviso. |
| B13 | «Cambiar vendedor con PIN»: si `/staff` falla (sin conexión), la promesa queda sin manejar y no se ve nada. | `App.tsx:852-856` | `try/catch` con aviso «Necesitas conexión para cambiar de vendedor». |

---

## No verificado
- Impresión física en una térmica de 80 mm real (solo vista de impresión `@media print` `[14]` `[40]` `[59]`) y diálogo de impresión del navegador o del kiosco.
- Lector de códigos físico (se simuló con teclas a 5-8 ms) y cámara (`@zxing/browser`).
- Lectores de pantalla reales (NVDA, VoiceOver, TalkBack). Solo axe-core automático, con 0 violaciones.
- Safari o iOS, Android real, aplicaciones Capacitor y Tauri.
- Recarga real por un service worker nuevo durante una venta (deducida del código de `vite-plugin-pwa/register.js`, ver M1).
- Que «Reintentar» sincronice un conflicto de stock después de que gerencia ajuste el inventario (A2). Regla de 48 h para ventas sin conexión.
- Cerrar la ventana de cobro (clic fuera o Esc) mientras dice «Registrando…» (posible venta sin recibo a la vista).
- Varias pestañas del mismo equipo a la vez. Uso prolongado (memoria, SSE de horas).
- Importación de catálogo Excel, plantilla de mercancía, subida de logo, Telegram, contenido del PDF de factura y de la nota de crédito, enlaces reales de WhatsApp y correo.
- Contraste en tema oscuro de los impresos y de las ventanas (axe solo en POS oscuro).
- Comportamiento con un catálogo real de miles de productos (la semilla tiene 60 productos y 228 variantes).

## Índice de capturas (`capturas/`)
| Nº | Contenido |
|---|---|
| 01–04 | Inicio de sesión en escritorio y celular; Resumen de la administradora; inicio de la cajera en celular con el equipo pendiente de aprobación |
| 05–08 | Aprobación del equipo; Caja sin abrir; ventana de apertura; caja abierta (cierre ciego) |
| 09–14 | Escaneo, código no encontrado, carrito a 1280, selector de cliente sin búsqueda, cobro, venta registrada, ticket impreso (A1, M8) |
| 15–21 | Celular: variantes, botón «Cobrar» fijo, selector, cobro con aviso pegado (M2), recibo, Caja, menú |
| 22–26 | Sin conexión: recibo LOCAL, «En espera» cargando sin fin (M3), Caja sin panel de pendientes (M3), productos, recarga sin conexión |
| 27–30b | Conflicto y bloqueo del cierre (A2); caja en otro equipo; la gerente no aparece en «Cambiar vendedor» |
| 31–33 | Aviso de inactividad, sesión cerrada sin conexión, inicio de sesión imposible sin conexión (A3) |
| 34, 34b | Códigos pegados al escanear durante la carga y resultado (A4) |
| 35–36 | Servidor caído y respuesta perdida: venta local sin duplicado |
| 37–41 | Descuento con PIN, venta al por mayor, contraentrega, ticket de contraentrega con «Consumidor final» (A1), ventas en espera |
| 42–52 | Pantallas de la administradora: Caja, devolución, Mercancía, Incentivos, Configuración, Reportes, Clientes, Inventario, Compras, Alertas, Equipos |
| 53–54 | Cambio obligatorio de contraseña (390 px); inicio del rol almacén |
| 55–56 | Código ambiguo; importación de factura CSV |
| 57 | Carrito con 5 líneas a 1366×768 y a 1920×1080 (A5) |
| 58–59 | Ventana de cierre ciego; cuadre impreso de la cajera con totales del sistema (M5) |
| barrido-* | Barrido de todas las pantallas de la administradora a 1280 y 390 px |
