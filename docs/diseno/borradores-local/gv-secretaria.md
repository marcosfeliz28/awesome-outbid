> **Borrador sin verificar, hecho por modelo local (cola N38).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: Revisar contra docs/sistema/GV.md completo; el modelo vio solo 4000 caracteres.

# Resumen para quien atiende GV: Inscripciones, pagos y citas

## Inscripciones

1. **Lista de cursos**: Muestra nombre, tipo, fecha, cupo inscritas, precio, pagado y pendiente (`apps/web/src/Gv.tsx:203-221`).
2. **Botón «Nuevo curso»**: Permite crear o editar cursos con campos como nombre, tipo, fecha, precio, cupo y activo (`apps/web/src/Gv.tsx:276-342`).
3. **Cupo**: Se muestra «inscritas / cupo»; ocupan cupo las inscritas con estado Activa o No asistió (`apps/api/src/gv.ts:94-95`, `:181`).
4. **Nueva inscripción**: Al abrir un curso, se puede agregar una nueva inscripción (`apps/web/src/Gv.tsx:363-372`).

## Pagos

1. **Pantalla de pago**: Muestra opciones de pago con bancos y terminales de tarjeta agrupados en «Grupo Génesis» y «Grupo Macgen» (`apps/web/src/Gv.tsx:789-810`; `apps/api/src/gv-money.ts:62-74`).
2. **Comprobantes fiscales**: No hay NCF en GV (`docs/coordinacion/MODULO-GV.md:54`).

## Citas

1. **Citas de maquillaje**: Se gestionan en la pestaña «Citas» (`apps/web/src/Gv.tsx:147`); el componente se llama `GvAppointments` (`apps/web/src/GvCitas.tsx:110`).

# Qué hice:
- Resumí los pasos de inscripciones, pagos y citas para el módulo GV.
- Utilicé las citas de archivo:línea proporcionadas.

# Qué NO comprobé:
- No revisé el código detallado de las funciones de inscripciones, pagos y citas.
- No verifiqué la interacción entre el frontend y el backend en estos módulos.

