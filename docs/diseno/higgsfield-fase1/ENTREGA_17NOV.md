# Inicio / Resumen · Higgsfield 02 · primera integración revisable

Referencia inspeccionada: segunda lámina aprobada, Library `libfile_fde3_f-00191c155c6c81919dc54a30b46d3802_00021c7591648191a2873caeaff1ea36`.

## Alcance
- Encabezado Resumen y subtítulo; KPI primero, gráfica y accesos rápidos después. Bienvenida e indicadores anuales conservados abajo.
- Relieve CSS mediante capas, bordes, luces y sombras, no una imagen incrustada ni motor 3D.
- Accesos rápidos a caja, mercancía e informes filtrados por los mismos permisos existentes.
- Verde/azul; Claro/Oscuro/Negro explícitos; etiquetas ES/EN. Selección persistida como preferencia visual.
- Hover eleva accesos/nav/KPI y enciende bordes; pulsación comprime botones; foco visible y movimiento reducido. Se conserva la interacción de puntos de gráfica existente.
- Sin API nueva, migraciones, lógica de cobro, carrito, credenciales, producción ni Render.
- Los valores reales y la privacidad se conservan: no se inventan cifras o estados de caja para copiar la lámina.

## Evidencia local
- Typecheck web y lint: pasan.
- `pnpm exec vitest run tests/inicio-integrado.test.ts`: 11/11. Incluye reversibilidad byte a byte del Dashboard base y permisos de accesos.
- `pnpm --filter @fitstore/web build`: pasa; advertencia habitual de chunks grandes, no oculta ni modificada.
- `pnpm check`: typecheck/lint pasan; 108 archivos de tests pasan, 16 fallan al iniciar PostgreSQL embebido por `libicuuc.so.60` ausente; 1028 tests pasan, 12 fallan, 48 omitidos. No se modificaron ni desactivaron tests PostgreSQL.
- Pruebas visuales: Chromium aborta ANTES de abrir página con `socket() failed: Operation not permitted`, también en intento ampliado. No son once defectos visuales demostrados. No se han obtenido capturas nuevas ni certificado equivalencia visual.

## Revisión en PC
`pnpm exec playwright test -c playwright.visual-inicio.config.ts`

11 casos; datos DEMO y API simulada, nunca producción. Ocho combinaciones 1440/390, claro/oscuro y verde/azul; inglés/teclado/movimiento reducido; accesos rápidos sin escrituras; Negro diferenciado. Capturas en `test-results/higgsfield-visual/capturas` cuando pueda arrancar navegador. Este harness no certifica integración API real.

No avanzar a otra área ni desplegar como acabado visual aprobado hasta que Marcos vea la aplicación real. El relieve está implementado, pero la fidelidad al PNG sigue pendiente de revisión visual.
