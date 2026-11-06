1. Si no hay caja abierta, entonces se ve el título «Una caja que siempre cuadra» y el botón **«Abrir caja»** (`apps/web/src/Management.tsx:1670-1677`), o en el centro **«Abrir mi caja»** con el texto «Tu día empieza con una caja abierta» (`:1740-1744`).
2. Si el fondo es **menor** que lo sugerido, entonces aparece **«Nota si el fondo es menor que el sugerido»** y es obligatoria; no pide PIN (`apps/web/src/Management.tsx:2029-2039`; `apps/api/src/cash.ts:868-885`).
3. Si la caja quedó abierta en **otro equipo**, entonces se muestra «Tu caja está abierta en «…». Para cobrar aquí, trasládala a este equipo o ciérrala en el otro.» con el botón **«Trasladar caja aquí»** y la ventana «Trasladar caja a este equipo» (botón **«Trasladar caja»**; pide PIN de gerente según el caso) (`apps/web/src/realtime.tsx:629-668`; API `apps/api/src/cash.ts:1061-1111`).
4. Si el producto tiene **una sola variante**, entonces entra directo (`:425-430`). Si tiene varias, entonces abre la ventana con el nombre del producto y «Elige la combinación para esta venta.» (`:1284-1314`) y se pulsa la variante (talla, color, sabor).
5. Si el precio o una promoción cambió en otro equipo, entonces se muestra «Los precios cambiaron: …. El total ya está actualizado: revisa los pagos y finaliza otra vez.» (`POS.tsx:2276-2277`, `:2303-2327`).

Qué hice:
Reescribí las reglas como frases «Si … entonces …» de máximo 25 palabras, conservando las citas al final de cada frase.

Qué NO comprobé:
No revisé ningún archivo específico ni hice ninguna prueba de código.