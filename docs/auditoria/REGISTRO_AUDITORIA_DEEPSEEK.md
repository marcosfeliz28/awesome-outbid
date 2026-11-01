# Registro de auditoría por fases (DeepSeek)

Aquí guardo cada bloque `INSTRUCTIVO FASE N` que DeepSeek me entregue, porque él no conserva la información entre sesiones.

Paquetes: 57, en 7 fases. Índice y paquetes en la carpeta de trabajo temporal, archivo `paquetes-deepseek/INDICE.md`. Instrucciones: `docs/auditoria/INSTRUCCIONES_FASES_DEEPSEEK.md`.

| Fase | Estado | Entregado en | Hallazgos críticos o altos | Verificado por Claude |
|---|---|---|---|---|
| 1 | entregada, con rechazos | Respuesta de DeepSeek a F1-P01 a F1-P04 (1 nov 2026) | Tres endpoints de `admin.ts` sin `@RequireTerminal()` (líneas 587, 675, 722): **decisión de negocio, no bug confirmado**. Rate limit de administración (`rate-limit.ts:184-229`): confirmado, medio. | Ver detalle abajo |
| 1b | P02 y P03 **rechazados**: filas vacías con «sin hallazgo» en archivos de más de 1,400 líneas. Hay que repetirlos con revisión por archivo. | | | |
| 2 | pendiente | | | |
| 3 | pendiente | | | |
| 4 | pendiente | | | |
| 5 | pendiente | | | |
| 6 | pendiente | | | |
| 7 | pendiente | | | |

Regla: un hallazgo solo pasa a «verificado» cuando lo compruebo leyendo el archivo y la línea citados en el repo.

## Veredictos de la fase 1 (verificados por Claude, 1 nov 2026)

| # | Hallazgo de DeepSeek | Archivo:línea | Veredicto | Motivo |
|---|---|---|---|---|
| 1 | `supplier-payments` sin `@RequireTerminal()` | `apps/api/src/admin.ts:587` | **Decisión humana** (no bug) | La línea existe y el control existe (`common.ts:84`), pero ningún endpoint de `admin.ts` lo usa. Añadirlo bloquea la administración desde equipos que no son caja. Severidad «alta» sobrestimada. |
| 2 | `expenses` sin `@RequireTerminal()` | `apps/api/src/admin.ts:675` | **Decisión humana** | Igual que el 1. |
| 3 | `expenses/:id/void` sin `@RequireTerminal()` | `apps/api/src/admin.ts:722` | **Decisión humana** | Igual que el 1. Anular un gasto sí es sensible: conviene revisar quién tiene `expense:write`. |
| 4 | Rate limit no cubre rutas de administración | `apps/api/src/rate-limit.ts:184-229` | **Confirmado, medio** | El guard lista rutas concretas (`/auth/pin`, `/sales`, imports…). Falta comprobar si hay un límite general para el resto. |
| 5 | Lecturas con permiso de escritura | `apps/api/src/admin.ts:250` (`GET customers` con `customers:write`) | **Confirmado, bajo** | Exige más permiso del necesario para leer; no da acceso indebido. |

Pendiente para la siguiente ronda: DeepSeek debe repetir P02 y P03 revisando cada archivo por separado, y citar al menos un «sin hallazgo» justificado por archivo.
