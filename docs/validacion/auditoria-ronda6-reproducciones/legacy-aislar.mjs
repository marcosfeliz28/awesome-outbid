import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const fixture=JSON.parse(readFileSync(new URL('./legacy-fixture.json',import.meta.url),'utf8'));
const path=new URL('./fitstore-pos/docs/validacion/auditoria-ronda6-legado.json',import.meta.url),result=JSON.parse(readFileSync(path,'utf8'));
const db=new pg.Client({connectionString:'postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r6_upgrade'});await db.connect();
// Retira exclusivamente el registro artificial ya documentado para medir el
// reporte de compras originales sin mezclar ambos controles.
await db.query('DELETE FROM "GoodsReceipt" WHERE id=$1',[fixture.incompleteReceiptId]);await db.end();
const headers={'Content-Type':'application/json','X-Forwarded-For':'192.0.2.224'};
const login=await fetch('http://127.0.0.1:3007/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})});assert.equal(login.status,201);const token=(await login.json()).accessToken;
const report=await(await fetch('http://127.0.0.1:3007/api/reports/purchases',{headers:{Authorization:'Bearer '+token}})).json();
result.originalPurchasesAfterRemovingSynthetic=report.rows.find(r=>r.Proveedor===fixture.supplierName);assert.equal(result.originalPurchasesAfterRemovingSynthetic.Compras,89);assert.equal(result.originalPurchasesAfterRemovingSynthetic.Pendiente,0);
result.withoutEvidenceRow=report.rows.find(r=>r.Proveedor==='Recepciones sin proveedor (conciliar)');assert.equal(result.withoutEvidenceRow.Sin_conciliar,2); // original orphan-lot receipt + synthetic unknown
result.syntheticFixtureRemovedAfterRecordingEvidence=true;
writeFileSync(path,JSON.stringify(result,null,2));console.log('Compras originales sin fixture sintético: 89; pago 89; pendiente 0. Sin evidencia: 2 pendientes de conciliar.');
