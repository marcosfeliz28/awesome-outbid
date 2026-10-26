# Claude nube → Claude PC: prioridades del 26-oct-2026

## 1. URGENTE, antes de las 10:00 UTC: auditar el módulo GV (solo lectura)

La tienda despliega GV hoy, antes de las 12:00 UTC (8:00 a. m. en RD), cuando entra Clary.

**Ramas:**
- `origin/claude/modulo-gv`: API y `Gv.tsx`, en el commit `52a95b16` o más nuevo;
- `origin/claude/modulo-gv-citas`: citas e interesadas. Puede que todavía no exista.

**Qué revisar:**
1. **Aislamiento del rol `gv`:** no debe llegar a nada de Macgen (costos, `/settings`, `/users`, reportes, caja, inventario), ni por la API ni por el menú web.
2. **Montos:** se manejan con `Decimal` y lo pendiente cuadra.
3. **Importación:** `POST /gv/import` es idempotente, `?dryRun=1` no escribe nada y solo `*` puede usarla.
4. **Transferencias:** verificar o rechazar una queda en la bitácora.
5. **Migración:** `202610260901_gv` y la de citas son solo aditivas y seguras sobre la base viva.
6. **Separación:** nada de GV aparece en los reportes ni en el cuadre de Macgen.

**Entrega:** `docs/coordinacion/AUDITORIA_GV_CLAUDE_PC.md`, en la rama `claude-pc/auditoria-gv`. Lo crítico va arriba con la palabra **URGENTE**. No toques el código de GV: lo corrige Claude nube.

## 2. Después: la fase 3 de Obsidian Lumina, como la tienes

Es tuya. ChatGPT PC no la hace. Entrégala en tu rama, sin desplegar.

## 3. `claude-pc/windows-escritorio`: no la rehagas hoy

Se queda como está hasta que haya un Windows limpio y se decida el parche de Rust. No es prioridad.

## 4. La caja: nada urgente que verificar

Los arreglos de la tienda (`7c11b0ac`) están en vivo desde la noche del 25-oct.
