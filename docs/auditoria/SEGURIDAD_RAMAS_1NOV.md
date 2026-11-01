# Auditoría de seguridad de ramas (1-nov-2026, área 4 del plan)

Skill: `seguridad-20` (`.claude/skills/seguridad-20/SKILL.md`). Solo lectura: no se cambió código ni se tocó producción.

| Rama | SHA | Hallazgos de seguridad | Otros hallazgos (no seguridad) |
|---|---|---|---|
| `claude-pc/fix-seg-menor` | `7113b81a` | Ninguno alto ni medio | Baja (ver 1) |
| `claude-pc/fix-dinero` | `6a54a955` | Ninguno alto ni medio | Baja (ver 2); cambio de negocio a confirmar (ver 3) |
| `claude-pc/gv-incentivos` | `c227d6b0` | Ninguno alto ni medio | **Media (dinero, ver 4)** |

## Puntos de seguridad-20 comprobados en las tres ramas

- **1 Llaves:** patrones fuertes (`sk-ant-…`) en `apps/` y `packages/`: 0 aciertos en las tres.
- **3 Rutas:** `node scripts/rutas-permisos.mjs` en cada rama: `sinPermiso=0` (188, 188 y 189 rutas).
- **7 XSS:** `dangerouslySetInnerHTML` / `innerHTML` en `apps/` y `packages/`: 0 aciertos.
- **13 Dependencias:** ninguna rama cambia `package.json` ni el lock. **NO COMPROBADO** con `pnpm audit` en estas ramas.
- **16 SQL:** sin `$queryRawUnsafe` nuevo.
- **17 Hashes:** sin cambios en contraseñas ni PIN.
- **5 Acceso por usuario:** el nuevo `GET /gv/catalog` (`apps/api/src/gv.ts`, `@Permit("gv:read")`) devuelve nombre, precio, moneda y tipo, sin incentivo ni costos.
- **9, 19, 20:** no hay ejecución de pruebas en este contenedor (Postgres no corre como root). **NO COMPROBADO:** cada prueba de las ramas; los 3 CI corren en GitHub.

## Hallazgos

1. **fix-seg-menor, baja:** `apps/web/src/api.ts:545`: `DOWNLOAD_TIMEOUT_MS = 120_000` corta descargas grandes (respaldos). Riesgo de disponibilidad, no de fuga. El propio comentario lo marca como atajo.
2. **fix-dinero, baja:** `packages/shared/src/index.ts:335` limita el descuento a 100 % en silencio; un descuento mayor o negativo no da error. Conviene rechazarlo, no recortarlo.
3. **fix-dinero, cambio de negocio:** `apps/api/src/sales.ts:491` ahora rechaza cualquier pago en dólares que no sea efectivo. Es decisión de la dueña, no de seguridad: confirmar antes de mezclar.
4. **gv-incentivos, media (dinero):** `apps/api/src/gv-incentives.ts:66` suma `aceptado` al tope del 100 % **antes** de mirar `p.rejectedAt` (línea 78). Un pago anulado consume el tope y el siguiente pago válido sale en cero.
   - Caso comprobado: curso automaquillaje de RD$ 4 500, incentivo 50. Pago A de 4 500 (3-oct) anulado el 10-nov; pago B de 4 500 (3-nov). Resultado: A −50 en nov (correcto), **B 0** (debería ser 50).
   - El test de anulados (`tests/gv-incentivos-unit.test.ts`) tiene un solo pago, así que no lo cubre.
   - Corrección sugerida: excluir los anulados del `cum` (o no sumarlos) y añadir un test con este caso.
5. **seg-menor, verificar:** `drive-backup-core.ts:118` baja los límites de scrypt a log2N ≤ 16, r ≤ 8, p ≤ 2. Los respaldos actuales usan `SCRYPT = { log2N: 15, r: 8, p: 1 }` (línea 49), dentro del límite. **NO COMPROBADO:** respaldos antiguos con otros parámetros.

## Pregunta abierta (gv-incentivos)

`createdBy` es quien cobró cada pago. Los pagos que entran por importación (`planGvImportPayments`) pueden quedar a nombre de quien importa, no de quien cobró. **NO COMPROBADO**; conviene confirmar con la dueña antes de mezclar.

## Veredicto

- `fix-seg-menor`: **sin objeción de seguridad**; pendiente solo la baja 1.
- `fix-dinero`: **sin objeción de seguridad**; confirmar el cambio de pagos en dólares (3).
- `gv-incentivos`: **sin objeción de seguridad**, pero **no mezclar** hasta corregir el tope (4) y responder la pregunta abierta.

Nada de esto toca credenciales. No se imprimió ningún valor secreto.
