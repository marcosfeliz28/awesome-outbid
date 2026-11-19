# Caja y turnos · fase visual revisable

Referencia aprobada: `norexos-caja-turnos-higgsfield-01.png`. Se aplica la misma familia verde/azul, claro/oscuro/negro, superficies biseladas, tipografía editorial y respuestas sutiles hover/pulsación. Se conservan foco visible, reducción de movimiento y colores forzados.

Esta fase conserva el flujo actual completo. No copia los importes, tablas ni botones ficticios de la imagen. Respeta arqueo ciego, permisos, equipo actual, ventas pendientes, sincronización, incentivos y cierre. Management solo recibe import CSS y clase raíz; un registro reversible y test de SHA256 prueban que todo el archivo original se recupera byte a byte.

La composición usa efectivo esperado y cuatro indicadores realmente disponibles (apertura, tarjeta, transferencia y número de movimientos), no inventa entradas ni salidas sumadas. Mantiene historial, reportes y acciones reales. No incorpora controles de idioma que prometan traducir esta pantalla; siguen sus textos operativos en español. Los temas existentes se heredan de las preferencias actuales.

Esta es una implementación inicial a cotejar con el concepto, no una afirmación de equivalencia visual. Falta inspección de navegador en 390 y escritorio, incluido rol sin permiso de ver importes. Sin despliegue ni datos reales de clientes.

## Defensa de importes en historial
La revisión DEMO entregó por error `expected` a un rol cajero y el historial antiguo lo mostraba. El contrato API real (cash.ts, GET cash-sessions) ya omite expected y diferencias cuando canViewCashExpected es falso. Se agrega defensa UI adicional con canSeeExpected para importe esperado y diferencias, sin ampliar permisos. El registro reversible incluye estas dos guardas explícitas. Harness de 16 casos incluye payloads hostiles abierto/cerrado; discovery/lint pasan, ejecución automatizada bloqueada por Chromium EPERM. 21 pruebas unitarias locales pasan; falta revisión real de esta guarda y móvil antes de publicar.
