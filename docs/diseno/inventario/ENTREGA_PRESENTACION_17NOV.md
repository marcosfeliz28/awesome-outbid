# Inventario · primer corte de presentación, 17 noviembre 2026

## Alcance y estado

Rama `dot/inventario-higgsfield-17nov`, base local `93baacf5` (POS). Referencia inspeccionada: `norexos-inventario-higgsfield-01.png`, aprobada por Marcos. **Parcial, no desplegada ni visualmente validada.** No sustituye la revisión del PNG contra capturas reales. Esta rama contiene la base POS; integrar solamente el commit de Inventario sobre la rama coordinada, no fusionar ciegamente otras fases.

Se incorpora relieve CSS, bordes metálicos, superficies verde/azul y claro/oscuro/negro, navegación armonizada solo en esta ruta, foco visible, pulsación/hover leves y respeto a reduced-motion/forced-colors. La tabla móvil conserva su adaptación original. No se inventan KPIs ni se usan cifras/imágenes ficticias de la lámina.

`Management.tsx` únicamente importa CSS y cambia el fragmento raíz de `Inventory()` por una sección accesible. Todos los handlers, consultas, permisos, ajustes, conteos, almacenes y kardex permanecen byte a byte. El hash reversible de la función y sus cambios se guardan en `PRESENTACION_REVERSIBLE.json`. No se toca API, base, credenciales, cobro, Render ni producción.

## Verificación ejecutada

- Prueba focal antes: 1 falla / 1 pasa (falta wrapper); después: 2/2 pasan.
- `pnpm typecheck`: pasa los cuatro paquetes.
- `pnpm lint`: pasa completo.
- `pnpm check`: **NO verde**. 110 archivos pasan, 16 fallan y 1 omitido; 1036 pruebas pasan, 12 fallan y 48 omitidas. Los fallos PostgreSQL provienen de `initdb: error while loading shared libraries: libicuuc.so.60: cannot open shared object file`. No se omiten ni debilitan estas pruebas para declarar éxito.
- `pnpm --filter @fitstore/web build`: pasa, incluido service worker.
- `git diff --check`: pasa.
- `playwright test --config playwright.visual-inventario.config.ts --max-failures=1`: bloqueado antes de abrir app por Chromium `socket() failed: Operation not permitted`. 1 caso falla por arranque, 3 no ejecutados. **No hay capturas 1440/390 ni evidencia de ausencia de recortes.** El harness usa exclusivamente fixtures DEMO locales y bloquea mutaciones y dominios externos.

## Siguiente control antes de publicar o integrar

1. Ejecutar el harness en entorno con Chromium autorizado; verificar 1440/390 claro/oscuro, repetición de pestañas, tablas y ausencia de escrituras.
2. Revisar comparación visual con la referencia (este corte conserva estructura original, no reproduce aún las tarjetas/resumen de la lámina).
3. Diseñar métricas solo con datos verificables y traducciones completas; la pantalla conserva textos originales en español, no se afirma EN completo.
4. Restablecer entorno PostgreSQL de pruebas y pasar check e integración sin cambiar assertions.
5. Publicar rama y confirmar CI del SHA exacto. No realizado en este corte.

## Segundo corte tras QA PC

La PC reconstruyó el árbol exacto `7a608b8f` y pasó 4/4 casos 1440/390 claro/oscuro (sin overflow, pestañas repetidas, cero mutaciones). Encontró acento púrpura heredado, pestañas móviles demasiado altas y barra fija atravesando acciones.

Este ajuste **solo CSS** limita `--primary`/`--primary-soft` al inventario, da prioridad al color activo y pone la barra Mercancía dentro del flujo móvil, conservando el botón y su handler. Las pestañas móviles pasan a dos columnas de altura intrínseca y mínimo44px. La repetición de QA contra este corte sigue pendiente; no se declara acabado. No se inventan KPIs ni fotos para imitar números del PNG.

## Tercer corte: disabled y EN principal

QA PC del segundo corte: 4/4 visuales y 4/4 diagnósticos, pestañas móviles44px, barra estática y hit-test Ajustar correcto tras scroll. Quedaban Traspasar/Revisar archivo deshabilitados con púrpura heredado; se neutralizan solo dentro de Inventario, sin quitar disabled ni cambiar handlers.

Se conecta el cuerpo principal Inventory a la preferencia ES/EN existente: cabecera, pestañas, búsqueda, columnas, estados, etiquetas de almacén y conteo. Se preservan nombres del catálogo, códigos, valores persistidos y mensajes de servidor. La transformación reversible sigue recuperando byte a byte la función original al retirar exclusivamente presentación/traducciones.

**EN parcial:** los componentes compartidos (WarehousesPanel, WithoutCostCard, controles comunes de modales/paginación) y textos dinámicos secundarios requieren otra fase. No se afirma pantalla completa traducida. KPI y productos ilustrativos de la referencia no se copian como datos reales. Sin producción.

## Integración aislada 18-nov sobre Ventas 0ed250e5

Rama `dot/inventario-produccion-revision-18nov`. Solo corte de presentación: conserva Ventas, PWA, fotos, API y Caja de esa base. La aprobación del concepto proviene del lote de cuatro áreas aceptado por Marcos; referencia `norexos-inventario-higgsfield-01.png` inspeccionada. No equivale todavía a reproducción completa del PNG: KPI, alertas/movimientos y fotos del concepto no se inventan como datos.

Se corrigen además nombre accesible, sobretítulo EN, prefijo de almacén, fallback sin lote y aria de Kardex; la prueba reversible de Inventory sigue pasando. 6/6 pruebas focalizadas, tipado web, lint focal y build web pasan. Pruebas CI y capturas de este SHA pendientes. EN compartido/modales aún parcial. Sin despliegue.

## Corrección QA posterior

Acceso directo restaura preferencia azul/negro sin pasar por Inicio. Logo y modales usan acento de Inventario; títulos sans y acciones móvil mínimo44px. Traducciones ES/EN de Ajustar, Contar, Kardex y Almacenes/traspasos/importación, sin traducir códigos Excel, datos del catálogo ni respuestas del servidor. Prueba reversible conserva hash funcional original. Continúan pendientes capturas nuevas y evaluación de fidelidad del concepto, no se declara reproducción completa ni producción.

## Cotejo personal de referencia y mejora de resumen

Referencia PNG aprobada inspeccionada en nube contra páginas renderizadas del PDF QA c664 (`libfile_fde3_f-fd18c5757c7c819183636b206e4445af_00021c7591648191a2873caeaff1ea36`). Brechas reales: el corte c664 tiene tabla larga y paneles apilados, sin fotos en filas, sin resumen de stock ni columna de alertas/movimientos; no reproduce el concepto completo. Relieve, bordes metálicos y paleta sí están presentes; tipografía sans mejora legibilidad operativa.

Se añaden tres tarjetas de unidades físicas, variantes con stock bajo y variantes sin existencias, exclusivamente a partir de las filas cargadas/filtradas ya autorizadas y el almacén visible. API stock usa findMany sin paginación (inventory.ts:581), pero el texto declara siempre alcance cargado/búsqueda, nunca total global. No se calculan valores monetarios ni movimientos inventados; cantidades ocultas/invalidas suprimen resumen. Se mantienen pendientes fotos, composición de alertas/movimientos y revisión final de fidelidad.

EN: fallback de variante y carga ahora opt-in inglés; otros consumidores conservan español. Verificación local: 41 pruebas focales pasan, tipado web/lint/build pasan con @fitstore/ui apuntando al paquete exacto de este worktree, no dependencia de otro checkout. Nueva QA aún pendiente. Sin producción.
