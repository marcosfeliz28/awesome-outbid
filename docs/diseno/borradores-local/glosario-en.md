Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/GLOSARIO.md` (vía `glosario-simple.md`). Tarea N41. Una fila por término, mismo orden. Los nombres de botones y las rutas no se traducen.

# Glosario ES-EN

| ES | EN term | EN definition |
|---|---|---|
| Abono | Installment payment | A later payment on a sale that still had an open balance. |
| Aprobar con PIN / PIN de gerente | Approve with PIN / manager PIN | A manager's 6-digit code that authorizes a risky operation. |
| Arqueo / «Cerrar y arquear» | Cash-up / «Cerrar y arquear» | Counting the cash in the register and comparing it with what the system expects. |
| B01 / B02 | B01 / B02 | Invoice types that can only be requested; the system does not issue them. |
| Caja | Register (cash drawer) | The screen to open and close the shift, or a person's shift. |
| Caja ciega / arqueo ciego / conteo ciego | Blind register / blind count | The cashier does not see the expected amount; they declare what they counted and the system compares afterward. |
| Casa | Home (storage) | A storage area outside the store; moves only with an express order from the owner. |
| Cierre de emergencia | Emergency close | A manager or administrator closes another person's register. |
| Conciliar | Reconcile | Compare the system's transfers with the bank statement. |
| Conteo | Count | Physically counting stock; a manager approves the adjustment. |
| Consumidor final | Final consumer | A generic customer for sales without details; listed first when choosing a customer. |
| Contraentrega (`cod`) | Cash on delivery (`cod`) | A sale that leaves now and is paid when the courier brings the money. |
| Costo promedio (`costAvg`) | Average cost (`costAvg`) | A variant's cost, recalculated on every receipt; used for margin. |
| Crédito | Credit | A sale on the customer's account: goods leave now and are paid for later. |
| Cuadre | Register summary (cuadre) | The result of closing: what was counted against what was expected, with differences. |
| Datáfono / verifón / lote del verifón | Card terminal / terminal batch | The card machine; its batch is closed before closing the register. |
| Descuento | Discount | A markdown on a line or on the whole sale; always has a reason and may need a PIN. |
| Dueña | Owner | The user with all permissions, whose dated orders take precedence. |
| Entregado / Dejado en caja | Handed over / Left in register | Cash handed to the owner and cash left as the next opening float. |
| Envío / mensajero | Delivery fee / courier | The delivery charge kept apart from the total and later paid to the courier. |
| Equipo / terminal | Workstation / terminal | A registered computer; a new one needs a manager's approval. |
| En espera | On hold | A cart saved to continue later; quoting saves it as a quote. |
| Factura (venta) | Invoice (sale) | The number of a sale to the customer; the receipt is a non-fiscal document. |
| FEFO | FEFO | First expired, first out: the lot that expires first is sold first. |
| Fondo / «Efectivo inicial» | Float / «Efectivo inicial» | The money the register is opened with. |
| Génesis / Macgen | Génesis / Macgen | Names of the two groups of bank accounts. |
| Grupo MacGen | Grupo MacGen | The company that owns the store and the goods it sells. |
| GV / GV Makeup Studio | GV / GV Makeup Studio | A sister company for makeup courses and services. |
| ITBIS | ITBIS | An 18 % tax; prices include it and the margin does not subtract it. |
| Kardex | Kardex | The movement history of a variant. |
| Lote / vencimiento | Lot / expiry | A batch of a variant with a number and an expiry date. |
| Margen | Margin | (price − cost) / price, without subtracting ITBIS; the minimum is 15 %. |
| Merma | Shrinkage (merma) | Loss of goods from damage, expiry or samples; it is not a count. |
| NC-000000 / Nota de crédito | NC-000000 / Credit note | A return number, or a customer credit balance to redeem. |
| NCF / e-CF | Fiscal receipt number (not issued) | A fiscal receipt number that this system does not issue. |
| Norexos / «Nexora POS» (nombre anterior) | Norexos / «Nexora POS» (former name) | The product's new name; the code still shows the former one. |
| Ramas de producción y de producto | Production and product branches | The first branch is the live store; the second is the product. |
| Offline / sin conexión | Offline | Selling without internet only if the setting allows it; it syncs later. |
| Oferta / promoción | Offer / promotion | An automatic discount applied by the register without changing the price. |
| Por verificar (`pending_verification`) | To verify (`pending_verification`) | A transfer that has not yet been checked at the bank. |
| Por mayor («al por mayor») | Wholesale | A flag that only halves the cashier's incentive. |
| Recepción | Receiving | A record of what arrived from a purchase order or invoice. |
| Reembolsada (GV) | Refunded (GV) | The final state of a registration or appointment where money was returned. |
| RNC | RNC (taxpayer ID) | The National Taxpayer Registry, a company's identification. |
| Sesiones (equipo de trabajo) | Sessions (work team) | The Claude sessions and their roles: decides, goods, workshop, reviewer, director. |
| SKU / código de barras | SKU / barcode | Unique codes of each variant; the register searches by both. |
| Solicitud de anulación | Void request | A cashier's request to void their sale; administration approves it. |
| Traspaso | Transfer between warehouses | Moving goods between Home and Store in a single operation. |
| Transferencia | Bank transfer | Payment through the bank; asks for account and reference and stays to be verified. |
| Vale de caja | Cash voucher | A slip left in the drawer that offsets missing cash; requires a PIN. |
| Variante | Variant | A concrete combination of a product: size, color or flavor, with its own code. |
| Venta (estado `voided`) | Sale (`voided` status) | A voided sale: kept with its reason, stock is reversed and it does not count. |

## Qué NO comprobé
Las traducciones se hicieron a partir de las definiciones resumidas de `glosario-simple.md`; no las revisó una persona bilingüe ni se contrastaron con el código.
