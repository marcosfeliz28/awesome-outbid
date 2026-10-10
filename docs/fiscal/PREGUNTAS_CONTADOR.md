# Nexora: preguntas para el contador y la DGII

Borrador de consulta, 10-oct-2026. No certifica cumplimiento fiscal. Clasificación, razón social y RNC reales deben verificarse con documentación privada; no usar valores ficticios ni publicarlos aquí.

## Plazo y trámites

1. ¿Nuestra clasificación DGII es pequeña, micro, no clasificada u otra? ¿Qué constancia vigente la acredita?
2. ¿Nos aplica el **15/11/2026** para implementar e-CF, según el Aviso 06-26 y la situación de nuestro RNC? ¿Hay resolución posterior o condición particular que revisar?
3. ¿Qué autorización, certificado digital, pruebas y trámites necesitamos, quién los hará y con qué fechas? ¿Cómo operamos legalmente mientras se completa?

Fuente oficial consultada el 10-oct-2026: [Aviso DGII 06-26](https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/06-26.pdf). Otorga seis meses desde el 15 de mayo de 2026 al grupo indicado; el 15 de noviembre es el cómputo de ese periodo, no una conclusión sobre esta tienda. El contador debe confirmar su aplicación y normas posteriores.

## Comprobante que entregamos hoy

4. ¿Cómo entrega actualmente la tienda el comprobante fiscal: sistema anterior, talonario, facturador u otro mecanismo autorizado? ¿Quién controla secuencias, vigencia y documentos anulados?
5. ¿Qué comprobante corresponde a consumidor final, empresa, crédito y contraentrega? ¿Qué datos del cliente son realmente necesarios?
6. ¿Puede acompañarse el comprobante autorizado con ticket comercial Nexora? ¿Cómo vinculamos números para no duplicar ingresos ni presentar el ticket como comprobante fiscal?

Evidencia de `496030f`: el recibo web lleva siempre «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL», incluso si una venta contiene NCF; la solicitud NCF dice pendiente de emisión fiscal (`apps/web/src/Prints.tsx:290`, `:343`, `:404`). El PDF también advierte que es no fiscal (`apps/api/src/sales.ts:2416`). Esos campos no acreditan autorización de emisión.

## Solución e-CF

7. ¿Nexora debe emitir NCF/e-CF directamente o integrarse con un proveedor autorizado? ¿Es adecuado el facturador gratuito DGII para nuestro volumen? ¿Cómo comprobamos autorización y alcance antes de contratar?
8. ¿Quién firma, envía, gestiona aceptación/rechazo y entrega representación impresa? ¿Cómo operamos sin internet y conciliamos ventas con documentos aceptados?
9. ¿Qué razón social, RNC, sucursal y otros datos deben figurar? ¿Qué configuración y pruebas validará el contador antes de emitir?

## ITBIS, devoluciones y contabilidad

10. ¿Los precios incluyen ITBIS o se añade al cobrar? ¿Qué tasas/exenciones corresponden por producto? ¿Cómo tratar descuentos, redondeo, promociones y mayoreo?
11. ¿Qué política escrita de devolución —días, condiciones y excepciones— debe aprobarse? ¿Cuándo se emite nota de crédito fiscal, a qué comprobante se vincula y cómo afecta ITBIS e inventario?
12. ¿Cómo contabilizar pagos mixtos, abonos, contraentrega, anulaciones y reembolsos de días anteriores? ¿Qué reportes y plazos de conservación necesita el contador?

La venta guarda `taxIncluded` desde Ajustes y valida preparación de NCF; eso no comprueba tasas, secuencias o reglas legales (`apps/api/src/sales.ts:758`, `:845`). No cambie ajustes fiscales por una suposición.

## Resultado esperado

Para cada pregunta: respuesta escrita, fundamento/enlace oficial, responsable, fecha y configuración requerida. Compartir documentos tributarios por canal privado. Nunca incluir contraseñas, certificados digitales ni datos de clientes. **[CONTADOR/ABOGADO: confirmar respuestas y su aplicación antes de declarar cumplimiento]**.
