# F2-01 · tokens en tres capas y 12 primitivos `Nx*` (Claude PC, orden 36)

Punto de partida verificado (28-oct): `producto-nexora` a58efb33, con Fase 1 visual (`aab91c9a`) y F1-01 (`35b20a2d`) ya mezclados.

## Estado actual
- `packages/ui/src/index.tsx` exporta 8 componentes: Badge, Button, Card, Empty, Field, Loading, Modal, TableFrame.
- Faltan los 12 primitivos `Nx*` pedidos por el plan.
- Existe `tests/visual-tokens.test.ts` (bloque de tokens por tema en `apps/web/src/styles.css`).
- Existe `tests/obsidian-lumina-f2.test.ts` (16 pruebas de primitivas y marco de la fase 2 previa).

## Pasos (una rama, un commit por primitivo)
1. Tokens en tres capas (base, semántica, componente) en archivo nuevo; no tocar `styles.css` en este paso.
2. Prueba que falle antes: lista de los 12 primitivos esperados y sus tokens.
3. Un primitivo por commit, en archivo nuevo dentro de `packages/ui/src/`. El borrador del modelo local se revisa antes de entrar.
4. Capturas a 390 y 1440 px, claro y oscuro (pendiente: requiere navegador).
5. Anotar el cierre en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`.

## Límites
No tocar `App.tsx` ni `styles.css` en F2-01 (eso es F2-03 y F3-01, después). Sin cambios de dinero, sin desplegar, sin mezclar en `producto-nexora`.
