# Orden a ChatGPT PC: integrar «Lumina Motion» (27-oct-2026)

Auditado por Claude nube («Nexora 1 · Software») sobre `chatgpt-nube/lumina-motion` (`c2cb6e0d`, PR #10). Solo tú integras; no despliegas ni tocas Render, base ni credenciales.

## Veredicto: bueno en el fondo, NO se puede subir tal cual
Base correcta (contiene `producto-nexora` c6148bac). Solo cambia portada (App.tsx `Login`, styles.css), una imagen, pruebas y documentos; no toca auth, caja, pagos ni API. Reduced-motion cubierto, video no se autoreproduce, sin credenciales.

## Problemas a corregir
1. **Prueba rota (esperable en rojo en `verify`):** `tests/product-branding.test.ts:33` exige en `App.tsx` el patrón `PRODUCT_TENANCY_REQUIRED ? productLoginFaces … : LOGIN_CUBE`, que la rama borró; y `productLoginFaces` queda sin uso. Decide: (a) conservar esa lógica de caras por producto/tienda, o (b) actualizar la prueba y retirar `productLoginFaces` si ya no se usa (con la prueba nueva que lo respalde). No borres la prueba para ocultar el fallo.
2. **Portada de la tienda:** el cambio quita el texto propio de Grupo MacGen / GV Makeup Studio (suplementos, fajas, maquillaje, cursos) y deja un texto único. Esta portada es del PRODUCTO (`producto-nexora`). No lo lleves a `nexora-cloud` sin orden mía.
3. **Estilo oficial:** la dueña aprobó la V2 (maqueta `design/obsidian-lumina/portada-v2-ejecutiva/`). Conserva la bóveda de acceso V2 intacta (pestañas, «PIN de 6 dígitos» como clave de 6 dígitos, botón violeta). Solo cambia el panel izquierdo (N grande + 3 grupos).
4. CI: revisa que pasen los 3 (`verify`, `windows-installer`, `render-images`); a la hora de esta orden seguían en curso.

## Tarea
1. Rama nueva desde `producto-nexora`: `chatgpt-pc/lumina-motion-integracion`; trae solo los archivos de la lista del instructivo (`INSTRUCTIVO_LUMINA_MOTION_CHATGPT_PC.md`).
2. Arregla 1 y 3. Corre `pnpm exec vitest run tests/obsidian-lumina-f2.test.ts tests/product-branding.test.ts`, eslint y `pnpm --filter @fitstore/web build`; la suite completa si tu laptop lo permite.
3. Capturas 1440 y 390 (normal y reduced-motion), N sin borrosidad ni recorte, foco por teclado, 4.5:1.
4. Entrega el commit y el resumen (qué cambió, pruebas, riesgos) en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`. Yo reviso en la revisión horaria y despliego si hay 3 CI en verde y no hay cajas abiertas.
5. Video de Higgsfield: sin créditos, no insistas; el clip local basta. Nunca pegues claves.
