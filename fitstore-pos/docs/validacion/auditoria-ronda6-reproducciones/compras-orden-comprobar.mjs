import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:3007/api',suffix='invoice-r6-'+Date.now().toString(36);
async function req(path,data,token,method=data===undefined?'GET':'POST'){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.215',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const out=await r.json();if(!r.ok)throw new Error(path+' '+r.status+' '+JSON.stringify(out));return out;}
const token=(await req('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'})).accessToken;
await req('/terminals/register',{id:randomUUID(),name:'Auditoría factura contra orden',secret:'secreto-qa-'+randomUUID()},token);
const categories=await req('/categories',undefined,token);
const supplier=await req('/suppliers',{name:suffix},token);
const product=await req('/products',{name:suffix,sku:suffix,categoryId:categories.find(c=>c.name==='Ropa deportiva').id,variants:[{sku:suffix+'-v',barcode:suffix+'-b',costAvg:10,price:118}]},token);
try{
 const variantId=product.variants[0].id;
 const order=await req('/purchase-orders',{supplierId:supplier.id,items:[{variantId,qty:2,unitCost:25}]},token);
 const receipt=await req('/merchandise/operations',{id:randomUUID(),direction:'entry',supplierId:supplier.id,orderId:order.id,invoiceTotal:60,items:[{variantId,itemId:order.items[0].id,qty:2,unitCost:30}]},token);
 const report=async()=> (await req('/reports/purchases',undefined,token)).rows.find(r=>r.Proveedor===supplier.name);
 const result={orderTotal:Number(order.total),acceptedInvoiceTotal:receipt.total,reportBeforePayment:await report()};
 await req('/supplier-payments',{supplierId:supplier.id,amount:60,method:'transfer',reference:'Pago exacto de factura QA 60'},token);
 result.reportAfterPayingInvoice=await report();
 const variants=await req('/inventory/stock',undefined,token);result.stockAfter=Number(variants.find(v=>v.id===variantId).stock);result.averageCostAfter=Number(variants.find(v=>v.id===variantId).costAvg);
 writeFileSync('/workspace/auditoria-ronda6/fitstore-pos/docs/validacion/auditoria-ronda6-compras-orden.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await req('/products/'+product.id,{active:false},token,'PATCH');}
