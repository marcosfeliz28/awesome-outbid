# Preguntas frecuentes de GV (verificadas)

Fuentes: `apps/web/src/Gv.tsx` y `apps/web/src/GvCitas.tsx` de `origin/nexora-cloud` (SHA 9626b19f).
Cada respuesta cita el archivo y la línea que la respalda. El borrador original no se editó.

### ¿Cómo se llama la sección que muestra los cursos y los cobros?
«Cursos y cobros» (Gv.tsx:122).

### ¿Qué mensaje se muestra cuando no hay cursos disponibles?
«Todavía no hay cursos.» (Gv.tsx:222).

### ¿Qué campos se muestran para cada curso?
En el formulario del curso: Nombre (Gv.tsx:280), Tipo (288), Fecha (297), Precio (RD$) (306), Cupo (315) y Activo (330).

### ¿Qué información se muestra para cada inscripción?
En la tabla de inscripciones: CLIENTA (Gv.tsx:385), TELÉFONO (386), PRECIO (387), PAGADO (388), PENDIENTE (389), ESTADO (390), ASISTIÓ (391) y SET (392).

### ¿Qué mensaje se muestra cuando no hay inscripciones registradas?
«Todavía no hay inscripciones.» (Gv.tsx:437).

### ¿Qué campos se muestran para cada cliente en las inscripciones?
En el formulario de inscripción: Clienta (Gv.tsx:530), Teléfono (538), Instagram (546), Precio acordado (RD$) (553), Estado (562), Asistió (571) y la opción «Sin marcar» (576).

### ¿Qué información se muestra para cada pago?
En el formulario de pago: Fecha (Gv.tsx:751), Monto (RD$) (760), Concepto (769), Método (778), Banco (789) y Referencia (813).

### ¿Qué mensaje se muestra cuando no hay transferencias por verificar?
«No hay transferencias por verificar.» (Gv.tsx:908).

### ¿Qué campos se muestran en el resumen de ingresos?
Desde (Gv.tsx:950), Hasta (958) e Ingresos (970).

### ¿Qué información se muestra para cada cita?
La cita está en **GvCitas.tsx**, no en Gv.tsx. Campos del formulario: Clienta (GvCitas.tsx:279), Teléfono (287), Instagram (295), Fecha y hora (302), Servicio (311), Artistas (320), Fuera de horario (347), Estado (350), Monto reembolsado (RD$) (361), Fecha del reembolso (370), Total (RD$) (381), Propina (RD$) (390), Cotización (RD$) (400) y Personas (408).

### ¿Qué mensaje se muestra cuando no hay citas registradas?
«Todavía no hay citas.» (GvCitas.tsx:189). La cita del borrador (Gv.tsx:189) era de archivo equivocado.

### ¿Qué campos se muestran en el resumen de ocupación y pendientes por curso?
La columna CURSO (Gv.tsx:987) y la sección «Pendientes por clienta» (Gv.tsx:1015).

## Por confirmar con la dueña
- **Nombre de la sección de citas en el menú.** El código la llama «Citas» en GvCitas.tsx, pero no encontré en esta revisión la etiqueta exacta del menú.
  - Pregunta: ¿Cómo se llama la sección de citas en el menú de GV?
- **Campos de la tabla de inscripciones.** El borrador original omitía PRECIO, PAGADO y PENDIENTE; esta versión sí los incluye, con su línea.
  - Pregunta: ¿Quieres que la FAQ incluya PRECIO, PAGADO y PENDIENTE, o solo los campos que se ven en la pantalla principal?
