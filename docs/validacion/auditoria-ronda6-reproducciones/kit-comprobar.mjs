import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/workspace/auditoria-ronda6/fitstore-pos',reqApi=createRequire(root+'/apps/api/package.json');reqApi('dotenv').config({path:root+'/.env',quiet:true});const {PrismaClient}=reqApi('@prisma/client'),db=new PrismaClient();
const base='http://127.0.0.1:3006/api',suffix='kit-r6-'+Date.now().toString(36),evidence={};
async function req(path,data,token){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.223',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json()};}
async function ok(path,data,token){const r=await req(path,data,token);assert.ok(r.status<400,path+' '+JSON.stringify(r));return r.body;}
try{
 const token=(await ok('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})).accessToken;
 await ok('/terminals/register',{id:randomUUID(),name:'Prueba de combos R6',secret:'kit-qa-'+randomUUID()},token);
 const categories=await ok('/categories',undefined,token),categoryId=categories.find(c=>c.name==='Ropa deportiva').id;
 const product=async(label,price,costAvg)=>ok('/products',{name:label+' '+suffix,sku:label+'-'+suffix,categoryId,taxRate:0,variants:[{sku:label+'-v-'+suffix,barcode:label+'-b-'+suffix,price,costAvg}]},token);
 const component=await product('componente',12000,10000),kit=await product('combo',5000,0);
 const componentId=component.variants[0].id,kitId=kit.variants[0].id;
 await ok('/inventory/adjustments',{variantId:componentId,qty:1,reason:'Stock para combo fraccionado'},token);
 await ok('/kits',{kitVariantId:kitId,components:[{componentVariantId:componentId,qty:0.4}]},token);
 const cash=await ok('/cash-sessions/open',{openingAmount:0},token);
 const before=await db.variant.findUnique({where:{id:componentId}}),beforeMoves=await db.inventoryMovement.count({where:{variantId:componentId}});
 const input={offlineUuid:randomUUID(),cashSessionId:cash.id,items:[{variantId:kitId,qty:0.001}],payments:[{method:'cash',amount:5}],expectedTotal:5};
 const sale=await req('/sales',input,token);const after=await db.variant.findUnique({where:{id:componentId}});
 evidence.input=input;evidence.componentQuantityPerKit=0.4;evidence.expectedExactConsumption=0.0004;evidence.saleStatus=sale.status;evidence.saleTotal=sale.body.total;evidence.saleCost=sale.body.costTotal;evidence.stockBefore=Number(before.stock);evidence.stockAfter=Number(after.stock);evidence.moves=await db.inventoryMovement.findMany({where:{variantId:componentId,type:'sale'},select:{qty:true,balanceAfter:true,unitCost:true}});evidence.newMovementCount=await db.inventoryMovement.count({where:{variantId:componentId}})-beforeMoves;
 evidence.saleItems=sale.status<400?await db.saleItem.findMany({where:{saleId:sale.body.id},select:{qty:true,unitCost:true,stockAllocations:true}}):[];
 assert.equal(sale.status,201);assert.equal(Number(after.stock),1);assert.equal(Number(evidence.moves[0].qty),0);assert.equal(Number(evidence.saleCost),4);
 evidence.observedDefect=true;evidence.expectedBehavior='Rechazar la venta antes de cobrar cuando el consumo de un componente no es representable a 3 decimales; preservar stock, caja y facturas.';
 await ok('/cash-sessions/'+cash.id+'/close',{countedCash:5,countedCard:0,countedTransfer:0,notes:'Cierre QA combos'},token);
}finally{await db.$disconnect();writeFileSync(root+'/docs/validacion/auditoria-ronda6-kit.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
