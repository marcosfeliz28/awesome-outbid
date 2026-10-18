# LEER PRIMERO — ChatGPT NUBE (actualizado 14-oct-2026)

> **Orden 3ae (14-oct):** la dueña te pasa el control del día a día. Lee primero `docs/coordinacion/TRASPASO_CHATGPT_NUBE.md`: donde choque con las reglas de abajo sobre tocar producción o desplegar, manda ese documento.

**Antes de escribir una sola línea:** baja la rama `nexora-cloud` actualizada y lee, en este orden, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` desde la orden **3aa** hasta el final. Si no puedes bajar el repositorio, pide a la dueña que te pegue el texto. **Contesta primero con 3 líneas: qué leíste y qué vas a entregar.**

## Reglas fijas
1. La tienda trabaja en producción (Render, rama `nexora-cloud`) con mercancía real. **Nunca** la toques ni te conectes a su base de datos.
2. Solo Claude (nube) integra y despliega, con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
3. Margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %. No cambies precios en el sistema por una oferta (el descuento lo aplica la caja).
4. Nada de credenciales en chat, commits ni documentos.
5. Responde a la dueña en español, corto y claro.
6. **Entrega siempre con la rama subida a GitHub** o, si no puedes, con un bundle de git por Drive. Una entrega que Claude no puede ver no existe.

## Estado
- **Recibido y revisado:** 3aa (corregir referencia de transferencia; en CI en `claude/merge-3aa`), informe Camino A (`producto-local`) e informe Camino B (`producto-saas`).
- **Pendiente tuyo, en este orden:** (1) 3ab Fase 0 (WhatsApp: coexistencia del número, verificación de Meta, política de IA, costo mensual, sin código); (2) lote 6 de publicidad (diseño); (3) confirmar lotes 1, 2 y 5.
- **No empieces** código del Camino A ni del Camino B hasta que la dueña lo autorice por escrito.
