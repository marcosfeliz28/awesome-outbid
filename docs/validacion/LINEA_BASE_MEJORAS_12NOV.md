# Línea base de pantallas y Windows, 12-nov-2026

## Alcance y resultado

**Pieza 1: completada como línea base manual, no como certificación de una fase nueva.** Se recorrió la aplicación local en Windows 11 Pro (compilación 26300), Microsoft Edge, con anchuras de 1366 y 390 píxeles, y con los roles de demostración cajera (`seller`), gerente (`manager`) y dueña (`admin`). Se entregan 72 capturas. Se solicitaron al controlador viewports de 1366×900 y 390×844; algunas vistas se desplazaron para mostrar el control pertinente. El capturador devolvió archivos de 1366×900 o 1351×890 para escritorio y de 390×843 o 375×811 para móvil. Los nombres indican el viewport solicitado, no que todos los archivos tengan exactamente esa dimensión. Se conservaron los píxeles entregados, sin estirar imágenes para ocultar esta diferencia.

- Rama: `chatgpt-pc/linea-base-12nov`.
- Código observado: `a251637415a031b888d4d95ed4546586c1417dbe`, procedente de `origin/nexora-cloud`.
- Fuente del encargo: `docs/coordinacion/ORDEN_CHATGPT_PC_MEJORAS_12NOV.md`, piezas 1 y 2. La sesión «Norexos 1» confirma esta asignación; no es un proyecto llamado «Norexos 1».
- Fecha: 12-nov-2026, mañana y comienzo de la tarde, zona de la PC `SA Western Standard Time`, UTC−04:00.
- Entorno descartable independiente: base PostgreSQL local, API y web limitadas a `127.0.0.1`. No producción, Render, tienda real ni servicios externos de IA. Sin cambios en `apps/**`, `tests/e2e/**`, permisos, PIN, claves o reglas de dinero.
- Datos: seed de demostración; nombres, contactos `example.test` e identificadores `DEMO-*` son ficticios. No se pulsaron enlaces de WhatsApp/correo ni se imprimieron recibos.
- Preparación: dependencias del lockfile desde la caché, generación de Prisma, migraciones sobre base vacía, seed y `pnpm build`, todos terminados correctamente. Esto **no** es una nueva ejecución de `pnpm check`, integración o E2E.

## Hallazgos que requieren atención

1. **C1:** elegir cliente después de F12 no abre cobro. Hace falta pulsar F12 otra vez, en los tres roles.
2. **C13:** la cajera recibe el aviso de aprobación al abrir cobro, pero el gerente con 11 % no lo recibe hasta intentar finalizar. El servidor rechaza el intento y entonces aparece el campo de PIN. La dueña sí finaliza 11 % sin PIN. No se modificó esta regla ni se introdujo ningún PIN.
3. **C15:** con una unidad disponible, el segundo incremento se rechaza y se conserva cantidad 1. Mensaje literal: **«Stock insuficiente.»**. No explica cuál producto ni cuántas unidades quedan.
4. **C6 frente a C9:** la solicitud de anulación de cajera muestra **`cash · RD$ 270.00`**, mientras Ventas muestra **«Efectivo»**.
5. **D5:** roles, permisos y acciones de bitácora siguen mostrando códigos técnicos en la interfaz; la pestaña actual se llama **«Usuarios y permisos»**, no «Usuarios y Roles».
6. **D11:** «Uso y costo de IA» está dentro de «Negocio y reglas». No hay uso ni menú «Preguntar a Norexos» en esta copia sin IA habilitada. No se activó IA para forzar su aparición.

## Cobertura por rol

| Caso                               | Cajera             | Gerente                      | Dueña                      |
| ---------------------------------- | ------------------ | ---------------------------- | -------------------------- |
| C1, F12 con carrito y sin cliente  | 1366 / 390         | 1366 / 390                   | 1366 / 390                 |
| C13, campo de línea al 10 % y 11 % | 1366 / 390         | 1366 / 390                   | 1366 / 390                 |
| C15, existencia 1 e intento de 2   | 1366 / 390         | 1366 / 390                   | 1366 / 390                 |
| C12, Ventas, Caja y Clientes       | 1366 / 390         | 1366 / 390                   | 1366 / 390                 |
| C12, Resumen                       | No está en su menú | 1366 / 390                   | 1366 / 390                 |
| C12, aviso de venta completada     | 1366 / 390         | 1366 / 390                   | 1366 / 390                 |
| C6, solicitud de anulación         | 1366 / 390         | No solicitado por la orden   | No solicitado por la orden |
| D5 y D11, Configuración            | No está en su menú | No requerido para esta pieza | 1366 / 390                 |

Los casos se ejecutaron por rol y se capturó el mismo estado a ambas anchuras. No se trata de dos ventas diferentes por cada anchura ni de una prueba en teléfono físico. La ausencia de una opción en el menú de cajera se documentó sin intentar eludir su control de acceso.

## C1: de carrito sin cliente a cobro

Precondiciones: sesión iniciada, caja de prueba abierta, artículo en el carrito, sin cliente elegido. No se cuentan inicio de sesión, apertura de caja ni búsqueda del producto.

| Paso | Acción                          | Resultado observado                                                                        |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | F12                             | Abre «¿Para quién es esta venta?» y alerta «Selecciona o crea el cliente antes de cobrar.» |
| 2    | Elegir el primer cliente demo   | Cierra el selector y vuelve al carrito; no abre el diálogo de cobro                        |
| 3    | F12 de nuevo                    | Abre «Todo listo para cobrar»                                                              |
| 4    | Agregar pago en efectivo exacto | Incorpora el pago al cobro                                                                 |
| 5    | Finalizar venta                 | Registra una venta demo, si no falta otra aprobación                                       |

**Medida base: 3 acciones hasta abrir cobro; 5 hasta registrar una venta en efectivo sin incidencias.** Buscar/crear otro cliente, escribir un motivo de descuento, desplazarse o aprobar con PIN agrega acciones que no se incluyen en ese conteo. No se midieron segundos ni rendimiento P95.

La secuencia F12 → cliente → F12 se observó con cajera, gerente y dueña. Molestia concreta: el botón/atajo de cobro no retoma automáticamente el flujo después de resolver el cliente obligatorio.

Referencias: `apps/web/src/POS.tsx:521` (aviso), `:579` (F12), `:1526` (selección de cliente).

## C13: descuento de línea

Producto de precio RD$ 300.00; 10 % muestra RD$ 270.00 y 11 % muestra RD$ 267.00. El carrito permite escribir ambos porcentajes y no explica allí la aprobación necesaria. Se compararon los campos de línea, no solo el descuento global.

| Rol     | 10 %                                                      | 11 % al abrir cobro                                                                           | Al intentar finalizar 11 %                                                               |
| ------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cajera  | Venta demo de RD$ 270.00 completada sin PIN               | Campo «PIN del gerente para aprobar la venta · El descuento supera 10 % permitido al cajero.» | No se envió con PIN vacío; el requisito ya era visible                                   |
| Gerente | Venta demo de RD$ 270.00 completada sin PIN               | No muestra requisito de PIN                                                                   | Rechaza y añade «Esta operación requiere el PIN de un gerente.»; la venta no se registra |
| Dueña   | Campo y total comprobados; no se duplicó la venta al 10 % | No muestra requisito de PIN                                                                   | Venta demo de RD$ 267.00 completada sin PIN                                              |

El gerente se probó de nuevo para encuadrar el aviso: el segundo intento al 11 % volvió a pedir PIN, sin crear otra venta. Se abandonó ese carrito. Las ventas exitosas de esta línea base fueron **FS-0000848** (cajera, RD$ 270.00), **FS-0000849** (gerente, RD$ 270.00) y **FS-0000850** (dueña, RD$ 267.00).

La discrepancia tiene respaldo en el código de esta base: `apps/web/src/POS.tsx:1939-1943` excluye a quien tiene `sale:manage` del aviso anticipado de descuento; `apps/api/src/sales.ts:708-720` solo exceptúa de ese umbral al permiso `*`. El manejo del rechazo y texto posterior está en `apps/web/src/POS.tsx:2360`; el campo, en `:2523`. **Es un hallazgo para quien implemente C13, no una autorización para cambiar el criterio financiero.**

En 390 px el formulario de cobro necesita desplazamiento vertical: opciones de pago, motivo y botón final no caben simultáneamente. Las capturas de requisito de PIN están encuadradas en el campo; las del cobro sin PIN representan solo el tramo visible, no todo el formulario.

## C15: existencia baja

Se preparó exclusivamente en la base descartable la variante **Bandas Resistance / Lila / FIT-0038-1**, con existencia 1 tanto en la variante como en el registro del almacén. El selector indicaba «1 disponibles».

En cada rol: agregar una unidad → pulsar «Aumentar Bandas Resistance» → mensaje **«Stock insuficiente.»**, cantidad permanece en **1**. No hubo venta de dos unidades ni cambio de una regla de inventario. El fixture se repuso a 1 entre recorridos después de las ventas demo; no se usó como stock real.

Referencias: `apps/web/src/POS.tsx:1175`. Las capturas muestran el carrito y el aviso transitorio; su duración no se cronometró. Molestia: el texto no identifica el artículo ni la cantidad disponible.

## C6 y C9: anulaciones y método de pago

Se solicitó la anulación de FS-0000848 desde el rol cajera, con motivo de prueba. La solicitud quedó **Pendiente** en la base descartable; no se aprobó ni se anuló la venta.

- Solicitudes de anulación: «Consulta el estado de tus solicitudes.»; bajo Pagos, **`cash · RD$ 270.00`**.
- Ventas: el mismo pago se presenta como **«Efectivo»**. También se observaron etiquetas en español para Tarjeta y Transferencia en ventas demo del seed; no se hicieron cobros reales con esos medios.

Referencias: `apps/web/src/VoidRequests.tsx:100` imprime `payment.method` directamente; `apps/web/src/Management.tsx:3539-3541` usa etiquetas para Ventas. Las diferencias afectan legibilidad; no se deduce un error de contabilidad de la etiqueta sin traducir.

## C12: textos visibles

| Pantalla         | Título                              | Subtítulo / estado                                           |
| ---------------- | ----------------------------------- | ------------------------------------------------------------ |
| Ventas           | Cada venta tiene una historia       | Consulta recibos, pagos y movimientos sin perder el detalle. |
| Caja             | Una caja que siempre cuadra         | Abre el día con claridad. Ciérralo con tranquilidad.         |
| Clientes         | Personas que vuelven a elegirte     | Conoce a tus clientes y construye relaciones que duran.      |
| Resumen          | Hola, Valeria ✦ / Hola, Andrea ✦    | Un vistazo a tu tienda. Un paso más hacia tus metas.         |
| Venta finalizada | ¡Una venta más, una meta más cerca! | Venta registrada; número de venta, total y cambio            |

Los primeros tres títulos son iguales para los tres roles. Resumen no está en el menú de cajera. La confirmación exitosa se capturó en los tres roles. Sus acciones visibles incluyen Imprimir recibo, Recibo PDF, WhatsApp, Correo y Nueva venta; no se probaron envíos ni impresoras.

Referencias: `apps/web/src/Management.tsx:1685`, `:2319`, `:3244`; `apps/web/src/Dashboard.tsx:181`; `apps/web/src/POS.tsx:2421`.

Estos títulos son expresivos, pero no nombran primero la tarea («Ventas», «Caja», etc.); en móvil ocupan varias líneas. Es una observación para comparar con la fase futura, no una prueba de que los textos nuevos sean mejores. No se hizo un estudio de usuarios ni una auditoría completa de accesibilidad.

## D5: configuración de dueña

La pestaña se llama **Usuarios y permisos**. Muestra «Equipo de tu tienda» y «Permisos por rol». Los roles se ven como `admin`, `manager`, `seller`, `warehouse`; los permisos se enumeran en formato técnico (por ejemplo `catalog:read`). En Bitácora las acciones se ven como `terminal_registered` y `login`, entidades como `terminal` y `user`, y referencias internas largas. Solo se leyó esta pantalla en la copia demo.

Referencias: `apps/web/src/Management.tsx:4378-4379`, `:4475`, `:4525-4531`, `:4555-4559`. Molestia: una persona de tienda necesita interpretar códigos internos. No se editó ningún usuario, rol, permiso ni credencial.

## D11: IA deshabilitada

Dentro de Configuración → **Negocio y reglas**, el bloque **Uso y costo de IA** mostraba: «Del 2026-11-01 al 2026-11-12: sin uso. “sin precio” = falta cargar el precio del modelo.» Debajo estaban Por función, Por usuario y Por día sin registros.

No apareció «Preguntar a Norexos» en esta configuración. POS sí presenta «Preguntas rápidas sin IA». No se habilitó IA, no se cargaron claves, no se generó una consulta pagada. Por tanto **no se validaron el panel conversacional, respuestas, consumo, precios reales ni límites de un proveedor**. Referencia del bloque: `apps/web/src/AiUsage.tsx:67`.

## Pieza 2 / C14: BLOQUEADA por hardware

No se encontró webcam física operativa. La consulta de dispositivos de clase Camera solo devolvió **«Camera AI Effect Opt-in»**, con estado **Error**. La búsqueda complementaria de webcam/cámara integrada no encontró una cámara física. El botón «Escanear con cámara» existe en POS, pero eso no prueba captura ni lectura real.

No se concedió permiso de cámara, no se deshabilitaron protecciones y no se simuló una webcam para presentar una prueba falsa. **Pendiente:** conectar una webcam operativa y disponer de tres productos/códigos impresos para medir continuidad, pasos y aviso sonoro. No se verificó audio ni lectura sucesiva de códigos.

## Piezas 3 y 4: no se dan por cerradas

- Pieza 3 depende de que Norexos 1 anuncie una fase desplegada y de conocer su versión. Este informe conserva el ANTES sobre `a2516374`; no contiene un DESPUÉS ni provoca un despliegue.
- Pieza 4 exige instalador de la fase y recorrido en Windows limpio/VM. Esta prueba en navegador de Windows 11 **no equivale a instalar el EXE en un Windows limpio**, ni a firma de código. No se repitió el smoke del instalador coordinado por otra tarea.
- No se ejercitaron backup/restauración, cierre de caja, periféricos, desconexión real ni impresión como parte de esta pieza visual.
- La revisión de las 18 páginas D12 se hizo en otra pieza; este informe no duplica ni declara integrada su auditoría.

## Reproducción y limpieza

Comandos de preparación ejecutados en la copia aislada: `pnpm install --offline --frozen-lockfile`, `pnpm db:generate`, migraciones Prisma, seed demo y `pnpm build`. La web se sirvió con `vite preview --host 127.0.0.1 --port 4177 --strictPort`, API local en 3157 y PostgreSQL local en 5457. Los secretos aleatorios de la copia no forman parte del informe ni del commit.

Al terminar se cerraron las pestañas creadas para la prueba, se restableció el tamaño normal del navegador y se detuvieron API, Vite y el PostgreSQL propios mediante `node scripts/local-db.mjs --detener`. Se comprobó que ya no había listeners en 3157, 4177 ni 5457. No se cerraron navegadores/sesiones ajenas ni procesos de otros trabajadores.

Las capturas entregadas son PNG, convertidas sin redimensionar a partir de los JPEG nativos del capturador; no se retocó su contenido. Las capturas corresponden a momentos distintos de la misma sesión de pruebas, por lo que ventas/stock demo pueden variar entre imágenes. Se revisaron las miniaturas y se recapturaron encuadres incorrectos o estados de carga. Algunas imágenes de Caja incluyen secciones inferiores aún cargando; se usan para el título/caja visible, no como prueba del historial completo.

## Índice de capturas

Ver la tabla siguiente para abrir el ancho requerido. Los nombres incluyen código, pantalla, rol y anchura.

| Código / pantalla / rol        | 1366 px                                                         | 390 px                                                         |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------- |
| c1-cobro-cajera                | —                                                               | [Abrir](capturas-12nov/c1-cobro-cajera-390.png)                |
| c1-sin-cliente-cajera          | [Abrir](capturas-12nov/c1-sin-cliente-cajera-1366.png)          | [Abrir](capturas-12nov/c1-sin-cliente-cajera-390.png)          |
| c1-sin-cliente-duena           | [Abrir](capturas-12nov/c1-sin-cliente-duena-1366.png)           | [Abrir](capturas-12nov/c1-sin-cliente-duena-390.png)           |
| c1-sin-cliente-gerente         | [Abrir](capturas-12nov/c1-sin-cliente-gerente-1366.png)         | [Abrir](capturas-12nov/c1-sin-cliente-gerente-390.png)         |
| c12-caja-cajera                | [Abrir](capturas-12nov/c12-caja-cajera-1366.png)                | [Abrir](capturas-12nov/c12-caja-cajera-390.png)                |
| c12-caja-duena                 | [Abrir](capturas-12nov/c12-caja-duena-1366.png)                 | [Abrir](capturas-12nov/c12-caja-duena-390.png)                 |
| c12-caja-gerente               | [Abrir](capturas-12nov/c12-caja-gerente-1366.png)               | [Abrir](capturas-12nov/c12-caja-gerente-390.png)               |
| c12-clientes-cajera            | [Abrir](capturas-12nov/c12-clientes-cajera-1366.png)            | [Abrir](capturas-12nov/c12-clientes-cajera-390.png)            |
| c12-clientes-duena             | [Abrir](capturas-12nov/c12-clientes-duena-1366.png)             | [Abrir](capturas-12nov/c12-clientes-duena-390.png)             |
| c12-clientes-gerente           | [Abrir](capturas-12nov/c12-clientes-gerente-1366.png)           | [Abrir](capturas-12nov/c12-clientes-gerente-390.png)           |
| c12-resumen-duena              | [Abrir](capturas-12nov/c12-resumen-duena-1366.png)              | [Abrir](capturas-12nov/c12-resumen-duena-390.png)              |
| c12-resumen-gerente            | [Abrir](capturas-12nov/c12-resumen-gerente-1366.png)            | [Abrir](capturas-12nov/c12-resumen-gerente-390.png)            |
| c12-venta-finalizada-cajera    | [Abrir](capturas-12nov/c12-venta-finalizada-cajera-1366.png)    | [Abrir](capturas-12nov/c12-venta-finalizada-cajera-390.png)    |
| c12-venta-finalizada-duena     | [Abrir](capturas-12nov/c12-venta-finalizada-duena-1366.png)     | [Abrir](capturas-12nov/c12-venta-finalizada-duena-390.png)     |
| c12-venta-finalizada-gerente   | [Abrir](capturas-12nov/c12-venta-finalizada-gerente-1366.png)   | [Abrir](capturas-12nov/c12-venta-finalizada-gerente-390.png)   |
| c12-ventas-duena               | [Abrir](capturas-12nov/c12-ventas-duena-1366.png)               | [Abrir](capturas-12nov/c12-ventas-duena-390.png)               |
| c12-ventas-gerente             | [Abrir](capturas-12nov/c12-ventas-gerente-1366.png)             | [Abrir](capturas-12nov/c12-ventas-gerente-390.png)             |
| c13-descuento-10-cajera        | [Abrir](capturas-12nov/c13-descuento-10-cajera-1366.png)        | [Abrir](capturas-12nov/c13-descuento-10-cajera-390.png)        |
| c13-descuento-10-duena         | [Abrir](capturas-12nov/c13-descuento-10-duena-1366.png)         | [Abrir](capturas-12nov/c13-descuento-10-duena-390.png)         |
| c13-descuento-10-gerente       | [Abrir](capturas-12nov/c13-descuento-10-gerente-1366.png)       | [Abrir](capturas-12nov/c13-descuento-10-gerente-390.png)       |
| c13-descuento-11-cajera        | [Abrir](capturas-12nov/c13-descuento-11-cajera-1366.png)        | [Abrir](capturas-12nov/c13-descuento-11-cajera-390.png)        |
| c13-descuento-11-duena         | [Abrir](capturas-12nov/c13-descuento-11-duena-1366.png)         | [Abrir](capturas-12nov/c13-descuento-11-duena-390.png)         |
| c13-descuento-11-gerente       | [Abrir](capturas-12nov/c13-descuento-11-gerente-1366.png)       | [Abrir](capturas-12nov/c13-descuento-11-gerente-390.png)       |
| c13-pin-11-cajera              | [Abrir](capturas-12nov/c13-pin-11-cajera-1366.png)              | [Abrir](capturas-12nov/c13-pin-11-cajera-390.png)              |
| c13-pin-tardio-gerente         | [Abrir](capturas-12nov/c13-pin-tardio-gerente-1366.png)         | [Abrir](capturas-12nov/c13-pin-tardio-gerente-390.png)         |
| c13-sin-pin-10-cajera          | [Abrir](capturas-12nov/c13-sin-pin-10-cajera-1366.png)          | —                                                              |
| c13-sin-pin-11-duena           | [Abrir](capturas-12nov/c13-sin-pin-11-duena-1366.png)           | [Abrir](capturas-12nov/c13-sin-pin-11-duena-390.png)           |
| c13-sin-pin-11-gerente         | [Abrir](capturas-12nov/c13-sin-pin-11-gerente-1366.png)         | [Abrir](capturas-12nov/c13-sin-pin-11-gerente-390.png)         |
| c15-stock-insuficiente-cajera  | [Abrir](capturas-12nov/c15-stock-insuficiente-cajera-1366.png)  | [Abrir](capturas-12nov/c15-stock-insuficiente-cajera-390.png)  |
| c15-stock-insuficiente-duena   | [Abrir](capturas-12nov/c15-stock-insuficiente-duena-1366.png)   | [Abrir](capturas-12nov/c15-stock-insuficiente-duena-390.png)   |
| c15-stock-insuficiente-gerente | [Abrir](capturas-12nov/c15-stock-insuficiente-gerente-1366.png) | [Abrir](capturas-12nov/c15-stock-insuficiente-gerente-390.png) |
| c6-solicitud-cajera            | [Abrir](capturas-12nov/c6-solicitud-cajera-1366.png)            | [Abrir](capturas-12nov/c6-solicitud-cajera-390.png)            |
| c9-c12-ventas-cajera           | [Abrir](capturas-12nov/c9-c12-ventas-cajera-1366.png)           | [Abrir](capturas-12nov/c9-c12-ventas-cajera-390.png)           |
| d11-uso-ia-duena               | [Abrir](capturas-12nov/d11-uso-ia-duena-1366.png)               | [Abrir](capturas-12nov/d11-uso-ia-duena-390.png)               |
| d5-bitacora-duena              | [Abrir](capturas-12nov/d5-bitacora-duena-1366.png)              | [Abrir](capturas-12nov/d5-bitacora-duena-390.png)              |
| d5-permisos-duena              | [Abrir](capturas-12nov/d5-permisos-duena-1366.png)              | [Abrir](capturas-12nov/d5-permisos-duena-390.png)              |
| d5-usuarios-duena              | [Abrir](capturas-12nov/d5-usuarios-duena-1366.png)              | [Abrir](capturas-12nov/d5-usuarios-duena-390.png)              |
