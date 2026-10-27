# Task Observer 3.8.1: huella del candado (Revisor, 27-oct-2026)

Pregunta de «Nexora 1»: el Taller dice que lo instalado da 30 archivos sensibles y otra huella, no los 7 esperados de `ba696b2`.

## Veredicto: NO puedo confirmar que la instalada sea la revisada
No tengo acceso al caché del Taller (`~/.claude/plugins/cache/...`) y su rama `claude/taller-plugins` (`fbcf000`) no incluye Task Observer en `plugins.lock.json` ni la lista de sus 30 archivos. Comparar sin ver el árbol instalado sería adivinar. Sí puedo dar la referencia limpia y el comando para comparar.

## Referencia limpia (commit `ba696b2`, v3.8.1)
Corrí `scripts/plugins-lock.mjs generar` (copia leída de `fbcf000`) sobre una copia exacta de `ba696b2` en una carpeta temporal, sin ejecutar nada del plugin:

- **7 archivos sensibles, huella `5d8583079e9d7e56503cc9b5ecd6942ed84642413bfed7806729981081b838a1`**.
- Los 7 coinciden con lo que el candado considera sensible (`SENSIBLES`, `plugins-lock.mjs:13`): 2 en `.claude-plugin/` y 5 en `scripts/`. No hay `hooks/`, `bin/`, `bridge/`, `dist/` ni `.mcp.json` en ese commit.

| archivo | sha256 (primeros 16) |
|---|---|
| .claude-plugin/marketplace.json | f2716bed7cdceeb1 |
| .claude-plugin/plugin.json | 7599bb30eb46a0bf |
| scripts/migrate-log.py | ce4418ecac5e12b0 |
| scripts/new-observation.sh | f2844d0c99b1f313 |
| scripts/session-start-scan.sh | e1b761fb73634d1f |
| scripts/skill-load.sh | 3546be4182e70a03 |
| scripts/validate-skill-bundle.py | 35bd1118ff73280f |

Tampoco depende del commit: v3.6.0, v3.7.0, v3.8.0 y el HEAD actual de upstream dan también 7 archivos. Es decir, **los 23 archivos de más no vienen del repo original**: alguien los añadió al árbol instalado o el árbol instalado es de otro origen.

## Qué hace que 30 ≠ 7
El candado cuenta solo rutas que empiezan por `hooks/`, `scripts/`, `bin/`, `bridge/`, `dist/hooks/`, `.claude-plugin/`, `.mcp.json`, `mcp.json` (y salta `node_modules`, `.git`, `tests`). 23 archivos extra en esas rutas significan, en orden de probabilidad:
1. El caché contiene otra cosa que `ba696b2` (otro commit, o un fork/copia).
2. Se instaló junto a otro plugin dentro del mismo directorio.
3. Archivos generados al usarse (por ejemplo, `scripts/` o `hooks/` creados por el propio skill, que escribe cosas por diseño).
No lo sé: son hipótesis hasta ver la lista. Si alguno es un `hooks/*.sh` o un script nuevo que se ejecuta solo, el plugin **ya no es el aprobado**.

## Cómo comprobarlo (solo lectura, para el Taller)
Con `D` = la carpeta instalada de `task-observer/3.8.1`:
```
cd "$D"
find . -type f -not -path './node_modules/*' -not -path './.git/*' | sed 's|^\./||' | sort > /tmp/instalado.txt
git ls-remote https://github.com/rebelytics/one-skill-to-rule-them-all   # confirmar ba696b2
# en un clon limpio: git ls-tree -r --name-only ba696b2 | sort > /tmp/limpio.txt
diff /tmp/limpio.txt /tmp/instalado.txt         # archivos de más o de menos
for f in $(comm -12 /tmp/limpio.txt /tmp/instalado.txt); do
  [ "$(sha256sum "$D/$f" | cut -d' ' -f1)" = "$(git show ba696b2:"$f" | sha256sum | cut -d' ' -f1)" ] || echo "DISTINTO: $f"
done
```
Mandar al Revisor `diff` y la lista de `DISTINTO`. Con esos nombres leo qué ejecuta cada archivo extra y doy el veredicto final. No hay que regenerar el candado hasta entonces.

## Mientras tanto
No aprobar la huella del Taller para Task Observer ni copiarla a `plugins.lock.json`. Si el Taller quiere seguir usándolo, que lo desactive o lo reinstale desde `ba696b2` y compare con `5d85…38a1`.

---
## Cierre (tras el inventario del Taller, `TALLER-TASKOBSERVER-27OCT.md`)
**Veredicto: la instalada = la revisada (`ba696b2`). Solo Taller.**
- Aclaración: los «30 archivos» eran **todos** los archivos del caché, no 30 sensibles. El candado cuenta 7 y esos 7 son los mismos que arriba, así que la huella correcta es **`5d8583079e9d7e56503cc9b5ecd6942ed84642413bfed7806729981081b838a1`** (7 archivos).
- Diff completo (nombre + sha256 completo) contra `git ls-tree -r ba696b2`: **29 de 29 archivos del repo son byte a byte idénticos** a lo instalado. Lo único de más es `.in_use/95` (no existe en git; es un marcador del propio caché de Claude Code). Su sha256 no coincide con «95», «95\n» ni vacío, así que **no sé qué contiene**; está fuera de las rutas sensibles del candado y no es código del plugin. Pedir al Taller solo su tamaño (`wc -c`), no más.
- SKILL.md y `references/*` instalados son idénticos a los revisados. Búsqueda dirigida de instrucciones peligrosas (credenciales, `.ssh`/`.aws`, `printenv`, `sudo`, `eval`, `base64`, webhooks, red): nada que lea llaves ni envíe datos. Lo que hay: `chmod` sobre su propio directorio de skill (`skill-authoring.md:935-940`, `weekly-review.md:1440`), listar tareas programadas (`crontab -l`, `launchctl list`, `weekly-review.md:310-311`), y `curl` solo en la comprobación opcional con el repo original, iniciada por el usuario (`skill-authoring.md:453-454`). El `SKILL.md` declara que no usa red (`SKILL.md:18`) y `SECURITY.md:5` que no tiene servicio ni credenciales. Revisión por búsqueda, no lectura línea por línea de los ~15 000 renglones.
- Sigue valiendo la advertencia: el skill ordena invocarse en cada sesión y propone cambios a otros skills, hooks y CLAUDE.md; toda edición propuesta debe pasar por la dueña.
