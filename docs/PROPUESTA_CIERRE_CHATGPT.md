# Propuesta de cierre de caja · orden 3ah

17-oct-2026 · ChatGPT NUBE · Referencia: `nexora-cloud`, `140e7c1`.
Propuesta para decisión de la dueña y revisión de Claude. No autoriza implementación.

**1. Cobrar significa identificar quién recibió el dinero**

Al cobrar una contraentrega o crédito, mostrar factura, saldo y tres destinos:

- **Entró hoy en mi gaveta:** efectivo recibido físicamente, ligado a la caja abierta del cobrador. Emitir recibo por el abono real, aunque sea parcial; el resto sigue pendiente.
- **Banco o verifón:** registrar referencia y monto. Conservar la confirmación por administración; la cajera no puede convertirlo en efectivo para quitar el saldo. No aumenta el efectivo de la gaveta.
- **Ya lo recibió la dueña:** la cajera solicita; la dueña confirma desde su propia cuenta cuánto recibió, cuándo, por qué medio y la constancia disponible. Hasta confirmar, queda pendiente. No basta un PIN introducido por la cajera. Registrar por separado fecha de recepción y fecha de registro, sin inventar entrada hoy ni otra venta.

Cada abono tendrá un folio único y se aplicará una sola vez, incluso con doble clic o reenvío. Si ya existe, se vincula, no se duplica. Si se registró por error en una caja, la corrección requiere motivo, aprobación e historial enlazado, conservando el cierre original: no borrar el cobro ni simular una retirada de dinero que nunca entró.

**2. Dos comprobantes para mantener el cierre ciego**

La cajera cuenta por denominaciones sin ver lo esperado. Si no coincide, recibe sólo «Vuelve a contar / solicita autorización». Su copia conserva folio, turno, contado, entregado, fondo dejado y firmas; no muestra esperado ni diferencia. La dueña o gerencia autorizada ve el detalle completo, también al reimprimir.

Modelo del detalle reservado; importes del caso, suponiendo que no hay fondo ni otros movimientos:

```text
CAJA / TURNO / CAJERO / HORAS / FOLIO
Ventas del día cobradas en efectivo       RD$ 1.900
Cobros hoy de facturas anteriores         RD$ 4.700
Efectivo esperado en gaveta               RD$ 6.600
Efectivo contado                         RD$ 6.700
Diferencia: SOBRANTE                      RD$   100
Fondo autorizado que queda                RD$ [   ]
EFECTIVO A ENTREGAR AHORA                  RD$ [   ]
Entregas parciales ya recibidas            RD$ [   ]
Recontó / autorizó / recibió / motivo / hora
Fuera de gaveta: recibido antes por dueña  RD$ 3.300
```

En el caso real, excluir RD$3.300 de RD$9.900 deja RD$6.600: persiste un sobrante de RD$100 por investigar. No declarar «cuadrada» la caja automáticamente.

El esperado incluirá fondo inicial, entradas reales, cobros, devoluciones y salidas confirmadas, cada concepto separado. A entregar ahora = contado menos fondo autorizado; las entregas parciales ya descontadas no se restan otra vez. Anexo reservado por cada cobro anterior: **[factura] · [cliente] · [fecha original] · [abono de hoy] · [destino y receptor]**. Banco y tarjeta, separados del efectivo. No llamar «venta del día» al cobro de una factura vieja.

**3. Controles con pocos pasos**

Conservar PIN de gerente, cierre ciego, alertas y bitácora existentes; el PIN por diferencia de efectivo ya lo resolvió Claude. Ante diferencia, segundo conteo independiente y motivo, sin revelar cifras a la cajera. La autorización registra identidad, nunca el PIN, y no elimina la diferencia.

Entregas parciales: monto, folio y confirmación de quien entrega y quien recibe; sólo entonces descuentan de gaveta. Alerta a gerencia cuando se supere el tope que decida la dueña. Sin internet: conteo y entrega con recibo provisional firmado; cobros sin confirmar siguen pendientes. El cierre definitivo espera sincronización y revisión, sin duplicar los folios al reconectar.

**4. Tarjeta: comparar operaciones, no un total tecleado**

Vincular cada voucher con factura o abono mediante referencia, terminal, fecha e importe bruto; incluir el envío separado cuando corresponda. Cruzarlo con el reporte oficial del verifón/adquirente: faltantes, duplicados, anulaciones y devoluciones por separado; no confundir comisiones bancarias con diferencias. Un voucher de RD$2.500 sin factura genera incidencia ese día: localizar la operación real o gestionar anulación/devolución; no crear una factura ficticia para cuadrar.

No conozco modelo ni acceso al reporte. Si permite exportación, proponer importarla; integración automática se evalúa después. Si sólo imprime, supervisor coteja vouchers y listado, con revisión independiente del total. No almacenar números completos de tarjeta ni códigos de seguridad.

| Problema | Propuesta | Esfuerzo | Cómo evita el robo |
|---|---|---|---|
| Cobro sin destino | Destino obligatorio y confirmación de la dueña | Medio | Impide atribuir dinero inexistente a gaveta |
| Papel confuso | Dos copias y detalle por factura | Bajo | Permite rastrear cada abono sin perder el cierre ciego |
| Diferencia ocultada | Recuento, PIN existente e historial | Bajo | Evita cierre unilateral y conserva evidencia |
| Entregas sin prueba | Doble confirmación y alerta por tope | Medio | Reduce exposición y atribuye custodia |
| Voucher sin factura | Cruce por operación con reporte oficial | Alto | Detecta cobros omitidos o reutilizados |

**5. Las tres primeras acciones, en orden**

1. Resolver el destino de cobros anteriores y la confirmación «ya recibió la dueña».
2. Simplificar ambos comprobantes y documentar recuento y entrega con receptor.
3. Conciliar vouchers contra facturas; evaluar importación con el verifón real.

**Decisiones pendientes:** ¿qué modelo/proveedor de verifón tienen y qué reporte exporta? ¿Qué fondo y tope de gaveta fija la dueña? ¿Puede alguien más confirmar dinero recibido fuera de caja y entregas parciales? Hasta decidir, proponer esa confirmación sólo a la dueña. No se cambian precios, márgenes, base ni servicios.
