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

## Entregado (rama `claude/modulo-gv`, 26-oct; incluye `claude/modulo-gv-citas` y las correcciones de `AUDITORIA_GV_CHATGPT.md`)

- Rol `gv` (`gv:read`, `gv:write`, `gv:reports`): lo crea `202610260901_gv` y `202610260903_gv_auditoria` le fija exactamente esos permisos. No se asigna a nadie en la migración. Gerencia recibe `gv:read`, `gv:write`, `gv:reports` y `gv:verify`; administración ya tiene `*`.
- **Verificar transferencias** (`gv:verify`): sólo administración y gerencia, nunca quien registró el pago (salvo `*`), sólo transferencias pendientes y una sola vez.
- **Dinero:** «pagado» es sólo lo verificado (efectivo y tarjeta lo están al registrarse); lo que espera verificación va en «por verificar». Ningún pago supera el total contando lo por verificar, y el total no baja de lo cobrado. Una transferencia exige banco y referencia. Cancelada o reembolsada no aceptan pagos. «Reembolsada» exige monto (≤ lo verificado) y fecha, es final y se resta de los ingresos (`income.net`).
- Endpoints (por sucursal; cada escritura en la bitácora):
  - `GET/POST /api/gv/courses`, `GET/PATCH /api/gv/courses/:id` (el detalle trae las inscripciones con `paid`, `unverified`, `refunded`, `pending` y sus pagos).
  - `POST /api/gv/enrollments` (exige `operationId` uuid), `PATCH /api/gv/enrollments/:id` (para «reembolsada»: `refundAmount` y `refundDate`).
  - `POST /api/gv/payments` (`operationId`, `enrollmentId`, `date`, `amount`, `concept`, `method`, `bank`, `reference`).
  - Citas e interesadas: `GET/POST /api/gv/appointments`, `GET/PATCH /api/gv/appointments/:id`, `POST /api/gv/appointments/:id/payments`, `GET/POST /api/gv/leads`, `PATCH /api/gv/leads/:id`.
  - `POST /api/gv/payments/:id/review` (`gv:verify`) con `{ "verified": true }` o `{ "verified": false, "reason": "…" }`.
  - `GET /api/gv/transfers/pending`, `GET /api/gv/reports?from=AAAA-MM-DD&to=AAAA-MM-DD` (ingresos verificados, reembolsos y neto; pendientes de cursos y citas; ocupación).
  - `POST /api/gv/import[?dryRun=1]` (sólo `*`). Formato:

```json
{
  "courses": [{ "key": "auto-2026-11-08", "name": "Automaquillaje", "type": "automaquillaje", "date": "2026-11-08", "price": 4500, "capacity": 32, "active": true }],
  "enrollments": [{
    "key": "auto-2026-11-08-01", "courseKey": "auto-2026-11-08",
    "clientName": "…", "phone": "…", "instagram": "…", "agreedPrice": 4500,
    "status": "activa", "attended": null, "boughtBrushSet": false, "note": "…",
    "refundAmount": null, "refundDate": null,
    "payments": [{ "key": "auto-2026-11-08-01-p1", "date": "2026-10-20", "amount": 2000, "concept": "separo", "method": "transferencia", "bank": "Popular Grupo Génesis ···9797", "reference": "…", "verified": false }]
  }],
  "appointments": [{
    "key": "cita-2026-10-05-01", "date": "2026-10-05T15:30:00-04:00",
    "clientName": "…", "phone": "…", "instagram": "…", "service": "social",
    "artists": ["Génesis"], "afterHours": false, "total": 3500, "tip": 0,
    "status": "realizada", "note": "…", "refundAmount": null, "refundDate": null,
    "payments": [{ "key": "cita-2026-10-05-01-p1", "date": "2026-10-05", "amount": 3500, "concept": "otro", "method": "efectivo" }]
  }],
  "leads": [{ "key": "int-01", "name": "…", "phone": "…", "interest": "…", "action": "…", "status": "por_contactar", "note": "…" }]
}
```

  `type`: automaquillaje | brazilian | personalizado | otro. `status` de inscripción: activa | no_asistio | personalizado | cancelada | reembolsada. `concept`: separo | restante | segundo | tercero | otro. `method`: efectivo | transferencia | tarjeta (transferencia con `bank` y `reference`). Importes con hasta 2 decimales; pagos > 0; la suma de los pagos no supera el precio. **Cada pago lleva su `key`** (única por sucursal): reordenar no cambia nada, una `key` no puede pasar a otra clienta y un pago ya verificado o rechazado no cambia (si el archivo trae otra cosa, error). «reembolsada» exige `refundAmount` y `refundDate`. Reimportar actualiza por clave y nunca duplica; la verificación hecha en el sistema sólo cambia si el archivo trae `verified`. Con errores no se guarda nada; `?dryRun=1` devuelve los conteos `{create, update}` y `errors` sin escribir.

- **Importación, reglas extra (auditoría de Claude PC):** `dryRun` sólo acepta `0`, `1`, `true` o `false` una vez; cualquier otro valor es 400 y no escribe. El cuerpo de `/gv/import` admite hasta 4 MB (el resto de la API, 100 kb). Todo se valida dentro de la transacción con el candado de la sucursal tomado. Para el tope se suman los pagos que ya están en el sistema y los del archivo; una reembolsada no se reabre, no cambia su reembolso ni acepta pagos nuevos.
- **Propina:** `tip` de una cita va aparte del `total`: no cuenta para el pendiente ni para los ingresos.
- Una inscripción o cita reembolsada no acepta pagos ni verificación o rechazo de transferencias.
- La lista de cambio de usuario del POS (`/staff`) no muestra a las usuarias GV y la bitácora de administración (`/audit-log`) no incluye las acciones `gv_*` (siguen en la base).
- Importes de GV exactos: más de 2 decimales (por ejemplo 0.1 + 0.2 sin redondear) es 400.

## Pendientes (anotados por la auditoría)

- **GV-15:** una sesión de GV todavía registra el equipo en «Equipos» de Macgen y corre la sincronización de ventas/mercancía (de sus propias filas, que no tiene). No le da acceso a nada de Macgen; falta no iniciarlo para un usuario sólo GV.
- **GV-16:** falta la conciliación bancaria completa de GV (filtro por fecha y banco, selección múltiple, totales, CSV y corrección auditada de banco/referencia), como la de Macgen.
- **GV-01 (resto):** al cambiar de usuario con PIN a una cuenta GV se borra la caché local y se bloquea el cambio si hay ventas o entradas sin enviar. Si una cuenta GV entra con contraseña en un equipo que tiene ventas o entradas de Macgen sin enviar, esas filas siguen en el navegador hasta que su dueña las sincronice.
- Teléfonos: hoy no se comparan en ningún lado; si se agrega búsqueda o detección de duplicados, comparar sólo los dígitos.
- Corregir un pago ya verificado (monto, banco o referencia) necesita una operación administrativa con motivo; hoy no existe.
