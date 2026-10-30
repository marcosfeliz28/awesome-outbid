Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/GV.md`. Tarea N38. Cada paso lleva su cita. Es un registro de seguimiento, no una caja ni una factura.

# GV Makeup Studio: guía corta para quien atiende

**Dónde entrar.** Menú **«GV Makeup Studio»**; dentro, las pestañas **Cursos**, **Citas**, **Interesadas**, **Por verificar** y **Reportes**. (`apps/web/src/App.tsx:282`; `apps/web/src/Gv.tsx:129-174`)

## Inscripciones a un curso
1. Abre la pestaña **Cursos** y elige el curso. (`apps/web/src/Gv.tsx:203-221`)
2. Pulsa **«Nueva inscripción»**. (`apps/web/src/Gv.tsx:363-372`)
3. Llena Clienta, Teléfono, Instagram, **Precio acordado (RD$)**, Estado y, si compró brochas, «Compró el set de brochas». (`apps/web/src/Gv.tsx:525-632`)
4. Una inscripción nueva no puede empezar como Cancelada ni Reembolsada. (entrada §4)
5. Mira la tabla: PRECIO, PAGADO y PENDIENTE. «Pagado» cuenta solo lo verificado. (`apps/web/src/Gv.tsx:385-393`, `:405-410`)
6. Para cambiar el estado o marcar si asistió, pulsa **«Editar»** en la fila. (`apps/web/src/Gv.tsx:418-431`)

## Pagos
1. Pulsa **«Pago»** en la inscripción o en la cita. (`apps/web/src/Gv.tsx:745`; `apps/web/src/GvCitas.tsx:516`)
2. Escribe Fecha, Monto (RD$), **Concepto** (Separo, Pago completo, Restante, Segundo pago, Tercer pago, Otro) y **Método** (Efectivo, Transferencia o Tarjeta). (`apps/web/src/Gv.tsx:73-85`)
3. Con **Tarjeta** o **Transferencia** el Banco es obligatorio; en **Transferencia** también la Referencia. Efectivo no pide banco. (`apps/web/src/Gv.tsx:786-819`; `apps/api/src/gv-money.ts:86-104`)
4. Efectivo y tarjeta quedan verificados; la **transferencia queda «Por verificar»** hasta que gerencia o administración la verifique. (`docs/coordinacion/MODULO-GV.md:74`; `apps/web/src/Gv.tsx:666-674`)
5. Un cobro no puede superar el total, y una inscripción cancelada o reembolsada no acepta pagos. (`apps/api/src/gv-money.ts:1-8`)
6. Si te equivocaste, pulsa **«Anular»** con un motivo de al menos 3 letras y registra el pago correcto de nuevo. (`apps/web/src/Gv.tsx:640-654`, `:677-686`)
7. Quien registra un pago no lo verifica; lo hace quien tiene permiso de verificar. (`apps/api/src/gv.ts:447-518`)

## Citas
1. Abre la pestaña **Citas**; filtra por Estado (Agendada, Realizada, Cancelada, Reembolsada) o pulsa **«Nueva cita»**. (`apps/web/src/GvCitas.tsx:121-131`)
2. Llena Clienta, Teléfono, Instagram, **Fecha y hora**, **Servicio**, **Artistas**, Estado, **Total (RD$)** y Propina. (`apps/web/src/GvCitas.tsx:276-466`)
3. Marca «Fuera de horario» si aplica. (`apps/web/src/GvCitas.tsx:276-466`)
4. El pendiente de la cita se calcula (total − pagado verificado) y no se guarda. (`apps/api/prisma/schema.prisma` comentario de `GvAppointment`)
5. Los pagos de una cita se registran igual: botón **«Pago»**. (`apps/web/src/GvCitas.tsx:516`)

## Interesadas
1. Abre la pestaña **Interesadas** y anota nombre, teléfono, Interés, Acción y nota. (`apps/web/src/GvInteresadas.tsx:30-160`)
2. Cambia el Estado: Por contactar, Contactada, Inscrita o Descartada. (`apps/web/src/GvInteresadas.tsx:20-24`)

## Lo que esta persona no puede hacer
No ve configuración, usuarios, costos, inventario ni datos de MacGen. Verificar transferencias es de gerencia o administración. (`docs/coordinacion/MODULO-GV.md:43-44`; entrada §9)

## Qué NO comprobé
Los pasos resumen la entrada; no se contrastaron con la pantalla ni con el código. El cupo de los cursos no bloquea la inscripción según la entrada (decisión pendiente de la dueña). (entrada §3)
