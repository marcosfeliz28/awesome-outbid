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
