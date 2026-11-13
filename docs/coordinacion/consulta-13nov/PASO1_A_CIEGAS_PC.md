# Paso 1 · Revisión a ciegas de diseño y facilidad de uso

Base observada: `4fef4d550fc465f2285876fa84ed55e6a6501c5f`

Revisión hecha el 13-nov-2026 contra una instalación local descartable, con las 68 migraciones y la semilla de demostración (60 productos, 228 variantes y 846 ventas). Se recorrió la aplicación a 1366 × 844 y 390 × 844 como administradora/dueña, gerente, vendedora/cajera y almacén. Esta lista se cerró antes de abrir el catálogo de propuestas.

## P-A01 · Mantener el carrito al alcance en el POS móvil

En 390 px, el catálogo completo aparece antes que «Venta actual»: con 60 productos hay que recorrer una página enorme para llegar al carrito, total y cobro. Pondría una barra inferior fija con artículos, total y «Ver carrito/Cobrar», y abriría el carrito como panel; la venta no puede quedar después del catálogo.

- **Pantalla:** Punto de venta, 390 px, perfil vendedora.
- **Versión:** ambas (tienda y producto).

## P-A02 · Paginar o virtualizar las variantes de Inventario en móvil

Inventario convierte 228 variantes en una sucesión extremadamente larga de tarjetas. La búsqueda ayuda solo si ya se conoce el artículo; para conteo o revisión hace falta paginación/virtualización, filtros fijos y un resumen por producto que se expanda bajo demanda.

- **Pantalla:** Inventario, 390 px, perfil administradora.
- **Versión:** ambas.

## P-A03 · Hacer Clientes realmente explorables en móvil

La vista repite cinco rótulos por cada cliente («Cliente», «Cédula/RNC», «Compras», etc.) y genera una página muy larga; comparar personas o volver a una posición cuesta. Usaría filas compactas con nombre + dato clave, detalle expandible y paginación/carga por bloques.

- **Pantalla:** Clientes, 390 px, perfiles administradora y vendedora.
- **Versión:** ambas.

## P-A04 · Simplificar Ventas móvil y dar nombre a las acciones

Cada venta ocupa una tarjeta alta y las acciones principales quedan como iconos pequeños sin texto. Mostraría factura, cliente, total y estado en una fila compacta; el resto en un detalle expandible y una acción principal textual («Ver», «Solicitar anulación», según permiso).

- **Pantalla:** Ventas, 390 px, perfil vendedora.
- **Versión:** ambas.

## P-A05 · Resumir el tablero móvil por decisiones, no por todos los gráficos

El Resumen móvil apila tarjetas, gráfico anual, comparación diaria, alertas, favoritos, categorías, horas pico y resultados hasta formar un tablero demasiado largo. Dejaría arriba 4–6 decisiones del día y movería análisis anual, mezcla y horas pico a secciones plegables o a Reportes.

- **Pantalla:** Resumen, 390 px, perfiles gerente y administradora/dueña.
- **Versión:** ambas.

## P-A06 · Buscar y fijar reportes frecuentes

Reportes ofrece decenas de opciones agrupadas en una navegación lateral extensa. Añadiría búsqueda de reportes, «Favoritos» y «Usados recientemente»; la dueña debería llegar a ventas, margen, caja o inventario con uno o dos pasos, sin recordar en qué grupo vive cada informe.

- **Pantalla:** Reportes, 1366 px, perfil administradora.
- **Versión:** producto (también beneficia a la tienda).

## P-A07 · Sustituir acciones crípticas de Productos por etiquetas o menú

La columna «Acciones» muestra tres iconos parecidos por fila sin nombre visible permanente. Un menú «Acciones» con verbos («Ver», «Imprimir etiqueta», «Variantes») reduce errores y funciona mejor en pantalla táctil; los iconos pueden acompañar, no reemplazar, el texto.

- **Pantalla:** Productos, 1366 px, perfil administradora.
- **Versión:** ambas.

## P-A08 · Convertir la aprobación del equipo en aviso compacto persistente

Mientras el equipo no está aprobado, el mismo formulario grande (nombre del equipo + PIN) ocupa la parte superior de cada pantalla consultada, especialmente en móvil. Tras explicarlo una vez, lo dejaría como franja compacta «Solo consulta · Aprobar equipo», que abra el formulario al tocarla.

- **Pantallas:** Punto de venta, Ventas y Caja; 390 y 1366 px; perfiles vendedora y almacén.
- **Versión:** producto.

## P-A09 · Traducir los códigos internos de rol en todos los mensajes

Las alertas visibles a la administración dicen «(warehouse)» y «(manager)» dentro de una interfaz en español. Deben decir «Almacén» y «Gerente», y el sistema debería centralizar las etiquetas de roles para no filtrar nombres técnicos a clientes.

- **Pantalla:** Resumen › Un poco de atención, perfiles gerente y administradora.
- **Versión:** producto.

## P-A10 · Usar estados vacíos específicos y accionables

«Todavía no hay registros · Revisa la búsqueda y los filtros, o registra un nuevo dato desde esta pantalla» aparece en Historial de cajas aunque allí no hay búsqueda, filtros ni un alta directa. Cada vacío debe explicar la causa real y ofrecer la acción válida («Abre tu primera caja» o «Ajusta el período»).

- **Pantalla:** Caja › Historial de cajas, 390 px, perfil vendedora.
- **Versión:** producto.

## P-A11 · Mantener búsqueda y filtros visibles en listas largas

Productos, Clientes, Inventario y Ventas dependen de controles ubicados solo al comienzo. En móvil, después de varias tarjetas, refinar la lista exige volver muchos desplazamientos. Haría fija una barra mínima de buscar/filtrar/ordenar y conservaría posición y filtros al volver de un detalle.

- **Pantallas:** Productos, Inventario, Clientes y Ventas, 390 px.
- **Versión:** ambas.

## P-A12 · Dar a gerente y dueña un inicio distinto

Gerente y administradora reciben prácticamente el mismo Resumen extenso. La gerente necesita operación inmediata (cajas, alertas, aprobaciones, transferencias); la dueña necesita margen, gastos, caja consolidada y tendencias. Mantendría una base común, con bloques y orden predeterminados por responsabilidad.

- **Pantalla:** Resumen, 1366 y 390 px, perfiles gerente y administradora/dueña.
- **Versión:** producto.

## Nota de alcance

La semilla no incluye un rol llamado literalmente «cajera»; para el recorrido operativo se usó la vendedora, que tiene Punto de venta, Ventas, Caja y Clientes. Almacén se revisó además para distinguir problemas propios del flujo de mercancía de los problemas generales de navegación.
