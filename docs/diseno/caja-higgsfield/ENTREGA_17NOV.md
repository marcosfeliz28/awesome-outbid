# Caja · concepto Higgsfield 01 · implementación inicial para revisión

Referencia: PNG nítido revisado de Caja; Library `libfile_fde3_f-84d6325a9b8881919cb389ee4c9d4ec7_00021c7591648191a2873caeaff1ea36`, SHA256 `9555ca20584c15ec1fd61d461c3d348b19fcaf4952ea9bca8220539698b89dbc`.
Estado actualizado: Marcos aprobó el concepto Caja («Me encanta ... misma calidad y nitidez o más»). Esta rama prepara la vista funcional; aprobar la imagen no equivale a certificar la implementación ni a desplegar producción.

## Cambios reales
Pintura CSS aislada de POS y shell mientras Caja está montada. Superficies negras/verdes con borde oro, relieve, catálogo con fotos reales existentes sin saturación artificial, tarjeta de venta actual, controles elevados, resumen legible, CTA Cobrar. En claro se prioriza contraste, azul y Negro como preferencias. Hover y pulsación ligeros; foco visible, reduced-motion y forced-colors.

Se conserva el POS original. `PRESENTACION_REVERSIBLE.json` registra cada cambio de presentación; prueba revierte importaciones, clase, preferencias y etiquetas, y exige SHA256 exacto del archivo original. No se modifican cálculos, queries, pagos, carrito, cantidades, stock, persistencia, teclado, permisos, API ni BD.

Idioma: etiquetas principales de Caja en ES/EN. Datos de productos, avisos y modales de pago conservan su idioma original; no se anuncia traducción completa. Cambiar apariencia no recarga ni limpia carrito.

## Diferencias deliberadas del PNG
No reemplazar fotos reales por frascos genéricos de la maqueta. No sustituir stock por «Disponible», ni inventar caja abierta, importes o ITBIS. Se mantienen controles mayorista, estados, lector y seguridad originales. La app conserva fuente operativa y datos reales; no se rasteriza la pantalla. No se afirma equivalencia visual100% sin comparar capturas reales.

## Pruebas locales
Typecheck web, ESLint y build web pasan. 30/30 pruebas pasan: presentación reversible3, Inicio11, estiloPOS2, política borrador7, carrera borrador3, refresco trasventa4.
Harness nuevo con API únicamente DEMO, escrituras desconocidas405 y recursos externos bloqueados: `pnpm exec playwright test -c playwright.visual-caja.config.ts`. Siete casos preparados:1440/390 claro/oscuro, monto/cantidad/descuento/ITBIS, agotado, F2/F4/F12 sin confirmar pago y movimiento reducido. Cloud Chromium no puede iniciar por `socket EPERM`; ejecución real de esos casos y capturas se hará en copia PC antes de aprobar apariencia.

Sin producción, despliegue, datos de clientes, dinero ni cambios de seguridad.

Check global cloud: 16 suites PostgreSQL siguen bloqueadas por falta de libicuuc.so.60. Se reparó una cita documental del título traducido (el fragmento de evidencia pasó de texto literal a t(...)); pruebas de citas pasan sin relajar sus assertions. Los demás cambios de docs/sistema son reanclajes automáticos a las nuevas líneas del mismo código.

## Ajuste previo a QA
Se aumenta la especificidad de Caja para que la hoja antigua no vuelva a imponer un borde violeta o estilos planos sobre la referencia nueva. Se añade octava prueba de cambio ES/EN, azul y Negro conservando carrito y total. Se incorpora además el arreglo accesible de Inicio (atajos Abrir..., navegación sin duplicado), sin modificar su aspecto.
PC se desconectó antes de ejecutar los casos Caja. El intento cloud estándar y ampliado sigue bloqueado al iniciar Chromium (socketEPERM). No hay aprobación visual, ocho pruebas aprobadas ni capturas certificadas de Caja. Se prepara copia DEMO privada con la misma fuente y fixtures para revisar sin tocar tienda.

## Revisión de pantalla corta · candidato 2aa7c5b2
La revisión de navegador de la demo detectó a 1180×757 el botón Cobrar entre y=783.375 y847.375, fuera de la pantalla, y nombre de producto comprimido. Se compactan las preferencias en disclosure nativo, se corrigen las columnas del carrito y se reducen espacios en escritorios de altura corta, sin modificar cálculos ni manejadores.
Typecheck, lint de archivos modificados, build y 35 regresiones locales pasan. Se preparan cuatro casos adicionales de geometría (1024/1180/1366/1536×768), para doce casos de navegador. No se anuncian aprobados: Chromium automatizado cloud sigue bloqueado. La revisión real del nuevo candidato está en curso.
Marca actual Norexos, con migración de preferencia anterior; accesos de Inicio «Ir a ...». Las menciones anteriores describen iteraciones históricas.

### Resultado de revisión real del candidato
La revisión independiente del navegador privado confirmó a 1180×757 Cobrar entre y=628.98 y676.98 (antes final847.375), nombre Proteína DEMO completo y variante debajo. Abrir apariencia no desplaza Caja. Alternar EN→ES y Negro→Claro conserva dos artículos, total RD$236 e ITBIS36. Demo privada v3 publicada con fuente2aa7c5b2; no producción. Esta comprobación manual no sustituye los doce casos automatizados ni certifica aún todos los anchos móviles.

## Regresiones CI 29291088
El CI completo detectó siete fallos de navegador: A5 mostraba menos de tres filas completas con cinco artículos; W5 desbordaba el catálogo con categoría larga a cuatro tamaños; U1 exigía conservar la fuente operativa Plus Jakarta Sans de 28–32px en el total. Se corrigen geometría, contención y tipografía sin cambiar los tests E2E originales, datos ni manejadores. Harness DEMO ahora tiene 16 casos y reproduce esos escenarios. 29 regresiones unitarias locales pasan; build y lint pasan. Pendiente medición real y CI antes de afirmar resuelto.

Revisión independiente real de fb119ff1 en 1180×757: cinco productos distintos, seis unidades; filas85px, lista255.406px con tres filas completas; panel y93–745 dentro de757; Cobrar y652–698. Categoría larga sin desbordamiento (documento1165px en viewport1180). No se publicaron estas correcciones en producción. Falta ejecución CI de los casos en todos los anchos y QA390/1440; una revisión manual no se anuncia como suite completa aprobada.
