# PQ27: pnpm audit, separado en producción y desarrollo (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 27 de la cola.

Alcance: solo informe. No se ejecutó `pnpm audit --fix` ni se cambió ningún `package.json`, `pnpm-workspace.yaml` ni lockfile.

## Comandos

- `pnpm audit --json` (todas las dependencias): salida con código 1 (hay avisos). Resumen: `info 0, low 5, moderate 10, high 2, critical 3` (20 avisos).
- `pnpm audit --prod --json` (solo producción): código 1. Resumen: `moderate 2, high 1` (3 avisos).
- Por diferencia, desarrollo: 17 avisos (`critical 3, high 1, moderate 8, low 5`).
- Qué importa de cada paquete: `pnpm view` y lectura de `apps/api/src` con `grep`.

## Producción (3 avisos)

Estos tres sí llegan a la API o al paquete compartido.

| Gravedad | Paquete | Versión en el lock | Parche | Aviso | Dónde llega | Qué afecta |
|---|---|---|---|---|---|---|
| alta | zod | 3.25.76 | >=4.6.6 | GHSA-mrhx-c7xc-m3w5: agotamiento de memoria al validar colecciones grandes con restricciones | `apps/api` (`zod`), `packages/shared` (`zod`), y `@anthropic-ai/sdk` (peer, se resuelve a este mismo zod) | Validación de cuerpos de la API con `parse(schema, body)`. El cuerpo JSON tiene tope de 100 kB (`main.ts:46`), pero `/api/gv/import` acepta 4 MB (`main.ts:45`). Exposición real: DoS en endpoints con arreglos, limitada por el tope. |
| moderada | minimatch | <11.0.1 | >=11.0.1 | GHSA-g3hv-75wg-m249: amplificación de partes de patrón (ReDoS) | `@sentry/node > @sentry/bundler-plugins > glob > minimatch` y `exceljs > archiver > ... > glob > minimatch` | La API no importa `glob` ni `minimatch` (`grep` en `apps/api/src`: 0 importaciones). Llega por dependencias transitivas. Exposición baja, si no hay patrones de usuario. |
| moderada | glob | >=9.0.0 <=14.0.1 | >=14.0.2 | GHSA-3g3m-2fjr-6pw4: cancelación con `AbortSignal` no detiene el recorrido | `@sentry/node > @sentry/bundler-plugins > glob` | `@sentry/bundler-plugins` sirve para compilar y subir mapas de Sentry. No verifiqué si `@sentry/node` lo carga en tiempo de ejecución. Exposición probablemente muy baja. |

Notas de producción:

- Los tres avisos de producción tienen la misma causa de fondo: son transitivos o de utilidades. Solo zod es una dependencia directa y de uso amplio.
- `body-parser`, `multer` y `qs`, que aparecían el 30-oct, ya no están en la lista. Están fijados con `pnpm.overrides` en `pnpm-workspace.yaml:10-12` (`body-parser >=2.4.0`, `multer >=2.5.0`, `qs >=6.16.1`).
- El aviso de zod también está en `packages/shared`. El cliente web no importa zod directamente (`grep` en `apps/web/src`: 0), pero sí importa `@fitstore/shared`.

## Desarrollo (17 avisos)

No se empaquetan en la web ni en la API desplegadas. Afectan al equipo de desarrollo y a la CI.

| Gravedad | Paquete | Ruta | Aviso | Qué afecta |
|---|---|---|---|---|
| crítica | tinypool | `vitest > tinypool` | GHSA-5gmw-xhrv-c9v3 (prototipo a RCE en opciones de worker) y GHSA-85c8-ppgw-ccpr (run() con opciones) | Solo al ejecutar pruebas con vitest. Parche >=2.1.2. |
| crítica | shell-quote | `concurrently > shell-quote` | GHSA-pqg4-j6r4-53mv: inyección en `quote()` con salto de línea | Solo al usar `concurrently` (scripts `dev` de la raíz). Parche >=1.11.0. |
| alta | vite | `vitest > vite` y similares | GHSA-587h-7wmj-h5pm: `launch-editor` salta la comprobación de existencia en Windows | Servidor de desarrollo de Vite en la laptop Windows de Marcos. No llega a Render (la web se sirve como archivos estáticos). Parche >=7.3.7. |
| moderada | vite (x3) | `vitest > vite` | GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw (`launch-editor` en Windows), GHSA-rq7h-c2jc-7f22 (`server.fs.allow`) | Servidor de desarrollo. Parche >=7.3.7. |
| moderada | @vitest/mocker (x2) | `vitest > @vitest/mocker` | GHSA-82fw-gwwq-j7x9 (lectura de archivos por redirección de mock), GHSA-qxg6-89mg-rqv8 (inyección de código con mocks) | Pruebas. Parche >=4.1.12. |
| moderada | fast-uri (x2 de 4) | `apps/web > vite-plugin-pwa > workbox-build > ajv > fast-uri` | GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr | Solo en la compilación del service worker. Parche >=3.1.9. |
| baja | serialize-javascript | `apps/web > vite-plugin-pwa > workbox-build > @rollup/plugin-terser` | GHSA-m5mm-p8h7-m29v (XSS con `</script>` en funciones serializadas) | Solo en compilación; no se sirve al usuario. Parche >=7.1.3. |
| baja | fast-uri (x2) | igual que arriba | GHSA-333x-w4r6-6crp, GHSA-xhq7-xmqj-769h | Compilación. |
| baja | deepmerge | `apps/web > vite-plugin-pwa > workbox-build > @rollup/plugin-node-resolve` | GHSA-gcqx-w48m-w2h4 | Compilación. Parche >=4.3.2. |
| baja | vite | `vitest > vite` | GHSA-9jrq-w75r-8gcw (script cruzado por middleware) | Servidor de desarrollo. |

Cuenta de desarrollo: `critical 3` (tinypool x2, shell-quote), `high 1` (vite), `moderate 8` (vitest, @vitest/mocker x2, vite x3, fast-uri x2), `low 5` (vite, serialize-javascript, fast-uri x2, deepmerge).

Nota: `minimatch` (GHSA-g3hv-75wg-m249) y `glob` (GHSA-3g3m-2fjr-6pw4) son un aviso cada uno con varias rutas. Están en producción (arriba) y también en desarrollo (`eslint`, `@capacitor/cli > rimraf > glob`, `workbox-build`). Por eso no se cuentan dos veces.

## Recomendación

1. **Producción, prioridad 1:** zod a 4.6.6 o superior (pieza 9 de la cola). El SDK de Anthropic acepta zod 4 como peer, así que no bloquea. Tras subirlo, correr la suite de la API y las pruebas de importación de GV.
2. **Desarrollo, prioridad 2:** subir `vitest` a una versión que traiga `tinypool >=2.1.2`, `vite >=7.3.7` y `@vitest/mocker >=4.1.12`. Hay que ver si `vitest` 5 está listo (PQ23 lo marca como mayor).
3. **Desarrollo, prioridad 2:** `concurrently` a una versión con `shell-quote >=1.11.0`, o un `pnpm.overrides` que fije `shell-quote`. Un override puntual es la opción más pequeña.
4. **Compilación de la web:** los avisos de `workbox-build` (fast-uri, serialize-javascript, deepmerge) esperan a la subida de `vite-plugin-pwa` (PQ23 lo marca como mayor, 1.3 a 2.0).
5. **Producción, menores:** `minimatch` y `glob` por override de `pnpm` (`minimatch >=11.0.1`, `glob >=14.0.2`) si se quiere cerrar el `pnpm audit --prod` por completo. Es seguro porque no hay uso directo en la API, pero debe probarse con `exceljs` y `@sentry/node`.

No conviene pasar `pnpm audit --fix` sin revisar: podría subir zod a una mayor sin pruebas.

## No cambiado

- `package.json` de la raíz y de los workspaces, `pnpm-workspace.yaml`, `pnpm-lock.yaml`: sin cambios.
- No se aplicó ningún parche ni override.
- Los JSON completos de auditoría se guardaron fuera del repositorio (carpeta temporal) y no se incluyen aquí.
- No se llamó a servicios de Render ni de producción.
