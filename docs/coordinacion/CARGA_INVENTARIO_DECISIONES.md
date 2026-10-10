# Carga de inventario inicial: decisiones de la dueña (10 oct 2026)

El archivo `listado_actualizado.xls` (628 productos, ID 1001–1630, sin encabezado) NO está en el repositorio a propósito: trae costos. La dueña se lo entrega a quien haga la carga.
Columnas del .xls (índice): 0 ID, 1 descripción, 2 referencia/código de barras (vacío en 10 filas; distinto del ID en 6), 3 categoría (Maquillaje 363, Suplementos 223, Fajas 42), 4 unidad, 5 existencia (total 3,020), 6 costo, 7 precio, 11 = 18 en 10 filas, 12 = marca de fecha/1, 13 = 1 o 0 (0 en esas 10 filas).

## Decididas por la dueña
- Productos con costo/precio en 0 (29): se cargan igual, con 0; quedan inactivos (comportamiento del importador) hasta que ella les ponga precio.
- IDs 1623 y 1624 (LOréal too faced / honey) vienen con costo y precio invertidos: corregir a costo 1,675 y precio 2,450 (ella dijo «2550», el archivo dice 2,450: CONFIRMAR con ella antes de cargar).
- Códigos de barras: se conservan los que hay; los vacíos quedan vacíos.
- ITBIS: «a todo»: todos los productos con 18 % (es el valor por defecto de la app). Pendiente de confirmar que los precios ya lo incluyen.
- Productos que ella no menciona en los conteos: no se tocan.

## Conteo físico de hoy (10 oct), se aplica DESPUÉS de cargar el listado, como conteo con aprobación («Contar»), no como entrada
Faja tipo chaleco (IDs 1605–1617, 1612): 3XS 2, 2XS 2, XS 3, S 3, M 1, L 0 (sin cambio), XL 1, 2XL 6.
Cinturilla tipo corset (IDs 1575–1578, 1601–1604): 3XS 24, 2XS 36, XS 0 (sin cambio), S 5, M 5, L 1, XL 5, 2XL 4.
Creatina y multivitamínicos, cambian: 1125→4, 1080→3, 1077→12, 1076→3, 1078→3, 1141→3, 1122→6, 1152→12. Los demás nombrados ya coinciden. 1143 y 1214 se dejan como están.
Productos NUEVOS por crear (faltan costo y precio): Multivitamínico MuscleTech 180 tab (20), Optimen 250 tab (11), Optimen 150 tab (2), Optimen 90 tab (2).

## Cómo cargar
Producción: la base no acepta conexiones externas. El importador (`apps/api/scripts/import-inventario.ts`, con `--dry-run` primero) necesita acceso a la base; la pantalla de la app (plantilla .xlsx) pide IDs de categoría, código de barras obligatorio y no carga existencias. Decisión pendiente: pantalla de administración para importar inventario (requiere desarrollo y auditoría) o ejecutarlo como tarea puntual en Render. Siempre `--dry-run` y mostrar el resultado a la dueña antes de cargar.
