# GV Makeup Studio (módulo GV)

Rama `cola-n26` (= `nexora-cloud`). Citas `archivo:línea`. Origen y decisiones de la dueña: `docs/coordinacion/MODULO-GV.md` (25-oct-2026). Auditoría: `docs/coordinacion/AUDITORIA_GV_CHATGPT.md`.

## 1. Qué es

- GV es la **empresa hermana** de Grupo MacGen: cursos de maquillaje, citas de maquillaje y prospectos («interesadas»). La pantalla dice: «Inscripciones y pagos de GV. No es la caja: los productos se venden en el punto de venta.» (`apps/web/src/Gv.tsx:123-126`). Es un **registro de seguimiento**, no factura ni caja (`apps/web/src/Gv.tsx:1-2`).
- Los **productos** que se venden en los cursos (sets de brochas, Amave) siguen siendo ventas de MacGen en el **Punto de venta**; hay una categoría con color propio rosado para GV en la caja (`apps/web/src/POS.tsx:1545-1550`) y los servicios se venden sin existencia (unidad «servicio», `packages/shared/src/index.ts` `isService`). GV solo lleva el curso y los servicios en su módulo.
- Los cobros de GV caen en las cuentas de Génesis, según la dueña (`docs/coordinacion/MODULO-GV.md:3`). En la pantalla de pago, el banco se escoge de la lista de Configuración agrupada en «Grupo Génesis» y «Grupo Macgen»: los nombres que contienen «génesis» van al primer grupo, el resto al segundo (`apps/web/src/Gv.tsx:793-814`; `apps/api/src/gv-money.ts:62-74`). Es la misma lista de «Cuentas de banco para transferencias» y «Terminales de tarjeta» de Configuración.
- Comprobantes fiscales de GV (RNC): la dueña los dejó para después (`docs/coordinacion/MODULO-GV.md:54`). No hay NCF en GV.

## 2. Dónde está en el menú y cómo se llama cada sección

- Ítem del menú: **«GV Makeup Studio»**, permiso `gv:read` (`apps/web/src/App.tsx:282`). Título dentro de la pantalla: **«Cursos y cobros»**, antetítulo «GV MAKEUP STUDIO» (`apps/web/src/Gv.tsx:121-122`).
- **Pestañas internas** (`apps/web/src/Gv.tsx:129-174`):

| Pestaña (etiqueta exacta) | Qué es | Permiso para verla |
|---|---|---|
| **Cursos** | Lista de cursos y, al abrir uno, sus inscripciones. | `gv:read` |
| **Citas** | Citas de maquillaje (servicios). **Este es el nombre de la sección de citas** (`Gv.tsx:147`); el componente se llama `GvAppointments` (`apps/web/src/GvCitas.tsx:125`). | `gv:read` |
| **Interesadas** | Prospectos (`apps/web/src/GvInteresadas.tsx`). | `gv:read` |
| **Por verificar** | Transferencias de GV pendientes de verificar. | `gv:read` (verificar: `gv:verify`) |
| **Reportes** | Ingresos y pendientes. | `gv:reports` |

- Una persona cuyo único permiso es de GV (`gvOnly`, todos los permisos empiezan con `gv:`) no carga el catálogo ni registra terminal (`apps/web/src/realtime.tsx:147-153`, `apps/web/src/App.tsx:776`).

## 3. Cursos

- Lista de tarjetas: nombre, tipo · fecha, «N / cupo inscritas · precio», «Pagado … · Pendiente …» (`Gv.tsx:203-221`). Botón **«Nuevo curso»** (`:199`).
- Formulario «Nuevo curso» / «Editar curso» (`:276-342`): **Nombre**, **Tipo** (Automaquillaje, Brazilian, Personalizado, Otro), **Fecha** (editable: así se «cambia la fecha»), **Precio (RD$)**, **Cupo**, **Activo**.
- **Cupo:** se muestra «inscritas / cupo»; ocupan cupo las inscritas con estado Activa o No asistió (`apps/api/src/gv.ts:94-95`, `:181`). En el código revisado **no hay validación que bloquee** inscribir pasado el cupo (solo se cuenta); la decisión D1 «bloquear o avisar» está pendiente de la dueña (`docs/proyecto/PLAN_MAESTRO_NOREXOS.md:23`).
- Al abrir un curso: botones **«← Cursos»**, **«Editar curso»**, **«Nueva inscripción»** (`:363-372`).
- API: `GET/POST /gv/courses`, `GET/PATCH /gv/courses/:id` (`apps/api/src/gv.ts:150-245`).

## 4. Inscripciones (tabla del curso)

**Sí, la tabla muestra PRECIO, PAGADO y PENDIENTE.** Columnas exactas, en este orden (`apps/web/src/Gv.tsx:385-393`):

`CLIENTA` · `TELÉFONO` · `PRECIO` · `PAGADO` · `PENDIENTE` · `ESTADO` · `ASISTIÓ` · `SET` · (acciones)

- **CLIENTA**: nombre y, si hay, Instagram (`:400-402`).
- **PRECIO**: precio acordado de esa inscripción (`agreedPrice`), no necesariamente el del curso (`:404`).
- **PAGADO**: solo lo **verificado**; si hay transferencias sin verificar se agrega «(RD$ X por verificar)» (`:405-410`).
- **PENDIENTE**: precio − pagado, nunca negativo, y 0 si la inscripción está cancelada o reembolsada (`:411`; `apps/api/src/gv-money.ts:156-178`).
- **ESTADO**: Activa, No asistió, Cambió a personalizado, Cancelada, Reembolsada (`:66-72`).
- **ASISTIÓ**: «—» (sin marcar), «Sí», «No» (`:414`). **SET**: «Sí/No» compró el set de brochas (`:416`).
- Acciones por fila: **«Pago»** (deshabilitado si está cancelada o reembolsada) y **«Editar»** (`:418-431`).
- Sin inscripciones: «Todavía no hay inscripciones.» (`:437`).

**Nueva / Editar inscripción** (`:525-632`): Clienta, Teléfono, Instagram, **Precio acordado (RD$)**, Estado, Asistió (Sin marcar/Sí/No), «Compró el set de brochas», Nota; si el estado es **Reembolsada**: «Monto reembolsado (RD$)» y «Fecha del reembolso» (`:599-608`). Una inscripción nueva no puede empezar cancelada o reembolsada (`apps/api/src/gv.ts:291-292`). «Reembolsada» exige monto (≤ lo verificado) y fecha, es final y se resta de los ingresos (`docs/coordinacion/MODULO-GV.md:74`; `apps/api/src/gv-money.ts:294-314`).

## 5. Pagos y conceptos de pago

- Se registran con el botón **«Pago»** de la inscripción o de la cita: ventana **«Pago de <clienta>»** (`Gv.tsx:749`, `apps/web/src/GvCitas.tsx:536`) con **Fecha**, **Monto (RD$)**, **Concepto**, **Método** y, según el método, **Banco** (transferencia) o **Terminal** (tarjeta) y **Referencia**.
- **Conceptos** (exactos, `Gv.tsx:73-80`, `GvCitas.tsx:60-67`): **Separo**, **Pago completo**, **Restante**, **Segundo pago**, **Tercer pago**, **Otro**. En la base: `separo | completo | restante | segundo | tercero | otro` (`apps/api/src/gv-money.ts:15-22`).
- **Métodos** (`Gv.tsx:81-85`): **Efectivo**, **Transferencia**, **Tarjeta**.
  - Efectivo: no pide banco.
  - Transferencia: **Banco** (lista) y **Referencia** obligatorios (`apps/web/src/Gv.tsx:786-812`; API: «es obligatorio / es obligatoria en una transferencia», `apps/api/src/gv-money.ts:90-108`).
  - Tarjeta: **no pide banco**. Muestra **Terminal** (la lista de «Terminales de tarjeta» de Configuración si tiene valores; si está vacía, el valor fijo «Terminal GV») y **Referencia** obligatoria (aprobación, lote o voucher) (`apps/web/src/Gv.tsx:820-850`; API: `cardDetails` y la terminal de la lista, `apps/api/src/gv-money.ts:112-128`). El dinero de tarjeta se registra en el **área GV / Grupo Génesis**, sin cuenta de banco (respuesta de la dueña): la API guarda `destination = "gv"` en el pago (columna opcional, nula en efectivo y transferencia) y, si no llega terminal, `bank = "Terminal GV"`. No se inventó nombre de terminal ni de cuenta.
- **Estados de un pago**: `Verificado` (insignia verde), `Por verificar` (amarilla) o `Rechazado` (roja) (`Gv.tsx:666-674`). **Efectivo y tarjeta quedan verificados al registrarse; la transferencia queda por verificar** hasta que gerencia/administración la verifique (`docs/coordinacion/MODULO-GV.md:74`; esquema `apps/api/prisma/schema.prisma` modelo `GvPayment`, campo `verified`).
- **Reglas de dinero** (`apps/api/src/gv-money.ts:1-8`): lo pagado cuenta solo lo verificado; «por verificar» va aparte; **ningún cobro puede superar el total** (contando lo por verificar) y el total no baja de lo cobrado; cancelada o reembolsada no aceptan pagos.
- **Anular un pago** (botón **«Anular»**, con motivo de mínimo 3 letras, quien tenga `gv:write`): deja de contar, queda en auditoría y se registra el correcto con un pago nuevo (`Gv.tsx:640-654`, `:677-686`; API `POST /gv/payments/:id/void`, `apps/api/src/gv.ts:395-446`). No se anula en una inscripción reembolsada (`gv.ts:422`).
- **Verificar o rechazar** (pestaña **«Por verificar»**, botones **«Verificar»** / **«Rechazar»**, el rechazo pide motivo): solo `gv:verify` (administración y gerencia), nunca quien registró el pago salvo `*`, solo transferencias pendientes y una sola vez (`Gv.tsx:885`; API `POST /gv/payments/:id/review`, `apps/api/src/gv.ts:448-519`, mensajes `:472-492`). Lista: `GET /gv/transfers/pending` (`gv.ts:661`). Esta pantalla muestra «No hay transferencias por verificar.» si está vacía (`Gv.tsx:941`).

## 6. Citas (pestaña «Citas»)

- Filtro **Estado** (Todas, Agendada, Realizada, Cancelada, Reembolsada) y botón **«Nueva cita»** (`apps/web/src/GvCitas.tsx:109-119`, estados `:54-59`).
- Cada cita se muestra como tarjeta: clienta, fecha y hora · servicio (· «fuera de horario»), artistas, teléfono · Instagram, «Total … · Pagado …», «Pendiente … (… por verificar) · Propina …», insignia de estado, y botones «Pago» / «Editar» (`GvCitas.tsx:149-205`). Aquí **no es una tabla**: son tarjetas, y la cita sí muestra Total, Pagado y Pendiente.
- Formulario **«Nueva cita» / «Editar cita»** (`GvCitas.tsx:291-481`): Clienta, Teléfono, Instagram, **Fecha y hora**, **Servicio** (Sencillo, Social, Glam, Correctivo, Novia, Con peinado, Boda, Otro; `:43-52`), **Artistas** (Génesis, Maryori, Camila, Evelin; `:53`), **Fuera de horario**, **Estado**, **Total (RD$)**, **Propina (RD$)**, y para bodas **Cotización (RD$)**, **Personas**, **Lugar**; Nota; lista de pagos. Reembolso: «Monto reembolsado» y «Fecha del reembolso» (`:358-372`).
- El **pendiente** de una cita se calcula (total − pagado verificado); no se guarda (`apps/api/prisma/schema.prisma` comentario de `GvAppointment`).
- API: `GET/POST /gv/appointments`, `GET/PATCH /gv/appointments/:id`, `POST /gv/appointments/:id/payments` (`apps/api/src/gv-citas.ts:316-475`).

## 7. Interesadas (prospectos)

Pestaña **«Interesadas»** (`Gv.tsx:149-156`, `apps/web/src/GvInteresadas.tsx:30-160`): nombre, teléfono, **Interés**, **Acción**, **Estado** (Por contactar, Contactada, Inscrita, Descartada: `GvInteresadas.tsx:20-24`) y nota. Requiere `gv:write` para crear/editar. API `GET/POST /gv/leads`, `PATCH /gv/leads/:id` (`apps/api/src/gv-citas.ts:476-546`).

## 8. Reportes (pestaña «Reportes», `gv:reports`)

Filtros **Desde** / **Hasta** (`Gv.tsx:983-991`). Secciones (`:970-1037`): **Ingresos** (verificado, reembolsos, neto y por verificar), tablas **Por día**, **Por método**, **Por banco**, **Por empleada**; **«Ocupación y pendientes por curso»** (columnas CURSO, INSCRITAS, ASISTIERON, SETS, PAGADO, PENDIENTE); y **«Pendientes por clienta»**. API `GET /gv/reports` (`apps/api/src/gv.ts:520-661`).

## 9. Quién puede qué en GV

| Permiso | Qué permite | Quién lo tiene |
|---|---|---|
| `gv:read` | Ver cursos, citas, interesadas, transferencias por verificar, bancos. | Rol `gv`, `manager`, `admin` (`*`) |
| `gv:write` | Crear/editar cursos, inscripciones, citas, interesadas; registrar y anular pagos. | Rol `gv`, `manager`, `admin` |
| `gv:reports` | Pestaña «Reportes». | Rol `gv`, `manager`, `admin` |
| `gv:verify` | Verificar o rechazar transferencias. | `manager`, `admin`; **no** el rol `gv` |
| `*` | Importación en lote `POST /gv/import` (`apps/api/src/gv.ts:693`). | `admin` |

Fuente de los permisos por rol: `packages/shared/src/index.ts:759-786`. El rol `gv` (p. ej. la empleada Clary) no tiene acceso a configuración, usuarios, costos, inventario ni datos de MacGen (`docs/coordinacion/MODULO-GV.md:43-44`).

## 10. Datos que NO están en el sistema (no preguntar al código)

- Nombres y teléfonos de clientas: son datos personales; el Excel original no se sube al repositorio (`docs/coordinacion/MODULO-GV.md:5`).
- Cifras de cursos concretos (inscritas por fecha): están en la base de datos, no en el código; para leerlas hay que entrar al sistema (`docs/coordinacion/claude-nube/entrar.py`).
