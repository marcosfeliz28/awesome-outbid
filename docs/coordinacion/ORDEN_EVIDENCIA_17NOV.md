# Orden de Marcos (17-nov-2026): evidencia de avance real — fotos y diseño

Marcos exige evidencia. Desde el 16-nov 15:58 no hay ningún commit nuevo de fotos ni de diseño. «Lo puse en marcha» o «está avanzando» no cuenta: solo cuenta lo que está en el repositorio.

## Qué cuenta como evidencia

Un commit en una rama propia (nunca en `nexora-cloud`) con: SHA, archivos, capturas reales y una línea en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md` (o `RESULTADOS_DOT.md`) con lo hecho, lo que falta y lo que no se comprobó.

## Dot — diseño completo (escritorio y móvil 390 px)

1. **Hoy:** crear la rama `dot/prueba-acceso` con un archivo de texto. Si no puede, decirlo en una línea para que Marcos conecte GitHub en ChatGPT solo para este repositorio.
2. Leer `docs/coordinacion/TRASPASO_REDISENO_DOT_16NOV.md` y los PR borrador de Obsidian Lumina (#8–#16) para no repetirlos.
3. Entregar en `dot/rediseno-*` (desde `nexora-cloud`): biblioteca de tokens + Caja + Inicio, solo presentación en `apps/web/src`, con capturas antes/después en 1440 y 390, claro y oscuro.
4. Evidencia mínima por entrega: SHA, lista de archivos, capturas, los 3 CI (`verify`, `windows-installer`, `render-images`) en verde. Sin eso no se revisa.

## ChatGPT nube — fotos por lote

1. Seguir desde el lote 3 (los lotes 1 y 2, 120 candidatas en `docs/fotos/candidatas_lote*.csv`, ya están). No repetir ni reanudar lotes rechazados.
2. Entregar **archivos de imagen**, no solo enlaces: `docs/fotos/lote-N/<sku>.webp` (fondo limpio, mínimo 800 px, el mismo producto y presentación del sistema) + CSV con `sku, archivo, fuente, licencia/uso, coincide_marca, coincide_presentación`.
3. Evidencia mínima por lote: cuántas fotos reales hay (no filas), cuántas faltan y por qué, y una hoja de contacto (`lote-N/contacto.png`) para revisarlas de un vistazo.
4. Ninguna foto se sube a la tienda hasta que Claude nube la revise y Marcos o Dot la aprueben.

## Claude nube

Revisa cada entrega el mismo día que aparezca y le informa a Marcos y a Dot: aprobado, rechazado y por qué. No despliega nada de esto sin los 3 CI en verde y la orden de Dot.
