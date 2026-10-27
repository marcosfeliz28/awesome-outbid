# Instructivo Cloud → ChatGPT PC · movimiento Obsidian Lumina

**Fecha:** 27 de octubre de 2026  
**Estado:** propuesta implementada y pendiente de auditoría  
**PR de revisión:** [#10 · OL Motion: marca grande, texto mínimo y video auditable](https://github.com/marcosfeliz28/awesome-outbid/pull/10)  
**Rama:** `chatgpt-nube/lumina-motion`  
**Último commit funcional:** `5435b974`

## Mensaje que ChatGPT Cloud debe enviar a ChatGPT PC

> Lee `docs/coordinacion/INSTRUCTIVO_LUMINA_MOTION_CHATGPT_PC.md` en la rama `chatgpt-nube/lumina-motion` y revisa el PR #10. La dueña pidió una identidad con la N prismática grande, muy poco texto y solo tres grupos funcionales: Vende, Controla y Decide. Audita primero las capturas y el video. Después adapta o integra esta entrega sobre la rama vigente que Cloud te indique, sin cambiar autenticación, caja, pagos, permisos, API ni base de datos. Conserva `prefers-reduced-motion`, ejecuta las pruebas indicadas y entrega capturas nuevas a 1440 px y 390 px. No despliegues ni toques Render.

## Qué ya hizo ChatGPT Cloud

1. Creó una N prismática grande, derivada del activo oficial y sin texto dentro de la imagen.
2. Redujo la portada a un mensaje principal: **Todo bajo control**.
3. Agrupó las funciones en tres bloques:
   - **Vende:** caja y cobros.
   - **Controla:** inventario y turnos.
   - **Decide:** reportes y alertas.
4. Añadió movimiento CSS corto al emblema y a la N principal.
5. Desactivó las animaciones con `prefers-reduced-motion: reduce`.
6. Generó un clip local silencioso de seis segundos en MP4 y WebM.
7. Dejó un generador reproducible con Pillow y FFmpeg.
8. Actualizó pruebas y capturas de escritorio, móvil y movimiento reducido.

Esto es una propuesta auditable. No se ha integrado en la rama de producción ni se ha desplegado.

## Archivos que debe revisar ChatGPT PC

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/public/nexora-prisma-mark.webp`
- `tests/obsidian-lumina-f2.test.ts`
- `scripts/generate-nexora-motion.py`
- `docs/diseno/obsidian-lumina/motion/README.md`
- `docs/diseno/obsidian-lumina/motion/nexora-prism-mark-reference.png`
- `docs/diseno/obsidian-lumina/motion/nexora-prism-reveal-16x9.mp4`
- `docs/diseno/obsidian-lumina/motion/nexora-prism-reveal-16x9.webm`
- `docs/diseno/obsidian-lumina/motion/capturas/`

## Resultado visual esperado

- La N prismática domina la composición en escritorio.
- La cabecera móvil conserva una marca clara y más grande.
- No aparecen seis categorías o listas largas en la portada.
- El texto se lee rápido y no compite con el formulario de acceso.
- Las animaciones se ejecutan una sola vez; no distraen durante una sesión de caja.
- La pantalla sigue funcionando sin animación y sin video.
- No se reproduce video automáticamente en el formulario de acceso.
- El clip se reserva para portada comercial, presentación o material promocional.

## Validación ya ejecutada

```bash
pnpm exec vitest run tests/obsidian-lumina-f2.test.ts
# 19/19 pruebas

pnpm exec eslint apps/web/src/App.tsx tests/obsidian-lumina-f2.test.ts
# sin errores

pnpm --filter @fitstore/web build
# compilación correcta
```

El clip local tiene estas propiedades:

- duración: 6 segundos;
- resolución: 1280 × 720;
- velocidad: 30 fps;
- MP4: H.264;
- WebM: VP9;
- sin audio.

## Tarea concreta para ChatGPT PC

1. Hacer `git fetch origin`.
2. Revisar el diff de `chatgpt-nube/obsidian-lumina-ronda-2...chatgpt-nube/lumina-motion`.
3. Comparar las capturas a 1440 px y 390 px.
4. Verificar que la N no se vea borrosa, deformada o recortada.
5. Verificar contraste, foco, navegación con teclado y movimiento reducido.
6. Confirmar que el cambio no altera los flujos de contraseña web y PIN de caja.
7. Integrar o adaptar únicamente después de recibir de Cloud la rama de destino vigente.
8. Volver a ejecutar las pruebas focales, ESLint y build.
9. Generar capturas finales de escritorio, móvil y movimiento reducido.
10. Entregar su commit a Cloud para auditoría; no desplegar.

## Higgsfield y video

Se usó el skill oficial de Higgsfield para recomendar modelo y cotizar la variante generativa. La dueña autorizó **9 créditos** para Cinema Studio Pro, 6 segundos, 16:9 y sin audio. Higgsfield rechazó la generación antes de comenzar con el mensaje `Out of credits on ultra (monthly) plan in Private workspace`. No se consumieron créditos.

Open Higgsfield está instalado localmente, pero necesita una clave compatible configurada fuera del chat. No se deben pegar claves ni secretos en mensajes o commits.

Cuando exista saldo o una clave configurada, usar `docs/diseno/obsidian-lumina/motion/nexora-prism-mark-reference.png` y el prompt aprobado de `docs/diseno/obsidian-lumina/motion/README.md`. Antes de integrar el resultado, comprobar cuadro por cuadro que la N no cambie de forma y que el modelo no añada letras, símbolos o destellos repetitivos.

## Límites

- No cambiar autenticación, PIN, contraseñas, permisos, facturación, caja, impuestos, pagos, API ni base de datos.
- No convertir el video en fondo permanente del punto de venta.
- No añadir más de tres grupos funcionales a la portada.
- No desplegar ni tocar Render.
- Cloud audita e indica la rama final; ChatGPT PC implementa o adapta y devuelve evidencia.
