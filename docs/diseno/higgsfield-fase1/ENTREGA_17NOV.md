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

## Revisión PC y corrección de KPI
La revisión PC del primer árbol pasó 11/11 casos pero la inspección humana detectó un último cero partido en el importe `RD$124,850.00` a 1440 px. Se corrigió la tipografía para que dependa del ancho de la tarjeta y se apilaron los KPI a 390 px; no se alteraron importes, formato monetario ni lógica. No se oculta ni se trunca texto.

El revisor PC confirmó sobre la corrección CSS en copia aislada: 11/11 Playwright (45,4 s), 8/8 combinaciones 1440/390 × claro/oscuro × verde/azul con importe en una línea y todos sus rectángulos contenidos; inspección de 1440 oscuro y 390 claro confirmó cifra íntegra y gráfica/pie completos tras 2200 ms. Capturas PC: `noxeros-inicio-kpi-review/test-results/higgsfield-visual/capturas`. El harness ahora exige estas comprobaciones del importe y espera la entrada animada de la gráfica antes de capturar. Typecheck, lint, build y 11 pruebas de preservación también pasan en cloud. Las pruebas de API real y los controles GitHub quedan separados de esta evidencia visual DEMO.

## Accesos móviles y contrato del saludo
Tras la validación del KPI se detectó que los accesos comenzaban a 2308,92 px a 390 px. Se mantiene un único bloque de accesos y se monta antes de la tira KPI en pantallas de hasta 560 px; el orden DOM y teclado sigue el orden visual. En escritorio conserva su sitio junto a la gráfica. No hay botones duplicados ni cambios de destino/permisos.

Se restaura el saludo visible `Hola, <nombre>` como encabezado secundario bajo Resumen. La eliminación anterior rompía el contrato de identificación de Inicio usado por los E2E después del login. No se relajaron ni modificaron esos E2E existentes.

QA PC de este ajuste: 12/12 casos (50,4 s), ocho variantes con importes íntegros, saludo visible y resize 1440→390→1440→390 sin duplicados; navegación Reportes con Enter y vuelta comprobadas. Accesos a390 ahora top680,84 px (antes2308,92), fondo1083,23 antes de KPI1501,70. Desktop conserva panel lateral. Capturas tras animación. Typecheck/lint/build y 11 pruebas de preservación pasan cloud. Pendiente verificación CI GitHub del nuevo SHA, distinta de la validación visual DEMO.

## Nombre accesible de accesos rápidos
El CI de eb20caab llegó a154 E2E aprobados y1fallo: navegación y atajo tenían ambos nombre accesible exacto «Punto de venta». Se da al atajo un nombre de acción «Abrir Punto de venta» (inglés «Open Point of sale»), preservando texto visible, permiso y destino. No se toca store.spec.ts ni se relaja su cobertura. La prueba visual propia de Reportes se actualiza al nuevo nombre y se añade regresión de unicidad navegación/atajo. Typecheck/lint y11pruebas preservación pasan; navegador local bloqueado antes de abrir página por socketEPERM, pendiente CI.

## Marca canónica: Norexos (corrección expresa de Marcos)
Se devuelve Noxeros a Norexos en index.html, App.tsx e inicioLanguage.ts. La clave nueva es norexos-overview-language; se lee la anterior únicamente para migrar una preferencia válida, sin eliminarla ni pisar una elección canónica. El almacenamiento bloqueado no inutiliza la sesión.

Se restauran íntegros los E2E acerca-de y caja-web al contenido anterior a1d62b760 (comprobado con diff contraa1c18c66 vacío), y el assert/nombre original de la prueba Inicio. Se conservan las nuevas regresiones. Atajos accesibles «Ir a Punto de venta», «Ir a Inventario» y «Ir a Reportes», en inglés «Go to …»; texto visible inalterado y navegación sigue diferenciada.

Fuente de referencia leída: docs/diseno/inicio-integrado/AUDITORIA_CLAUDE_4e4bb76f.md en nexora-cloud, blob5742af07. No se ejecutan instrucciones adicionales de ese documento. Typecheck, lint, build,12pruebasInicio y4citas pasan. E2E/CI remoto pendiente. Rama de corrección separada de Caja.
