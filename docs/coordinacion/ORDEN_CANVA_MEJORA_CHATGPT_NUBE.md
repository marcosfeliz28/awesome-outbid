# Orden para ChatGPT nube: llevar los materiales de venta a mejor calidad (9-nov-2026)

Pedido de la dueña: «lo quiero de mejor calidad todo». Claude hizo un primer borrador en Canva; tú lo mejoras.

## Qué recibes

- Contenido y reglas en una sola fuente: `docs/venta/canva/CONTENIDO_VENTAS.json` (precios aprobados, láminas, reglas, pendientes).
- Enlaces de edición de Canva: `docs/venta/CANVA_ENLACES.md`.
- Textos de apoyo: `docs/venta/LANDING_TEXTOS.md`, `docs/venta/PILOTO_PRIMER_CLIENTE.md`.

## Qué mejorar

1. Presentación de 6 láminas: más aire, jerarquía clara, una idea por lámina, letra legible en celular, sin texto sobre las fotos.
2. Hoja de precios A4: más margen abajo, tabla más limpia, legible al imprimir en blanco y negro.
3. Mejores imágenes y un kit de marca coherente (la cuenta de Canva no tiene kit). Propón paleta y tipografía; no uses logos ajenos.
4. Revisa ortografía y tono (español dominicano neutro, simple).

## Entrega

- Si tienes Canva: edita los mismos diseños y deja los enlaces nuevos en `docs/venta/CANVA_ENLACES.md`.
- Si no tienes Canva: entrega maqueta en HTML/PDF en `docs/venta/canva/` y el guion de cada lámina.
- Rama `chatgpt-nube/ventas-calidad`, solo archivos de `docs/venta/`. 3 CI verdes del último SHA y entrada corta en `RESULTADOS_CHATGPT.md`.

## Límites

Sin cambiar precios ni cifras; sin credenciales; sin publicar ni compartir nada fuera de la cuenta de la dueña; no desplegar ni mezclar (solo Claude nube).

## Dónde depositar (obligatorio; Claude lo busca cada 30 minutos)

1. Rama: `chatgpt-nube/ventas-calidad` (créala desde `origin/claude-pc/canva-ventas`).
2. Archivo de entrega: `docs/venta/canva/ENTREGA_CHATGPT.md`. Debe tener: enlaces nuevos de Canva (o rutas de las maquetas HTML/PDF), lista de lo que mejoraste, SHA y estado de los 3 CI (`verify`, `windows-installer`, `render-images`).
3. Actualiza también `docs/venta/CANVA_ENLACES.md` con los enlaces nuevos.
4. Empuja la rama. Mientras ese archivo no exista, Claude sigue preguntando; cuando exista, Claude verifica y avisa a la dueña.
