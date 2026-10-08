import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const fixture=JSON.parse(readFileSync(new URL('./legacy-fixture.json',import.meta.url),'utf8'));
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r6_upgrade'});await db.connect();
const table=(name,id)=>db.query('SELECT * FROM "'+name+'" WHERE id=$1',[id]).then(r=>r.rows[0]);
async function snapshot(){return {terminal:await table('Terminal',fixture.terminalId),standalone:await table('GoodsReceipt',fixture.operation.receiptId),ordered:await table('GoodsReceipt',fixture.oldReceive.id),unknown:await table('GoodsReceipt',fixture.unknownReceiptId),syntheticIncomplete:await table('GoodsReceipt',fixture.incompleteReceiptId),orphanReferences:(await db.query('SELECT count(*) FROM "InventoryMovement" WHERE "lotId"=$1',[fixture.orphanLotId])).rows[0].count};}
const first=await snapshot();
assert.equal(first.terminal.approvedAt,null);assert.equal(first.terminal.legacy,true);
assert.equal(Number(first.standalone.total),34);assert.equal(first.standalone.supplierId,fixture.supplierId);assert.equal(first.standalone.operationId,fixture.operation.id);
assert.equal(Number(first.ordered.total),55);assert.equal(first.ordered.supplierId,fixture.supplierId);
assert.equal(first.unknown.total,null);assert.equal(first.orphanReferences,'0');
await db.query(readFileSync(new URL('./fitstore-pos/apps/api/prisma/migrations/202610060001_round6_audit/migration.sql',import.meta.url),'utf8'));
const second=await snapshot();assert.deepEqual(second,first);
const result={...first,idempotent:true,migrations:(await db.query('SELECT migration_name,finished_at FROM "_prisma_migrations" ORDER BY migration_name')).rows,lotIndex:(await db.query("SELECT indexname FROM pg_indexes WHERE tablename='InventoryMovement' AND indexname='InventoryMovement_lotId_idx'")).rows,version:(await db.query('SHOW server_version')).rows[0]};
writeFileSync(new URL('./fitstore-pos/docs/validacion/auditoria-ronda6-migracion-despues.json',import.meta.url),JSON.stringify(result,null,2));await db.end();console.log('Migración verificada e idempotente. Compra R3: 34; orden: 55; sin evidencia: NULL; sintético incompleto: '+first.syntheticIncomplete.total);
