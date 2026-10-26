# Módulo GV Makeup Studio (pedido de la dueña, 25-oct-2026)

GV es la **empresa hermana** de Grupo Macgen. Hoy lleva sus datos en un Excel de 13 hojas. La dueña quiere pasarlos al sistema, con los mismos datos y el mismo tipo de reportes que tiene Macgen. Los cobros de GV caen en las **cuentas de Génesis**.

Las respuestas de la dueña están en la sesión de mercancía. El Excel tiene datos personales de clientas (nombres y teléfonos), así que **no se sube al repositorio**. La sesión de mercancía lo importa por la API cuando el módulo esté en vivo.

## Qué debe guardar

1. **Cursos**
   - Campos: nombre, tipo (automaquillaje, brazilian, personalizado), fecha, precio y cupo.
   - Ejemplos: Automaquillaje 4,500 con cupo 32; Brazilian Touch 18,000 con cupo 12.
2. **Inscripciones** a un curso
   - **Datos de la clienta:** nombre, teléfono e Instagram.
   - **Precio y pagos:** precio acordado y una lista de pagos. Cada pago lleva fecha, monto, concepto (separo, restante, segundo o tercer pago), método, banco y referencia, y queda verificado o pendiente, igual que una transferencia de Macgen.
   - **Seguimiento:**
     - pendiente calculado;
     - quién la inscribió (usuario);
     - si asistió (sí, no, sin marcar);
     - si compró el set de brochas;
     - nota;
     - estado: activa, no asistió, cambió a personalizado, cancelada o reembolsada.
3. **Citas de maquillaje** (servicios)
   - **Datos de la cita:**
     - fecha y hora;
     - clienta con teléfono e Instagram;
     - servicio (sencillo, social, glam, correctivo, novia, con peinado);
     - artista o artistas (Génesis, Maryori, Camila, Evelin en peinado);
     - si fue fuera de horario.
   - **Dinero:** total, pagos (con el mismo formato que las inscripciones), pendiente y propina.
   - **Estado:** agendada, realizada, cancelada o reembolsada.
4. **Interesadas** (prospectos): nombre, teléfono, tipo de interés, acción a tomar y estado (por contactar, contactada).
5. **Bodas:** una cita de tipo «boda» con cotización, inicial, restante, lugar y cantidad de personas. Opcional: hoy no hay ninguna pendiente.

## Reportes (los mismos tipos que Macgen, filtrados por GV)

- **Ingresos:** por día, método, banco y empleada (quién registró y artista).
- **Pendientes por cobrar:** por curso, por clienta y por cita.
- **Transferencias por verificar:** con el mismo flujo de verificación que Macgen.
- **Ocupación de cada curso:** inscritas contra cupo, asistencia y sets de brochas vendidos.

## Usuarios y permisos

- **Clary**, la empleada nueva de GV, es un usuario nuevo con un rol propio de GV. **Puede:**
  - crear y editar cursos, inscripciones, citas e interesadas;
  - registrar pagos;
  - ver los reportes de GV.

  **Sin acceso a nada de administración** (backend): ni configuración, ni usuarios, ni costos, ni inventario, ni datos de Macgen. La contraseña la da la dueña.
- **Génesis** y **la dueña** son gerentes de las dos empresas, con acceso completo («*»).

## Reglas

- Los **productos** que se venden en los cursos (sets de brochas, Amave) siguen siendo ventas de Macgen en la caja normal. GV solo lleva el curso y los servicios.
- **Comprobantes fiscales:** la dueña pidió dejar el RNC de GV para después. No se construye nada para que los ingresos de GV queden fuera de la DGII. Cuando se defina con la contadora, los cobros de GV llevan su comprobante igual que Macgen.
- Las pruebas deben pasar y los 3 CI estar en verde antes de desplegar. Sin tocar datos de producción de Macgen.

## Datos a importar (de octubre en adelante)

| Qué | Cantidad |
|---|---|
| Automaquillaje 25-oct | 32 inscritas + 1 cambio a personalizado (12,290) |
| Automaquillaje 8-nov | 21 inscritas |
| Automaquillaje 15-nov | 17 inscritas |
| Brazilian Touch Volumen II Pink, 22-nov | 5 inscritas |
| Citas de maquillaje desde el 1-oct | 18 |
| Interesadas | 17 |

Para importar hacen falta endpoints de creación, o uno de importación en lote, que la sesión de mercancía pueda llamar con el usuario de Claude.

## Entregado (rama `claude/modulo-gv`, 26-oct)

- Rol `gv` (`gv:read`, `gv:write`, `gv:reports`), creado por la migración `202610260901_gv` sin asignarlo a nadie. Gerencia también recibe `gv:*`; administración ya tiene `*`.
- Endpoints (todos por sucursal, cada escritura en la bitácora):
  - `GET/POST /api/gv/courses`, `GET/PATCH /api/gv/courses/:id` (el detalle trae las inscripciones con `paid`, `unverified`, `pending` y sus pagos).
  - `POST /api/gv/enrollments` (exige `operationId` uuid; un reintento devuelve la misma), `PATCH /api/gv/enrollments/:id`.
  - `POST /api/gv/payments` (exige `operationId`; transferencia queda por verificar, efectivo y tarjeta verificados).
  - `POST /api/gv/payments/:id/review` con `{ "verified": true }` o `{ "verified": false, "reason": "…" }` (el rechazado deja de contar como pagado).
  - `GET /api/gv/transfers/pending`, `GET /api/gv/reports?from=AAAA-MM-DD&to=AAAA-MM-DD`.
  - `POST /api/gv/import[?dryRun=1]` (sólo `*`). Formato:

```json
{
  "courses": [{ "key": "auto-2026-11-08", "name": "Automaquillaje", "type": "automaquillaje", "date": "2026-11-08", "price": 4500, "capacity": 32, "active": true }],
  "enrollments": [{
    "key": "auto-2026-11-08-01", "courseKey": "auto-2026-11-08",
    "clientName": "…", "phone": "…", "instagram": "…", "agreedPrice": 4500,
    "status": "activa", "attended": null, "boughtBrushSet": false, "note": "…",
    "payments": [{ "key": "opcional", "date": "2026-10-20", "amount": 2000, "concept": "separo", "method": "transferencia", "bank": "Popular Grupo Génesis ···9797", "reference": "…", "verified": false }]
  }],
  "appointments": [], "leads": []
}
```

  `type`: automaquillaje | brazilian | personalizado | otro. `status`: activa | no_asistio | personalizado | cancelada | reembolsada. `concept`: separo | restante | segundo | tercero | otro. `method`: efectivo | transferencia | tarjeta. Importes con hasta 2 decimales; pagos > 0. La clave de un pago sin `key` es `<clave de la inscripción>#<n>` (orden en la lista). Reimportar actualiza por clave y nunca duplica; la verificación hecha en el sistema sólo cambia si el archivo trae `verified`. `appointments` y `leads` se aceptan y se ignoran (`ignored` en la respuesta) hasta que el módulo de citas los conecte. Con errores no se guarda nada; `?dryRun=1` devuelve `{ courses|enrollments|payments: {create, update}, ignored, errors }` sin escribir.
