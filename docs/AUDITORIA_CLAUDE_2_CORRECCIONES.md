# Correcciones de la segunda revisión con IA (Claude)

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

**Fecha:** 8 de octubre de 2026  
**Alcance:** código y pruebas locales. No se conectó ni modificó Render,
producción ni datos de la tienda.

Claude revisó el ZIP con SHA abreviado `f25cac88…4d54`. El árbol local ya
contenía correcciones posteriores para A06, A07, A08, A10, A11 y A12. Se creó
la regresión focal `tests/claude-round2.test.ts` para separar lo ya resuelto de
lo que todavía faltaba.

## Resultado por punto

- **N1:** se eliminaron por completo los contadores globales compartidos. El
  login se limita por identificador normalizado de cuenta + IP. Las ventas se
  limitan por credencial de sesión + IP; el tráfico anónimo conserva su propio
  contador y no puede agotar el de una sesión válida. La protección persistente
  `AuthAttempt` por cuenta continúa activa.
- **A07:** las sesiones, el cierre y el cuadre ocultan montos esperados y
  diferencias salvo que el usuario tenga `profit:read` o `sale:manage`. El
  formulario exige confirmar el conteo ciego. Campos vacíos de tarjeta o
  transferencia se envían como cero. Diferencias superiores al límite exigen
  nota y generan alerta para cualquiera de los tres medios.
- **A08:** ventas, pendientes y cuadre devuelven `hasProof` y metadatos, nunca
  la cadena base64. `GET /payments/:id/proof` devuelve bytes de imagen con
  `private, no-store`; comparte la autorización por sucursal/caja del POST. La
  interfaz descarga con `fetch`, crea un Blob URL y muestra la miniatura.
- **A06:** `operationId` es obligatorio; el bloqueo, la restricción única y el
  reintento por serialización devuelven la misma recepción. Ya estaba corregido
  en el árbol posterior y su regresión concurrente permanece.
- **A12:** `Sale.discountApprovedBy`, nombre y rol se persisten. Ticket, PDF e
  historial muestran `Autorizó: nombre`.
- **A11:** ticket, PDF e historial distinguen `Recibido`, `Aplicado` y `Cambio`.
- **A10:** los overrides compatibles mantienen Prisma funcional y
  `pnpm audit --prod --json` informa cero vulnerabilidades.

## Salida antes

Comando:

```text
pnpm vitest run tests/claude-round2.test.ts --reporter=verbose
```

Salida focal observada antes de las correcciones restantes:

```text
× N1: separa el límite compartido del límite por cuenta e IP
× A07: oculta esperado y diferencias, y exige confirmar el conteo ciego
× A08: las listas no llevan base64 y la evidencia se consume como blob
✓ A06: operationId es obligatorio y la concurrencia tiene regresión
× A12: persiste discountApprovedBy y muestra el nombre del autorizador
× A11: PDF e historial muestran recibido, aplicado y cambio

Test Files  1 failed (1)
Tests       5 failed | 1 passed (6)
```

## Salida después

```text
✓ N1: separa el límite compartido del límite por cuenta e IP
✓ A07: oculta esperado y diferencias, y exige confirmar el conteo ciego
✓ A08: las listas no llevan base64 y la evidencia se consume como blob
✓ A06: operationId es obligatorio y la concurrencia tiene regresión
✓ A12: persiste discountApprovedBy y muestra el nombre del autorizador
✓ A11: PDF e historial muestran recibido, aplicado y cambio

Test Files  1 passed (1)
Tests       6 passed (6)
```

## Validación completa

```text
pnpm check
Test Files  11 passed (11)
Tests       174 passed | 1 skipped (175)
Typecheck, ESLint, build web/PWA y build API: pasan

pnpm audit --prod --json
info 0 · low 0 · moderate 0 · high 0 · critical 0
```

Vite conserva una advertencia no bloqueante por un chunk de aproximadamente
984 kB. No se presenta como error funcional ni como vulnerabilidad.

## Segunda verificación focal solicitada por Claude

Claude demostró que el contador global de 600 todavía permitía denegación de
servicio y señaló un acceso inseguro a `s.expected.cash` para cajeras. Antes de
la segunda corrección, la regresión reforzada produjo exactamente dos fallos:

```text
Test Files  1 failed (1)
Tests       2 failed | 4 passed (6)
```

Después de eliminar los contadores compartidos, hacer opcional el acceso al
esperado, representar valores ocultos como `—` y evitar revelar el importe de
la diferencia en el error de cierre:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

La prueba N1 simula 601 identificadores de login distintos y 601 solicitudes
anónimas a ventas. En ambos casos, la cuenta o sesión legítima continúa con
estado 200. La prueba A11 ejecuta la misma función que el PDF usa para imprimir
`Recibido`, `Aplicado` y `Cambio`.

Además se creó una base PostgreSQL 18 nueva y descartable y se ejecutó:

```text
pnpm --filter @fitstore/api exec prisma migrate deploy
21 migrations found
All migrations have been successfully applied.
MIGRATION_AUDIT_OK
```

La base temporal se detuvo y eliminó al terminar. No se conectó a Render ni a
producción.
