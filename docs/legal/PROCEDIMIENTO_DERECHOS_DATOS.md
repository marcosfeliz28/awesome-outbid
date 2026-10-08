# Procedimiento interno: solicitudes de derechos sobre datos personales (BORRADOR)

> Borrador para revisión de un abogado. Plazos son propuestos, no legales; confirmar con la Ley 172-13 y normas aplicables.
> Responsable del procedimiento: [NOMBRE/CARGO]. Correo: [CORREO DE CONTACTO]. Registro de solicitudes: hoja o libro [UBICACIÓN].

## Tipos
Acceso, rectificación, cancelación/eliminación, oposición, retiro de consentimiento.

## Pasos
1. **Recibir** (caja, correo o teléfono). Quien la reciba anota fecha, nombre, medio y qué pide, y la pasa a la persona responsable el mismo día. Plazo propuesto: acuse de recibo en 2 días hábiles.
2. **Verificar identidad.** Cédula en persona, o por correo/teléfono que coincida con el registrado más un dato de compra (fecha aproximada o número de venta). No entregar datos por teléfono sin verificar. Un tercero necesita autorización escrita y copia de cédula del titular.
3. **Localizar los datos.** Pantalla Clientes (nombre/teléfono), ventas asociadas, notas, auditoría (`audit-log`, entity=customer), fotos de comprobantes en pagos de abonos.
4. **Decidir y responder** dentro de un plazo propuesto de 10 días hábiles (prorrogable una vez con aviso por escrito).
   - **Acceso:** entregar un resumen de los datos que tiene la Tienda (nombre, contactos, ventas con fecha y monto). No incluir datos de otras personas ni de seguridad (hashes).
   - **Rectificación:** editar el cliente (permiso `customers:write`); anotar el cambio.
   - **Cancelación/eliminación:** si no hay deuda pendiente (créditos, contraentrega, notas de crédito con saldo), anonimizar el cliente (ver diseño técnico). Si hay deuda, explicar que se hará cuando se salde. Conservar siempre importes, fechas, NCF y números de venta por obligación contable/fiscal.
   - **Oposición/retiro de consentimiento:** dejar de usar el dato para esa finalidad (por ejemplo, contacto de cobro no obligatorio).
5. **Ejecutar con dos personas:** quien ejecuta y un gerente que aprueba. Registrar en auditoría el cliente afectado, quien aprobó y la solicitud (sin copiar los datos eliminados).
6. **Copias de seguridad:** informar al titular que los respaldos se rotan en 30 días y que no se restaurarán datos eliminados; si se restaura un respaldo, repetir las anonimizaciones del registro.
7. **Responder por escrito** y cerrar el registro. Guardar la solicitud y la respuesta [N] años como prueba, sin datos de más.
8. **Empleados:** las solicitudes de acceso o rectificación las atiende [RR. HH./dueña]. Un empleado desactivado no se borra (se mantiene su nombre en ventas y auditoría por obligación contable y de seguridad); se desactiva y, vencido el plazo legal, se anonimiza.

## Plazos propuestos
| Etapa | Plazo |
|---|---|
| Acuse | 2 días hábiles |
| Verificación | 3 días hábiles |
| Respuesta final | 10 días hábiles (prórroga única de 10 con aviso) |

## Incidentes
Si se pierde o expone un equipo, dato o respaldo: desactivar usuarios/terminales, cambiar claves, anotar qué se expuso y avisar a [ABOGADO] para decidir si debe notificarse a los afectados o la autoridad.

## Diseño técnico mínimo (a implementar)
- Endpoint `POST /customers/:id/anonymize` en `apps/api/src/admin.ts`, permiso nuevo `customers:erase` (solo gerente/admin; el vendedor no). Body: `{ reason, requestRef }`.
- Rechazar si existen ventas con `creditBalance > 0` o `cod` pendiente, o notas de crédito con saldo.
- En una transacción: poner en `Customer` name="Cliente anonimizado #<n>", phone/email/legalId/birthday=null, notes="", active=false; `Quote.notes` del cliente a ""; depurar `AuditLog.before/after` donde entity="customer" y entityId=id (dejar solo ids y la marca de anonimización); borrar `Payment.proofUrl` de las ventas del cliente si ya no hay deuda y el plazo fiscal lo permite (confirmar con contador).
- NO tocar: Sale, SaleItem, Payment (montos), NCF, `Sale.number`, `recipientLegalId` de ventas con NCF (obligación fiscal; confirmar con contador).
- Auditar con `audit(..., "anonymize", "customer", id, undefined, { reason, requestRef })` sin datos personales.
- Auditar también `editCustomer` (hoy no se audita) guardando solo los nombres de campos cambiados.
- Prueba de regresión en `tests/api.test.ts`: crear cliente con datos y venta; anonimizar; verificar que `GET /customers` ya no lo lista con datos, la venta mantiene `number`, `total` y `payments`; que el audit-log no contiene el teléfono; que un vendedor recibe 403; que con crédito pendiente devuelve 409.
