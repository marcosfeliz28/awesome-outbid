import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const fixture=JSON.parse(readFileSync(new URL('./legacy-fixture.json',import.meta.url),'utf8'));
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r7_upgrade3'});await db.connect();
const table=(name,id)=>db.query('SELECT * FROM "'+name+'" WHERE id=$1',[id]).then(r=>r.rows[0]);
const evidence={source:'API y migraciones R3 originales, base aislada',terminal:await table('Terminal',fixture.terminalId),standalone:await table('GoodsReceipt',fixture.operation.receiptId),ordered:await table('GoodsReceipt',fixture.oldReceive.id),migrations:(await db.query('SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name')).rows};
// Casos defensivos de datos históricos: se identifican como sintéticos, no creados por API.
fixture.unknownReceiptId=randomUUID();fixture.incompleteReceiptId=randomUUID();
await db.query('INSERT INTO "GoodsReceipt" (id,"items","freight","otherCosts","userId","branchId") VALUES ($1,$2,0,0,$3,\'main\')',[fixture.unknownReceiptId,JSON.stringify([{qty:2,cost:10}]),fixture.users[0].id]);
await db.query('INSERT INTO "GoodsReceipt" (id,"orderId","items","freight","otherCosts","userId","branchId") VALUES ($1,$2,$3,0,0,$4,\'main\')',[fixture.incompleteReceiptId,fixture.oldOrder.id,JSON.stringify([{qty:1,cost:25},{qty:1}]),fixture.users[0].id]);
evidence.syntheticIncompleteBefore=await table('GoodsReceipt',fixture.incompleteReceiptId);
writeFileSync(new URL('./legacy-fixture.json',import.meta.url),JSON.stringify(fixture,null,2));
writeFileSync(new URL('./fitstore-pos/docs/validacion/auditoria-ronda7-migracion-antes.json',import.meta.url),JSON.stringify(evidence,null,2));
await db.end();console.log('Instantánea R3 guardada; controles históricos sintéticos separados.');
