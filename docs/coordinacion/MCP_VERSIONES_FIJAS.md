# MCP recomendados · versiones fijas (orden 118, 7-nov-2026)

Ambos paquetes se resuelven con `npx -y <paquete>@<versión>`. `npx` no verifica el hash en cada arranque; los hashes de abajo son para auditar qué versión exacta se instaló.

| MCP | Paquete | Versión | Publicada | integrity (sha512) |
| --- | --- | --- | --- | --- |
| context7 | `@upstash/context7-mcp` | 4.4.4 | 2026-10-19 | `sha512-T2DkjhweDnC2mRAclDiTrPG3KI1zYKhhjgY2SMKD9PVrbEaGD8x35VsIOqpwwDc2qiKBvfYCF/jqr+jQMu5PUA==` |
| playwright | `@playwright/mcp` | 0.0.83 | 2026-09-28 | `sha512-oNcl+Ae2/IAjhfPeP46BfIkSakfmprY+aOtkv5MjrQ4lPav4/yNtPhL0iq8SlIM90oApWgBDUxaNKvktazUKOg==` |

Se eligieron versiones con al menos dos semanas de antigüedad. La última de context7 (4.5.1, 2026-11-06) y la de Playwright (0.0.84, 2026-10-31) quedan fuera a propósito.

## Revisión de seguridad (manual, no es la auditoría completa seguridad-20)
- No hay secretos ni variables de entorno en `.mcp.json`.
- Los dos paquetes son de publicadores oficiales en npm (upstash, playwright).
- Sin `npx` sin versión.
- Pendiente: que la auditoría seguridad-20 completa lo revise antes de mezclar.

## Conflicto con .gitignore
`.gitignore` excluye `/.mcp.json` («Solo el Taller lo genera; nunca se sube»). Por eso la configuración quedó en `docs/coordinacion/mcp-recomendados.json`. Para usarla en la laptop hay que copiarla a `.mcp.json` localmente. Decisión pendiente de Norexos 1: si el Taller debe aceptar este archivo o si se mantiene fuera del repo.
