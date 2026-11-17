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

## ChatGPT PC — apoyo en la PC (fotos y verificación del diseño)

1. Ayudar a ChatGPT nube con las fotos: descargar y recortar las imágenes de su lote asignado y subirlas en `chatgpt-pc/fotos-lote-N` con la misma estructura (`docs/fotos/lote-N/<sku>.webp` + CSV + `contacto.png`). Repartirse los lotes con ChatGPT nube por escrito en `RESULTADOS_CHATGPT.md`, sin duplicar.
2. Cuando Dot entregue una rama `dot/rediseno-*`: correr la app en la PC, tomar capturas reales en 1440 y 390 (claro y oscuro) de Caja, Inicio, Productos y GV, y subirlas en `chatgpt-pc/capturas-dot-<SHA>`.
3. Evidencia mínima: SHA, archivos, capturas y una línea en `docs/coordinacion/RESULTADOS_CHATGPT.md`.

## Claude nube

Revisa cada entrega el mismo día que aparezca y le informa a Marcos y a Dot: aprobado, rechazado y por qué. No despliega nada de esto sin los 3 CI en verde y la orden de Dot.

## Revisión de Claude nube (17-nov, 00:40 hora de la tienda)

| Lote | Quién | Rama / SHA | Fotos reales | Faltan | Veredicto |
|---|---|---|---|---|---|
| 1–2 (filas 1–120) | ChatGPT nube | `chatgpt-nube/fotos-suplementos` `70029992` | 0 (solo enlaces) | 120 | **Rehacer con archivos** |
| 3 (121–180) | ChatGPT nube | `chatgpt-nube/fotos-lote3-17nov` `7fc7d19e` | 44 | 16 | Bien. Corregir: 6 Klean (INV-1116…1124) con fondo gris, no blanco; 2 fotos con SKU `1693`/`1694` sin formato `INV-` |
| 4 (181–240) | ChatGPT PC | `chatgpt-pc/fotos-lote-4` `b4abd29e` | 4 | 56 | **Insuficiente** (7 %). Seguir hasta cubrir lo que exista |
| 5 (241–261) | ChatGPT PC | `chatgpt-pc/fotos-lote-5` `66c3bb7c` | 15 (2 con observación de submarca) | 6 | Bien |

Total: **63 fotos reales de 261** (24 %). Ninguna aprobada para la tienda; derechos de uso no comprobados en todas.
Diseño: **Dot no ha entregado nada** (ni `dot/prueba-acceso`).

Siguiente: ChatGPT nube rehace lotes 1–2 con archivos; ChatGPT PC completa el lote 4; Dot crea su rama y entrega tokens + Caja + Inicio.
