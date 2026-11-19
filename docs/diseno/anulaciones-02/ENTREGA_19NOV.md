# Anulaciones 02: propuesta nativa aislada, 19 nov

Base Tienda: `553c7e80a08851f9f4c6169c4db078acc9e87fd0`. No producto, publicación, API, BD ni datos reales.

Referencia inspeccionada: Norexos-02-Anulaciones-4K.png, 3840x2160, Library `libfile_fde3_f-2f8ee86703208191919f47e49908bfff_00021c7591648191a2873caeaff1ea36`, SHA256 `715d244b009e37dff68c7d1d539c2437f3d6c8acaf8be1f91defa19945f6c15a`.

Lista compacta izquierda y único detalle derecha; a <=760px se apilan. Selección por botón con aria-pressed y aria-controls; selección inicial y fallback al primer resultado vigente. Filtro pertenece a selección; no se agregan filtros ficticios de tienda/fecha ni folios inventados. Sin resultados se conserva mensaje original. El polling original de 15000ms permanece.

Tarjeta de detalle completa (importes, guardas, acciones) y sufijo de ambos modales son byte-for-byte iguales a la base. Un efecto de presentación cierra un diálogo si su solicitud desaparece o deja de estar pendiente, y el de aprobación si aparece bloqueo; no ejecuta acciones. La autorización `can(user.permissions, "*")` no cambia.

Pruebas:
- Web typecheck: PASS.
- Web build: PASS (aviso existente tamaño de chunks; no límite modificado).
- ESLint de archivos TS/TSX tocados: PASS.
- operational-aux: 12/12 PASS, hash histórico intacto. Ledger revierte cuatro cambios UI exactos con exigencia de aparición única; no nueva base/hash ni omisión de handlers. SHA de tarjeta y sufijo de modales comprobados además por separado.
- Pristine base: operational-aux 9/9 PASS; con UI nueva sin ledger, el contrato anterior falla (regresión demostrada).
- QA navegador sintético preparado en tests/visual-anulaciones-02.spec.ts para admin/noadmin, 1440/390, selección manual, nota obligatoria/modal rechazo, polling que elimina selección, cierre diálogo obsoleto, confirmar/cancelar, vacío y ausencia de escrituras.
- QA navegador NO EJECUTADO: Chromium termina antes de crear página por socket() Operation not permitted; un intento autorizado con escalación obtuvo el mismo bloqueo. No reintentar aquí ni afirmar capturas actuales. Config acepta CHROMIUM_PATH para entorno autorizado independiente.
- pnpm check agregado / integración / CI remoto: no ejecutados. No listo para publicar hasta QA independiente.

Comandos: pnpm --filter @fitstore/web typecheck; pnpm --filter @fitstore/web build; pnpm exec vitest run tests/operational-aux.test.ts; pnpm exec playwright test -c playwright.visual-anulaciones.config.ts.
