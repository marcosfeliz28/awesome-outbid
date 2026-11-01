# PQ26: pasada de seguridad en 20 puntos sobre nexora-cloud (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 26 de la cola. Procedimiento: `.claude/skills/seguridad-20/SKILL.md`. Referencia previa: `docs/auditoria/SEGURIDAD_20_PUNTOS.md` (30-oct, base c9975b02).

Reglas: no se cambió código ni configuración. No se llamó a Render, a la API desplegada ni a la base de producción. No se imprimió ningún valor secreto.

## Resumen

- **Alto, sigue abierto (punto 13):** `zod 3.25.76` (GHSA-mrhx-c7xc-m3w5, severidad alta) es dependencia de producción de `apps/api` y `packages/shared`. Detalle en PQ27.
- **Cerrado desde el 30-oct:** `body-parser`, `multer` y `qs` ya no aparecen en la auditoría de producción (overrides en `pnpm-workspace.yaml:10-12`).
- **Cerrado desde el 30-oct:** `$queryRawUnsafe` ya no se usa en `apps/` ni `packages/` (antes, cinco usos). Queda uno en un script de despliegue (punto 16).
- **Medio, sigue abierto (punto 8):** la extracción de facturas con IA no tiene tope diario por usuario.
- **Nuevo, bajo-medio (punto 11):** la web no envía `Cross-Origin-Opener-Policy` ni `Cross-Origin-Resource-Policy`. Detalle en PQ28.
- **Sin hallazgos nuevos en código:** XSS, llaves en el código y en el historial de la rama.

## Tabla de 20 puntos

Estado: **V** verificado hoy con comando; **P** parcial; **R** sin re-verificar (se mantiene el resultado del 30-oct, no revisado en esta pasada).

| # | Punto | Estado | Evidencia de hoy |
|---|---|---|---|
| 1 | Llaves fuera del código | V | `git grep -E "sk-ant-[A-Za-z0-9_-]{20,}\|AKIA…\|BEGIN … PRIVATE KEY"` sobre HEAD, en `apps packages deploy scripts render.yaml .env.example`: 1 acierto en `scripts/package-external-audit.mjs:115`, que es la expresión regular del propio detector (falso positivo, no hay llave). |
| 2 | Variables de entorno | P | `validateSecret` exige `JWT_SECRET` de 32 caracteres o más (`apps/api/src/security.ts:17`). `WEB_ORIGIN` obligatoria en producción (`main.ts:23-25`). No cotejé `.env.example` con `render.yaml` variable por variable. |
| 3 | Rutas de administración | V | `node scripts/rutas-permisos.mjs` → `rutas=188 sinPermiso=0` (el 30-oct: 187). El script reescribe `docs/auditoria/RUTAS_Y_PERMISOS.md`; se revirtió para no mezclar cambios en esta pieza. |
| 4 | Autenticación | R | Sin re-verificar en esta pasada. `bcryptjs` en `auth.ts:15` (confirmado). |
| 5 | Acceso por usuario | R | Sin re-verificar. `safe()` en `common.ts` según el 30-oct. |
| 6 | Formularios | R | Sin re-verificar. `parse(...)` y límite de 100 kB en `main.ts`. |
| 7 | XSS | V | `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(` en `apps/` y `packages/`: 0 aciertos. |
| 8 | Límite de tasa | V (hallazgo) | Existe `apps/api/src/rate-limit.ts`. La IA de facturas captura `Anthropic.RateLimitError` (`invoice.ts:423`) y no hay tope diario por usuario (búsqueda de `diario`, `daily`, `tope` en `invoice.ts`: 0). **Media, sin cambio.** |
| 9 | Endpoints seguros | P | Hay 105 decoradores de escritura (`@Post/@Put/@Delete/@Patch`) y 183 `@Permit` (incluye nivel clase; no es un conteo uno a uno). Idempotencia y auditoría sin re-verificar. |
| 10 | CORS | V (baja) | `cors-origin.ts:4-12`: origen explícito; sin `WEB_ORIGIN` solo usa `http://localhost:5173` si `NODE_ENV` es indefinido o `development`; en otro caso no envía CORS. `main.ts:48-49` lo aplica. Render define `NODE_ENV=production` (`render.yaml:52-53`). **Baja, sin cambio.** |
| 11 | Cabeceras | V (ver PQ28) | `app.use(helmet())` en `main.ts:42` (helmet 8.3.0). Helmet añade COOP y CORP `same-origin` por defecto (`apps/api/node_modules/helmet/index.cjs:175,191`). La web usa `deploy/render/security-headers.conf`, que no tiene COOP ni CORP. **Live: NO COMPROBADO.** |
| 12 | Modo debug y errores | V (parcial) | `render.yaml`: `NODE_ENV=production` (52-53) y `ENABLE_SWAGGER=false` (56-57). El filtro de errores sin re-leer. |
| 13 | Dependencias | V (**alto**) | `pnpm audit --prod`: 1 alta (`zod` <4.6.6), 2 moderadas (`minimatch`, `glob`). Ver PQ27. `body-parser`, `multer` y `qs` ya corregidos. |
| 14 | Paquetes sin uso | R | No se repitió `depcheck`. Hay `@capacitor/*` en `apps/web/package.json` sin importaciones en `apps/web/src` (ver PQ23). |
| 15 | Archivos expuestos | P | `apps/web/public` tiene 6 archivos hoy (el 30-oct se citaron 10). No revisé el contenido en esta pasada. Live: NO COMPROBADO. |
| 16 | Base de datos segura | V (baja) | `$queryRawUnsafe` en `apps/` y `packages/`: 0 usos (antes, 5). Queda `deploy/render/post-deploy-check.mjs:218` (`db.$queryRawUnsafe(sql, ...params)`), un script de verificación posterior al despliegue. Revisar que `sql` sea siempre constante. |
| 17 | Hashes | V (parcial) | `bcryptjs` en `auth.ts:15` y `realtime.ts:13` (`compare`). Hash del PIN no re-verificado. |
| 18 | Secretos en git | V (HEAD) | Mismo patrón que el punto 1 sobre HEAD: 0 aciertos reales. El historial completo y las ramas remotas no se repitieron hoy (el 30-oct: 0 commits). |
| 19 | Auditoría completa | V | Este informe, fechado. |
| 20 | Sin errores | V | Cada fila lleva comando o `archivo:línea`. Lo que no se comprobó se marca R o NO COMPROBADO. |

## Cambios respecto al 30-oct

| Punto | 30-oct | Hoy |
|---|---|---|
| 13 dependencias | Alto: body-parser, multer, zod, qs | Alto: solo zod. body-parser, multer, qs corregidos. |
| 16 `$queryRawUnsafe` | Baja: 5 usos | Baja: 0 en `apps/`, 1 en `deploy/render/post-deploy-check.mjs`. |
| 11 cabeceras | OK en código | Brecha nueva detectada: COOP y CORP no están en la web. |

## Recomendación

1. Punto 13: zod. Actualizar a 4.6.6 o superior en una pieza propia (la pieza 9 de la cola). El SDK de Anthropic 0.131 acepta zod `^3.25.0 || ^4.0.0` como peer (`@anthropic-ai/sdk/package.json`), así que no bloquea el salto. Hasta entonces, el tope de 100 kB del cuerpo JSON (`main.ts:46`; 4 MB solo para `/api/gv/import`, `main.ts:45`) reduce la exposición.
2. Punto 8: tope diario por usuario para la extracción de facturas con IA (`invoice.ts`). Es lógica nueva con prueba propia.
3. Punto 11: añadir COOP y CORP a `security-headers.conf` (ver PQ28).
4. Punto 16: asegurar que `post-deploy-check.mjs:218` solo reciba SQL constante, o pasarlo a `Prisma.sql`.
5. Punto 2 y 14: cotejar variables y paquetes sin uso en una pasada aparte.
6. Repetir los puntos R (4, 5, 6, 17) en la próxima pasada semanal.

## No cambiado

- Código de `apps/`, `packages/`, `deploy/`, `scripts/`: sin cambios.
- `docs/auditoria/RUTAS_Y_PERMISOS.md`: el script lo regeneró y se revirtió con `git checkout`.
- `docs/auditoria/SEGURIDAD_20_PUNTOS.md`: sin cambios; este informe es la pasada de hoy.
- No se tocó Render, la API desplegada, la base de producción ni ningún secreto.
