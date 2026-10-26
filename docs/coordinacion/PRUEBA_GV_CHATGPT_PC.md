# Prueba local del módulo GV

Fecha: 2026-10-26. Rama probada: `claude/modulo-gv` en una base PostgreSQL local descartable. No se usó Render, la tienda en vivo ni credenciales reales.

## Preparación

- `git fetch origin`: apareció `origin/claude/modulo-gv` en `c1167491`.
- `pnpm install --frozen-lockfile`: correcto.
- Base local en `127.0.0.1:5434`; `pnpm db:migrate`: 54 migraciones aplicadas, incluida `202610260901_gv`.
- `pnpm db:seed`: correcto con datos demo locales.
- Pruebas GV: `pnpm exec vitest run --config vitest.integration.config.ts --testNamePattern='GV' --reporter=dot`.
  Resultado: 2 archivos aprobados, 10 pruebas aprobadas, 31 archivos y 515 pruebas fuera del filtro.

## Resultado de flujos de API

Las pruebas aprobaron el rol `gv`, sus permisos aislados, creación y edición de cursos, inscripciones, pagos, pendiente calculado, transferencia pendiente/verificada/rechazada e importación idempotente con `dryRun`.

## Hallazgos

### GV-01 — URGENTE — No hay pantalla operable para Clary

- Gravedad: crítica.
- Evidencia de código: no existe componente de GV ni llamada del cliente web a `/gv`; la única mención funcional de GV en `apps/web/src` es identidad visual en `App.tsx` y una categoría de caja en `POS.tsx`.
- Cómo repetirlo:
  1. Ejecutar API y web locales sobre la base de prueba.
  2. Iniciar sesión.
  3. Revisar el menú de escritorio o abrirlo a 390 px.
  4. No hay ruta, menú ni formulario para cursos, inscritas, pagos, verificación, asistencia o set de brochas.
- Resultado visible: el menú y el tablero son de Macgen. En 390 px sólo aparece la navegación de tienda y el botón de Mercancía; no aparece GV.
- Captura: tomada durante esta prueba en la sesión ChatGPT PC, vista local `127.0.0.1:5173` a 390 × 844 px.
- Impacto: no fue posible realizar el flujo pedido como Clary ni comprobar que el rol `gv` oculte Caja, costos, Configuración y Reportes de Macgen desde la interfaz. La API sí rechaza esos accesos según las pruebas aprobadas, pero falta la experiencia de usuario.
- Arreglo propuesto: construir una sección GV separada, visible sólo con `gv:read`, con cursos, inscritas, pagos, transferencias pendientes y seguimiento. La navegación del rol GV debe excluir explícitamente las rutas y datos de Macgen, y necesita pruebas de 390 px.

## Veredicto provisional

**Bloqueado para prueba de aceptación de Clary.** La API está cubierta por pruebas focales, pero las pantallas de GV no están en esta rama. La conversión del Excel queda pendiente hasta identificar el archivo local correcto; no se abrió ningún Excel ajeno ni se subieron datos personales.
