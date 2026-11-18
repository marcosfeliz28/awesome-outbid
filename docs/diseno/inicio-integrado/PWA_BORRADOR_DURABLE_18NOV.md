# Recarga PWA y borrador durable · 18-nov

Base: 24d0213a, que conserva las 38 fotos de bb379731 y el acabado premium.

PC reprodujo en 92d131f8 la restauración del último artículo retirado: el actualizador se suscribe antes que cartDraft y recargaba antes del borrado diferido. Los controles anteriores no cubrían IndexedDB real.

La recarga ahora espera una barrera inyectada desde main: solo drena la transición local a carrito vacío, espera escrituras previas, cancela diferidos y confirma eliminación durable. Revalida usuario, generación, restauración, carrito y cobro incierto después de cada espera. Un fallo de almacenamiento o una revisión ajena bloquea la recarga. La eliminación usa comparación de revisión dentro de una transacción Dexie; también se aplica al borrado normal, a la limpieza de restauración y al descarte tras cobro. No cambia claves ni migra/borrra registros globales. Las restauraciones antiguas no pueden terminar la barrera de una restauración más nueva. Un intento de cobro sin resolución conserva la barrera incluso con carrito vacío.

Regresiones: módulo real cartDraft con almacenamiento controlable, fallo de eliminación, revisión ajena, intento incierto, nueva venta y cambio de usuario durante espera. E2E usa cartDraft y Dexie/IndexedDB reales, service worker y Workbox reales: retiro del último artículo y tres pestañas del mismo usuario con revisión más reciente conservada.

Local: 21 pruebas focales, lint de cambios, typecheck web y compilación web pasan. Playwright local no puede iniciar: falta chromium_headless_shell-1243. E2E real y controles completos pendientes del CI del SHA publicado y repetición PC. No constituye autorización de producción. La política previa de escritura de carritos no vacíos entre pestañas no se rediseña aquí.
