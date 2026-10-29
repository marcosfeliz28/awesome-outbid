# Tipos de prueba (tarea 87)

Borrador sin verificar, hecho por script. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/cola-b14-resto`. Conteo por nombre de archivo con `git ls-tree`: unitarias (`tests/*.test.ts` sin postgres ni -api), `*-postgres`, integración (`*-api*`) y e2e (`tests/e2e/*.spec.ts`).

| Tipo | Archivos |
|---|---|
| Unitarias (sin postgres ni -api) | 180 |
| `*-postgres` | 56 |
| Integración `*-api` | 22 |
| e2e (`tests/e2e/*.spec.ts`) | 36 |

Total: 294. Control: `git ls-tree -r --name-only HEAD tests | grep -c -E '(\.test\.ts|\.spec\.ts)$'` = 294.
