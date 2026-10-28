# Tareas listas para DeepSeek Harness (Nexora 1, 28-oct-2026)

Reglas para todas: rama `deepseek/<id>` desde `producto-nexora`; **no empuja** (Claude PC lee el diff y empuja); sin red nueva, descargas, lectura de variables de entorno ni dependencias nuevas; no toca `App.tsx`, `styles.css`, dinero, mercancía, migraciones, despliegue, CI, instalador ni `plugins-lock`; una prueba que falle antes y pase después cuando haya código; no ve `tests/` con literales hasta que `claude-pc/tests-sin-literales` esté mezclada. Entrega: 5 líneas + `git diff --stat`. Revisa y mezcla Nexora 1 con los 3 CI en verde.

## D1 · Script de peso del bundle
Crea `scripts/check-bundle.mjs`: recorre `apps/web/dist/assets/*.js`, imprime el tamaño de cada archivo y sale con código 1 si alguno pasa de 1,90 MiB (1 992 294 bytes). Agrega `"check:bundle": "node ../../scripts/check-bundle.mjs"` en `apps/web/package.json`. Prueba: un test que cree una carpeta temporal con un archivo de 2 MiB y otro de 1 MiB y verifique salida 1 y 0. No toques `vite.config.ts` (carril R).

## D3 · Documentos de venta (solo texto, `docs/venta/`)
1. `PRECIOS_BORRADOR.md`: tabla de planes (propuesta; la dueña decide precios y límites de consultas de IA por plan), qué incluye cada uno, política de prueba, cancelación. Marca todo precio como «PROPUESTA».
2. `SOPORTE_Y_FAQ.md`: guía de inicio de 5 minutos, 15 preguntas frecuentes (caja, inventario, facturas, usuarios, copia de seguridad, instalar en PC), canales de soporte y tiempos objetivo.
3. `REPORTES_606_607_608_ESPECIFICACION.md`: especificación sin código de los formatos DGII 606 (compras), 607 (ventas) y 608 (anulados): campos, orígenes en nuestro modelo de datos (léelo en `packages/shared/src` y `apps/api/prisma`), validaciones y huecos. No inventes reglas fiscales: cita la norma de la DGII o marca «verificar con contador».

## D4 · (después de F2-01) Pruebas de los primitivos `Nx*`
En `packages/ui`, pruebas de accesibilidad y de render para cada primitivo. Rama `deepseek/nx-pruebas`.

## D5 · Ilustraciones de estados vacíos
SVG nuevos y livianos (<8 KB cada uno) en `apps/web/public/ilustraciones/` para: clientes, ventas, equipos, alertas. Mismo estilo y paleta que `vacio-carrito.svg`. Sin texto dentro del SVG, sin scripts, sin enlaces externos.
