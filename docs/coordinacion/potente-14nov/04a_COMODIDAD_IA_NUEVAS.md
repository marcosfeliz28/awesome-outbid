# 04a · Propuesta: comodidad, IA útil y empleadas nuevas (14-nov-2026)

Fase 4, solo lectura. Código leído: rama `investigacion/potente-14nov` (HEAD `e959914`). `git diff origin/nexora-cloud HEAD -- apps packages` sale vacío, así que el código es el mismo de `nexora-cloud` `ed5826f`. Cada `archivo:línea` lo abrí yo con `sed -n` o `grep -n`. La app no se ejecutó.

Competencia: solo datos de `02_TABLA_EMPRESAS.md` con estado **V** (verificado), **F1** (fuente oficial de fase 1) o **T** (marcado «solo tercero»). Lo «sin fuente» no se usa. Si nadie de la tabla lo publica, lo digo.

Ya decidido y **no se repite**: C1–C16 y D1–D12 (`LEVANTAMIENTO_MEJORAS_IA_12NOV.md`) y el catálogo `origin/consulta/catalogo-13nov` (EST, DIS, COM, SEG, EFI, MOD). Aquí solo se citan por código.

Reglas de dinero que respetan todas: margen = (precio − costo)/precio sin restar ITBIS; mínimo 15 %; ninguna oferta cambia un precio (la caja aplica el descuento); nada se aplica sobre lo que la dueña contó o cambió ayer u hoy.

**Marca de IA** (va en cada propuesta con IA): **[IA: propone · humano confirma · tope · roles]**. Quiere decir:

1. La IA solo deja un borrador y nunca escribe en ventas, inventario, precios ni pagos.
2. Lo confirma una persona con el permiso que ya exige esa acción, y su PIN cuando la acción ya lo pide.
3. Toda llamada cuenta contra un tope (los de hoy o PC-IA-02).
4. La IA ve lo mismo que el rol de quien pregunta. La vendedora nunca ve costos (`apps/api/src/common.ts:368-370`).

**Corrección a 03 §1 y §7.3:** la caja **sí** muestra el contador de ventas sin subir. En la cabecera sale «En línea / Sin conexión · N», con el texto de ayuda «N ventas pendientes» (`apps/web/src/App.tsx:1124-1149`). No se propone de nuevo.

---

## 1. Comodidad de caja y administración

### PC-COM-01 · Pestañas «Más vendidos» y «En oferta» al principio de la caja

- **Competidores:** Square tiene pestañas «Favorites / Clearance» sobre la cuadrícula (**V**, captura `capturas/square.png`; https://squareup.com/gb/en/point-of-sale/retail/pricing). Loyverse usa mosaicos de color para atajos (**V**, captura; https://loyverse.com/pricing).
- **Norexos hoy:** tiene pestañas «Todos los productos» y una por cada categoría con productos (`apps/web/src/POS.tsx:1039-1058`) y una sola cuadrícula (`POS.tsx:1622`). «Los favoritos de tu tienda» existe solo como estadística en el Resumen (`apps/web/src/Dashboard.tsx:539`).
- **Propuesta:** dos pestañas fijas antes de las categorías:
  - «Más vendidos»: los 12 más vendidos de 30 días, más los que la dueña fije.
  - «En oferta»: productos con promoción activa, con la etiqueta de la promoción. El precio que se muestra es el de siempre y el descuento lo aplica la caja.
- **Esfuerzo:** P · **¿Toca dinero?** No (solo filtra lo que se ve).
- **Cómo se comprobaría:**
  1. Prueba de componente: con 3 ventas falsas, la pestaña ordena bien.
  2. Prueba e2e: un producto en promoción sale en «En oferta» con su precio de lista sin cambiar.
  3. Comparar el total de una venta hecha desde la pestaña con la misma venta hecha desde «Todos».

### PC-COM-02 · «Probar equipo» al abrir la caja

- **Competidores:** Square tiene siempre visible una barra «Reader / 1 printer / Scanner» (**V**, captura `capturas/square.png`).
- **Norexos hoy:** la cabecera solo muestra la conexión y las ventas pendientes (`apps/web/src/App.tsx:1124-1149`). No hay barra de periféricos (03 §1, y yo no la encontré).
- **Propuesta:**
  - Al abrir caja, un paso opcional de unos 20 s: imprimir un ticket de prueba, escanear cualquier código y abrir el cajón (esto último cuando exista **MOD-03**).
  - Cada prueba se marca bien o mal y queda la hora de la última que salió bien.
  - Un icono pequeño en la cabecera repite ese estado.
  - Es necesario porque el navegador no puede saber solo si la impresora está conectada.
- **Esfuerzo:** M · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba e2e con un escáner simulado (teclado): el estado pasa a «bien».
  2. Sin pulsar «Imprimir», el estado queda «sin probar».
  3. En la tienda, la gerente lo hace una mañana y confirma.

### PC-COM-03 · Tope de descuento por persona (opcional), además del general

- **Competidores:**
  - Kyte permite activar o quitar «descuentos» por perfil (**V**, https://kyteapp.com/pricing).
  - Fudo tiene PIN de autorización, solo en el plan Pro (**V**, https://fu.do/precios).
  - Shopify tiene PIN de gerente (**F1**).
- **Norexos hoy:** hay un solo tope para todas las vendedoras: `sellerDiscountLimit` (`apps/api/src/admin.ts:84`), aplicado en `apps/api/src/sales.ts:640` (10 % por defecto). La caja lo muestra en `apps/web/src/POS.tsx:1219` y `:1960-1971`, y la dueña lo edita en `apps/web/src/Management.tsx:4273`.
- **Propuesta:**
  - Un campo opcional «Tope de descuento» en cada usuaria. Si está vacío, se usa el general.
  - El servidor usa el menor entre el tope de la persona y el general.
  - No cambia `safeDiscount` (piso de margen 15 %) ni el motivo obligatorio.
- **Esfuerzo:** M · **¿Toca dinero?** **Sí** (descuentos).
- **Cómo se comprobaría:**
  1. Prueba de API en tres casos (tope personal menor, mayor y vacío): pide PIN exactamente por encima del menor.
  2. Prueba e2e de la caja con el texto «hasta N % sin PIN».
  3. Venta real de prueba revisada con la dueña.
  4. Verificación triple antes de desplegar, por ser ruta de dinero.

### PC-COM-04 · Franja de estado fiscal para la dueña, sin tapar el trabajo

- **Competidores:** Alegra RD muestra un modal con cuenta regresiva del plazo DGII (**V**, captura `capturas/alegra-rd.png`). Es el contraejemplo porque tapa la pantalla. El plazo para pequeños y micro es el **15-nov-2026** (DGII, **V**, https://dgii.gov.do/noticias/Paginas/-100-mil-contribuyentes-ya-son-emisoreselectronicos.aspx).
- **Norexos hoy:** solo hay un texto en Ajustes: «NCF/e-CF reservado para integración futura. Los recibos son internos.» (`apps/web/src/Management.tsx:4410-4413`).
- **Propuesta:**
  - Una franja de una línea en el Resumen, solo para quien tiene `*`: «Los recibos de Norexos no son fiscales. NCF: por medio externo».
  - Lleva un enlace a la decisión pendiente (**EST-04**).
  - Se puede cerrar por 7 días. No aparece en la caja ni a la vendedora.
- **Esfuerzo:** P · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba e2e con rol admin: se ve. Con rol seller: no se ve.
  2. Al cerrarla, vuelve a los 7 días (reloj simulado).

### PC-COM-05 · «Ver como este rol» al editar permisos

- **Competidores:**
  - Kyte describe los permisos con ejemplos («ver pedidos ajenos, descuentos, crear productos») (**V**).
  - Alegra tiene roles predefinidos y «Personalizar roles» (**V**, https://www.alegra.com/rdominicana/precios/).
  - Lightspeed llega a 21 roles (**F1**).
- **Norexos hoy:** los roles de fábrica y sus claves están en `packages/shared/src/index.ts:760-790`. **D5** (etiquetas en español) y **EST-11** (permisos con nombre) cubren cómo se leen, pero no hay forma de ver el resultado antes de guardarlo.
- **Propuesta:** en la edición de un rol, un botón «Ver como este rol». Muestra el menú y la caja en solo lectura, con los permisos marcados y sin guardar nada. Debajo, en frases: «Podrá cobrar; no verá costos; no verá el esperado de caja; necesitará PIN para más de N %».
- **Esfuerzo:** M · **¿Toca dinero?** No (solo lectura).
- **Cómo se comprobaría:**
  1. Prueba de componente: para el rol seller, «Costos» y «Utilidad» no aparecen, igual que en una sesión real de vendedora.
  2. Prueba de API: la vista previa no hace ninguna escritura (el contador de la bitácora no sube).

### PC-COM-06 · Inglés en la caja para la versión que se vende (producto)

- **Competidores:**
  - Square sigue el idioma del equipo en EN/ES/FR/JA (**V**, https://squareup.com/help/au/article/5226).
  - La app de Shopify POS trae español (**V**, https://help.shopify.com/manual/sell-in-person/faq).
  - Las de LatAm y RD son solo en español.
- **Norexos hoy:**
  - Solo español: `apps/web/index.html:2` (`lang="es"`).
  - Según 03 §5, el borrador de traducción está fuera del código (`docs/i18n/borrador/`), sin verificar y sin librería de traducción. Yo no abrí esos archivos.
- **Propuesta:** solo para la edición producto. Empezar por la caja y el recibo. Seguir el idioma del equipo con un selector en «Mi cuenta». Montos y fechas siempre en formato RD (`RD$`, día/mes). En la tienda no cambia nada.
- **Esfuerzo:** G · **¿Toca dinero?** No (solo textos; los montos no cambian).
- **Cómo se comprobaría:**
  1. Prueba e2e de una venta completa en `en`: el total y el ITBIS son idénticos a los de `es`.
  2. Una prueba falla si queda algún texto sin clave en la caja.
  3. Revisión humana del glosario.

---

## 2. IA útil

### PC-IA-01 · Bandeja única «Propuestas de la IA» · [IA: propone · humano confirma · tope · roles]

- **Competidores:**
  - Toast IQ se anuncia como «asistente de IA que actúa» (**V**, https://pos.toasttab.com/products/toast-iq). Es lo contrario de lo que se busca aquí.
  - Shopify Sidekick y Lightspeed proponen y el dueño aprueba (**F1**, patrón 7 de la tabla).
- **Norexos hoy:** la lectura de facturas ya «siempre pasa por revisión humana» (`apps/api/src/invoice.ts:322`). El asistente es solo de lectura y lo puede usar cualquier persona autenticada (`apps/api/src/assistant.ts:657`, `:672`). No hay un lugar común donde esperen los borradores de la IA.
- **Propuesta:**
  - Una tabla y una pantalla de «propuestas», cada una con: origen (factura, voucher **C4**, banco **D6**, entrada **D8**, PC-IA-03/04/07), estado (pendiente, aprobada, rechazada o vencida), quién aprobó, rol exigido y diferencia con lo actual.
  - Al aprobar, se llama a la misma ruta de siempre con los permisos y el PIN de siempre. La IA no tiene ruta propia de escritura.
  - Las propuestas vencen a los 7 días y todo queda en la bitácora.
- **Esfuerzo:** M · **¿Toca dinero?** **Sí** al aprobar una propuesta de dinero (por la ruta existente). La bandeja en sí, no.
- **Cómo se comprobaría:**
  1. Prueba de API: una propuesta aprobada por una seller para una acción de `inventory:write` da 403.
  2. Una propuesta aprobada dos veces no duplica nada (clave de operación, **SEG-07**).
  3. Prueba de que el módulo de IA no importa ningún servicio que escriba.

### PC-IA-02 · Tope de gasto mensual de IA en RD$, con aviso al 80 % · [IA: tope · roles]

- **Competidores:** ninguno de la tabla publica un tope de gasto de IA para el dueño. Fudo cobra la Recepcionista IA como extra fijo de USD 40 (**V**, https://fu.do/precios). Odoo deja la «Agentic AI» en el plan Custom (**V**, https://www.odoo.com/pricing).
- **Norexos hoy:**
  - Hay topes **diarios**: asistente de 10 o 30 por sucursal (`apps/api/src/assistant.ts:26`, `:46-58`) y 30 lecturas de factura por persona (`apps/api/src/ai-daily-limit.ts:5`, `:26-28`).
  - El medidor muestra el costo en US$ o «sin precio» (`apps/web/src/AiUsage.tsx:24-25`, `:77`).
  - **D11** solo cambia cómo se muestra. No hay tope mensual de dinero.
- **Propuesta:**
  - La dueña fija un «Tope mensual de IA (RD$)».
  - Al 80 % le llega un aviso por Telegram (canal existente, `apps/api/src/notifications.ts:1-7`).
  - Al 100 % la IA se apaga hasta el mes siguiente, salvo que la dueña la vuelva a encender.
  - Lo ya reservado no se corta a mitad de una llamada. Mientras falte el precio del modelo, se cuenta con el precio más alto conocido.
- **Esfuerzo:** P–M · **¿Toca dinero?** No (gasto del proveedor, no de la caja).
- **Cómo se comprobaría:**
  1. Prueba unitaria con uso simulado al 79, 80 y 100 %.
  2. Prueba de concurrencia, con el mismo patrón de bloqueo que `ai-daily-limit.ts`: dos llamadas simultáneas no pasan el tope.
  3. Comparar el total del mes contra la factura del proveedor.

### PC-IA-03 · Descripciones de producto en borrador, aprobadas en lote · [IA: propone · humano confirma · tope · roles]

- **Competidores:** Square hace descripciones y fotos de producto con IA (**F1**). Kyte GROW hace descripciones con IA (**V**, https://kyteapp.com/pricing).
- **Norexos hoy:** el producto tiene `description` vacía por defecto (`apps/api/prisma/schema.prisma:102`) y un campo «Descripción» en el formulario (`apps/web/src/Management.tsx:295`). No encontré nada que la llene.
- **Propuesta:**
  - Un botón «Sugerir descripciones» en Productos, solo para `catalog:write`.
  - La IA escribe 2 o 3 líneas (para qué es, tamaño, sabor), solo con el nombre, la marca y los atributos que ya existen.
  - Sin afirmaciones de salud ni dosis: los suplementos piden cuidado.
  - Se aprueban, editan o descartan en lote. Nunca toca precio, costo ni existencia.
- **Esfuerzo:** P · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba de API: la respuesta solo puede escribir `description` (esquema estricto).
  2. Prueba: una seller recibe 403.
  3. La dueña revisa una muestra de 10 antes de activarlo para todo el catálogo.
  4. Cuenta contra el tope (PC-IA-02).

### PC-IA-04 · Producto nuevo desde foto de etiqueta o código de barras · [IA: propone · humano confirma · tope · roles]

- **Competidores:** Kyte PRIME tiene «alta automática de productos» (**V**). Lightspeed AI Doc Import pasa la factura a una orden de compra (**F1**).
- **Norexos hoy:** la IA lee fotos y PDF de facturas con un modelo dedicado (`apps/api/src/invoice.ts:322-324`). En `invoice.ts` no encontré creación de productos nuevos (grep de `product.create`, sin resultados). El alta es manual.
- **Propuesta:**
  - Una foto de la etiqueta produce un borrador con nombre, marca, tamaño, sabor, categoría sugerida y código de barras.
  - **Precio y costo quedan vacíos.** Los pone la persona, viendo el margen y el aviso de menos de 15 % de **COM-03**.
  - El borrador va a la bandeja PC-IA-01.
- **Esfuerzo:** M · **¿Toca dinero?** No en lo que hace la IA. El precio lo escribe la persona por la ruta existente.
- **Cómo se comprobaría:**
  1. Prueba: el esquema de salida no tiene campos de precio ni costo.
  2. Prueba e2e: no se puede guardar el borrador sin precio, y el margen se muestra.
  3. Prueba con 5 fotos reales de la tienda, comparadas a mano.

### PC-IA-05 · Consultas desde la app de Claude (conexión MCP de solo lectura) · [IA: roles · tope]

- **Competidores:** Alegra publica «conexión MCP» (**V**, https://www.alegra.com/rdominicana/precios/).
- **Norexos hoy:** el asistente solo vive dentro de la app (`apps/api/src/assistant.ts:44` modelo, `:657` y `:672` rutas) y trae la regla de margen en sus instrucciones (`assistant.ts:460`).
- **Propuesta:**
  - Un servidor MCP con las **mismas** herramientas de solo lectura del asistente, autenticado con un token personal que se pueda revocar.
  - Cada consulta pasa por los mismos filtros de rol: la vendedora nunca recibe costos (`apps/api/src/common.ts:368-370`).
  - Nada de escribir.
  - Sin datos personales de clientes (Ley 172-13, como ya hace `notifications.ts:9-10`).
- **Esfuerzo:** M · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba de API: con un token de seller, la herramienta de margen falla.
  2. Un token revocado da 401.
  3. Una auditoría con la skill `seguridad-20` antes de abrirlo.
  4. La dueña hace 3 preguntas y compara las respuestas con los reportes.

### PC-IA-06 · Recepcionista por WhatsApp para GV (cursos y citas) · [IA: propone · humano confirma · tope · roles]

- **Competidores:** Fudo tiene una Recepcionista IA por WhatsApp para reservas y consultas, a +USD 40 al mes (**V**, https://fu.do/precios).
- **Norexos hoy:**
  - Citas e inscripciones de GV con permisos `gv:*` (`apps/api/src/gv-citas.ts:322-545`) y lista de «interesadas» (`apps/web/src/GvInteresadas.tsx:1`).
  - No hay entrada por WhatsApp.
  - Los avisos salen por Telegram (`apps/api/src/notifications.ts:1`).
- **Propuesta:**
  - Responde con los horarios y cursos **publicados**.
  - Deja una «interesada» o una «solicitud de cita» en estado pendiente, que GV confirma.
  - No cobra, no confirma pagos y no da precios distintos de los publicados.
  - Respeta el tope y pasa a una persona si no entiende.
- **Esfuerzo:** G · **¿Toca dinero?** No (no toca pagos).
- **Cómo se comprobaría:**
  1. Prueba: el agente no tiene herramientas de pago.
  2. 20 conversaciones de prueba revisadas por GV.
  3. Toda cita creada queda «pendiente» hasta que una persona con `gv:write` la confirme.

### PC-IA-07 · Conteo dictado que llena la hoja de conteo · [IA: propone · humano confirma · tope · roles]

- **Competidores:** Square tiene conteo con cámara (**F1**).
- **Norexos hoy:** la caja ya tiene búsqueda por voz (`apps/web/src/POS.tsx:990-995`). La hoja de conteo de muchos productos está propuesta en **COM-01**.
- **Propuesta:**
  - Dentro de **COM-01**, la empleada dicta: «proteína X vainilla 5 libras, doce».
  - La IA empareja el producto y la cantidad y lo deja en la hoja como borrador. Ella confirma cada línea.
  - Aplicarla sigue el instructivo `mercancia`: el conteo se verifica 4 veces y la dueña lo confirma.
  - No se tocan productos que la dueña contó ayer u hoy.
- **Esfuerzo:** M · **¿Toca dinero?** **Sí** (el conteo termina en ajuste), pero la IA solo llena el borrador.
- **Cómo se comprobaría:**
  1. Prueba: un dictado ambiguo deja la línea «por elegir» y no adivina.
  2. Prueba: aplicar exige el flujo de **COM-01** y **SEG-06**.
  3. Comparar 20 líneas dictadas contra un conteo hecho a mano.

---

## 3. Facilidad para empleadas nuevas

### PC-NEW-01 · Hoja de bienvenida al crear una usuaria (sin contraseña)

- **Competidores:** nadie de la tabla publica algo así. Lo más cercano son los roles predefinidos de Alegra (**V**).
- **Norexos hoy:** al crear la usuaria ya se exige cambiar la contraseña, la temporal vence y se guarda su PIN (`apps/api/src/admin.ts:1092-1105`; `schema.prisma:27-31`). También tiene número de cajero (`schema.prisma:39-40`). No se le entrega nada que explique su puesto.
- **Propuesta:**
  - Al guardar, un botón «Imprimir hoja de bienvenida»: usuario, número de cajero, qué puede y qué no puede hacer (en frases sacadas de su rol, como PC-COM-05), atajos F2/F4/F8/F12 y a quién pedir el PIN.
  - **Nunca** imprime la contraseña ni el PIN.
- **Esfuerzo:** P · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba de componente: el texto de la hoja no contiene la contraseña temporal ni el PIN.
  2. Para el rol seller dice «no verás costos».
  3. Una empleada nueva la lee y la gerente confirma que se entiende.

### PC-NEW-02 · Recorrido de 5 pasos la primera vez que entra a Caja

- **Competidores:** sin dato en la tabla (03 §1: «Modo práctica: ninguna con fuente»).
- **Norexos hoy:** no encontré recorrido ni ayuda de primer ingreso (grep de «tour», «onboarding», «primer ingreso» y «primeros pasos» en `App.tsx`, `POS.tsx` y `Management.tsx`: solo sale la bienvenida del login, `apps/web/src/App.tsx:466`). Es distinto de **MOD-01** (caja de práctica) y **MOD-02** (arranque del negocio).
- **Propuesta:**
  - Cinco globos sobre la caja real: buscar (F2 y voz), agregar, cliente (F4), cobrar (F12) y «En espera / Cotizar» (`POS.tsx:1325-1338`).
  - Se puede saltar y se vuelve a ver desde «Mi cuenta». Se guarda como visto por usuaria.
- **Esfuerzo:** P–M · **¿Toca dinero?** No (no cobra ni guarda ventas).
- **Cómo se comprobaría:**
  1. Prueba e2e: sale solo en el primer ingreso y no bloquea F12 ni el cobro.
  2. Prueba de accesibilidad: se cierra con Esc y el foco vuelve a la caja.

### PC-NEW-03 · Periodo de prueba de la empleada nueva

- **Competidores:** Kyte tiene permisos por perfil, incluido «descuentos» (**V**). Fudo tiene PIN de autorización (**V**, Pro). Facturapp tiene caja con PIN (**V**).
- **Norexos hoy:** el tope de descuento es uno solo para todas (`apps/api/src/sales.ts:640`). La gerente aprueba con PIN (`POS.tsx:2127`, `:2540`). No hay estado de «nueva».
- **Propuesta:**
  - Una casilla «En periodo de prueba hasta [fecha]» en la usuaria. Durante el periodo:
    - Tope de descuento 0 % (usa PC-COM-03), así que todo descuento pide PIN.
    - «Cotizar» y «Crédito» ocultos.
  - Al vencer la fecha, se quita sola y avisa a la dueña.
  - No cambia precios ni el piso de 15 %.
- **Esfuerzo:** M (depende de PC-COM-03) · **¿Toca dinero?** **Sí** (descuentos).
- **Cómo se comprobaría:**
  1. Prueba de API: una usuaria en prueba con 1 % de descuento recibe «requiere PIN».
  2. Al día siguiente de la fecha (reloj simulado) ya no lo pide.
  3. Verificación triple antes de desplegar.

### PC-NEW-04 · Botón «Llamar a la gerente» en la caja

- **Competidores:** nadie de la tabla lo publica.
- **Norexos hoy:** la caja pide el PIN del gerente en pantalla (`apps/web/src/POS.tsx:2127`, `:2540`, `:2604`), pero la empleada tiene que ir a buscarla. Telegram ya funciona con una cola durable y sin datos personales (`apps/api/src/notifications.ts:1-12`).
- **Propuesta:**
  - Un botón junto a «Cada venta se registra con tu usuario» (`POS.tsx:1339-1341`) que manda a la gerente de turno: «Caja 1031 pide ayuda: descuento / anulación / no encuentra producto», con el total del carrito y sin cliente.
  - Máximo 1 aviso cada 2 minutos.
- **Esfuerzo:** P–M · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba: el mensaje en la cola no contiene cédula, teléfono ni nombre del cliente.
  2. Prueba: dos toques seguidos dejan un solo aviso.
  3. Prueba real en la tienda con el grupo de Telegram.

### PC-NEW-05 · Ficha rápida del producto para vender

- **Competidores:** Square (**F1**) y Kyte (**V**) generan descripciones de producto. La tabla no muestra que las enseñen en la caja.
- **Norexos hoy:** la tarjeta de la caja muestra categoría, nombre, código, precio y existencia (`apps/web/src/POS.tsx:1659-1678`). No muestra la descripción, aunque existe (`schema.prisma:102`).
- **Propuesta:**
  - Al mantener pulsada la tarjeta, o con un botón «i», se abre una ficha con la descripción (aprobada por la dueña, PC-IA-03), los sabores y tamaños de la variante y la existencia en el otro almacén.
  - Sin costo para la vendedora.
- **Esfuerzo:** P · **¿Toca dinero?** No.
- **Cómo se comprobaría:**
  1. Prueba e2e con rol seller: la ficha no trae costo ni margen.
  2. Agregar desde la ficha da la misma línea que tocar la tarjeta.

### PC-NEW-06 · «Primeras dos semanas»: resumen por empleada nueva para la gerente

- **Competidores:** nadie de la tabla lo publica.
- **Norexos hoy:** cada descuento guarda quién vendió, quién autorizó, el rol, el motivo y el monto (`apps/api/src/sales.ts:1503-1516`). **D1** propone señales para todo el negocio, no seguimiento por persona nueva.
- **Propuesta:**
  - Una tarjeta de solo lectura para quien tiene `sale:manage`, por cada usuaria creada hace menos de 14 días: ventas, descuentos con PIN, anulaciones pedidas, diferencias de cierre y errores repetidos.
  - Sin ranking entre empleadas.
- **Esfuerzo:** M · **¿Toca dinero?** No (solo lectura).
- **Cómo se comprobaría:**
  1. Prueba de API: los números cuadran con la misma consulta hecha a mano sobre la bitácora y las ventas, por dos caminos.
  2. Una seller recibe 403.

---

## Resumen

| ID        | Área                              | Esfuerzo | Dinero              | IA  |
| --------- | --------------------------------- | -------- | ------------------- | --- |
| PC-COM-01 | Pestañas Más vendidos / En oferta | P        | no                  | —   |
| PC-COM-02 | Probar equipo al abrir caja       | M        | no                  | —   |
| PC-COM-03 | Tope de descuento por persona     | M        | **sí**              | —   |
| PC-COM-04 | Franja fiscal para la dueña       | P        | no                  | —   |
| PC-COM-05 | Ver como este rol                 | M        | no                  | —   |
| PC-COM-06 | Inglés en la caja (producto)      | G        | no                  | —   |
| PC-IA-01  | Bandeja de propuestas de la IA    | M        | **sí** (al aprobar) | sí  |
| PC-IA-02  | Tope mensual de IA en RD$         | P–M      | no                  | sí  |
| PC-IA-03  | Descripciones en borrador         | P        | no                  | sí  |
| PC-IA-04  | Producto desde foto de etiqueta   | M        | no                  | sí  |
| PC-IA-05  | MCP de solo lectura               | M        | no                  | sí  |
| PC-IA-06  | Recepcionista WhatsApp GV         | G        | no                  | sí  |
| PC-IA-07  | Conteo dictado                    | M        | **sí**              | sí  |
| PC-NEW-01 | Hoja de bienvenida                | P        | no                  | —   |
| PC-NEW-02 | Recorrido de 5 pasos              | P–M      | no                  | —   |
| PC-NEW-03 | Periodo de prueba                 | M        | **sí**              | —   |
| PC-NEW-04 | Llamar a la gerente               | P–M      | no                  | —   |
| PC-NEW-05 | Ficha rápida del producto         | P        | no                  | —   |
| PC-NEW-06 | Primeras dos semanas              | M        | no                  | —   |

## No comprobado

1. La app no se ejecutó. No vi en pantalla la cabecera, las pestañas ni la tarjeta del producto.
2. Cuántos productos tienen hoy la descripción vacía (no consulté la base).
3. El borrador `docs/i18n/borrador/` (tomado de 03 §5, no lo abrí).
4. Si existe el traspaso de turno entre cajeras sin cerrar caja (Facturapp lo tiene, **V**). No lo busqué, así que no lo propuse.
5. Lo que sea Kyte/Square/Fudo y salga de la tabla tiene la marca de verificación de la tabla. Hoy no volví a abrir sus páginas.
6. Si el cambio de vendedora funciona sin conexión: `App.tsx:1203-1205` dice que hace falta conexión. No lo propuse porque verificar el PIN sin servidor es un riesgo de seguridad.
