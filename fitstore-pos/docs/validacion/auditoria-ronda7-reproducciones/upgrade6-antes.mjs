import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r7_upgrade6'});await db.connect();
const old=JSON.parse(readFileSync('/workspace/auditoria-ronda6/legacy-fixture.json','utf8')),id=randomUUID();
await db.query('INSERT INTO "GoodsReceipt" (id,"orderId","supplierId",total,items,freight,"otherCosts","userId","branchId") VALUES ($1,$2,$3,25,$4,0,0,$5,\'main\')',[id,old.oldOrder.id,old.supplierId,JSON.stringify([{qty:1,cost:25},{qty:1}]),old.users[0].id]);
const result={source:'Clon de la base R6 auditada, historial Prisma y SQL R6 original ya aplicados; nueva recepción sintética reproduce total parcial 25',id,before:(await db.query('SELECT * FROM "GoodsReceipt" WHERE id=$1',[id])).rows[0],migrationBefore:(await db.query('SELECT migration_name,checksum FROM "_prisma_migrations" ORDER BY migration_name')).rows};
writeFileSync('/workspace/auditoria-ronda7/fitstore-pos/docs/validacion/auditoria-ronda7-upgrade6-antes.json',JSON.stringify(result,null,2));await db.end();console.log('R6 aplicada: recepción sintética parcial 25 preparada en copia separada.');
