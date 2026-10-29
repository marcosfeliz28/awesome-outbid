# Spec: «Pedir un cambio» (tickets de solicitudes)

Estado: **borrador sin construir** · Taller, 29-oct-2026 · rama `claude/taller-gv`
Regla: solo documento. No se crea código, tabla, migración ni botón. La dueña decide.

## 1. Qué problema resuelve
Las usuarias (cajeras, vendedoras, GV) ven errores o pedidos de cambio mientras trabajan, y hoy los dicen de palabra o por WhatsApp. Este botón deja cada pedido por escrito, con captura y estado, para que la dueña lo vea sin perderlo.

## 2. Experiencia de la usuaria
- Botón **«Pedir un cambio»** visible en el encabezado de cada pantalla (no en el POS mientras cobra; ver §8).
- Formulario: **texto libre** (obligatorio, 10 a 2000 caracteres) y **captura opcional** (una imagen, máximo 2 MB, PNG o JPG).
- Se guardan automáticamente: pantalla de origen (ruta), usuaria, sucursal, fecha y hora. La usuaria no escribe esos datos.
- Al enviar: confirmación «Gracias, la dueña lo revisará» y el número de ticket.
- La usuaria ve sus propios tickets con su estado (solo lectura).

## 3. Estados
| Estado | Quién lo pone | Significado |
|---|---|---|
| `nuevo` | sistema, al enviar | llegó y nadie lo ha visto |
| `en_revision` | dueña o gerencia | alguien lo está mirando |
| `hecho` | dueña o gerencia | se hizo; se anota qué se hizo (nota corta) |
| `rechazado` | dueña o gerencia | no se hará; **obligatorio** el motivo |

Transiciones: `nuevo → en_revision → hecho | rechazado`, y `nuevo → hecho | rechazado` directo. No se vuelve atrás: si hay que reabrir, se crea un ticket nuevo que apunta al anterior.

## 4. Quién ve qué (por rol)
| Rol | Crea | Ve | Cambia estado | Comenta |
|---|---|---|---|---|
| Vendedora / cajera | sí | solo los suyos | no | no |
| GV | sí | solo los suyos | no | no |
| Gerencia | sí | todos de su sucursal | sí | sí |
| Dueña (admin) | sí | todos | sí | sí |

Nadie ve tickets de otra sucursal. La captura solo la ven quienes ven el ticket.
[FALTA INFORMACIÓN]: confirmar si gerencia cambia de sucursal a todas las sucursales.

## 5. Tabla propuesta (PostgreSQL, Prisma)
Nombre propuesto: `support_ticket`. No existe ningún modelo de tickets en `apps/api/prisma/schema.prisma` hoy (revisado el 29-oct), así que es un modelo nuevo.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | clave primaria |
| `number` | serial por sucursal | lo que ve la usuaria: «Ticket 42» |
| `branch_id` | uuid | sucursal, obligatorio |
| `created_by` | uuid | usuaria que lo envió |
| `route` | text, máx. 200 | pantalla de origen |
| `body` | text, 10–2000 | texto libre |
| `image_key` | text, nulo | referencia al archivo guardado fuera de la fila (no el binario) |
| `status` | enum `nuevo`,`en_revision`,`hecho`,`rechazado` | |
| `resolution` | text, nulo, máx. 500 | obligatorio si `rechazado` o `hecho` |
| `resolved_by` | uuid, nulo | |
| `created_at`, `updated_at`, `resolved_at` | timestamptz | |

Índices: `(branch_id, status, created_at)` para la lista de gerencia; `(created_by, created_at)` para «mis tickets».
Auditoría: cada cambio de estado escribe en `audit_log` (como ya hacen las demás acciones).
Ninguna tabla se toca en el POS ni en caja. Sin migración hasta aprobar la spec.

## 6. Endpoints propuestos
Todos bajo `/support/tickets`, con el guardia de permisos del módulo.

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `POST /support/tickets` | cualquier usuaria con sesión | crea (texto + captura opcional en `multipart`) |
| `GET /support/tickets/mine` | cualquier usuaria | sus tickets |
| `GET /support/tickets?status=` | `support:review` | lista de su sucursal (o todas, admin) |
| `GET /support/tickets/:id` | dueño del ticket o `support:review` | detalle y captura |
| `PATCH /support/tickets/:id/status` | `support:review` | cambia estado; exige `resolution` en `hecho`/`rechazado` |

Reglas del servidor: la sucursal y el autor salen de la sesión, nunca del cuerpo de la petición. La captura se valida por tipo real del archivo, no por extensión. Respuestas sin datos de otras sucursales ni de otros usuarios.

## 7. Pruebas que tendría que pasar (antes de construir)
1. Una vendedora no ve tickets ajenos ni de otra sucursal (401/403 y lista vacía).
2. `rechazado` sin motivo → 400. `hecho` sin nota → 400.
3. Transición inválida (`hecho → nuevo`) → 400.
4. Texto de 9 o 2001 caracteres → 400; captura de 3 MB → 413; archivo `.exe` renombrado a `.png` → 400.
5. Cada cambio de estado deja una fila en auditoría con el estado anterior y el nuevo.
6. Dos cambios de estado a la vez: gana uno y el otro recibe 409 (sin pisarse).
7. Con el navegador (Playwright): el botón aparece en las pantallas, el formulario envía, y la captura se ve en el detalle de gerencia.

## 8. Lo que no entra
- Ningún botón dentro del flujo de cobro del POS (no distrae ni retrasa la venta).
- Sin notificaciones por WhatsApp o correo en esta versión.
- Sin comentarios de las usuarias (solo texto inicial).
- No reemplaza al canal de emergencia de la tienda.

## 9. Preguntas abiertas para la dueña
1. ¿Gerencia ve tickets de todas las sucursales o solo de la suya?
2. ¿Quién tiene el permiso `support:review`: gerencia, la dueña o ambas?
3. ¿Límite de 2 MB y solo PNG/JPG está bien para las capturas?
4. ¿Cuánto tiempo se guardan los tickets (se propone: sin borrar)?
