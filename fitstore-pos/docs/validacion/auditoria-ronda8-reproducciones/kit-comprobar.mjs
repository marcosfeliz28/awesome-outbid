import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/workspace/auditoria-ronda8/fitstore-pos',r=createRequire(root+'/apps/api/package.json');r('dotenv').config({path:root+'/.env',quiet:true});const {PrismaClient}=r('@prisma/client'),db=new PrismaClient();
const base='http://127.0.0.1:3038/api',evidence={};
async function req(path,data,token){const x=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.239',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:x.status,body:await x.json()};}
async function ok(path,data,token){const x=await req(path,data,token);assert.ok(x.status<400,path+' '+JSON.stringify(x));return x.body;}
try{
 let token=(await ok('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})).accessToken;
 const roles=await ok('/roles',undefined,token),email='audit-kit-r8-'+Date.now()+'@example.test';
 await ok('/users',{name:'QA independiente combos R8',email,password:'FitStore-QA-2026!',pin:'876543',roleId:roles.find(r=>r.name==='admin').id},token);
 token=(await ok('/auth/login',{email,password:'FitStore-QA-2026!'})).accessToken;
 await ok('/terminals/register',{id:randomUUID(),name:'Auditoría combos R8',secret:'qa-kit-'+randomUUID()},token);
 const cats=await ok('/categories',undefined,token),suffix='kit-r8-'+Date.now().toString(36);
 const product=async(name,price,costAvg)=>{const p=await ok('/products',{name:name+' '+suffix,sku:name+'-'+suffix,categoryId:cats.find(c=>c.name==='Ropa deportiva').id,taxRate:0,variants:[{sku:name+'-v-'+suffix,barcode:name+'-b-'+suffix,price,costAvg}]},token);return {...p.variants[0],productName:p.name};};
 const component=await product('componente',12000,10000),kit=await product('combo',5000,0);await ok('/inventory/adjustments',{variantId:component.id,qty:1,reason:'QA combo exacto'},token);await ok('/kits',{kitVariantId:kit.id,components:[{componentVariantId:component.id,qty:0.4}]},token);
 const cash=await ok('/cash-sessions/open',{openingAmount:0},token);
 const input=q=>({offlineUuid:randomUUID(),cashSessionId:cash.id,items:[{variantId:kit.id,qty:q}],payments:[{method:'cash',amount:5000*q}],expectedTotal:5000*q});
 const snapshot=async()=>({stock:String((await db.variant.findUnique({where:{id:component.id}})).stock),moves:await db.inventoryMovement.count({where:{variantId:component.id}}),sales:await db.saleItem.count({where:{variantId:kit.id}}),payments:await db.payment.count({where:{cashSessionId:cash.id}}),cash:(await ok('/cash-sessions',undefined,token)).find(s=>s.id===cash.id).expected});
 const before=await snapshot(),fraction=await req('/sales',input(0.001),token),half=await req('/sales',input(0.5),token);assert.equal(fraction.status,400);assert.equal(half.status,400);assert.deepEqual(await snapshot(),before);
 evidence.fractional={submitted:[0.001,0.5],statuses:[fraction.status,half.status],message:fraction.body.message,before,after:await snapshot(),noWrites:true};
 const sale=await ok('/sales',input(1),token),item=await db.saleItem.findFirstOrThrow({where:{saleId:sale.id}}),stock=Number((await db.variant.findUnique({where:{id:component.id}})).stock);assert.equal(stock,0.6);assert.equal(Number(sale.costTotal),4000);assert.equal(item.stockAllocations[0].qty,0.4);
 const returnInput=q=>({saleId:sale.id,cashSessionId:cash.id,reason:'QA devolución combo exacto',refundMethod:'credit_note',items:[{saleItemId:item.id,qty:q,restock:true}]});
 const partial=await req('/returns',returnInput(0.5),token);assert.equal(partial.status,400);const returned=await ok('/returns',returnInput(1),token),restored=Number((await db.variant.findUnique({where:{id:component.id}})).stock);assert.equal(restored,1);assert.equal(Number(returned.costTotal),4000);
 evidence.wholeKit={saleTotal:Number(sale.total),saleCost:Number(sale.costTotal),stockAfter:stock,allocations:item.stockAllocations,partialReturnStatus:partial.status,totalReturnCost:Number(returned.costTotal),restoredStock:restored};
 const fine=await product('componente-fino',30,10.01),fineKit=await product('combo-fino',20,0);
 await ok('/inventory/adjustments',{variantId:fine.id,qty:10,reason:'QA redondeo contabilizado'},token);
 await ok('/kits',{kitVariantId:fineKit.id,components:[{componentVariantId:fine.id,qty:0.5}]},token);
 const fineSale=await ok('/sales',{offlineUuid:randomUUID(),cashSessionId:cash.id,items:[{variantId:fineKit.id,qty:10}],payments:[{method:'cash',amount:200}],expectedTotal:200},token);
 const fineItem=await db.saleItem.findFirstOrThrow({where:{saleId:fineSale.id}});
 const profit=async()=> (await ok('/reports/profit',undefined,token)).rows.find(r=>r.Producto===fineKit.productName);
 const back=async qty=>ok('/returns',{saleId:fineSale.id,cashSessionId:cash.id,reason:'QA costo de devolución parcial',refundMethod:'credit_note',items:[{saleItemId:fineItem.id,qty,restock:true}]},token);
 const firstBack=await back(3),partialProfit=await profit();
 evidence.partialCost={saleCost:Number(fineSale.costTotal),returnedCost:Number(firstBack.costTotal),bookedRemainingCost:Number(fineSale.costTotal)-Number(firstBack.costTotal),reportedRemainingCost:partialProfit.Costo,profitRow:partialProfit};
 assert.equal(partialProfit.Costo,35.03);assert.equal(firstBack.items[0].cost,15.02);evidence.partialCost.storedLineCost=firstBack.items[0].cost;
 const secondBack=await back(7),fullProfit=await profit();evidence.partialCost.fullReturnCosts=[Number(firstBack.costTotal),Number(secondBack.costTotal)];evidence.partialCost.finalReportCost=fullProfit.Costo;
 assert.equal(Number(fineSale.costTotal),50.05);assert.equal(Number(firstBack.costTotal),15.02);assert.equal(fullProfit.Costo,0);
 await ok('/cash-sessions/'+cash.id+'/close',{countedCash:5200,countedCard:0,countedTransfer:0,notes:'Cierre QA combos R8'},token);
}finally{await db.$disconnect();writeFileSync(root+'/docs/validacion/auditoria-ronda8-kit.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
