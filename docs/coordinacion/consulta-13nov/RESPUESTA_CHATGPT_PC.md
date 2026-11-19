Base: 4fef4d550fc465f2285876fa84ed55e6a6501c5f

# Revisión de diseño y facilidad de uso · ChatGPT PC · 13-nov-2026

## Resumen para la dueña en 10 líneas

1. Las 28 propuestas se evaluaron contra el código de la base indicada; ninguna quedó «no abierta».
2. Recomiendo 23, pero 19 necesitan cambios de alcance o de ejecución; no conviene construir el catálogo literalmente.
3. Lo primero es evitar cifras falsas durante fallos, mostrar el margen al editar precios y encontrar créditos sin recorrer listas.
4. En móvil, Inventario, Clientes, Ventas y Resumen siguen siendo páginas demasiado largas para trabajo diario.
5. El POS ya tiene una barra móvil fija de carrito/cobro; retiro mi propuesta inicial que pedía crearla.
6. No guardaría datos de tarjeta en el equipo para recuperar el cobro: protegería el cierre accidental mientras hay datos escritos.
7. Conteos masivos, devoluciones y traspasos valen la pena, pero deben empezar con la tienda cerrada y pruebas de dinero.
8. El instalador necesita arranque guiado; impresión directa y cajón esperan la prueba con impresora, gaveta y Windows reales.
9. C1, C6, C13 y C15 pasaron en la aplicación local y tienen capturas; F4 conservó su comportamiento.
10. No se cambió código, no se desplegó y no se usaron datos de producción; todo lo creado es documentación y evidencia local.

## Tabla de veredictos

| ID | Veredicto | Impacto | Esfuerzo | Riesgo | Pantalla |
|---|---|---:|:---:|:---:|:---:|
| DIS-01 | apoyo con cambios | 4 | P | bajo | no |
| DIS-02 | apoyo con cambios | 4 | M | medio | no |
| DIS-03 | apoyo con cambios | 3 | M | medio | sí |
| DIS-04 | apoyo con cambios | 4 | M | medio | sí |
| DIS-05 | apoyo con cambios | 3 | G | alto | sí |
| DIS-06 | apoyo con cambios | 3 | P | medio | no |
| DIS-07 | apoyo con cambios | 3 | G | alto | sí |
| DIS-08 | apoyo con cambios | 3 | G | alto | sí |
| DIS-09 | apoyo | 4 | M | bajo | no |
| COM-01 | apoyo con cambios | 5 | G | alto | sí |
| COM-02 | apoyo con cambios | 4 | M | medio | sí |
| COM-03 | apoyo con cambios | 5 | P | bajo | sí |
| COM-04 | apoyo con cambios | 4 | P | medio | sí |
| COM-05 | apoyo | 4 | M | alto | no |
| COM-06 | apoyo con cambios | 4 | M | alto | no |
| COM-07 | apoyo con cambios | 5 | M | medio | sí |
| COM-08 | apoyo con cambios | 4 | P | bajo | sí |
| COM-09 | apoyo con cambios | 4 | M | medio | sí |
| COM-10 | apoyo con cambios | 4 | M | medio | sí |
| COM-11 | apoyo con cambios | 4 | M | medio | sí |
| COM-12 | apoyo con cambios | 5 | M | alto | sí |
| COM-13 | apoyo con cambios | 4 | G | alto | sí |
| COM-14 | falta un dato | 4 | G | medio | sí |
| MOD-01 | apoyo con cambios | 4 | G | alto | no |
| MOD-02 | apoyo con cambios | 5 | G | medio | no |
| MOD-03 | apoyo con cambios | 5 | G | alto | no |
| MOD-04 | apoyo con cambios | 4 | M | medio | no |
| MOD-08 | apoyo con cambios | 2 | P | bajo | sí |

## Fichas

### DIS-01 · Estados honestos en el Resumen
- **Evidencia:** confirmada (abrí `KpiStrip.tsx`, `kpiStripModel.ts`, `YearPie.tsx`, `ZeroCost.tsx`, `helpers.tsx` y la variante de producto).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** esqueleto dentro de cada tarjeta durante carga; si fallan varias, aviso único arriba y estado de error compacto en cada cifra. Conservar el último dato solo si viene acompañado de «Última actualización: …» y nunca presentarlo como actual.
- **Qué harías en su lugar o qué cambiarías:** centralizar carga/error/último dato en un componente de KPI; «0» queda reservado a una respuesta válida del servidor.
- **Certeza:** comprobado

### DIS-02 · No perder datos al cerrar cobro o arqueo
- **Evidencia:** confirmada (`Modal` cierra por `onOpenChange`; pagos y conteo viven en estado local).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** pedir confirmación solo cuando el formulario está sucio. No guardaría en `localStorage` últimos cuatro dígitos, aprobaciones ni referencias; aumenta exposición y deja datos entre usuarios. Puede conservarse el borrador solo en memoria mientras dura la sesión.
- **Qué harías en su lugar o qué cambiarías:** `Modal` necesita contrato de «cambios sin guardar» y cierre explícito; X, Esc y clic exterior deben respetarlo por igual.
- **Certeza:** comprobado

### DIS-03 · Menú agrupado y reconocible
- **Evidencia:** confirmada (`navigation` es una lista y repite Truck, Wallet, Bell y ChartNoAxesCombined; se vio el menú completo).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** **Vender:** Punto de venta, Ventas, Solicitudes, Clientes. **Mercancía:** Mercancía, Productos, Inventario, Compras, Envíos. **Dinero:** Caja, Conciliar, Gastos, Incentivos. **Administración:** Resumen, Reportes, Alertas, Promociones, Configuración y GV. Íconos: PackagePlus (Mercancía), ShoppingCart (Compras), Bike (Envíos), Landmark/BadgeCheck (Conciliar) y FileX2 (Solicitudes).
- **Qué harías en su lugar o qué cambiarías:** no impondría «cero iconos repetidos» como prueba absoluta; exigiría semántica distinta dentro de una misma sección y conservaría nombres/orden durante una transición corta.
- **Certeza:** comprobado

### DIS-04 · Alertas con total, grupos y paginación
- **Evidencia:** confirmada (la web no pagina; API usa 200 por defecto y admite cursor/tipo).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** expondría reglas de alertas en «Configuración avanzada», no como acción principal del centro. Para inventario, primero mínimos por categoría con excepción por producto. El marcado masivo solo para inventario/promociones; dinero, caja y seguridad se resuelven individualmente.
- **Qué harías en su lugar o qué cambiarías:** API de resumen por tipo + total real, detalle paginado y prioridad fija de hechos monetarios.
- **Certeza:** comprobado

### DIS-05 · Escala tipográfica real
- **Evidencia:** confirmada (tokens 14/16 y numerosas reglas colapsan a 14 px; la jerarquía plana se aprecia en pantalla).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** cinco pasos principales: 14 nota/metadato, 16 texto, 18 etiqueta/subtítulo, 22 título y 28 cifra; 32 solo para una cifra/hero excepcional. Las notas usan además peso y color, pero no color como única diferencia.
- **Qué harías en su lugar o qué cambiarías:** migración por familias con capturas a 1366, 390 y 320; no una sustitución masiva. Corrijo el esfuerzo de M a G.
- **Certeza:** comprobado

### DIS-06 · Tipografía térmica separada de la pantalla
- **Evidencia:** corregida (el CSS confirma que 58 mm usa 14 px y 80 mm 13 px; que se corte es deducción, no impresión real).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** P · **Riesgo:** medio · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** objetivo inicial: 32 caracteres útiles en 58 mm y 42–48 en 80 mm, según fuente/driver. Usaría tamaño físico de impresión (aprox. 8–9 pt para 58 mm y 9–10 pt para 80 mm) y columnas probadas, no el mínimo de pantalla ni una equivalencia ciega de px.
- **Qué harías en su lugar o qué cambiarías:** prueba PDF ayuda, pero el cierre exige papel real en ambas anchuras y con los importes más largos.
- **Certeza:** deducido

### DIS-07 · Un sistema de colores y componentes
- **Evidencia:** confirmada (tokens/Nx se cargan pero no los consumen las pantallas; abundan hex y estados sin tema oscuro).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** conservaría Button/Badge actuales y migraría sus estados a tokens; no movería toda la aplicación a Nx* sin adopción previa. Variables mínimas: fondo, superficie, superficie suave, texto, texto secundario, borde, primario y texto sobre primario, foco, éxito, aviso, peligro, overlay y sombra, cada estado con fondo/texto/borde cuando aplique.
- **Qué harías en su lugar o qué cambiarías:** estados primero, luego superficies y marca; borrar Nx* solo al demostrar que no queda consumidor. Corrijo esfuerzo de M a G.
- **Certeza:** comprobado

### DIS-08 · Consolidar el CSS del POS sin mover la caja
- **Evidencia:** confirmada (selectores repetidos e `!important`; no hay snapshots visuales).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** primero congelar comportamiento y estilos calculados; después `pos.css` por componente con base y pocas consultas de contenedor/ancho. `@layer` ayuda al orden de cascada, pero no arregla por sí solo diez definiciones. En CI estable usaría `maxDiffPixelRatio` de 0.001, enmascarando solo datos realmente variables.
- **Qué harías en su lugar o qué cambiarías:** dividir en cambios pequeños y visualmente equivalentes; no mezclar refactor con rediseño.
- **Certeza:** comprobado

### DIS-09 · Landing coherente y con producto visible
- **Evidencia:** confirmada (colores distintos, sin imágenes ni `og:image`; hay capturas de demostración disponibles).
- **Veredicto:** apoyo
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** bajo · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** primero POS de escritorio cobrando, después POS/carrito móvil y Resumen de dueña en móvil. Capturas WebP reales de demo como base; un video corto secundario, no demo navegable como primera prueba. Mantendría `#7c3aed`, el color ya reconocido dentro del producto, y derivaría la landing de la misma fuente.
- **Qué harías en su lugar o qué cambiarías:** script reproducible, datos ficticios y fecha de actualización de capturas.
- **Certeza:** comprobado

### COM-01 · Hoja de conteo masivo
- **Evidencia:** confirmada (UI envía una línea, prellena stock; API acepta 1,000; historial no muestra diferencias).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** MVP con tienda cerrada o zona/categoría bloqueada para ventas. No «descontaría ventas» de forma aproximada. Una fase posterior puede registrar `countedAt` por línea y reproducir movimientos posteriores antes de ajustar, con conflicto si falta algún movimiento.
- **Qué harías en su lugar o qué cambiarías:** casillas vacías, guardado parcial, revisión de diferencias y aprobación separada. Corrijo esfuerzo de M a G por conciliación y riesgo monetario.
- **Certeza:** comprobado

### COM-02 · Venta preparada por otra persona
- **Evidencia:** confirmada (GET y convert filtran `userId`; la pantalla solo consulta esa lista).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** conservar ventas personales privadas y añadir «Enviar a caja». Guardar `preparedBy` y `soldBy`; el incentivo comercial corresponde a quien atendió/preparó cuando se marcó explícitamente, y la responsabilidad de caja a quien cobró. La dueña debe poder configurar la política antes de pagar incentivos.
- **Qué harías en su lugar o qué cambiarías:** recuperación atómica, nombre visible, caducidad y bitácora; no compartir automáticamente todos los borradores.
- **Certeza:** comprobado

### COM-03 · Margen visible al editar precio/costo
- **Evidencia:** confirmada (formularios no calculan; Mercancía usa 15 fijo; alerta usa ajuste; producto confirma con 15 fijo).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** una sola fuente: el ajuste «Margen bajo (%)». Si la dueña quiere un piso inamovible, se valida el propio ajuste; no se esconden dos umbrales distintos. Predeterminado 15 %, configurable por administración.
- **Qué harías en su lugar o qué cambiarías:** cálculo compartido en vivo, aviso no bloqueante y confirmación solo bajo el umbral.
- **Certeza:** comprobado

### COM-04 · Cantidad editable en el carrito
- **Evidencia:** confirmada (cantidad fija entre −/+; `enterText` no interpreta cantidades).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** P · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** campo numérico siempre visible con `inputMode` numérico, selección completa al enfocar y botones −/+. No usaría `cantidad*código`: el asterisco puede pertenecer al protocolo/lectura Code 39 y añade una segunda gramática al escáner.
- **Qué harías en su lugar o qué cambiarías:** confirmación visual al salto grande y la misma validación de stock/lotе existente.
- **Certeza:** comprobado

### COM-05 · Devolución de varias líneas
- **Evidencia:** confirmada (UI envía una línea; API acepta lista y calcula total/ITBIS/costo por línea con redondeo acumulado).
- **Veredicto:** apoyo
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** alto · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** un método de reembolso por devolución en la primera versión; dividir métodos multiplica conciliación y comprobantes. La API sí reparte correctamente descuento/ITBIS porque devuelve proporciones del `lineTotal` y `tax` registrados, acumulando redondeos por línea.
- **Qué harías en su lugar o qué cambiarías:** resumen total fijo al pie, estado por línea y pruebas de devolución parcial/total, lotes, merma, crédito y efectivo.
- **Certeza:** comprobado

### COM-06 · Traspaso multilínea con escáner
- **Evidencia:** confirmada (formulario de una variante; API acepta 100 líneas; producto conserva el mismo patrón).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** alto · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** reutilizar búsqueda y escáner, pero ubicar «Traspaso» como tercer modo de Mercancía; ahí está el modelo mental de entradas/salidas. Inventario conserva el resumen Tienda/Casa y enlaza al flujo.
- **Qué harías en su lugar o qué cambiarías:** vista previa origen/destino, una operación idempotente y opción de crear el traspaso inverso, no «deshacer» destructivo.
- **Certeza:** comprobado

### COM-07 · Comprobante de abono
- **Evidencia:** confirmada (ambos flujos solo muestran toast; PDF de estado existe en administración).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** debe mostrar monto recibido y saldo del cliente; eso no revela el efectivo esperado de la gaveta y no rompe el arqueo ciego. Necesita número propio estable (REC-…) para reimpresión y reclamos.
- **Qué harías en su lugar o qué cambiarías:** recibo no fiscal, método, factura(s), quien recibió, saldo y QR/identificador; enviar solo con teléfono confirmado.
- **Certeza:** comprobado

### COM-08 · Buscar créditos pendientes
- **Evidencia:** confirmada (cajera recibe hasta 500 sin búsqueda; búsqueda solo en vista administrativa).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** búsqueda en la API desde el inicio; filtrar 500 crea falsos «no está». Nombre y factura, no teléfono: el rol de cajera recibe el teléfono enmascarado por privacidad.
- **Qué harías en su lugar o qué cambiarías:** `q` paginado, total independiente y estado vacío que distinga «sin resultados» de «sin créditos».
- **Certeza:** comprobado

### COM-09 · Aviso de cliente duplicado
- **Evidencia:** confirmada (API crea sin comparar, teléfono libre, sin único; formulario rápido lo envía directamente).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** avisar, no bloquear; familiares pueden compartir teléfono. «Crear de todos modos» requiere motivo. Una herramienta de unión debe ser otro proyecto auditado: conservar documentos históricos, mover saldos/notas abiertas de forma transaccional, dejar alias y bitácora; nunca reescribir silenciosamente ventas cerradas.
- **Qué harías en su lugar o qué cambiarías:** normalización dominicana de teléfono/cédula y coincidencias explicables, sin mostrar datos completos al rol limitado.
- **Certeza:** comprobado

### COM-10 · Cotización imprimible y reutilizable
- **Evidencia:** confirmada (solo guarda y recupera; convertir consume; no conserva precio por línea).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** vigencia predeterminada de 7 días, configurable. Al recuperar, cobrar precio vigente y mostrar diferencia; si se decide honrar el anterior, aplicar descuento explícito y PIN cuando supere el límite. La cotización no debe prometer precio indefinido.
- **Qué harías en su lugar o qué cambiarías:** snapshot de precios, versión/no fiscal, reimpresión sin consumo y conversión atómica solo al llevarla al carrito.
- **Certeza:** comprobado

### COM-11 · Categorías administrables
- **Evidencia:** confirmada (web solo lee; API crea pero no edita; importación puede crear).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** impedir «exige lote» mientras haya existencia vendible sin lote y ofrecer plan de regularización; no aplicarlo solo a entradas futuras porque deja una regla ambigua. Una categoría con productos se archiva para altas nuevas, no se borra; se reactiva y conserva historial.
- **Qué harías en su lugar o qué cambiarías:** color opcional, nombre único normalizado, auditoría y previsualización de productos afectados.
- **Certeza:** comprobado

### COM-12 · Excel de ida y vuelta
- **Evidencia:** confirmada (plantilla antigua pide ID; importador seguro usa columnas distintas; reporte exporta otro formato).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** M · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** aceptar encabezados heredados y llanos mediante alias. La descarga puede mostrar existencia, pero al reimportar debe quedar desactivada por defecto y exigir «Aplicar como conteo físico»; cambiar precios no puede tocar stock por accidente.
- **Qué harías en su lugar o qué cambiarías:** un único archivo/versionado, identificador estable por variante, vista previa por tipo de cambio y exportación sin cambios = 0 operaciones.
- **Certeza:** comprobado

### COM-13 · Mapeo de columnas y CSV
- **Evidencia:** confirmada (encabezados fijos, solo XLSX; mismo núcleo en producto).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** reglas por nombre y muestra de valores bastan; IA no debe decidir costo/precio/existencia. El usuario confirma cada columna y la vista previa bloquea incoherencias. Después de inventario migraría proveedores, luego clientes; saldos de crédito al final y como apertura auditada.
- **Qué harías en su lugar o qué cambiarías:** construir después de COM-12 para no mantener dos importadores; CSV con codificación/decimal explícitos.
- **Certeza:** comprobado

### COM-14 · Paquete mensual contable
- **Evidencia:** confirmada (descargas separadas, 606-prep en Compras, formal solo PDF y sin CxC en Reportes).
- **Veredicto:** falta un dato
- **Impacto:** 4 · **Esfuerzo:** G · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** propuesta de orden: Resumen, Ventas, Cobros por método, CxC, Compras/606-prep, CxP, Gastos, Resultado e Inventario actual, en un libro con hojas. Pero la contable debe confirmar columnas, corte y si prefiere libro o ZIP. Inventario histórico no debe fingirse: solo «actual al generar» hasta tener snapshots.
- **Qué harías en su lugar o qué cambiarías:** taller corto con la contable y archivo ejemplo aprobado antes de construir; rotular «no es declaración fiscal».
- **Certeza:** comprobado

### MOD-01 · Modo práctica aislado
- **Evidencia:** confirmada (tienda no tiene práctica; demo no cobra; onboarding de producto crea stock real y va a venta real).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** empresa/base de demostración separada y reiniciable, usando la misma API y reglas, es más segura y mantenible que simular el POS solo en el navegador. El aislamiento evita mezclar ventas; la banda «PRÁCTICA» sigue siendo obligatoria. «Primeros pasos» debe entrar al sandbox, no crear ventas de prueba reales.
- **Qué harías en su lugar o qué cambiarías:** ejercicios guiados, reset y salida explícita; no disponible con caja real abierta.
- **Certeza:** comprobado

### MOD-02 · Arranque guiado en instalación
- **Evidencia:** confirmada (instalador manda a Configuración; bootstrap crea categorías FitStore; onboarding de producto depende de registro/tenant).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** G · **Riesgo:** medio · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** no copiarlo tal cual: adaptar cinco pasos locales (negocio/tipo, categorías, primera cajera, primer producto o importación, ticket y respaldo). Tipos iniciales: colmado/minimarket, ropa y calzado, belleza/salón, ferretería y servicios. Las plantillas sugieren categorías; impuesto, NCF y reglas de dinero se preguntan, no se adivinan por rubro.
- **Qué harías en su lugar o qué cambiarías:** retomable, sin categorías de FitStore por defecto y con validación de impresión/backup. Corrijo esfuerzo de M a G por instalador, migración y pruebas.
- **Certeza:** comprobado

### MOD-03 · Impresión y gaveta desde escritorio
- **Evidencia:** confirmada (tienda usa `window.print`; Tauri tienda vacío; producto ya tiene comandos y API de gaveta).
- **Veredicto:** apoyo con cambios
- **Impacto:** 5 · **Esfuerzo:** G · **Riesgo:** alto · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** llevar la app Tauri auditada; impresión silenciosa del navegador depende de políticas y ofrece menos control/bitácora. Falta probar modelo/driver real, USB/LAN, 58/80 mm, acentos, 20 ventas, reconexión, cola offline, reintentos sin duplicar, pulso ESC/POS, gaveta manual con motivo, efectivo vs otros medios y actualización de Windows.
- **Qué harías en su lugar o qué cambiarías:** piloto en una caja y fallback explícito a ventana de impresión. Corrijo esfuerzo de M a G hasta cerrar hardware y seguridad.
- **Certeza:** comprobado

### MOD-04 · WhatsApp con destinatario confirmado
- **Evidencia:** confirmada (`wa.me` usa contacto disponible; el rol limitado recibe dato enmascarado; mensaje no incluye líneas).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** no
- **Respuesta a la pregunta del catálogo:** para la tienda pequeña, primero pedir el número dictado, mostrarlo para confirmar y abrir `wa.me`; no revela el teléfono guardado ni exige servicio pago. Guardarlo en la ficha solo con consentimiento. La API oficial añade cuenta empresarial, plantillas/consentimiento, operación y precio variable; requiere evaluación comercial actual antes de prometer costo.
- **Qué harías en su lugar o qué cambiarías:** resumen breve con artículos/cantidades/total, confirmación de últimos dígitos y advertencia de compra privada antes de abrir el chat.
- **Certeza:** comprobado

### MOD-08 · Tema del sistema sin destello
- **Evidencia:** confirmada (default claro en `localStorage`, tema en `useEffect`, `theme-color` fijo; landing sí usa preferencia).
- **Veredicto:** apoyo con cambios
- **Impacto:** 2 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta a la pregunta del catálogo:** seguir sistema solo cuando no existe elección guardada; después manda la elección del equipo. En mostrador iluminado suele rendir mejor claro, pero no lo forzaría: la cajera lo deja fijo una vez.
- **Qué harías en su lugar o qué cambiarías:** script en `<head>` antes de React y `theme-color` por tema; prueba del primer cuadro.
- **Certeza:** comprobado

## A fondo · hasta 10 que sí valen una orden de construcción

1. **COM-03 · Margen visible:** evita vender con margen roto, usa una regla existente y cabe en un cambio pequeño.
2. **DIS-01 · Estados honestos:** nunca presentar «RD$ 0» o «Sin faltantes» cuando en realidad falló la consulta.
3. **COM-08 · Buscar créditos:** búsqueda paginada por cliente/factura para cobrar sin recorrer hasta 500 filas.
4. **DIS-02 · Formularios sucios:** confirmación uniforme que evite perder cobro o arqueo sin guardar datos de tarjeta en disco.
5. **COM-04 · Cantidad editable:** campo numérico validado en el carrito; sin sintaxis especial en el lector.
6. **COM-09 · Duplicados de clientes:** aviso explicable, opción de usar existente y excepción con motivo.
7. **COM-07 · Recibo de abono:** número propio, impresión/reimpresión y saldo resultante.
8. **COM-01 · Conteo masivo:** primera versión con tienda cerrada, guardado parcial y aprobación de diferencias.
9. **COM-12 · Excel ida y vuelta:** un formato, vista previa y existencia separada explícitamente de precios/costos.
10. **MOD-02 · Arranque guiado:** instalación vendible sin categorías FitStore ni soporte manual para el primer ticket.

## Propuestas propias

La revisión posterior corrigió P-A01: la barra fija móvil ya existe (`POS.tsx:1347-1370`, `styles.css:5825-5855`). No se propone construirla otra vez. Las once restantes se mantienen:

### P-A02 · Inventario móvil por producto, no 228 tarjetas seguidas
- **Evidencia:** confirmada (captura local 390 px; lista de variantes extremadamente larga).
- **Veredicto:** apoyo
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta:** agrupar por producto, expandir variantes, paginar/virtualizar y mantener filtros visibles.
- **Qué cambiaría:** no ocultar alertas de lote/stock dentro del grupo cerrado; mostrar resumen.
- **Certeza:** comprobado

### P-A03 · Clientes móvil compacto
- **Evidencia:** confirmada (captura local 390 px; se repiten cinco rótulos por tarjeta).
- **Veredicto:** apoyo
- **Impacto:** 3 · **Esfuerzo:** M · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** fila de nombre + contacto enmascarado + deuda/última compra; detalle expandible y páginas.
- **Qué cambiaría:** conservar acción textual «Editar» y no depender de gestos ocultos.
- **Certeza:** comprobado

### P-A04 · Ventas móvil con resumen y acción textual
- **Evidencia:** confirmada (captura local 390 px; tarjetas altas e iconos pequeños).
- **Veredicto:** apoyo
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta:** factura/cliente/total/estado visibles; pagos y líneas bajo expansión; acción primaria con nombre.
- **Qué cambiaría:** no reducir importes ni estados a color solamente.
- **Certeza:** comprobado

### P-A05 · Resumen móvil orientado a decisiones
- **Evidencia:** confirmada (captura 390 px: tablero muy largo con análisis anual y horas pico).
- **Veredicto:** apoyo
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** hoy/cajas/alertas/acciones primero; análisis histórico plegable o en Reportes.
- **Qué cambiaría:** conservar acceso a todos los datos, pero no cargar visualmente todo al inicio.
- **Certeza:** comprobado

### P-A06 · Buscador y favoritos de Reportes
- **Evidencia:** confirmada (captura 1366 px; navegación lateral con decenas de informes).
- **Veredicto:** apoyo
- **Impacto:** 3 · **Esfuerzo:** M · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** buscar por nombre/sinónimo, fijar hasta cinco y mostrar recientes.
- **Qué cambiaría:** no crear otra jerarquía; aprovechar los grupos actuales como filtro.
- **Certeza:** comprobado

### P-A07 · Acciones de Productos con verbos
- **Evidencia:** confirmada (captura 1366 px: tres iconos por fila sin etiqueta persistente).
- **Veredicto:** apoyo
- **Impacto:** 3 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** menú «Acciones» o botones con nombre en la primera fila visible; icono + texto.
- **Qué cambiaría:** tooltips siguen como ayuda, no como única explicación.
- **Certeza:** comprobado

### P-A08 · Aprobación de equipo compacta después de explicarla
- **Evidencia:** confirmada (banner/formulario grande repetido en POS, Ventas y Caja, especialmente móvil).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** primera vista completa; luego franja «Solo consulta · Aprobar equipo» que abre el mismo formulario.
- **Qué cambiaría:** no ocultar que las acciones están bloqueadas ni reducir el PIN a un flujo ambiguo.
- **Certeza:** comprobado

### P-A09 · Traducir roles internos en mensajes
- **Evidencia:** confirmada (Resumen muestra `(manager)` y `(warehouse)`).
- **Veredicto:** apoyo
- **Impacto:** 2 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** diccionario único de roles: Administradora, Gerente, Vendedora, Almacén.
- **Qué cambiaría:** códigos técnicos solo en bitácora/export técnico, no en texto principal.
- **Certeza:** comprobado

### P-A10 · Estados vacíos que describan la pantalla real
- **Evidencia:** confirmada (Historial de cajas manda revisar búsqueda/filtros inexistentes).
- **Veredicto:** apoyo
- **Impacto:** 2 · **Esfuerzo:** P · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** mensaje y acción por contexto; «Abre tu primera caja» o «No hay cajas en este período».
- **Qué cambiaría:** retirar el vacío genérico de pantallas sin alta/búsqueda.
- **Certeza:** comprobado

### P-A11 · Controles fijos y retorno con contexto
- **Evidencia:** confirmada (listas móviles largas; búsqueda/filtros solo al inicio).
- **Veredicto:** apoyo con cambios
- **Impacto:** 4 · **Esfuerzo:** M · **Riesgo:** medio · **Visto en pantalla:** sí
- **Respuesta:** barra compacta fija al desplazarse y restaurar filtro, página y posición al volver.
- **Qué cambiaría:** aplicar primero a Inventario, Clientes y Ventas; Productos ya pagina y requiere medición antes de fijar más UI.
- **Certeza:** comprobado

### P-A12 · Inicio distinto para gerente y dueña
- **Evidencia:** confirmada (ambas reciben prácticamente el mismo Resumen).
- **Veredicto:** apoyo con cambios
- **Impacto:** 3 · **Esfuerzo:** M · **Riesgo:** bajo · **Visto en pantalla:** sí
- **Respuesta:** mismo conjunto de widgets, orden predeterminado por rol; la dueña puede personalizar.
- **Qué cambiaría:** gerente: cajas/aprobaciones/alertas; dueña: margen/gastos/consolidado/tendencia.
- **Certeza:** comprobado

| ID | Dimensión | Versión | Impacto | Esfuerzo | Riesgo | Parecida a |
|---|---|---|---:|:---:|:---:|---|
| P-A02 | comodidad | ambas | 4 | M | medio | COM-01 (solo parcialmente) |
| P-A03 | comodidad | ambas | 3 | M | bajo | — |
| P-A04 | comodidad | ambas | 4 | M | medio | — |
| P-A05 | diseño | ambas | 4 | M | bajo | DIS-01 (solo el Resumen) |
| P-A06 | comodidad | producto | 3 | M | bajo | DIS-03 / COM-14 |
| P-A07 | diseño | ambas | 3 | P | bajo | DIS-03 |
| P-A08 | comodidad | producto | 3 | P | bajo | — |
| P-A09 | diseño | producto | 2 | P | bajo | — (C6 fuera del catálogo) |
| P-A10 | diseño | producto | 2 | P | bajo | DIS-01 |
| P-A11 | comodidad | ambas | 4 | M | medio | — |
| P-A12 | comodidad | producto | 3 | M | bajo | — |

### Cinco cosas que quitaría o simplificaría

1. Quitar «Guía de estilos» de la navegación de producción; dejarla solo en modo interno/demo.
2. Unificar los dos caminos de Excel en COM-12 y retirar la plantilla que exige ID interno de categoría.
3. Adoptar o retirar los Nx*; no mantener dos bibliotecas visuales cargadas y sin uso.
4. Mover análisis históricos del Resumen móvil a secciones plegables/Reportes.
5. Reducir el formulario repetido de aprobación de equipo a una franja tras la primera explicación.

## Síntesis

### Mis 5 primeras para la tienda

1. COM-03 · margen visible al cambiar precio/costo.
2. COM-08 · búsqueda real de créditos pendientes.
3. COM-07 · comprobante numerado de abono.
4. COM-04 · cantidad editable en el carrito.
5. COM-01 · hoja de conteo masivo, inicialmente con tienda cerrada.

### Mis 5 primeras para el producto

1. MOD-02 · arranque guiado del instalador.
2. DIS-01 · estados honestos de carga/error.
3. COM-12 · Excel único de ida y vuelta.
4. P-A02 · Inventario móvil agrupado/paginado.
5. DIS-03 · menú por tareas y semántica clara.

### Victorias rápidas

- COM-03 margen en vivo con el ajuste real.
- DIS-01 carga/error en KPIs.
- COM-08 búsqueda por cliente/factura.
- DIS-02 confirmación de formulario sucio.
- MOD-08 tema antes del primer cuadro.
- P-A09 etiquetas de rol en español.
- P-A10 vacíos específicos.

### Qué no haría todavía

- DIS-08, hasta tener snapshots visuales estables.
- MOD-03, hasta tener impresora/gaveta/modelo/driver reales para aceptación.
- COM-14, hasta que la contable confirme contenido y formato.
- MOD-04 con API oficial, hasta validar consentimiento, operación y precio vigente.
- MOD-01, antes de cerrar el arranque guiado y el aislamiento de empresa/demo.

### Desacuerdos con el catálogo

1. DIS-05 no es M: migrar cientos de reglas sin romper 320/390/1366 es G.
2. DIS-07 no es M: unificar tokens/componentes/temas y retirar huérfanos es G.
3. COM-01 no debe conciliar ventas «sobre la marcha» en su MVP; primero tienda cerrada.
4. COM-12 no debe convertir toda existencia exportada en conteo al reimportar; stock requiere confirmación separada.
5. MOD-03 no es M hasta aprobar hardware, impresión, reintentos, seguridad y Windows; lo califico G.

## Comprobaciones en pantalla

| Código | Resultado | Evidencia |
|---|---|---|
| C1 | **PASA.** Con carrito y sin cliente, Cobrar abrió el selector; al elegir Adriana Torres, «Todo listo para cobrar» se abrió sin segundo clic. En una repetición iniciada desde el selector/F4, elegir otra clienta no abrió cobro. | `capturas/C1-selector-cliente.png`, `capturas/C1-cobro-abre-solo.png` |
| C6 | **PASA.** La solicitud FS-0000003 mostró «Efectivo · RD$ 3,400.00»; no apareció `cash`. | `capturas/C6-solicitud-efectivo.png` |
| C13 | **PASA.** Camila (Vendedora, sin `sale:manage`) vio «hasta 10 % sin PIN» en la línea; Andrea (Gerente) no lo vio. | `capturas/C13-vendedora-limite-visible.png`, `capturas/C13-gerente-sin-aviso.png` |
| C15 | **PASA.** Con Bandas Resistance · Lila en existencia 1, aumentar a 2 mostró «Stock insuficiente: de Bandas Resistance solo quedan 1.» | `capturas/C15-stock-producto-cantidad.png` |

Entorno: base PostgreSQL local descartable, datos de demostración, Chromium headless a 1366 × 900. No se confirmó una venta en estas cuatro comprobaciones.

## Lo que no pude comprobar

- DIS-06: no había impresora térmica física de 58/80 mm; se confirmó el CSS, no el papel.
- MOD-03: no había impresora, gaveta ni controlador físico; no se probó Tauri/hardware.
- MOD-04: no se envió WhatsApp ni se evaluó una cuenta Business/API; no se contactó a terceros.
- COM-14: no hubo una contable disponible para validar hojas/columnas ni formato fiscal.
- MOD-01/MOD-02: no se ejecutó una instalación limpia ni un sandbox de práctica; se evaluaron por código.
- No se usó producción, Render, base de la tienda, credenciales reales ni despliegues.
