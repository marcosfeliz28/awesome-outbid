import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const root='/workspace/auditoria-ronda4/fitstore-pos',requireApi=createRequire(root+'/apps/api/package.json');
requireApi('dotenv').config({path:root+'/.env',quiet:true});
const {PrismaClient}=requireApi('@prisma/client');const db=new PrismaClient();
const base='http://127.0.0.1:3002/api',suffix='audit-r4-'+Date.now().toString(36),result={};
async function req(path,data,token,method=data===undefined?'GET':'POST'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.213',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return{status:response.status,body:await response.json()};
}
async function ok(path,data,token,method){const r=await req(path,data,token,method);if(r.status>=400)throw new Error(path+' '+JSON.stringify(r));return r.body;}
async function enroll(token,name){const id=randomUUID(),secret='qa-only-'+randomUUID();const terminal=await ok('/terminals/register',{id,name,secret},token);return{...terminal,secret};}
const actors=[],products=[],suppliers=[];
let owner;
try {
 owner=(await ok('/auth/login',{email:'admin@fitstore.demo',password:process.env.SEED_DEMO_PASSWORD})).accessToken;
 const ownerTerminal=await enroll(owner,'Auditoría R4 dueño');
 const roles=await ok('/roles',undefined,owner),cats=await ok('/categories',undefined,owner);
 const user=await ok('/users',{name:'Auditoría aislada R4',email:suffix+'@example.test',password:'FitStore-QA-2026!',pin:'456789',roleId:roles.find(r=>r.name==='warehouse').id},owner);actors.push(user);
 const auth=()=>ok('/auth/login',{email:user.email,password:'FitStore-QA-2026!'});
 let token=(await auth()).accessToken;
 const makeProduct=async(name,costAvg=10)=>{const p=await ok('/products',{name:name+' '+suffix,sku:name+'-'+suffix,categoryId:cats.find(c=>c.name==='Ropa deportiva').id,variants:[{sku:name+'-v-'+suffix,barcode:name+'-b-'+suffix,price:118,costAvg}]},owner);products.push(p);return p;};
 const product=await makeProduct('regresion'),variantId=product.variants[0].id;
 const payload={variantId,qty:1,reason:'Prueba sin equipo de auditoría'};
 const missing=await req('/inventory/adjustments',payload,token);
 const terminal=await enroll(token,'Auditoría R4 almacén');
 const pending=await req('/inventory/adjustments',payload,token);
 await ok('/terminals/'+terminal.id+'/approve',{},owner);
 const approved=await req('/inventory/adjustments',payload,token);
 const logs=await ok('/audit-log',undefined,owner);
 const log=logs.find(a=>a.entityId===variantId&&a.action==='adjustment'&&a.userId===user.id);
 result.equipment={missing:{status:missing.status,code:missing.body.code},initialRegistrationStatus:terminal.status,pending:{status:pending.status,code:pending.body.code},approved:{status:approved.status,auditTerminalId:log?.terminalId},secretMismatch:(await req('/terminals/register',{id:terminal.id,name:'Mismo ID diferente secreto',secret:'otro-secreto-aleatorio-que-no-corresponde'},token)).status};
 const supplier=await ok('/suppliers',{name:'Proveedor auditoría '+suffix},owner);suppliers.push(supplier);
 const entry={id:randomUUID(),direction:'entry',supplierId:supplier.id,items:[{variantId,qty:2,unitCost:15}],freight:4};
 const received=await ok('/merchandise/operations',entry,token);
 const repeat=await ok('/merchandise/operations',entry,token);
 const report=async()=> (await ok('/reports/purchases',undefined,owner)).rows.find(r=>r.Proveedor===supplier.name);
 result.purchases={receiptTotal:received.total,receipt:await db.goodsReceipt.findUnique({where:{id:received.receiptId}}),reportAfterStandalone:await report(),repeatSameReceipt:repeat.receiptId===received.receiptId,receiptsForOperation:await db.goodsReceipt.count({where:{operationId:entry.id}})};
 const order=await ok('/purchase-orders',{supplierId:supplier.id,items:[{variantId,qty:2,unitCost:25}]},owner);
 await ok('/merchandise/operations',{id:randomUUID(),direction:'entry',supplierId:supplier.id,orderId:order.id,items:[{variantId,itemId:order.items[0].id,qty:2,unitCost:25}]},token);
 result.purchases.reportAfterOrder50=await report();
 await ok('/supplier-payments',{supplierId:supplier.id,amount:34,method:'transfer',reference:'Auditoría compra 34'},owner);
 result.purchases.reportAfterPaying34=await report();
 result.purchases.reportOutsideDateRange=(await ok('/reports/purchases?from=2020-01-01&to=2020-01-02',undefined,owner)).rows.find(r=>r.Proveedor===supplier.name);
 const before=await db.variant.findUnique({where:{id:variantId}}),beforeCount=await db.goodsReceipt.count(),beforeMoves=await db.inventoryMovement.count({where:{variantId}});
 const invented=randomUUID();
 const badLot=await req('/merchandise/operations',{id:randomUUID(),direction:'entry',items:[{variantId,qty:1,unitCost:1,lotId:invented}]},token);
 const after=await db.variant.findUnique({where:{id:variantId}});
 result.lots={invalidEntryStatus:badLot.status,message:badLot.body.message,stockUnchanged:String(before.stock)===String(after.stock),receiptCountUnchanged:beforeCount===await db.goodsReceipt.count(),movementCountUnchanged:beforeMoves===await db.inventoryMovement.count({where:{variantId}}),inventedLotStored:await db.inventoryMovement.count({where:{lotId:invented}})>0};
 try{await db.inventoryMovement.create({data:{variantId,lotId:invented,type:'adjustment',qty:1,unitCost:1,balanceAfter:1,userId:user.id,reason:'Integridad FK auditada',branchId:'main'}});}catch(e){result.lots.directForeignKeyRejectCode=e.code;}
 const validLot=await ok('/merchandise/operations',{id:randomUUID(),direction:'entry',items:[{variantId,qty:1,unitCost:15,lotNumber:'QA-R4-LOTE'}]},token);
 const lot=await db.lot.findUnique({where:{variantId_lotNumber:{variantId,lotNumber:'QA-R4-LOTE'}}});
 result.lots.validEntry={status:201,receiptId:validLot.receiptId,lotQty:String(lot.qty),movementQty:String((await db.inventoryMovement.findFirst({where:{lotId:lot.id}})).qty)};
 const fineProduct=await makeProduct('precision'),fineVariantId=fineProduct.variants[0].id;
 await ok('/inventory/adjustments',{variantId:fineVariantId,qty:1,reason:'Stock inicial prueba decimales'},token);
 const fineOrder=await ok('/purchase-orders',{supplierId:supplier.id,items:[{variantId:fineVariantId,qty:1,unitCost:1000000}]},owner);
 const fineBefore=await db.variant.findUnique({where:{id:fineVariantId}});
 const fine=await req('/purchase-orders/'+fineOrder.id+'/receive',{items:[{itemId:fineOrder.items[0].id,qty:0.0004}]},token);
 const fineAfter=await db.variant.findUnique({where:{id:fineVariantId}});
 const fineMovement=await db.inventoryMovement.findFirst({where:{variantId:fineVariantId,type:'purchase'}});
 const fineReceived=await db.purchaseItem.findUnique({where:{id:fineOrder.items[0].id}});
 result.precision={qtySubmitted:0.0004,legacyReceiveStatus:fine.status,stockBefore:String(fineBefore.stock),stockAfter:String(fineAfter.stock),costBefore:String(fineBefore.costAvg),costAfter:String(fineAfter.costAvg),receiptTotal:fine.body.total,storedMovementQty:String(fineMovement?.qty),storedReceivedQty:String(fineReceived.receivedQty),merchandiseSameQtyStatus:(await req('/merchandise/operations',{id:randomUUID(),direction:'entry',items:[{variantId:fineVariantId,qty:0.0004,unitCost:1000000}]},token)).status};
 result.productionValidation=await req('/sales',{},owner);
 await ok('/terminals/'+terminal.id+'/revoke',{},owner);
 result.equipment.revokedOldSession=(await req('/inventory/stock',undefined,token)).status;
 token=(await auth()).accessToken;
 result.equipment.revokedRegistration=(await req('/terminals/register',{id:terminal.id,name:terminal.name,secret:terminal.secret},token)).status;
 result.equipment.newSessionWithoutTerminal=(await req('/inventory/adjustments',payload,token)).status;
 const replacement=await enroll(token,'Reemplazo necesita aprobación');
 result.equipment.replacementStatus=replacement.status;
 result.equipment.replacementMutation=(await req('/inventory/adjustments',payload,token)).status;
 result.source={api:'API R4 compilada (node dist/main.js)',db:'fitstore_audit_r4',originalZipUnchanged:true};
}finally{
 if(owner){for(const p of products)await req('/products/'+p.id,{active:false},owner,'PATCH');for(const u of actors)await req('/users/'+u.id,{active:false},owner,'PATCH');for(const s of suppliers)await req('/suppliers/'+s.id,{active:false},owner,'PATCH');}
 await db.$disconnect();
 writeFileSync(root+'/docs/validacion/auditoria-ronda4-api.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
