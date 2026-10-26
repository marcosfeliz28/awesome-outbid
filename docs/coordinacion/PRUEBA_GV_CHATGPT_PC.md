# Prueba local del módulo GV

Fecha: 2026-10-26. Rama probada: `origin/claude/modulo-gv` en `6c292009` (incluye `apps/web/src/Gv.tsx`), integrada localmente en `chatgpt-pc/prueba-gv` como `f9673c63`. Todo se ejecutó contra PostgreSQL local descartable en `127.0.0.1:5444`; no se usó Render, la tienda en vivo ni datos o credenciales reales.

## Resultado

**Aprobado para el flujo de Clary, con una observación de claridad no bloqueante.** No hay hallazgos URGENTE: la pantalla GV ahora existe y permite completar el trabajo de cursos y cobros.

## Preparación y evidencia automática

- `git fetch origin`: rama fuente en `6c292009`, posterior al mínimo solicitado `52a95b16`.
- Base local nueva: `pnpm db:generate`, `pnpm db:migrate` (54 migraciones, incluida `202610260901_gv`) y `pnpm db:seed`: correctos.
- Rol temporal local: `Clary QA Local` con sólo `gv:read`, `gv:write`, `gv:reports`.
- `tests/gv-modulo-api.test.ts`: **7 de 7** aprobadas.
- `tests/gv-servicios-api.test.ts`: **4 de 4** aprobadas.
- Con el token del rol GV, estas rutas de Macgen respondieron `HTTP 403`: `/api/cash-sessions`, `/api/users`, `/api/settings` y `/api/reportes`.

## Flujo manual de Clary — escritorio

Se creó el curso **Automaquillaje 26-oct**, RD$ 4,500.00, cupo 32; luego se inscribieron Ana, Beatriz y Carla (datos ficticios de QA).

- Ana: separo en efectivo RD$ 1,500.00 y restante por transferencia RD$ 3,000.00, con banco y referencia. La transferencia se verificó; el pendiente quedó en RD$ 0.00.
- Carla: transferencia de RD$ 1,000.00 registrada y rechazada con motivo local. Su monto pagado volvió a RD$ 0.00 y pendiente a RD$ 4,500.00.
- Se marcó a Ana como asistió y con set de brochas.
- Reportes mostró ingreso RD$ 4,500.00, 3 inscritas de 32, 1 asistió, 1 set y RD$ 9,000.00 pendiente (Beatriz y Carla): los totales cuadran.
- La navegación del rol GV sólo mostró **GV Makeup Studio**; no expuso Caja, costos, Configuración, Usuarios ni Reportes de Macgen.

Capturas tomadas en esta sesión de prueba local:

1. Escritorio: tabla de las tres inscritas, montos, asistencia y set.
2. Escritorio: reportes GV con ingresos, métodos, banco, ocupación y pendientes.

## Prueba a 390 px

Se repitió la revisión a **390 × 844 px**. El menú móvil mantuvo únicamente GV Makeup Studio y el contenido quedó en una sola columna utilizable. Cursos, pestañas, filtros y tarjetas de reporte se pudieron ver sin que aparecieran módulos de Macgen.

Captura tomada en esta sesión: reporte GV a 390 px, con la cabecera, pestañas, filtros e ingreso visibles.

## Hallazgos

### GV-01 — baja — Aviso de equipo confuso para una usuaria que no opera caja

- Gravedad: baja; no bloquea a Clary.
- Archivo: `apps/web/src/App.tsx` (aviso global de aprobación de equipo).
- Cómo repetirlo:
  1. Iniciar sesión local con un rol que tenga sólo permisos `gv:*` desde un equipo no aprobado.
  2. Abrir GV Makeup Studio.
  3. Leer el aviso: «Puedes consultar, pero para vender o mover mercancía un gerente debe aprobarlo… desde Configuración › Equipos».
- Resultado: el aviso se muestra aun cuando la usuaria sólo gestiona cursos y cobros de GV, acciones que el sistema sí permite realizar. La mención a Configuración tampoco es una ruta a la que tenga acceso el rol GV.
- Captura: las tres capturas de esta corrida muestran el aviso sobre la pantalla GV.
- Arreglo propuesto: ocultar el aviso en GV o cambiarlo por un mensaje específico que aclare que aplica sólo al punto de venta e inventario, sin indicar una ruta inaccesible.

## Veredicto

**Aprobado con observación baja.** El bloqueador anterior (pantallas inexistentes) está resuelto en `6c292009`. La prueba de rechazo se confirmó por la misma API local: la interfaz abre un `prompt` nativo para el motivo, que el piloto de navegador no expone para escritura; no se considera fallo del producto porque el endpoint y el efecto final quedaron verificados localmente.
