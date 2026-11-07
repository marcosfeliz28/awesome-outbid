---
name: desplegar-nexora
description: Lista ejecutable para desplegar Nexora POS en Render (solo Norexos 1 / Claude nube). Úsalo cuando haya que desplegar API y web.
disable-model-invocation: true
---
# Desplegar Nexora (API primero, luego web)
Solo Claude nube despliega, con las llaves de Render. Detalle de la noche y excepciones: skill `noche-autonoma`; lecciones: `aprendizajes-n1`.

1. **SHA exacto.** `git fetch origin nexora-cloud`; anota el commit completo. Los 3 CI (`verify`, `windows-installer`, `render-images`) en verde EN ESE SHA: `https://api.github.com/repos/marcosfeliz28/awesome-outbid/commits/<SHA>/check-runs`. Cada push cancela el CI anterior. Si `verify` falla, mira qué prueba (nunca «es flaky» sin causa); relanza una sola vez.
2. **Cambio sin dinero o con autorización de la dueña.** Si toca ventas, caja, márgenes o precios: necesita su autorización y pasar por `money-guard`.
3. **Cajas.** 0 cajas de tienda y 0 de GV abiertas, y sin ventas en 15 min (lectura propia con `docs/coordinacion/claude-nube/entrar.py` o pedírsela a Norexos 2, solo lectura). Con cajas abiertas solo se despliega web sin reinicio de API, o se espera.
4. **Migraciones.** Solo aditivas (`migracion-aditiva`). Nunca editar una existente.
5. **API:** `mcp__Render__trigger_deploy` srv-db3fep59fdbs73dic6n0 con commitId completo; esperar `live`; revisar logs de error desde la hora del despliegue.
6. **Web:** srv-db3feel9fdbs73diarn0 con el mismo commitId.
7. **Verificar en vivo:** `/api/health` ok, web 200 con el bundle nuevo, el endpoint clave del cambio, `/api/gv/cash/current`, logs sin errores.
8. **Anotar** en `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md` (fecha, SHA, condiciones, verificaciones) y avisar a la dueña en una línea. Nunca imprimir credenciales.
