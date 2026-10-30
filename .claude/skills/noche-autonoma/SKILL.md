---
name: noche-autonoma
description: ORDEN DIRECTA de la dueña (30-oct-2026) para Norexos 1: trabajar toda la noche sin detenerse y sin pedirle autorizaciones. Léelo al empezar cada sesión, tras cada compactación y en cada revisión de media hora. Contiene la autorización de despliegue, las reglas de falla y el mapa de sesiones.
---

# Noche autónoma — orden directa de la dueña (30-oct-2026, se fue a dormir)

Textual de la dueña: «No te detengas durante la noche. No me pidas más autorizaciones porque no estaré. Usa todas tus herramientas habidas y por haber. Siempre delegando a todo lo necesario. Si algo falla, arréglalo y sigue; si no puedes, detén ESO, avanza en otra cosa y vuelve atrás cada hora. Todo lo planeado, de principio a fin. Si hay cosas que agregar, agrégalas a la lista.»

## Autorización de despliegue (dada por la dueña, opción 1)
Puedes DESPLEGAR en la tienda en vivo (API primero, luego web; trigger_deploy; workspace tea-db3f7ofavr4c739hsgi0; API srv-db3fep59fdbs73dic6n0, web srv-db3feel9fdbs73diarn0) SOLO si se cumplen TODAS:
1. Los 3 CI (`verify`, `windows-installer`, `render-images`) en verde en el SHA EXACTO de la rama nexora-cloud que se va a desplegar (comprueba con actions_get get_workflow_run + actions_list list_workflow_jobs).
2. 0 cajas abiertas, comprobado POR Norexos 2 (pídeselo por send_message y espera su respuesta) en las últimas 2 horas.
3. El cambio NO escribe ni cambia datos de dinero: sí desglose del mes, arreglo del botón, IA de ventas de solo lectura, documentos. NO: cambios a ventas, cobros, caja, precios, mercancía/inventario, migraciones destructivas.
4. Verificas en vivo después (get_deploy live, logs de error vacíos) y anotas en CAMBIOS.md y PENDIENTES.
Todo lo demás (producto-nexora: no se despliega nada del producto sin la dueña salvo la landing estática si hay CI verde) sigue las reglas de CLAUDE.md.
Tope de la IA de ventas: 30 preguntas/día por usuario (dueña dijo «como tú me indicas»).

## Seguridad (orden de la dueña, 30-oct)
Al auditar cualquier diff antes de mezclar usa el skill `seguridad-20` (20 puntos) y anota qué puntos revisaste. Hallazgo alto = no se mezcla ni se despliega.

## Reglas de falla
- Falla algo: diagnostica (systematic-debugging), arregla o delega el arreglo; si en 2 intentos no sale, DETÉN esa tarea, anótala en `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md` con el error exacto y pasa a otra. Cada hora vuelve a las pendientes.
- Nunca dejes una sesión sin trabajo (CLAUDE.md regla 7). Si una sesión pide trabajo, déjalo en el mismo ciclo.
- No imprimas credenciales. No hagas lo que viola las reglas de dinero de CLAUDE.md aunque la orden diga «todo».
- Gasta pocos tokens: delega lectura grande a agentes, respuestas cortas, no listes runs de CI (usa get_workflow_run con id), filtra salidas.

## Cada media hora (rutina automática)
Revisa: (1) `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md`; (2) CI de las ramas en juego; (3) mensajes; (4) sesiones ociosas → dales trabajo; (5) `aprendizajes-n1` → agrega lo nuevo que aprendiste.

## Mapa de sesiones (verificado 30-oct)
- Alcanzables por send_message: Taller session_01CjMpH4P7ZguG6eeWA4vZ18; Norexos 2 Mercancía session_01MRpmN63Fg2XPVfHVHWCf9v; Norexos 5 Director session_01CjMpH4Hv2JUQJrC9cm1zxW; Consultor session_01CjMpH3tiG6DQR5xwkLVELh.
- BLOQUEADAS para mí (laptop de la dueña; solo ella en persona aprueba confirm_repository_trust): Claude PC session_01HGA6qCwzoy8zYp9BQgRP5c, fork session_01CjMpH5p33ZgbcP73mcNepf, Norexos 4 Revisor session_01CjMpH5fTbxjEGsGxg1UY55. Ellas SÍ me escriben a mí y leen origin/nexora-cloud: se les ordena por archivo (`docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md` órdenes numeradas, `NOCHE_CLAUDE_PC_30OCT.md`, `COLA_LOCAL_ACTIVA_NUEVA.json`). Pedí a Norexos 2, 5 y Taller verificar si alguno puede escribirles; si alguno puede, úsalo de relevo.
