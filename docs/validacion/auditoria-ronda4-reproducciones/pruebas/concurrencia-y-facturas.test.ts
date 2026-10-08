import {describe,it,expect,vi,afterEach} from '../fitstore-pos/node_modules/vitest/dist/index.js';
import {EventEmitter} from 'node:events';
import {RealtimeHub,RealtimeController} from '../fitstore-pos/apps/api/src/realtime';
import {matchInvoiceLines} from '../fitstore-pos/apps/api/src/invoice';
import {writeFileSync} from 'node:fs';
const evidence:any={};
const output='/workspace/auditoria-ronda4/fitstore-pos/docs/validacion/auditoria-ronda4-pruebas-dirigidas.json';
afterEach(()=>{vi.restoreAllMocks();writeFileSync(output,JSON.stringify(evidence,null,2));});
function timers(){
  let next=0;const live=new Map<number,()=>any>();
  vi.spyOn(globalThis,'setInterval').mockImplementation(((fn:any)=>{live.set(++next,fn);return next;}) as any);
  vi.spyOn(globalThis,'clearInterval').mockImplementation(((id:any)=>{live.delete(id);}) as any);
  return live;
}
const actor={id:'audit-user',sessionId:'audit-session',branchId:'main'} as any;
function response(){
  const res:any=new EventEmitter();res.code=200;res.writes=[];
  res.status=(code:number)=>{res.code=code;return res;};
  res.json=(data:any)=>{res.body=data;return res;};
  res.setHeader=()=>{};res.flushHeaders=()=>{};
  res.write=(data:any)=>{res.writes.push(data);return true;};
  res.end=()=>res.emit('close');return res;
}
describe('Reproducciones independientes R4 (asserts de lo observado)',()=>{
 it('dos altas simultáneas duplican el temporizador y pueden saltarse un evento',async()=>{
   const live=timers(),resolvers:any[]=[],sent:any[]=[];
   const row={id:1n,branchId:'main',type:'stock.changed',data:{qtyOnHand:3}};
   const db:any={realtimeEvent:{aggregate:()=>new Promise(r=>resolvers.push(r)),findMany:async({where}:any)=>row.id>where.id.gt?[row]:[]}};
   const hub=new RealtimeHub(db);
   const first=hub.add({branchId:'main',send:r=>{sent.push(String(r.id));return true;}});
   const second=hub.add({branchId:'main',send:()=>true});
   expect(resolvers).toHaveLength(2);
   resolvers[0]({_max:{id:0n}});const remove1=await first;
   // El evento 1 se confirma después del alta 1 y antes del máximo del alta 2.
   resolvers[1]({_max:{id:1n}});const remove2=await second;
   expect(live.size).toBe(2);
   [...live.values()][0]();await Promise.resolve();await Promise.resolve();
   expect(sent).toEqual([]);
   remove1();remove2();
   expect(hub.count()).toBe(0);expect(live.size).toBe(1);
   evidence.hub={simultaneousInitialQueries:2,timersCreated:2,timersRemainingAfterAllDisconnect:live.size,eventCommittedWhileFirstListenerActive:'1',eventsReceivedByFirst:sent};
 });
 it('el límite acepta 20 conexiones simultáneas mientras el alta espera',async()=>{
   timers();const pending:any[]=[],controller=new RealtimeController({} as any);
   (controller as any).hub={add:()=>new Promise(resolve=>pending.push(resolve))};
   const responses=Array.from({length:20},()=>response());
   const requests=responses.map(()=>new EventEmitter());
   const calls=responses.map((r,i)=>controller.events(requests[i] as any,r,actor));
   expect(pending).toHaveLength(20);
   pending.forEach(resolve=>resolve(()=>{}));await Promise.all(calls);
   const accepted=responses.filter(r=>r.code===200).length;
   expect(accepted).toBe(20);
   const next=response();await controller.events(new EventEmitter() as any,next,actor);
   expect(next.code).toBe(429);
   evidence.connectionCaps={allowedPerSession:2,allowedPerUser:6,concurrentAccepted:accepted,nextSequentialStatus:next.code};
   responses.forEach(r=>r.emit('close'));
 });
 it('un cierre durante el alta deja el listener registrado después de desconectarse',async()=>{
   timers();let resolve:any,removed=0;
   const controller=new RealtimeController({} as any);
   (controller as any).hub={add:()=>new Promise(r=>{resolve=r;})};
   const req=new EventEmitter(),res=response();
   const p=controller.events(req as any,res,{...actor,sessionId:'closed-before-add'});
   req.emit('close');res.emit('close');
   resolve(()=>removed++);await p;
   expect(removed).toBe(0);expect(res.writes.length).toBe(1);
   evidence.disconnectDuringStartup={cleanupCallsAfterDisconnect:removed,readyWrittenAfterDisconnect:res.writes.length===1};
   res.emit('close');
 });
 it('el SKU del producto selecciona la única variante pese al sabor/tamaño contrario',()=>{
   const product={id:'product',name:'Proteína Whey',sku:'WHEY'};
   const catalog=[{id:'vainilla-2lb',sku:'WHEY-V2',barcode:'999',product,attributes:{sabor:'Vainilla',tamaño:'2 lb'}}];
   const line={code:'WHEY',description:'Proteína Whey chocolate 5 lb',qty:1,unitCost:50};
   const result=matchInvoiceLines([line],catalog)[0];
   expect(result.variantId).toBe('vainilla-2lb');expect(result.confidence).toBe(1);
   evidence.variantMismatch={invoice:line,onlyCatalogAttributes:catalog[0].attributes,matchedVariantId:result.variantId,confidence:result.confidence,note:result.note??null};
 });
});
