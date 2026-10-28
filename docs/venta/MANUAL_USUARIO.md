# Manual de usuario · Nexora POS

> BORRADOR de inducción interna. Los nombres de pantallas y botones corresponden
> a la app tal como está hoy (28-oct). Fecha: 2026-10-27.

## Roles y qué ve cada uno

| Rol | Quién es | Pantallas principales |
|---|---|---|
| **Administración** | La dueña | Todo, incluidas «Conciliar transferencias», «Envíos del mensajero» y «Configuración» |
| **Gerencia** | Gerente | Caja, ventas, productos, inventario, compras, clientes, reportes, promociones, incentivos, GV |
| **Cajera** | Quien vende en caja | Punto de venta, Ventas, Caja, Clientes |
| **Bodega** | Quien recibe mercancía | Inventario, Compras |

Las pantallas se muestran según el permiso; si no ves una opción es porque tu
rol no la tiene.

---

## 1. Entrar y salir

1. Abre la app y escribe tu **usuario o correo** y tu **contraseña**.
2. Pulsa **«Entrar a mi tienda»**.
3. Si el sistema te pide cambiar la contraseña la primera vez, crea una clave
   personal y pulsa **«Guardar contraseña y entrar»**.
4. Para salir, abre el menú de tu cuenta (arriba a la derecha) y elige cerrar
   sesión. Al cerrar se cierran tus otras sesiones abiertas.

---

## 2. Abrir la caja

1. Entra a **«Punto de venta»**.
2. Pulsa **«Abre tu caja para comenzar»**.
3. Indica el **fondo** (efectivo inicial). El sistema puede sugerir lo que
   dejaste en tu último cierre.

> La caja es **ciega**: el sistema nunca completa un importe por ti. Lo que no
> declares no se cuenta.

---

## 3. Vender

1. En **«Punto de venta»**, busca el producto por nombre o escaneando el código.
2. Pulsa el producto para agregarlo al carrito; ajusta la cantidad.
3. Si aplica un descuento, usa **«Descuento global»** o el descuento de la línea.
4. Si el cliente quiere pagar a crédito, primero **selecciona al cliente**
   (F4) y elige o crea el cliente.
5. Pulsa **cobrar** y elige la forma de pago:
   - **Efectivo**, **Tarjeta**, **Transferencia**, **Crédito**, **Contraentrega**
     o **Nota de crédito**.
6. Si son varias formas de pago, escribe el monto y pulsa **«Agregar pago»**;
   repite hasta cubrir el total y finaliza una sola vez.
7. Confirma y entrega/recibe el recibo (impreso, WhatsApp o correo).

> **Aprobación por monto**: si una venta a crédito o contraentrega supera el
> umbral (RD$ 1,000 por defecto), el sistema pide el **PIN de un gerente**.

---

## 4. Devolver y anular

1. Ve a **«Ventas»** y abre la venta.
2. Usa **devolución** para reponer la mercancía (o no, según la política de la
   tienda); el sistema concilia el costo con la venta original.
3. Para anular una factura ya emitida, crea una **«Solicitud de anulación»**;
   un gerente o la administración la aprueba (la aprueba la dueña si la caja ya
   cerró y hubo efectivo, para el reembolso).

---

## 5. Cerrar la caja (cierre ciego)

1. Ve a **«Caja»**.
2. Declara por cada forma de pago lo que realmente tienes:
   - **Efectivo contado** (o el conteo por **denominaciones**: 1, 5, 10, 20, 25,
     50, 100, 200, 500, 1000, 2000).
   - **Tarjeta** y **Transferencia** (obligatorias).
   - **Vales** y efectivo en dólares/euros si aplica.
3. Si hubo **descuadre** (falta o sobra), escribe la **justificación**.
4. Indica cuánto **entregas a la dueña** (no puede superar el efectivo contado)
   y cuánto dejas en caja.

---

## 6. Cobrar un crédito

1. Ve a **«Clientes»** y abre la cuenta del cliente.
2. Pulsa **abonar** (o registra el abono desde la venta pendiente).
3. Si el dinero **no llegó al banco**, usa la opción de abono informativo: no
   descuenta la deuda ni entra a caja. Si el cliente vuelve a pagar, registra un
   abono nuevo.

---

## 7. Inventario y mercancía

- **«Inventario»**: pulsa **Contar** junto a un artículo para registrar su
  existencia real; ve los **traspasos** entre sucursales.
- **«Compras»**: crea una **Orden de compra** y, al recibir, registra unidades
  buenas, dañadas o rechazadas con su motivo.
- **«Mercancía»**: entradas, salidas y ajustes de mercancía (solo personal con
  permiso `inventory:write`).

---

## 8. Reportes

En **«Reportes»** tienes ventas, utilidad/margen, clientes y los formatos
fiscales (606, 607, 608). El **margen** se calcula como
`(precio − costo) / precio`, **sin restar ITBIS**.

- **«Resumen»** (el tablero «Hoy») muestra un vistazo: ventas del día, utilidad,
  cajas activas y alertas de inventario.

---

## 9. Tareas de la dueña (administración)

- **«Configuración»**: define impuestos, permisos, tasa del dólar, política de
  devoluciones y datos de la tienda.
- **«Configuración › Equipos»**: aprueba o bloquea un equipo para que pueda
  vender y mover mercancía.
- **«Promociones»** y **«Incentivos»**: define ofertas y la tarifa que gana cada
  cajera por unidad vendida. **«Cerrar mes»** guarda el cuadre de incentivos y
  ya no cambia.
- **«Conciliar transferencias»** y **«Envíos del mensajero»**: revisa
  transferencias pendientes y liquidación de envíos.

---

## Atajos útiles

- **F4** en Punto de venta: seleccionar el cliente.
- El **lector de código** agrega productos sin escribir.
- La app guarda el carrito localmente: si sales sin cobrar, lo recuperas al
  volver a entrar.
