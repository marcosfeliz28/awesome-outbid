# Completar precios pendientes con «Importar inventario»

Esta guía es para la administradora. En la lista de trabajo hay **27 productos sin precio**; no inventes precios ni costos. El Excel con costos debe mantenerse fuera del repositorio y de los chats. **No hagas la carga hasta que la dueña/Claude confirme que la pantalla «Importar inventario» está desplegada.**

## Preparar el Excel

1. Pide a la dueña la lista vigente de los 27 productos y el precio y costo aprobados para cada uno. Si no tienes esa lista, detente: no inventes los IDs ni los valores. Confirma cada producto por su ID para no actualizar una variante equivocada.
2. Guarda el archivo en una computadora de la tienda, con una copia de respaldo protegida. Debe ser .xlsx y tener estos encabezados: ID, DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO, PRECIO DETALLE.
3. Completa precio y costo aprobados. La pantalla actualiza ambos juntos; si todavía no se conoce el costo correcto, no uses esta carga para cambiar solo el precio. Conserva la existencia real que corresponde a cada ID aunque luego vayas a desactivar la opción de actualizar existencias.
4. Revisa que no haya IDs repetidos, fórmulas pendientes de cálculo, filas equivocadas ni valores de prueba. No agregues los demás productos del catálogo “por si acaso”.

## Revisar antes de cargar

1. Entra con administración y abre **Productos** → **Importar inventario**. No elijas **Importar Excel**: esa es otra carga.
2. Selecciona el archivo. Para **actualizar solo precios y costos**, desmarca **Actualizar existencias (queda como «Conteo» en el kardex)** y deja marcada **Actualizar precios y costos**.
3. Espera la vista previa. Confirma que se leyeron los IDs previstos, que **Productos nuevos** sea 0, que las existencias no se cambiarán y que los precios/costos que cambian sean los esperados. Revisa especialmente los valores mayores y los productos que quedarían sin precio o costo.
4. Si aparece una categoría inesperada, un producto nuevo, una cantidad que no esperabas, una fila bloqueante o un valor distinto, **no cargues**. Corrige el Excel y genera una vista previa nueva.
5. **La carga puede activar automáticamente productos que estaban inactivos por falta de precio o costo cuando ambos datos queden completos.** Si no quieres habilitarlos para la venta, detente y consulta a la dueña antes de cargar.
6. Haz la operación con la tienda cerrada o sin ventas. Marca la confirmación solo después de revisar todo y pulsa **Cargar inventario** una vez. Si la base cambió después de la vista previa, el sistema puede rechazarla: vuelve a revisar desde el archivo actual; no reintentes a ciegas.
7. Al terminar, revisa los 27 artículos en **Productos**: precio, costo y estado. El sistema no modifica productos ausentes del archivo. Si un artículo sigue inactivo, confirma si falta precio o costo en el Excel.

**No subas el archivo al chat ni lo guardes en GitHub.** La pantalla valida archivos .xlsx de hasta 5 MB y 1,500 filas. La opción de existencias, si se activa, registra los cambios como conteo físico en el kardex; no la actives si solo se van a corregir precios y costos.
