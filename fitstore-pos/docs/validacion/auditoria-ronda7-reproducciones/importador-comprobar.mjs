import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/workspace/auditoria-ronda7/fitstore-pos',reqApi=createRequire(root+'/apps/api/package.json');reqApi('dotenv').config({path:root+'/.env',quiet:true});
const ExcelJS=reqApi('exceljs'),{PrismaClient}=reqApi('@prisma/client');
const url='postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r7_import';const db=new PrismaClient({datasources:{db:{url}}});
const out=root+'/docs/validacion/auditoria-ronda7-importador';mkdirSync(out,{recursive:true});const evidence={dataScope:'Sólo datos QA en base separada; libros sintéticos, sin el Excel original de la tienda.'};
const base='http://127.0.0.1:3020/api';
async function req(path,data,token,method=data===undefined?'GET':'POST'){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.237',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json()};}
async function ok(path,data,token,method){const r=await req(path,data,token,method);assert.ok(r.status<400,path+' '+JSON.stringify(r));return r.body;}
async function workbook(name,rows){const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Inventario 2026');ws.addRow(['ID','DESCRIPCION','REFERENCIA','SUB-GRUPO DE ARTICULO','EXISTENCIA','COSTO','PRECIO DETALLE']);rows.forEach(r=>ws.addRow(r));const file=out+'/'+name+'.xlsx';await wb.xlsx.writeFile(file);return file;}
function run(file){const r=spawnSync(root+'/apps/api/node_modules/.bin/tsx',['scripts/import-inventario.ts',file],{cwd:root+'/apps/api',env:{...process.env,DATABASE_URL:url},encoding:'utf8',timeout:60000});return {status:r.status,stdout:r.stdout,stderr:r.stderr};}
function variant(v){return {id:v.id,sku:v.sku,barcode:v.barcode,stock:Number(v.stock),costAvg:Number(v.costAvg),price:Number(v.price),productName:v.product.name,active:v.active};}
try{
 const owner=(await ok('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})).accessToken;await ok('/terminals/register',{id:randomUUID(),name:'Auditoría R7 importador',secret:'import-qa-'+randomUUID()},owner);
 const categories=await ok('/categories',undefined,owner),clothing=categories.find(c=>c.name==='Ropa deportiva'),supplement=categories.find(c=>c.name==='Suplementos');
 const code='9876500712345';
 const already=await db.variant.findUnique({where:{sku:'qa-existing-r7-v'},include:{product:{include:{variants:true}}}});
 const previous=already?.product ?? await ok('/products',{name:'QA producto existente por barras R7',sku:'qa-existing-r7',categoryId:clothing.id,taxRate:0,variants:[{sku:'qa-existing-r7-v',barcode:code,price:20,costAvg:10}]},owner);
 if(!already)await ok('/inventory/adjustments',{variantId:previous.variants[0].id,qty:4,reason:'Stock QA de código anterior'},owner);
 const collisionFile=await workbook('codigo-ambiguo-base',[ [code,'QA producto nuevo por ID R7',code,'Accesorios de gym',2,10,20] ]);
 const collision=run(collisionFile);assert.equal(collision.status,0,JSON.stringify(collision));
 const imported=await db.variant.findUnique({where:{sku:code},include:{product:true}}),existing=await db.variant.findUnique({where:{id:previous.variants[0].id},include:{product:true}});
 evidence.codeCollision={run:collision,code,existing:variant(existing),imported:variant(imported),expectedBehavior:'Rechazar la ambigüedad contra códigos existentes antes de escribir; el ID de cobro no debe seleccionar otro producto.'};
 assert.equal(existing.barcode,imported.sku);assert.notEqual(imported.id,existing.id);
 const numericId='9876500700002',numericFile=await workbook('numeros-espanol',[[numericId,'QA valores españoles R7',numericId,'Suplementos','1,5','1.250,50','2.500,75']]);
 const numericRun=run(numericFile);assert.equal(numericRun.status,0,JSON.stringify(numericRun));
 const numeric=await db.variant.findUnique({where:{sku:numericId},include:{product:true}});
 evidence.localizedNumbers={input:{qty:'1,5',cost:'1.250,50',price:'2.500,75'},expected:{qty:1.5,cost:1250.50,price:2500.75},persisted:variant(numeric),run:numericRun};
 assert.equal(Number(numeric.stock),15);assert.equal(Number(numeric.costAvg),1.25);assert.equal(Number(numeric.price),2.5);
 // Categoría creada por API con controles explícitos; producto ya existente.
 const guarded=await ok('/categories',{name:'QA categoría con lotes R7',requiresLot:true,requiresExpiry:true,attributes:[]},owner);
 const protectedProduct=await ok('/products',{name:'QA producto protegido R7',sku:'qa-protected-r7',categoryId:guarded.id,taxRate:0,variants:[{sku:'qa-protected-r7-v',barcode:'qa-protected-r7-b',price:20,costAvg:10}]},owner);
 const beforeCategory=await db.category.findUnique({where:{id:guarded.id}}),beforeLogs=await db.auditLog.count({where:{entity:'category',entityId:guarded.id}});
 const adjustment={variantId:protectedProduct.variants[0].id,qty:1,reason:'Prueba QA sin lote ni vencimiento'};
 const blocked=await req('/inventory/adjustments',adjustment,owner);assert.equal(blocked.status,400,JSON.stringify(blocked));
 const policyFile=await workbook('recarga-categoria-protegida',[['qa-protected-r7-v','QA producto protegido R7','qa-protected-r7-v',guarded.name,0,10,20]]);
 const repeat=run(policyFile);assert.equal(repeat.status,0,JSON.stringify(repeat));
 const afterCategory=await db.category.findUnique({where:{id:guarded.id}}),allowed=await req('/inventory/adjustments',adjustment,owner);
 evidence.categoryReset={before:{requiresLot:beforeCategory.requiresLot,requiresExpiry:beforeCategory.requiresExpiry},after:{requiresLot:afterCategory.requiresLot,requiresExpiry:afterCategory.requiresExpiry},newCategoryAuditEntries:await db.auditLog.count({where:{entity:'category',entityId:guarded.id}})-beforeLogs,repeatRun:repeat,entryWithoutLotBefore:{status:blocked.status,message:blocked.body.message},entryWithoutLotAfter:{status:allowed.status,body:allowed.body},source:'Categoría y producto creados por API; el Excel referencia el SKU existente y la carga informa sin cambios.'};
 assert.equal(afterCategory.requiresLot,false);assert.equal(afterCategory.requiresExpiry,false);assert.equal(allowed.status,201,JSON.stringify(allowed));
 // Control positivo de carga: catálogo público de nombres; cantidades y valores inventados sólo para QA.
 const catalog=JSON.parse(readFileSync(root+'/tests/fixtures/catalogo-tienda.json','utf8'));
 const catalogFile=await workbook('catalogo-616-datos-qa',catalog.map(r=>[r.id,r.name,r.id,r.categoria,1,10,20]));
 const catalogRun=run(catalogFile);assert.equal(catalogRun.status,0,JSON.stringify(catalogRun));
 const importedCount=await db.variant.count({where:{sku:{in:catalog.map(r=>r.id)}}});assert.equal(importedCount,616);
 const beforeSum=await db.variant.aggregate({where:{sku:{in:catalog.map(r=>r.id)}},_sum:{stock:true}});const catalogRepeat=run(catalogFile);assert.equal(catalogRepeat.status,0);const afterSum=await db.variant.aggregate({where:{sku:{in:catalog.map(r=>r.id)}},_sum:{stock:true}});assert.deepEqual(afterSum,beforeSum);
 evidence.catalogControl={source:'616 nombres/ID/categorías del fixture del ZIP. Stock=1, costo=10 y precio=20 son sintéticos de QA; NO representan el Excel real.',count:importedCount,stockTotal:Number(beforeSum._sum.stock),firstRun:catalogRun,repeatRun:catalogRepeat,stockUnchanged:true};
}finally{await db.$disconnect();writeFileSync(root+'/docs/validacion/auditoria-ronda7-importador.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
