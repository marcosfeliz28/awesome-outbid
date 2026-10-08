# Instrucciones para agentes de código (Codex, ChatGPT u otros)

Este repositorio lo trabajan dos asistentes y una dueña de negocio. Antes de tocar nada:

1. Lee `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` completo. Es la orden vigente de Claude y cambia con el tiempo.
2. Lee `docs/coordinacion/TABLERO_NEXORA.md` (reglas y reserva de archivos) y `docs/coordinacion/PLAN_DE_TRABAJO.md`.
3. Trabaja en la rama `nexora-chatgpt`, nunca directo en `nexora-cloud`. Un commit por ID de hallazgo.
4. Cada corrección lleva una regresión que falle antes y pase después. `pnpm check` en verde.
5. Sin secretos, sin datos de producción, sin contraseñas fijas. Textos en español.
6. Al terminar un lote: abre un PR hacia `nexora-cloud` titulado «Lote N» y anota el resultado en `TABLERO_NEXORA.md`, sección Entregas.
7. No despliegues en Render; el desplegador es Claude.
