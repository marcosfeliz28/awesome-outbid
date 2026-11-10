# Expediente de encargo para DeepSeek — PLANTILLA a rellenar

Los valores de abajo son **ficticios** (ejemplo de formato). Sustituye cada `____` por el
valor real de la **copia de prueba** desplegada. Si un ítem no aplica, escribe `N/A` y el
motivo. DeepSeek no arranca si falta cualquier sección marcada 🔴.

> **N1 (nota real):** esta plantilla está lista. Lo que NO existe todavía es la **copia de
> prueba desplegada** con estos objetos. Hasta que esa copia corra en algún lado (API + web
> de prueba, base demo con los fixtures de la sección 4), DeepSeek devolverá "NO EJECUTABLE".
> La preparación de la copia es trabajo de la dueña/infra (Bloque C) y necesita credenciales
> reales que esta sesión de la nube no puede tocar.

---

## 3.1 — Cuentas por rol 🔴

| Rol | Usuario | Contraseña | PIN | No. cajero | Sucursal | Notas |
|---|---|---|---|---|---|---|
| `admin` (dueña, `*`) | `____` | `____` | `____` | `____` | A | Línea base "todo permitido"; autoaprobación permitida |
| `manager` | `____` | `____` | `____` | `____` | A | Escalada vertical, `sale:manage` |
| `seller` | `____` | `____` (6 dígitos) | `____` | `____` | A | Cajera, caja ciega, cambio forzado al entrar |
| `warehouse` | `____` | `____` | — | — | A | Almacén, sin ventas |
| `gv` | `____` | `____` | — | — | A | Módulo GV aislado |
| `gerente_gv` | `____` | `____` | `____` | — | A | `gv:verify` sin `gv:write` |
| Custom | `____` | `____` | `____` | — | A | Permisos editados a mano |
| Inactivo | `____` | `____` | — | — | A | Debe rechazar login |
| Bloqueado | `____` | `____` | — | — | A | Debe quedar bloqueado tras N intentos |

## 3.2 — PINs de aprobación (mínimo 2, personas distintas) 🔴

| Usuario | PIN | Permiso | Notas |
|---|---|---|---|
| Gerente A | `____` | `sale:manage` | — |
| Gerente B | `____` | `sale:manage` | Para "otra persona" |
| Dueña | `____` | `*` | Autoaprobación permitida |
| PIN corto antiguo | `____` | `sale:manage` | 4 dígitos (si aplica) |

## 3.3 — Terminales 🔴

| Item | Valor | Estado esperado |
|---|---|---|
| Terminal aprobado | `____` (id, registerNumber, cashierNumber) | Puede vender / abrir caja |
| Terminal pendiente | `____` | Bloqueado hasta aprobación con PIN |
| Terminal revocado | `____` | Rechaza operaciones |
| Cómo crear uno nuevo | `____` (pasos) | Para probar el ciclo completo |

## 3.4 — Sucursales + IDs concretos 🔴

| Objeto | Sucursal A | Sucursal B |
|---|---|---|
| `branchId` | `____` | `____` |
| `terminalId` (aprobado) | `____` | `____` |
| `cashSessionId` (abierta/cerrada) | `____` | `____` |
| `saleId` | `____` | `____` |
| `customerId` (con PII / anonimizado) | `____` | `____` |
| `productId` (con costo / sin costo) | `____` | `____` |
| `paymentId` (transferencia pendiente) | `____` | `____` |
| `creditAccountId` (abono pendiente) | `____` | `____` |
| `voidRequestId` (pendiente) | `____` | `____` |
| `gvCourseId` / `gvAppointmentId` / `gvPaymentId` | `____` | — |
| `roleId` custom | `____` | — |
| `userId` de cada rol | `____` | `____` |

## 3.5 — Sesiones 🔴

| Item | Valor |
|---|---|
| Login | `POST /api/auth/login` con `{login, password}` -> `accessToken` + cookie `refresh_token` |
| Refresh | `POST /api/auth/refresh` con cookie |
| Cookie | nombre, `HttpOnly`, `Secure`, `SameSite`, `Path`, `Domain` -> `____` |
| Access token TTL | `____` (verificar en vivo) |
| Refresh TTL | `____` |
| Logout | `POST /api/auth/logout` — verificar qué invalida |
| Revocación al cambiar contraseña / PIN | `____` |

## 4 — Fixtures que deben existir en la copia 🔴

Venta con transferencia pendiente; venta a crédito con abono pendiente; venta en espera;
venta offline en conflicto; solicitud de anulación pendiente; caja abierta A / cerrada B;
caja con descuadre preparado; producto con costo / sin costo; cliente con PII / anonimizado;
GV (curso, cita, lead, pago pendiente); comprobante subido; producto con imagen; Excel de
importación válido; alerta + regla; gasto + proveedor; promoción activa; nota de crédito;
kardex/movimiento; vale de caja. **Cada uno con su ID real en la tabla 3.4.**

## 5 — Configuración 🟡

`NODE_ENV`, `WEB_ORIGIN`, rate limit de plataforma, tope IA, tope extractor fotos/PDF,
Swagger, crons activos (no disparar), Drive/Telegram (desconectados, no tocar), topes de
subida, límites de login/PIN, timeout de sesión. -> `____`

## 6 — Infra / ops 🟡

Snapshot previo + procedimiento de restauración probado; reinicio entre capas; acceso a
logs; rotación de credenciales demo al terminar; instancias; versiones. -> `____`

## 7 — Contacto de guardia y palabra STOP 🔴

Quién recibe el "STOP", cómo se contacta, ventana de prueba, franjas de no molestar. -> `____`

---

## Bloque C — Checklist de lo que le toca a la dueña / infra

| # | Paso | Hecho |
|---|---|---|
| 1 | Rellenar este expediente con valores reales de la copia de prueba. | ☐ |
| 2 | Verificar que todas las secciones 🔴 están OK (si falta una, no arranca). | ☐ |
| 3 | Limpiar `ROLES_Y_PERMISOS.md` (quitar duplicados y "DUDOSO" sueltos) — N1 lo puede hacer. | ☐ |
| 4 | Confirmar que la copia tiene los fixtures de la sección 4 (sin esto, capas 3-6 se quedan en teoría). | ☐ |
| 5 | Snapshot previo de la copia + restauración probada. | ☐ |
| 6 | Rotar credenciales demo al terminar y destruir/restaurar la copia. | ☐ |
| 7 | Pegar en DeepSeek: el prompt (`ENCARGO_DEEPSEEK.md`) + este expediente relleno + los 3 documentos. | ☐ |
| 8 | Guardar el JSONL recibido en `docs/seguridad/hallazgos/deepseek.jsonl`. | ☐ |
| 9 | Triage: corregir los altos antes de vender, planificar medios/bajos. | ☐ |
