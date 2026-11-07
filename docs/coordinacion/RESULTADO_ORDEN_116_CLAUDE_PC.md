# Resultado de la orden 116 (Claude PC nube, 7-nov-2026)
Solo lectura; no se tocó producción ni se desplegó. Base de datos desechable local, sin datos reales.

## 1. GV Caja tras el cierre en iPhone 390 px (commit 1a4c9bd7) — CORRECTO
Playwright 390x844 (iPhone 13) contra la API real con Postgres local. Tras cerrar caja se ve «el sistema registró RD$ 2,500.00 · tú declaraste RD$ 1,500.00 · diferencia RD$ -1,000.00» por forma de pago, la lista de recibos (GV-0000001 · efectivo · RD$ 1,000.00, ...) y la diferencia total. Sin desborde horizontal. Captura: orden116/gv-caja-cierre-390.png.
Observación menor (sin corregir): los recibos salen como líneas sueltas sin viñetas ni separación del bloque anterior; es legible.
(Las 2 filas de recibos vienen de dos corridas mías sobre la misma caja GV compartida, no es un fallo.)

## 2. ia-medidor (0d176e79) e ia-ventas-rescate (8954a099)
- Con Node 24 y pnpm 11.19: typecheck, eslint y build pasan en ambas (requiere pnpm db:generate antes del typecheck).
- Pruebas: ia-ventas-rescate 929 pasan, ia-medidor 911 pasan; 12 fallan en ambas y todas son *-postgres (initdb se niega a correr como root en este entorno), no relacionadas con el cambio.
- Tarjeta «Uso y costo de IA» en Configuración a 390 px: cabe, sin desborde (estado sin uso; no hay clave de IA aquí, así que no se vio con datos). Captura: orden116/ia-medidor-390.png.
- CI en GitHub: verify, windows-installer y render-images en verde en ambas.

## 3. Landing vs precios — solo lista de diferencias
La landing (es y en, rama landing-norexos-net d340664d) NO publica precios: «Próximamente. Los planes y sus precios se anunciarán aquí antes de cobrar nada» (marcador DECIDE-DUEÑA). No hay contradicción con cifras, pero faltan:
- Instalado: US$349 pago único + US$99/año (LEEME_PRIMERO de entrega-venta) — no aparece; PROPUESTA_PRECIOS.md no tiene este plan.
- Nube Medio: LEEME dice US$69/mes; PROPUESTA_PRECIOS.md dice US$59 (desactualizada, la landing no dice ninguno).
- Nube Completo US$119: coincide en ambos documentos; no está en la landing.
- Nube Básico US$29: aún en PROPUESTA_PRECIOS.md; LEEME dice no ofrecerlo; la landing no lo menciona (bien).
- Instalación US$150/250/400: en ambos documentos; no está en la landing.
Nota: entrega-venta/ solo existe en la rama claude/facturacion-app-architecture-a3bz90, no en nexora-cloud. Nada se cambió.
