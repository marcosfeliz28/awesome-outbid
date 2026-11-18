# Caja y turnos: integración revisable del 18 de noviembre

Base: `92d131f8847c1bd338b48c34231bf3c6ae82cb5b` (Inicio premium + POS + PWA).
Código integrado: `ae2c1862c8dbd7417b4b6a9f49282bcc361294e3`, árbol `e57979328897920060899ad8135a67886b21c9e2`.
Rama: `dot/caja-turnos-integrado-18nov`. No publicada en producción.

Cambios respecto a la base: hoja de estilo scoped de Caja/turnos, import y clase raíz, dos guardas defensivas del historial para no mostrar efectivo esperado ni diferencias sin permiso. Sin cambio de handlers de abrir, mover o cerrar caja. API, configuración Render, instalador y los 181 archivos públicos idénticos a base.

Referencia inspeccionada: PNG aprobado `norexos-caja-turnos-higgsfield-01.png`. El acabado implementa superficies verde/azul, bisel, relieve, foco y pulsación, temas claro/oscuro/negro y reducción de movimiento. No reproduce datos o controles ficticios del concepto. La pantalla operativa conserva español; no se afirma traducción completa ni equivalencia visual exacta.

## Controles ejecutados
- Typecheck de todo el workspace: pasa.
- ESLint completo: pasa.
- Build web Vite + service worker: pasa (advertencia existente de tamaño de chunk).
- Regresiones de presentación y privacidad: 9/9 pasan.
- `pnpm check`: no pasa. Unitarias: 1044 pasan, 12 fallan, 48 omitidas. Los 19 errores reportados entre suites/tests son inicialización de PostgreSQL embebido por falta de `libicuuc.so.60`. No se cambiaron pruebas ni bibliotecas del sistema para ocultarlo.
- Playwright visual390: no ejecutó aserciones; Chromium abortó con `socket() failed: Operation not permitted`. Cinco casos posteriores no se ejecutaron.
- Sin CI remoto ni push confirmado: Git CLI requiere autenticación (`could not read Username for https://github.com`).

## Próximo control obligatorio
Validación en PC aislada con `playwright.visual-caja-turnos.config.ts` y `tests/visual-caja-turnos-higgsfield.spec.ts`: 1440/390, claro/oscuro, cajero/gerente/caja cerrada, payload hostil de privacidad, abrir/cancelar diálogos sin enviar operaciones. Sin tocar tienda ni publicar durante mantenimiento Render.
