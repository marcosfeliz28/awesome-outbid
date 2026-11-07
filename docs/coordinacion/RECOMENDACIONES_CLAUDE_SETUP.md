# Recomendaciones de «Claude Code Setup» (claude-automation-recommender) — 7-nov-2026

Hecho por Norexos 1 (nube), solo lectura sobre nexora-cloud. **Ninguna está aplicada**: se revisan y se aplican con orden de la dueña. Claude PC corre el mismo plugin en la laptop (orden 117) y agrega sus propias sugerencias al final.

## Perfil del repositorio

- TypeScript monorepo pnpm: API NestJS 11 + Prisma 6 (PostgreSQL), web React 19 + Vite, pruebas Vitest y Playwright, ESLint 9 y Prettier. ~1 700 archivos. CI `FitStore checks` (verify, windows-installer, render-images). Despliegue manual en Render.
- Ya existen: ~35 skills en `.claude/skills` (seguridad-20, noche-autonoma, mercancia, etc.), `.claude/settings.json` solo con el plugin ponytail, **sin hooks, sin agentes y sin `.mcp.json`**.

## Hooks (los de más valor)

1. **PreToolUse: bloquear edición de migraciones ya existentes** (`apps/api/prisma/migrations/*/migration.sql` con commit previo) y de `pnpm-lock.yaml`. Las migraciones son aditivas y nunca se reescriben; un cambio accidental rompe la base en vivo. Ir en `.claude/settings.json`.
2. **PostToolUse: `prettier --write` sobre el archivo editado** (ya hay Prettier). Evita fallos de formato en `verify`, que cuesta ~35 min por ciclo.

## Subagentes

1. **money-guard** (`.claude/agents/money-guard.md`): revisor de solo lectura que, ante cualquier diff que toque ventas, caja, descuentos, márgenes o reportes, verifica las reglas de la dueña (margen = (precio−costo)/precio sin restar ITBIS, mínimo 15 %, no cambiar precios por una oferta). Hoy esa revisión depende de recordarla.
2. **security-reviewer** basado en el skill `seguridad-20` (ya existe como skill; como agente corre en paralelo antes de cada mezcla).

## Skills a crear

1. **desplegar-nexora** (solo usuario, `disable-model-invocation: true`): checklist ejecutable de despliegue — 3 CI verdes en el SHA exacto, 0 cajas abiertas (lectura), API antes que web, verificación en vivo, anotar en PENDIENTES. Hoy vive repartido entre `noche-autonoma` y `aprendizajes-n1`.
2. **migracion-aditiva** (solo usuario): plantilla de migración `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING` con su prueba de migración.

## Servidores MCP

1. **context7**: documentación al día de NestJS, Prisma y React 19 (el equipo trabaja con versiones nuevas; evita inventar APIs).
2. **Playwright MCP**: capturas a 390 px para la regla «todo debe verse en iPhone». Ya hay `@playwright/test`; el MCP deja a Claude PC revisar pantallas sin escribir scripts. (Chrome DevTools MCP ya estaba aprobado en `herramientas-evaluadas`.)
   - No se recomienda Supabase, Vercel ni otros conectores de datos: duplican acceso a datos de dinero.

## Plugins

- Ninguno adicional. `frontend-design` ya está como skill local.

## Cómo aplicar

Pedir a Norexos 1 o Claude PC «aplica la recomendación N» sobre una rama `claude-pc/...`; pasa por CI y por la auditoría seguridad-20 como todo cambio.
