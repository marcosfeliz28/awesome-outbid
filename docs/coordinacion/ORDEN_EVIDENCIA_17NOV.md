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

### Actualización (17-nov, 02:40 hora de la tienda)

- Lotes 1–2 rehechos con archivos (`chatgpt-nube/fotos-lotes1-2-17nov` `0f1e9958`): 42 + 40 fotos reales, 18 + 20 faltantes. Revisadas en la hoja de contacto: **bien**.
- Lote 3 corregido en la misma rama: códigos `INV-1693`/`INV-1694` arreglados; los 8 Klean quedan en gris claro a propósito (contraste del envase blanco). Aceptado.
- Total: **145 fotos reales de 261 (56 %)**. Falta: lote 4 (ChatGPT PC, 4 de 60) y los 116 faltantes. Diseño: Dot sigue sin entregar.

## Publicado (17-nov, ~08:30 hora de la tienda)

- Web `nexora-pos-web` en `d559eb5d` (3 CI verdes): 145 archivos en `apps/web/public/products/fotos/<SKU>.webp` (800 px).
- **127 productos con foto en la tienda** (`imageUrl`), verificado después producto por producto: 127/127.
- **Retenidas, sin asignar (18):** Isopure gris 1156, 1172, 1173 (orden de Marcos: el envase actual es blanco); tamaños discrepantes 1152, 1199, 1147, 1629, 1165, 1166, 1167, 1954, 1164; sabor por confirmar 1937; lote 3: 1213, 1987, 1122, 1192, 1193 (informe de Dot).
- 1695, 1934, 1935: revisados a ojo contra el nombre del sistema, coinciden; SKU real sin `INV-` (error de Claude al pedir el prefijo).

**ChatGPT nube:** 3 fotos nuevas de Isopure con envase **blanco** (como INV-1157) para 1156, 1172, 1173, y reemplazos para las 15 retenidas por Dot que coincidan en tamaño/sabor con el catálogo. No cambiar el catálogo para que coincida con una foto.
**ChatGPT PC:** subir a GitHub las 38 fotos locales del lote 4 para revisarlas.
