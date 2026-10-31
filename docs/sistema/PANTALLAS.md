# Pantallas del menú

Rama `cola-n26` (= `nexora-cloud`). El menú lateral sale de la lista `navigation` en `apps/web/src/App.tsx:194-283`; cada persona solo ve las pantallas cuyo permiso tiene (`apps/web/src/App.tsx:653-655`, `:1000-1011`). Si entra a una que no le toca, el sistema lo manda a la primera que sí puede ver (`apps/web/src/App.tsx:733-740`). El componente de cada pantalla se asigna en `apps/web/src/App.tsx:927-950`.

Permiso `*` = administración (dueña). Los permisos están explicados en `ROLES_Y_PERMISOS.md`.

## Orden y etiquetas del menú (exactas)

| # | Etiqueta | Permiso | Componente | Línea en `App.tsx` |
|---|---|---|---|---|
| 1 | **Mercancía** | `inventory:write` | `Merchandise` (`apps/web/src/Merchandise.tsx:279`) | 197 |
| 2 | **Resumen** | `reports:read` | `Dashboard` (`apps/web/src/Dashboard.tsx:107`) | 203 |
| 3 | **Punto de venta** | `sale:write` | `POS` (`apps/web/src/POS.tsx:193`) | 209 |
| 4 | **Ventas** | `sale:write` | `SalesHistory` (`apps/web/src/Management.tsx:3135`) | 213 |
| 5 | **Solicitudes de anulación** | `sale:write` | `VoidRequests` (`apps/web/src/VoidRequests.tsx:15`) | 216 |
| 6 | **Conciliar transferencias** | `*` | `TransferReconciliation` (`apps/web/src/TransferReconciliation.tsx:28`) | 222 |
| 7 | **Envíos del mensajero** | `*` | `CourierPayouts` (`apps/web/src/CourierPayouts.tsx:26`) | 228 |
| 8 | **Productos** | `catalog:read` | `Catalog` (`apps/web/src/Management.tsx:235`) | 234 |
| 9 | **Inventario** | `inventory:write` | `Inventory` (`apps/web/src/Management.tsx:781`) | 240 |
| 10 | **Compras** | `purchase:write` | `Purchases` (`apps/web/src/Management.tsx:1158`) | 246 |
| 11 | **Caja** | `cash:write` | `Cash` (`apps/web/src/Management.tsx:1591`) | 250 |
| 12 | **Gastos** | `expense:write` | `Expenses` (`apps/web/src/Management.tsx:1376`) | 253 |
| 13 | **Clientes** | `customers:write` | `Customers` (`apps/web/src/Management.tsx:2272`) | 259 |
| 14 | **Promociones** | `promotions:write` | `Promotions` (`apps/web/src/Management.tsx:2431`) | 265 |
| 15 | **Reportes** | `reports:read` | `Reports` (`apps/web/src/Management.tsx:2817`) | 271 |
| 16 | **Alertas** | `alerts:write` | `Alerts` (`apps/web/src/Management.tsx:3013`) | 275 |
| 17 | **Incentivos** | `sale:manage` | `IncentivesPage` (`apps/web/src/Incentives.tsx:287`) | 278 |
| 18 | **GV Makeup Studio** | `gv:read` | `Gv` (`apps/web/src/Gv.tsx:111`) | 282 |

Fuera de la lista (abajo del menú, `apps/web/src/App.tsx:1019-1049`):

- **Ver ayuda** (tarjeta «Ayuda para trabajar»): abre «Tu tienda, en movimiento» con los atajos (`apps/web/src/App.tsx:1019-1021`, `:1230-1262`).
- **Configuración**: solo si tiene `sale:manage` (`apps/web/src/App.tsx:1024-1031`). Componente `Configuration` (`apps/web/src/Management.tsx:3985`). Aquí viven «Usuarios y permisos», «Bitácora» y «Equipos».
- **Acerca de** (`apps/web/src/App.tsx:1033-1041`): versión, aviso de privacidad, licencias.
- **Guía de estilos**: solo si `SHOW_STYLE_GUIDE` (`apps/web/src/App.tsx:1043-1048`); no es de uso diario.
- Ctrl+K abre «¿A dónde quieres ir?» para saltar de pantalla (`apps/web/src/App.tsx:1202-1228`, atajo `:797`).
- F9 lleva a Mercancía, F7 y F10 a Productos (`apps/web/src/App.tsx:812`).

**No existe** en este menú: «Primeros pasos» ni «Plan y facturación» (solo en `producto-nexora`, ver `RESPUESTAS_A_TALLER.md` pregunta 9). Tampoco existe un ítem llamado «Gestión» ni uno llamado «Usuarios»: la gestión de usuarios es la pestaña «Usuarios y permisos» dentro de Configuración (`apps/web/src/Management.tsx:4155`). NO ENCONTRADO como etiqueta de menú.

---

## Punto de venta (Caja registradora)

- **Etiqueta:** «Punto de venta». **Permiso:** `sale:write`. **Componente:** `apps/web/src/POS.tsx:193`.
- **Qué hace:** catálogo de tarjetas a la izquierda, carrito «Venta actual» a la derecha, botón «Cobrar».
- **Flujo corto:** abrir caja (pantalla «Caja») → elegir cliente → un clic en la tarjeta del producto (o escanear/buscar) → descuentos si aplican → «Cobrar» → «Agregar pago» → «Finalizar venta» → «Imprimir recibo».
- Detalle completo: `FLUJO_CAJA_POS.md`.

## Caja

- **Etiqueta:** «Caja». **Permiso:** `cash:write`. **Componente:** `Cash`, `apps/web/src/Management.tsx:1591`. Título en pantalla: «Una caja que siempre cuadra» (`:1670`).
- **Qué hace:** abrir caja («Abrir caja», `:1674-1677`), «Movimiento» de efectivo (entrada/salida, `:1688-1692`), «Cerrar y arquear» (`:1693`), ventas guardadas sin conexión (`:1750-1917`), «Historial de cajas» con botones «Cuadre», «Venta diaria», «Por forma de pago» (`:1918-2014`; `apps/web/src/Tienda.tsx:475-505`), y el panel **«Créditos pendientes»** (crédito y contraentrega) (`apps/web/src/Tienda.tsx:585-786`). También muestra «Mis incentivos» (`:1748`).
- **Flujo corto:** «Abrir caja» → vender en Punto de venta → (si hace falta) «Movimiento» → al terminar «Cerrar y arquear» → contar → «Cerrar caja e imprimir cuadre».
- Detalle: `FLUJO_CAJA_POS.md` y `FLUJO_COBROS_Y_TRANSFERENCIAS.md`.

## Ventas (historial)

- **Etiqueta:** «Ventas». **Permiso:** `sale:write`. **Componente:** `SalesHistory`, `apps/web/src/Management.tsx:3135`. Título: «Cada venta tiene una historia» (`:3164`).
- **Columnas:** Venta n.º, Cliente, Fecha, Estado (Completada/Anulada), Total, Saldo pendiente, Pagos, Acciones (`:3188-3237`). Busca por número o por fecha (`:3169-3182`).
- **Acciones por fila:** ver (ojo), PDF del recibo (`:3247-3257`), «Registrar abono» (solo `*`, `:3277`), «Solicitar anulación» (la vendedora que hizo la venta, no `*`, `:3293`), «Devolver» (`sale:manage`, `:3317`), «Anular» (solo `*`, `:3332`).
- Dentro del detalle: «Verificar», «Rechazar», «Corregir banco y referencia» de transferencias (solo `*`), y en cada cobro: «Des-verificar transferencia» (solo `*`, transferencia de venta ya verificada; `POST payments/:id/unverify`, pide motivo) y «Mover cobro a otra caja» (solo `*`, con el motivo y la caja destino; `POST payments/:id/move-cash-session`) y «Imprimir nota NC-xxxxxx» (`:3402`). Panel «Corregir factura» (vendedora, al por mayor, método de pago; solo `*`, hasta 7 días) en `apps/web/src/SaleEditPanel.tsx:80-190`.

## Solicitudes de anulación

- **Etiqueta:** «Solicitudes de anulación». **Permiso:** `sale:write`. **Componente:** `apps/web/src/VoidRequests.tsx:15`.
- **Qué hace:** lista (filtro Pendientes/Todas/Aprobadas/Rechazadas/Canceladas, `:45-54`). La administración ve «Aprobar y anular» y «Rechazar» (`:123-136`); la cajera solo puede cancelar su propia solicitud (`:137-155`).
- **Flujo:** cajera pide en Ventas → «Solicitar anulación» → administración abre esta pantalla → «Aprobar y anular» (aprobar: `apps/api/src/sales.ts:2064`, `POST void-requests/:id/approve`).

## Conciliar transferencias

- **Etiqueta:** «Conciliar transferencias». **Permiso:** `*` (el contenido dice «Esta pantalla es solo para administración», `apps/web/src/TransferReconciliation.tsx:54`). **Componente:** `apps/web/src/TransferReconciliation.tsx:28`.
- **Qué hace:** compara cada factura pagada por transferencia con el banco: filtro «Fecha del pago (opcional)», «Todas las fechas», «Exportar lista a CSV» (`:192-218`); seleccionas facturas, escribes «Total del banco (RD$)», ves la «Diferencia» y pulsas «Verificar seleccionadas» (`:388-425`). También «Rechazar» (`:355-380`) y «Editar envío».
- Detalle: `FLUJO_COBROS_Y_TRANSFERENCIAS.md`.

## Envíos del mensajero

- **Etiqueta:** «Envíos del mensajero». **Permiso:** `*`. **Componente:** `apps/web/src/CourierPayouts.tsx:26`.
- **Qué hace:** lista los envíos pendientes de pago al mensajero («Pendientes», `:175`), se seleccionan y se pulsa «Marcar como pagado» (`:219-226`); «Historial de pagados» (`:230`). El envío va aparte del total de la venta: no es venta, ganancia ni ITBIS (`apps/web/src/POS.tsx:2894-2898`).

## Productos

- **Etiqueta:** «Productos». **Permiso:** `catalog:read` (editar requiere `catalog:write`). **Componente:** `Catalog`, `apps/web/src/Management.tsx:235`. Título: «Tu catálogo, con personalidad» (`:291`).
- **Qué hace:** catálogo con variantes, precios, códigos de barras y etiquetas; botones «Plantilla» y «Importar Excel» (`:311-340`, API `apps/api/src/catalog.ts:195`, `:587`). Productos y variantes: `apps/api/src/catalog.ts:378-496`.

## Inventario

- **Etiqueta:** «Inventario». **Permiso:** `inventory:write`. **Componente:** `Inventory`, `apps/web/src/Management.tsx:781`. Título: «Cada unidad, bajo control» (`:839`).
- **Qué hace:** selector «Almacén» (Todos/Casa/Tienda, `:842-853`), pestañas «Stock actual» y «Conteos físicos» (`:858-870`), acciones «Ajustar», «Contar» y Kardex por fila (`:945-962`), «Aprobar ajuste» a los conteos (`:1007`, solo `sale:manage`), y el panel **«Almacenes y traspasos»** con «Traspasar mercancía» y «Levantamiento inicial de Casa» (`apps/web/src/WarehousesPanel.tsx:74-290`).
- Detalle: `FLUJO_MERCANCIA.md`.

## Mercancía

- **Etiqueta:** «Mercancía». **Permiso:** `inventory:write` (la vendedora/`seller` está bloqueada aunque tenga el permiso, `apps/api/src/merchandise.ts:155-157`). **Componente:** `apps/web/src/Merchandise.tsx:279`.
- **Qué hace:** registrar **ENTRADA** y **SALIDA** de mercancía con revisión antes de confirmar (`:632-657`); importar la factura del proveedor (`:822-846`), escanear/buscar productos, «Confirmar entrada» / «Confirmar salida» (`:1297-1310`), «Historial de recepciones», «Entradas recientes» con «Etiquetas», y «Pendientes de este equipo» (cola sin conexión) (`:1311-1400`).
- Detalle: `FLUJO_MERCANCIA.md`.

## Compras

- **Etiqueta:** «Compras». **Permiso:** `purchase:write`. **Componente:** `Purchases`, `apps/web/src/Management.tsx:1158`. Título: «Compras que impulsan tu tienda» (`:1182`).
- **Qué hace:** botones «Proveedor» y «Orden de compra» (`:1185-1192`); pestañas «Órdenes», «Proveedores» y «Recepciones» (`:1196-1215`); recibir una orden (botón por fila), pagar a proveedor (`:1348-1370`). Editores: `apps/web/src/Purchases.tsx:181` (orden) y `:338` (recepción).

## Gastos

- **Etiqueta:** «Gastos». **Permiso:** `expense:write`. **Componente:** `Expenses`, `apps/web/src/Management.tsx:1376`. Título: «Tus gastos, sin sorpresas» (`:1395`). Botón «Registrar gasto» (`:1400`), presupuesto mensual por categoría (`:1404-1430`). API: `apps/api/src/admin.ts:643-737`.

## Clientes

- **Etiqueta:** «Clientes». **Permiso:** `customers:write`. **Componente:** `Customers`, `apps/web/src/Management.tsx:2272`. Título: «Personas que vuelven a elegirte» (`:2304`). Botón «Nuevo cliente». Teléfono, cédula y correo completos solo para `sale:manage` o `customers:erase` (el resto los ve enmascarados) (`apps/api/src/common.ts:276-281`). Anonimizar un cliente requiere `customers:erase` (`apps/api/src/admin.ts:351-352`).

## Promociones

- **Etiqueta:** «Promociones». **Permiso:** `promotions:write`. **Componente:** `Promotions`, `apps/web/src/Management.tsx:2431`. Título: «Dale una nueva oportunidad» (`:2451`). Pestañas «Candidatos a liquidación» y «Mis promociones» (`:2475-2485`); botón «Nueva promoción». Tipos de promoción que entiende la caja: porcentaje, monto, precio especial, NxM y segunda a mitad (`apps/web/src/POS.tsx:117-146`). **La caja aplica el descuento; no se cambia el precio del producto.**

## Reportes

- **Etiqueta:** «Reportes». **Permiso:** `reports:read`. **Componente:** `Reports`, `apps/web/src/Management.tsx:2817`. Título: «Los números cuentan tu historia» (`:2861`).
- **Qué hace:** menú de reportes agrupados (Ventas, etc., `:2733-2800`), elegir el reporte, «Desde»/«Hasta», botones «Excel» y «PDF» (`:2930-2945`, hasta 50,000 filas en Excel y 10,000 en PDF, `:2980`). Lista base de 20 reportes en `:2706-2730` (por ejemplo «Ventas detalladas», «Utilidad por producto», «Inventario valorizado», «Cierres y diferencias», «Ventas por método de pago», «Ingresos por día y método», «Informe formal diario/mensual»). Los de utilidad/margen solo con `profit:read` (`apps/web/src/Management.tsx:2870`). El servidor suma más reportes (hasta 40) en `GET /reportes` (`apps/api/src/reports.ts:684`; carpeta `apps/api/src/reportes/`).

## Resumen

- **Etiqueta:** «Resumen». **Permiso:** `reports:read`. **Componente:** `apps/web/src/Dashboard.tsx:107`. Encabezado «EL PULSO DE TU NEGOCIO» (`:176`).
- **Qué hace:** periodo («Este mes», «Últimos 7 días», «Otro día…», `:188-191`), ventas del periodo, «Así van tus ventas», «Un poco de atención», «Los favoritos de tu tienda», «Cada categoría cuenta», «Comparativo anual», «Horas pico» (`:378-640`), gastos, comisiones bancarias, mermas y «Ganancia neta» (solo con `profit:read`, `:663-681`). A la administración le avisa de solicitudes de anulación pendientes y deja aprobarlas desde aquí (`:233-282`).

## Alertas

- **Etiqueta:** «Alertas». **Permiso:** `alerts:write`. **Componente:** `Alerts`, `apps/web/src/Management.tsx:3013`. Título: «Lo importante, a tiempo» (`:3026`). Pestañas «Nuevas», «Vistas», «Resueltas», «Todas» (`:3037-3043`). Tipos que genera el motor: transferencia sin verificar (`apps/api/src/sales.ts:1385-1405`), vale de caja (`apps/api/src/cash.ts` cierre), descuadre de caja, margen bajo (`apps/api/src/alerts.ts:507`), etc. Reglas editables solo por `*` (`apps/api/src/alerts.ts:909-912`).

## Incentivos

- **Etiqueta:** «Incentivos». **Permiso:** `sale:manage`. **Componente:** `IncentivesPage`, `apps/web/src/Incentives.tsx:287`. Reporte mensual por cajera; la administración (`*`) cierra el mes (`:306-318`, API `apps/api/src/incentives.ts:852`). La cajera ve el suyo en «Mis incentivos» dentro de Caja (`apps/api/src/incentives.ts:754`). Reglas: `docs/INCENTIVOS.md`.

## GV Makeup Studio

- **Etiqueta:** «GV Makeup Studio». **Permiso:** `gv:read`. **Componente:** `Gv`, `apps/web/src/Gv.tsx:111`. Título en pantalla: «Cursos y cobros» (`:122`).
- **Pestañas internas:** «Cursos», «Citas», «Interesadas», «Por verificar» y «Reportes» (esta última solo con `gv:reports`) (`apps/web/src/Gv.tsx:129-174`).
- Detalle completo: `GV.md`.

## Configuración (lo que el equipo llama «gestión»)

- **Etiqueta:** «Configuración» (botón al fondo del menú, `sale:manage`). **Componente:** `apps/web/src/Management.tsx:3985`. Título «A la medida de tu negocio» (`:4150`).
- **Pestañas** (`:4155-4158`):
  - **Negocio y reglas:** datos del negocio, «Editar configuración» (descuento vendedor 10 %, margen bajo 15 %, devolución, tasa del dólar, cuentas de banco para transferencias, terminales de tarjeta, imprimir el recibo automáticamente, ventas sin conexión, ventas a crédito, preparación de NCF, ITBIS incluido: `:4026-4141`), cajas y cajeros (`apps/web/src/Tienda.tsx:1240-1372`), avisos por Telegram, respaldo a Drive, tasas de incentivos y encuesta de caja (`:4223-4227`).
  - **Usuarios y permisos:** «Crear usuario», Editar, «Restablecer contraseña», Activar/Desactivar y «Permisos por rol» (`:4230-4310`).
  - **Bitácora:** registro de acciones (`:4312-4335`).
  - **Equipos:** aprobar o revocar equipos (`:4171`).
- **Ojo:** guardar la configuración (`PUT /settings`) y administrar usuarios/roles exigen `*` en la API (`apps/api/src/admin.ts:839-840`, `:1024`, `:1056`, `:1296-1300`), aunque el botón de Configuración lo vea un gerente (`sale:manage`). DUDOSO: qué ve exactamente un gerente que no es `*` al abrir cada pestaña; no se probó.

## Usuarios

No es un ítem de menú. Se administra en Configuración › «Usuarios y permisos» (ver arriba y `ROLES_Y_PERMISOS.md`). Cada persona puede además «Cambiar mi contraseña» y «Cerrar sesión» desde su cuenta, y cambiar de usuario con PIN (`apps/web/src/App.tsx:1161`, `:1171`, `:1184`).

## Desglose del mes («Ver detalle del mes», `#month-report?from=&to=`)

Permiso `reports:read`; no está en el menú, se abre desde el panel anual (`apps/web/src/MonthReport.tsx`). Datos: `GET /dashboard/breakdown` (`apps/api/src/reports.ts`, «dashboard/breakdown»).
- **Formas de pago** (solo con permiso de esperado de caja): reparte la venta bruta de cada categoría según cómo se pagó cada factura. Renglones: efectivo, tarjeta, transferencia verificada, nota de crédito, y los que no son cobro: **Por cobrar (crédito y contraentrega)** = saldo pendiente `Sale.creditBalance`; **Transferencias por verificar** = pago `pending_verification`; **Sin cobro registrado** = lo que la factura vale y no tiene fila de pago; **Crédito ya cobrado** = parte del crédito que ya se abonó. Identidad: todos los renglones juntos = «Venta bruta» (con devoluciones restadas, D-05). Solo lectura: no cambia ventas, cobros ni caja.
- **Cobros por banco** (paso 2): bajo el gráfico de formas de pago, lista «Transferencia · <banco>» (y «Tarjeta · <banco>» si el cobro trae banco), agrupada por `Payment.bank`; los cobros sin banco no salen en esta lista (`apps/web/src/PaymentMixPie.tsx:50`, solo entra `r.bank`). Tarjeta crédito y débito van juntas en «Tarjeta» (el desglose agrupa por `method`, no por `cardType`). `GET /dashboard/breakdown` devuelve `payments[].bank`; la suma de todos los renglones sigue siendo la venta bruta. El CSV añade la columna «Banco». Prueba: `tests/desglose-suma-api.test.ts`.
- **Top 10 por categoría** (paso 3): sección con selector de categoría (la lista sale de las ventas del período, una categoría nueva aparece sola) y dos botones «Por unidades» / «Por monto». `GET /dashboard/breakdown` devuelve `topByCategory[{category, byUnits[], byAmount[]}]` (10 variantes por lista, nombre, código, unidades, vendido; las devoluciones se descuentan igual que en `revenue`). Ganancia y margen (venta − costo, sin restar ITBIS) solo con `profit:read`: lo recorta `safe()` (`apps/api/src/common.ts`). Pruebas: `tests/desglose-suma-api.test.ts`, `tests/top-categoria-permisos.test.ts`.
- **Mes anterior / Mes siguiente** (paso 4): botones junto a «Desde/Hasta» en `MonthReport.tsx`; cambian `from`/`to` al mes completo anterior o siguiente (el mes en curso termina hoy; «Mes siguiente» se apaga en el mes en curso). Prueba: `tests/e2e/desglose-mes-movil.spec.ts`.
