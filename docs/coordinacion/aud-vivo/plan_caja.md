# AUD-VIVO · Plan de caja, productos y ventas

Estado: **PLAN NO EJECUTADO**. No se ha abierto el producto, iniciado sesión ni modificado ningún dato. Los importes, existencias y resultados siguientes son un escenario propuesto, no observaciones.

## Alcance y condiciones

- Trabajar exclusivamente en `https://nexorapos.net`, empresa `aud-chatgpt`; comprobar su identificación antes de cada bloque de operaciones. No acceder a la tienda excluida ni a Render.
- Esperar confirmación del responsable sobre acceso, estado inicial y turno asignado. Solo un agente mueve caja, stock o crédito a la vez; los demás contrastan después de cada corte.
- Usar únicamente opciones ofrecidas por la interfaz, a ritmo humano: revisar, introducir, comprobar el resultado y registrar evidencia antes de continuar. No reintentar un cobro con resultado incierto sin revisar el historial.
- Capturar el estado inicial real: moneda, zona horaria, impuestos incluidos/excluidos, redondeo, caja abierta, saldo, productos y permisos. Si difiere del supuesto de abajo, recalcular antes de operar.
- No almacenar credenciales en evidencias. No alterar productos preexistentes; prefijo `AUD-VIVO-` para datos de prueba. Registrar los identificadores reales generados.
- Escenario base en **unidades de la moneda configurada**, precios finales y sin recargo fiscal adicional. No cambiar impuestos para forzarlo. Si el producto exige impuestos, adaptar el oráculo a las reglas visibles.

## Productos propuestos

| SKU propuesto | Nombre propuesto | Stock inicial | Precio final | Costo unitario |
|---|---|---:|---:|---:|
| AUD-VIVO-A | Artículo A | 40 | 10,00 | 6,00 |
| AUD-VIVO-B | Artículo B | 30 | 25,00 | 15,00 |
| AUD-VIVO-C | Artículo C | 20 | 40,00 | 24,00 |

Antes de vender: comprobar alta, búsqueda por nombre/SKU, persistencia tras volver al listado, cantidades, costo/precio y búsqueda desde POS. Si la UI ofrece variantes o lector de códigos, añadir un caso separado sin contaminar este cálculo. Intentar guardar un formulario inválido sin confirmarlo y comprobar mensajes de campos obligatorios/precio negativo. No asumir que falta una función solo porque no se ha encontrado.

## Jornada operacional propuesta

Apertura en efectivo: **200,00**, desde una caja sin movimientos previos del escenario. Las cantidades de stock de la tabla son el resultado esperado acumulado después de cada paso. Si no existe un medio de pago o función, marcar **no disponible / no ejecutado**, sin sustituirlo silenciosamente; recalcular todos los pasos dependientes.

| Paso | Operación planeada | Total / efecto esperado | Medio de pago | Stock A / B / C | Efectivo esperado en caja |
|---|---|---:|---|---|---:|
| 0 | Abrir caja con fondo | +200,00 | Efectivo | 40 / 30 / 20 | 200,00 |
| V1 | A × 3 + B × 1 | 55,00 | Efectivo: recibido 100,00; cambio 45,00 | 37 / 29 / 20 | 255,00 |
| V2 | B × 2 + C × 1 | 90,00 | Tarjeta | 37 / 27 / 19 | 255,00 |
| V3 | A × 2 + C × 1 | 60,00 | Transferencia | 35 / 27 / 18 | 255,00 |
| V4 | A × 1 + B × 1 + C × 1 | 75,00 | Mixto: efectivo 35,00 + tarjeta 40,00 | 34 / 26 / 17 | 290,00 |
| V5 | A × 2 + B × 2 para cliente de auditoría | 70,00 | Crédito íntegro; deuda inicial del cliente 0 | 32 / 24 / 17 | 290,00 |
| V6 | A × 5, descuento 10 % sobre 50,00 | 45,00 | Efectivo: recibido 50,00; cambio 5,00 | 27 / 24 / 17 | 335,00 |
| V7 | C × 1, descuento fijo 5,00 | 35,00 | Transferencia | 27 / 24 / 16 | 335,00 |
| V8 | Preparar A × 4 + C × 2 y cancelar **antes del cobro** | 0,00; sin venta, cobro ni descuento de inventario | Ninguno | 27 / 24 / 16 | 335,00 |
| D1 | Devolución parcial de V1: A × 1, reintegrar al inventario | −10,00 | Reembolso efectivo 10,00 | 28 / 24 / 16 | 325,00 |
| C1 | Abono del cliente sobre V5 | 30,00; deuda restante 40,00 | Efectivo | 28 / 24 / 16 | 355,00 |
| M1 | Egreso de caja con motivo de auditoría | −15,00; no es devolución ni venta | Efectivo | 28 / 24 / 16 | 340,00 |
| M2 | Ingreso de caja con motivo de auditoría | +50,00; no es venta | Efectivo | 28 / 24 / 16 | 390,00 |

Registrar después de cada operación el ticket/ID, hora real, actor, total, desglose, stock y saldo observado. Dejar un corte sin nuevas operaciones para que el equipo de IA pueda preguntar y verificar contra datos estables.

## Oráculo aritmético al terminar

Solo aplica si se ejecuta íntegramente el escenario base con las reglas indicadas:

- Ventas brutas antes de descuentos y devolución: **440,00**.
- Descuentos: **10,00** (5,00 porcentual + 5,00 fijo).
- Ventas después de descuentos: **430,00**; devolución: **10,00**; venta neta: **420,00**.
- Venta neta por medio original: efectivo **125,00**, tarjeta **130,00**, transferencia **95,00**, crédito **70,00**. Suma: **420,00**.
- El abono de deuda **30,00** aumenta caja y reduce cuentas por cobrar; **no vuelve a sumar ventas**. Cuenta por cobrar final: **40,00**.
- Caja esperada: `200 + 55 + 35 + 45 − 10 + 30 − 15 + 50 = 390,00`.
- Stock final: A **28**, B **24**, C **16**. Unidades netas vendidas: **12 + 6 + 4 = 22**.
- Costo neto propuesto: `12×6 + 6×15 + 4×24 = 258,00`. Margen bruto aritmético: **162,00**, únicamente si el reporte usa este costo y excluye impuestos/gastos. No confundirlo con beneficio neto.

Contrastar tickets, historial de ventas, inventario, crédito, movimientos de caja y reportes. Documentar explícitamente si un reporte muestra cobros, facturación, ventas anuladas, descuentos o impuestos con otra definición válida.

## Cierre y perfiles

1. Cajera: revisar totales de su turno, contar **390,00** en el escenario base y cerrar. Capturar el resumen antes y después; verificar persistencia del cierre y bloqueo de ventas sin nueva apertura si esa es la regla del producto.
2. Gerente: revisar ese mismo cierre y reportes; las ventas a crédito no deben inflar efectivo ni el abono duplicar facturación.
3. Dueña: consultar el consolidado y comprobar los mismos identificadores, filtros y período.
4. Si existe reapertura autorizada, probarla como caso separado. No inventar faltantes ni declarar un arqueo ficticio como conteo físico: dejar claro que es una auditoría digital y se usa el importe calculado.

## Casos adicionales, fuera del cálculo base

Ejecutar uno a uno, con saldo/stock de partida registrado, y llevar un segundo libro si alteran datos:

- Efectivo insuficiente, carrito vacío y cantidad cero/negativa: comprobar validación sin completar ventas inválidas.
- Cantidad por encima del stock: comparar comportamiento con la política visible de venta sin existencias. Si se permite, no afirmar que es fallo sin evidencia de la regla esperada.
- Pago mixto incompleto/excedente: comprobar suma y cambio según reglas, sin forzar valores que el formulario no ofrezca.
- Cancelación antes del cobro frente a anulación posterior: distinguir estados y consecuencias; probar anulación solo si la UI la ofrece y conservar vínculo a la venta original.
- Devolución total/parcial y repetida: comprobar límite de cantidad, importe y stock restituido. No completar un segundo reembolso indebido si la interfaz ya demuestra que supera lo vendido.
- Redondeo: producto separado con precio 0,10, tres unidades; resultado esperado 0,30 según moneda. Si exige otra precisión, usar la configurada.
- Sesión de cajera: verificar solo accesos y botones visibles. No inferir control real del servidor ni buscar otras empresas para probar aislamiento.
- Actualizar la página después de un ticket confirmado: verificar que el historial mantiene una sola venta. No provocar doble cargo mediante envíos repetidos deliberados.

## Evidencia por posible fallo

Usar registro `AUD-CAJA-###`, con gravedad justificada, rol, fecha/hora y zona, empresa, precondición, pasos exactos, resultado esperado calculado, resultado observado literal, ID de operación y captura. Guardar captura del estado que demuestra el fallo y, cuando haga falta, la pantalla de referencia que lo contradice. Señalar si el comportamiento es reproducible, si solo se observó una vez o si la ejecución quedó bloqueada.

El fallo conocido de Guardar en Configuración pertenece al bloque de configuración: no presentarlo como descubrimiento ni utilizarlo como motivo para modificar el resto de la empresa.

## Disponibilidad técnica verificada

Se leyó la guía Browser `c2/control-browser`. En las herramientas expuestas a este agente no aparece `js`, conexión Browser ni CUA. El responsable ya confirmó esa ausencia; no se ha intentado un navegador alternativo ni realizado pruebas del producto. Este documento permite ejecutar cuando exista acceso autorizado y compatible; no acredita pruebas en vivo.
