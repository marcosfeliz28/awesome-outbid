# Productos: integración aislada sobre live Caja/Ventas

Base remota: `7ac1da1437d221410fe04e3ca491b472a8a8cfae`, árbol `0559703c1ac575ea0ae6459cd2b2b80bc2cf7d18`.
Candidato de origen: `c6b75f070afd2f17de690ce703bac47cb95b34a3`.
Rama: `dot/productos-live-18nov`. No desplegada.

## Conservación
Se recuperan únicamente wrapper CatalogPresentation, CSS, tres líneas de integración de Catalog, prueba y registro Vitest. No se arrastran docs/sistema antiguos ni cambios de base. Se conservan Caja, Ventas, fotos, PWA, POS, API y permisos. Conflictos de importación y listado de pruebas resueltos acumulando ambas entradas. La prueba reversible de Productos compara Management sin wrapper contra base live; el registro reversible de Caja se reancla al texto que incluye ese wrapper, sin quitar sus guardas de privacidad ni debilitar comparación byte a byte.

## Evidencia y límites
12/12 pruebas focales (5 Productos + 7 Caja) y tsc web pasan en copia aislada. CI y QA visual de este SHA deben registrarse por separado. PC desconectada al solicitar QA; no se encendió. Chromium cloud previamente bloqueado por restricciones de sockets. No hay captura real nueva certificada.

PNG aprobado revisado: `libfile_fde3_f-95e37ef8dde881918c5b2c86507cddf1_00021c7591648191a2873caeaff1ea36`.
El concepto guía oro/verde, relieve, listado y ficha lateral. Este corte no certifica equivalencia visual: los KPI anteceden al encabezado, el listado conserva columnas/controles existentes, la ficha baja bajo el listado en móvil y la tipografía/volumen de iconos difiere del concepto. No se insertan métricas ni fotos de muestra.
Los nuevos textos son ES/EN, pero tabla y formularios heredados siguen español. No es módulo completamente bilingüe. Falta QA 1440/390 claro/oscuro y acentos, teclado, carga/error, cambio de filtro/selección, cifras largas, permisos y contraste. No usar CI verde como aprobación visual.
