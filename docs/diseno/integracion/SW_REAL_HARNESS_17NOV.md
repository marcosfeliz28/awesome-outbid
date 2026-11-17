# Integración aislada y prueba SW real

Base de tienda observada a732e1f2. Combina integración7bf3ef77 y guardiadefb2fc2 sin conflictos. Conserva las diez fotos nuevas; código de app idéntico a la guardia y diseño ya revisados.

36/36 pruebas focales pasan, TypeScript web y lint focal pasan. No hay despliegue.

La prueba adicional tests/e2e/pwa-update-real.spec.ts la ejecutará verify existente (sin cambiar workflows). Compila pwaUpdate.ts y register.js instalados, usa Workbox y service worker real en Chromium y dos pestañas del mismo contexto. Solo store de carrito y modal de pago son ficticios. Un servidor efímero localhost sirve SWv1, luego SWv2. Comprueba que actualizar desde una pestaña libre no recarga la otra con carrito/modal de pago, y que recarga cuando ambos quedan libres.

Reproducción: FITSTORE_WEB_URL=http://127.0.0.1:1 pnpm exec playwright test tests/e2e/pwa-update-real.spec.ts. La URL evita iniciar preview innecesario: la prueba usa su propio localhost. En Windows PowerShell: $env:FITSTORE_WEB_URL='http://127.0.0.1:1'; pnpm exec playwright test tests/e2e/pwa-update-real.spec.ts.

Cloud local: --list reconoce la prueba, pero browser real NO ejecutado. Chromium del sistema aborta socket() Operation not permitted; navegador Playwright propio no instalado. No confundir las36pruebas node con validación SW real. CI tiene instalación oficial de Chromium y puede ejecutar el caso. Antes de producción hacen falta resultado exacto, vista real aprobada y primera actualización con cajas/pagos libres. Esto no prueba aún API real, persistencia IndexedDB fallando, turno en servidor ni reintentos de ventas offline.
