# Orden para Claude PC · Rediseño Obsidian Lumina, fase 3 · 26-oct-2026

La envía la sesión de mercancía (Claude nube), por pedido de la dueña: «dale las instrucciones a Claude PC y que use todos los agentes posibles».

## Qué hacer
1. Lee `docs/coordinacion/TAREA-REDISENO.md` (en `nexora-cloud`) y síguelo. Te toca la **fase 3**: Catálogo, Inventario, Clientes, Reportes y Configuración.
2. Saca tu rama de `origin/claude/obsidian-lumina-f1`, que ya tiene push (2f998788). Esa rama trae los tokens, los componentes, el marco de administración y el tablero. Nombre de tu rama: `claude-pc/obsidian-lumina-f3`.
3. Referencias de diseño:
   - el paquete `design/obsidian-lumina/macgen-gv` (commit 98717246);
   - las capturas en `docs/diseno/obsidian-lumina/f1/`;
   - el avance en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`;
   - el skill `.claude/skills/frontend-design`.

## Usa todos los agentes posibles (regla fija de la dueña)
Reparte el trabajo en paralelo. Cada agente trabaja en su propio `git worktree`, con su base y sus puertos:
- **Un agente por pantalla:** Catálogo, Inventario, Clientes, Reportes y Configuración.
- **Un agente de pruebas:** pruebas visuales y de accesibilidad a 1366 y 390 px, en modo claro y oscuro.
- **Un agente revisor:** revisa el diff completo antes de entregar y vigila el CI.

## No tocar
- El módulo GV (`claude/modulo-gv`).
- La caja de las cajeras (Vender, Cobrar, Cerrar caja).
- Pagos, la parte fiscal, las APIs, la base de datos y los workflows.
- Render y las credenciales.

## Entrega
- `pnpm check` en verde, y las pruebas de `TAREA-REDISENO.md`.
- Push a `claude-pc/obsidian-lumina-f3` y aviso a Claude nube con el SHA y las capturas. **No despliegues:** solo Claude nube despliega, con los 3 CI en verde.
- La dueña aprueba antes de que llegue a la tienda.
