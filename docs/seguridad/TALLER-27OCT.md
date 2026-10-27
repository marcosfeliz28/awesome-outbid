# Taller · 27-oct-2026 · Revisión de plugins pedida por Llaves

## 1. Task Observer 3.8.1 (huella)
- Instalado en `~/.claude/plugins/cache/one-skill-to-rule-them-all/task-observer/3.8.1`: 30 archivos.
- La huella sha256 que pidió Llaves (`5d8583…838a1`, «7 archivos») **no coincide** con lo instalado. No pude reproducirla ni con el método del candado (`scripts/plugins-lock.mjs`) ni con un recálculo simple.
- `node scripts/plugins-lock.mjs verificar` sigue marcando `NUEVO sin aprobar: task-observer@one-skill-to-rule-them-all@3.8.1`.
- Estado: **no se ejecuta** Task Observer. Hace falta que Llaves/Revisor confirme la huella correcta y el número de archivos.

## 2. cloudflare/security-audit-skill y OpenSEO
- **No instalados.** Ninguno aparece en `docs/seguridad/PLUGINS.md`, así que por la regla 2 de `SESIONES_Y_LIMITES.md` aún no pueden probarse, ni siquiera en el Taller, sin veredicto del Revisor.
- Además, cloudflare/* choca con el límite del Taller (sin herramientas de Cloudflare).
- Qué hooks/MCP/hosts usan: sin revisar todavía. Esto se hace en la lectura del Revisor, no con instalación.

## 3. Qué sí quedó verificado
- Rama `claude/taller-plugins`, árbol limpio antes de este commit.
- Telemetría y guardia activas como en la configuración vigente.
- No se usó ninguna credencial ni se tocó producción, Render, Cloudflare ni `nexora-cloud`/`producto-nexora`.
