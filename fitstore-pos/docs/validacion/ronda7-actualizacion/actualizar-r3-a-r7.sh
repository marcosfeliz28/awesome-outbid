#!/bin/bash
# Ronda 7 · actualización real R3 → R7 de punta a punta (entorno de Claude).
# Requiere: checkout del commit 30393fc en $S/r3 con dependencias, base QA
# separada (URL en $S/upgrade7-url) y la API de la ronda 7 compilada.
# Pasos: base nueva → API R3 crea datos (1-preparar-r3.mjs) → recepciones
# sintéticas de R6-03 sobre el esquema R3 → prisma migrate deploy (R7) →
# API R7 compilada → 3-comprobar-r7.mjs.
# Actualización real R3 → R7, de punta a punta.
set -e
S=${S:?define S: carpeta de trabajo}
REPO=/home/user/awesome-outbid/fitstore-pos
U7=$(cat $S/upgrade7-url)
psql "$(sed "s#/fitstore_upgrade#/postgres#" $S/upgrade-url)" -qc "DROP DATABASE IF EXISTS fitstore_upgrade7" -c "CREATE DATABASE fitstore_upgrade7"
cd $S/r3/fitstore-pos && pnpm db:migrate >/dev/null 2>&1 && pnpm db:seed 2>&1 | grep Seed
cd $S/r3/fitstore-pos/apps/api && (PORT=3013 nohup npx tsx src/main.ts > $S/r3-api.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3013/api/health && break; sleep 1; done
cd $REPO && node docs/validacion/ronda7-actualizacion/1-preparar-r3.mjs
for p in $(pgrep node); do c=$(readlink /proc/$p/cwd 2>/dev/null || true); case "$c" in */scratchpad/r3/fitstore-pos/apps/api) kill $p;; esac; done
sleep 2
O=$(node -e 'console.log(require("./docs/validacion/ronda7-actualizacion/datos-r3.json").orderId)')
psql "$U7" -qAt -c "INSERT INTO \"GoodsReceipt\"(id,\"orderId\",freight,\"otherCosts\",items,\"userId\",\"branchId\") SELECT 'aaaaaaaa-0000-4000-8000-000000000001','$O',0,0,'[{\"qty\":1,\"cost\":25},{\"qty\":1}]'::jsonb,\"userId\",'main' FROM \"GoodsReceipt\" WHERE \"orderId\"='$O' LIMIT 1" -c "INSERT INTO \"GoodsReceipt\"(id,\"orderId\",freight,\"otherCosts\",items,\"userId\",\"branchId\") SELECT 'aaaaaaaa-0000-4000-8000-000000000002','$O',4,1,'[{\"qty\":2,\"cost\":25}]'::jsonb,\"userId\",'main' FROM \"GoodsReceipt\" WHERE \"orderId\"='$O' LIMIT 1"
{
  echo "Actualización real R3 → R7 (datos de la API de la ronda 3, commit 30393fc)."
  echo "Recepciones sintéticas agregadas sobre el esquema R3 para R6-03:"
  echo "  ...0001: items [{qty:1,cost:25},{qty:1}] (incompleta)  ...0002: 2×25 + flete 4 + otros 1"
  echo "== prisma migrate deploy (código ronda 7)"
  (cd apps/api && DATABASE_URL="$U7" npx prisma migrate deploy 2>&1 | grep -E "found|Applying|applied")
  echo "== Recepciones de la orden después de migrar (id | con proveedor | total)"
  psql "$U7" -Atc "SELECT id, \"supplierId\" IS NOT NULL, total FROM \"GoodsReceipt\" WHERE \"orderId\"='$O' ORDER BY id"
} | tee docs/validacion/ronda7-actualizacion/2-migracion.txt
cd apps/api && (DATABASE_URL="$U7" PORT=3014 nohup node dist/main.js > $S/r7-upgrade-api.log 2>&1 & echo $! > $S/r7up.pid) && cd $REPO
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3014/api/health && break; sleep 1; done
node docs/validacion/ronda7-actualizacion/3-comprobar-r7.mjs || true
kill $(cat $S/r7up.pid)
