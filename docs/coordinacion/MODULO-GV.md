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
