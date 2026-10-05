import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const fixture=JSON.parse(readFileSync(new URL('./legacy-fixture.json',import.meta.url),'utf8'));
const oldToken=JSON.parse(readFileSync(new URL('./legacy-token.private.json',import.meta.url),'utf8')).token;
const base='http://127.0.0.1:3007/api',result={};
async function req(path,data,token){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.222',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json()};}
async function ok(path,data,token){const r=await req(path,data,token);assert.ok(r.status<400,path+' '+JSON.stringify(r));return r.body;}
const login=async email=>(await ok('/auth/login',{email,password:email==='admin@fitstore.demo'?'FitStore-Demo-2026!':'FitStore-QA-2026!'})).accessToken;
const payload={variantId:fixture.variantId,qty:1,reason:'Auditoría de equipo anterior'};
result.oldSessionMutation=await req('/inventory/adjustments',payload,oldToken);assert.equal(result.oldSessionMutation.status,403);
const owner=await login('admin@fitstore.demo'),other=await login(fixture.users[1].email);
const registered=await ok('/terminals/register',{id:fixture.terminalId,name:'Reclamo R3 sin gerente',secret:'secreto-qa-r6-anterior-sin-gerente'},other);
result.claim={status:registered.status,legacy:registered.legacy,identified:registered.identified,hasSecretHash:Object.hasOwn(registered,'secretHash')};assert.equal(result.claim.status,'pending');
result.mutationBeforeApproval=await req('/inventory/adjustments',payload,other);assert.equal(result.mutationBeforeApproval.status,403);
await ok('/terminals/register',{id:randomUUID(),name:'Gerente auditoría R6 migrada',secret:'secret-qa-manager-'+randomUUID()},owner);
await ok('/terminals/'+fixture.terminalId+'/approve',{},owner);
result.mutationAfterApprovalStatus=(await req('/inventory/adjustments',payload,other)).status;assert.equal(result.mutationAfterApprovalStatus,201);
const report=async()=> (await ok('/reports/purchases',undefined,owner)).rows.find(r=>r.Proveedor===fixture.supplierName);
result.purchaseBeforePay=await report();
// 34 de Mercancía + 55 de la recepción por orden. El registro incompleto sintético
// se mantiene separado y demuestra el importe parcial de 25 que NO debió conciliarse.
await ok('/supplier-payments',{supplierId:fixture.supplierId,amount:89,method:'transfer',reference:'Pago QA compras originales R3'},owner);
result.purchaseAfterPay89=await report();
result.knownOriginalPurchases=89;result.syntheticIncorrectBackfill=25;result.syntheticCase='Una línea completa (1×25), otra sin costo; registro alterado vía SQL para control defensivo, no creado por API.';
writeFileSync(new URL('./fitstore-pos/docs/validacion/auditoria-ronda6-legado.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
