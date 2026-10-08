# Checklist de datos del negocio en Ajustes (BORRADOR)

Fuente: configSchema en apps/api/src/admin.ts (líneas 57-110) y Management.tsx (~2790-2990).

| Campo | Ajuste | Obligatorio en el sistema hoy | Impreso donde | Estado / falta |
|---|---|---|---|---|
| Nombre legal / comercial | name | Sí (2-100) | PDF de venta; el ticket de 80 mm NO lo usa (texto fijo "Grupo Macgen") | Corregir ticket; confirmar razón social vs nombre comercial |
| RNC | legalId | Opcional en práctica (string sin mínimo; puede ir vacío) | Ticket y PDF solo si no está vacío | Hacerlo obligatorio y validar 9 dígitos |
| Dirección | address | Igual, puede ir vacío | Ticket y PDF si existe | Hacerlo obligatorio |
| Teléfono | phone | Igual, puede ir vacío | Ticket (con WhatsApp); PDF NO lo imprime | Obligatorio; agregar al PDF |
| WhatsApp | phone2 | Opcional | Ticket | Confirmar número |
| Sucursal | branchName | Opcional | Ticket (texto fijo "Plaza Lope de Vega" en Prints.tsx:80, no usa el ajuste) | Usar el ajuste |
| Ancho de ticket | receiptWidth | Sí (58/80) | Todos los térmicos | Confirmar 80 mm |
| Plazo de devolución | returnDays | Sí (0-365, defecto 30) | No se imprime; se aplica al validar la devolución | Confirmar días; imprimir en pie |
| Condiciones de devolución / garantía | (no existe) | No | No | Crear campos returnPolicyText, warrantyDays |
| Correo de contacto | (no existe) | No | No | Opcional, crear campo contactEmail |
| Modo NCF | ncfMode | Sí | Ticket muestra "Solicitud NCF ... pendiente" | Confirmar con la contable |
| ITBIS incluido | taxIncluded | Sí | Ticket muestra línea ITBIS, no dice incluido o adicional | Imprimir "ITBIS incluido" según ajuste |
| Logo | logo | Opcional | Ticket | Opcional |

## Pendiente de la dueña
- Razón social exacta y nombre comercial: ______
- RNC: ______  Dirección: ______  Teléfono: ______  WhatsApp: ______
- Días de devolución (sugerido 30, a confirmar): ____  Días de garantía de defectos: ____
- Lista de productos sin devolución: ______
- Vigencia de notas de crédito: ______
- Cargo de envío o contraentrega (hay o no): ______
- Consultar a la contable el texto exacto de la leyenda no fiscal y la relación con e-CF/NCF.
