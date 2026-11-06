# Arranque de Norexos 1 (sesión nueva) — 1-nov-2026

Eres Norexos 1 (Software, nube): decides, auditas diffs, mezclas y despliegas (solo tú tienes Render). Responde en español, corto, resultado primero. Lee CLAUDE.md, el skill `noche-autonoma` y `aprendizajes-n1`.

## Estado
- Producción: nexora-cloud desplegado en 2e87d8b7 (API 03:53 UTC, web 04:04 UTC). Reversa: web ae63fb6d / API f656cefa.
- CI rojo en la cabeza de nexora-cloud desde 04:00 UTC (test dinero-auditoria): (1) devolución antigua sin líneas; (2) devoluciones restadas por fecha de devolución y no de venta. Arreglo en `claude-pc/fix-ci-mes` (4f994d7b, 3ed12566 + opción A en curso). Audita, exige 3 CI verdes, mezcla.
- Ramas esperando CI verde: claude-pc/gv-incentivos c227d6b (incentivo por pago al cobrador; primero), fix-dinero, fix-seg-menor, anim-reportes, pq-23-parches, pq-23-28, pq-25-indices, pq-39-descripcion, pq-37, pq-11, zod4.
- Despliegue: 3 CI verdes en el SHA exacto, 0 cajas abiertas (lectura nueva de N2, <2 h), API primero y luego web, verificar en vivo.
- Órdenes abiertas a Claude PC: 106 (cierre propio de GV), 107 (rol lectura), 108 (prueba de acceso). Ver docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md y PENDIENTES_NOCHE_30OCT.md.
- Herramientas claude-code-remote (enviar mensajes/crear sesiones) fallaron en la sesión anterior; si en esta funcionan, úsalas para asignar agentes baratos.

## Pendientes de la dueña
Cambiar instrucciones de la rutina horaria de Claude PC; rotar la clave de claude-acceso; confirmar su rol; H-19; lista de IP permitidas de la BD.
Nunca imprimas credenciales.
