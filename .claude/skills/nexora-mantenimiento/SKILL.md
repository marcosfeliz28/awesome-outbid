---
name: nexora-mantenimiento
description: Cuando el vigilante de Nexora POS detecta producción atrasada (commit desplegado en Render distinto al head de nexora-cloud), despliega automáticamente el head si el CI está verde, verifica salud y avisa. Úsalo en cada ronda del vigilante cuando el commit desplegado esté atrasado.
---

# Mantenimiento automático de Nexora POS (autorizado por la dueña)

Responde siempre en español, corto. Repo `marcosfeliz28/awesome-outbid`, rama `nexora-cloud`.
Render: workspace `tea-db3f7ofavr4c739hsgi0`, API `srv-db3fep59fdbs73dic6n0`, web `srv-db3feel9fdbs73diarn0`.
Sitio: https://nexora-pos-web.onrender.com (API en /api).

## Cuándo aplicar
El commit del último deploy `live` (API y/o web) ≠ head de `nexora-cloud`.

## Condiciones para desplegar (TODAS)
1. El último run de CI sobre el head de `nexora-cloud` está `completed` + `success` (verify, windows-installer y render-images verdes). Si está en curso: no desplegar, esperar a la siguiente ronda. Si está rojo: NO desplegar, ALERTA con el job que falló.
2. `/api/health` devuelve `{"status":"ok"}` y la web responde 200 ahora mismo.
3. No hay un deploy en curso (`build_in_progress`/`update_in_progress`) en ninguno de los dos servicios.

## Pasos
1. `mcp__Render__trigger_deploy` para la API y luego para el web (commit = head de `nexora-cloud`), con `workspaceId` explícito.
2. Esperar y consultar `list_deploys` hasta `live` (o `failed`).
3. Verificar: `/api/health` ok, web 200, logs de error de la API en los últimos 15 min sin excepciones/500/reinicios en bucle.
4. Notificar con PushNotification (`<routine_summary>`): qué commit se desplegó, hora y resultado.

## Límites (no negociables)
- Solo despliegue del head ya verificado por CI. No cambiar datos, variables de entorno, ni hacer push o merge; no iniciar sesión en la app; nunca imprimir credenciales.
- Si el deploy falla o la salud queda mal: NO reintentar en bucle ni hacer rollback por cuenta propia; ALERTA inmediata (qué falló, desde cuándo, qué harías) y la dueña/sesión principal decide.
- Máximo un despliegue por ronda.
