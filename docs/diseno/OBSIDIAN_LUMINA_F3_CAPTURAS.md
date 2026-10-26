# Obsidian Lumina F3: capturas antes/después

Script: `scripts/capturas-lumina-f3.mjs`. Captura Catálogo (`products`), Inventario, Clientes, Reportes y
Configuración como admin (`admin@fitstore.demo`), tema oscuro, a 1366x768 (desktop) y 390x844 (mobile),
solo el viewport. Salida: `docs/diseno/obsidian-lumina/f3/<fase>-<pantalla>-<desktop|mobile>.png`.
Las `antes-*` ya están commiteadas (base 8c6f58fc). Para `despues-*`, desde el otro worktree:

Puertos propios: web 4186, API 3186, PostgreSQL 55186. NUNCA 3001, 4173 ni 5432 (tienda real del PC).

```bash
pnpm install --frozen-lockfile && pnpm db:generate && pnpm build
export FITSTORE_DB_PORT=55186 FITSTORE_DB_DIR="$PWD/.lumina-db"   # carpeta desechable
node scripts/local-db.mjs &                                        # PostgreSQL embebido
export DATABASE_URL='postgresql://fitstore:fitstore_local@127.0.0.1:55186/fitstore?options=-c%20TimeZone%3DUTC'
export JWT_SECRET=lumina-f3-capturas-secreto-desechable-0123456789 WEB_ORIGIN=http://127.0.0.1:4186 PORT=3186
export SEED_DEMO_PASSWORD='FitStore-Demo-2026!'                    # la del .env.example
pnpm db:migrate && pnpm db:seed
pnpm --filter @fitstore/api start &                                # API en :3186
FITSTORE_API_PROXY=http://127.0.0.1:3186 pnpm --filter @fitstore/web exec vite preview --host 127.0.0.1 --port 4186 --strictPort &
node scripts/capturas-lumina-f3.mjs --fase despues --web http://127.0.0.1:4186
```

Al terminar: `node scripts/local-db.mjs --detener`, parar API y web, y borrar `.lumina-db`.

## Gotchas
- El script no arranca nada; si la web no responde o el login falla, imprime `ERROR:` y sale con 1.
- `.lumina-db` no está en `.gitignore`: usa `git add` con rutas explícitas, no `git add -A`.
- La preview debe llevar `FITSTORE_API_PROXY` a la API (si no, apunta a 3001 = tienda real).
- Tarda unos minutos (espera esqueletos y `networkidle` por pantalla). Avisa con `AVISO` si hay
  esqueleto persistente o `scrollWidth > innerWidth` (scroll horizontal).
- La semilla genera fechas relativas a hoy: los datos cambian algo entre corridas (Resumen, fechas).
- Compara antes/después con la misma semilla; el tema se fuerza con `localStorage["fitstore-theme"]="dark"`.
