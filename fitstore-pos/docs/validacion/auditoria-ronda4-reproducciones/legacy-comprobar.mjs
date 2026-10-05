import {readFileSync,writeFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('/workspace/auditoria-ronda4/legacy-fixture.json','utf8'));
const base='http://127.0.0.1:3004/api',results={};
async function req(path,data,token){const response=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.212',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return{status:response.status,body:await response.json()};}
async function ok(path,data,token){const r=await req(path,data,token);if(r.status>=400)throw new Error(path+' '+JSON.stringify(r));return r.body;}
const owner=(await ok('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})).accessToken;
const other=(await ok('/auth/login',{email:fixture.users[1].email,password:'FitStore-QA-2026!'})).accessToken;
results.unregisteredMutation=await req('/inventory/adjustments',{variantId:fixture.variantId,qty:1,reason:'Control sin equipo tras migración'},other);
const enrolled=await req('/terminals/register',{id:fixture.terminalId,name:'Otro navegador conoce ID anterior',secret:'secreto-nuevo-elegido-por-auditoria'},other);
results.legacyClaim={status:enrolled.status,terminalStatus:enrolled.body.status,approvedBy:enrolled.body.approvedBy,originalOwner:fixture.users[0].id,claimingUser:fixture.users[1].id,claimedTerminalId:fixture.terminalId,hasSecretHashInResponse:Object.hasOwn(enrolled.body,'secretHash')};
const adjust=await req('/inventory/adjustments',{variantId:fixture.variantId,qty:1,reason:'Operación sin aprobación de gerente usando equipo R3'},other);
results.mutationWithClaimedTerminal={status:adjust.status};
const original=(await ok('/auth/login',{email:fixture.users[0].email,password:'FitStore-QA-2026!'})).accessToken;
const originalEnroll=await req('/terminals/register',{id:fixture.terminalId,name:'Navegador original R3',secret:'secreto-del-navegador-original-distinto'},original);
results.originalOwnerRegistration=originalEnroll;
const row=(await ok('/reports/purchases',undefined,owner)).rows.find(r=>r.Proveedor===fixture.supplierName);
results.legacyPurchase={originalOperationTotal:fixture.operation.total,receiptId:fixture.operation.receiptId,reportRow:row};
await ok('/supplier-payments',{supplierId:fixture.supplierId,amount:34,method:'transfer',reference:'Pago QA compra R3'},owner);
results.legacyPurchase.reportAfterPaying34=(await ok('/reports/purchases',undefined,owner)).rows.find(r=>r.Proveedor===fixture.supplierName);
writeFileSync('/workspace/auditoria-ronda4/fitstore-pos/docs/validacion/auditoria-ronda4-legado.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
