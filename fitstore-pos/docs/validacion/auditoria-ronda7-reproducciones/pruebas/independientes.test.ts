import {afterEach,describe,it,expect,vi} from '../fitstore-pos/node_modules/vitest/dist/index.js';
import {EventEmitter} from 'node:events';
import {writeFileSync} from 'node:fs';
import {RealtimeHub,RealtimeController} from '../fitstore-pos/apps/api/src/realtime';
import {matchInvoiceLines} from '../fitstore-pos/apps/api/src/invoice';
const evidence:any={};
afterEach(()=>{vi.restoreAllMocks();writeFileSync('/workspace/auditoria-ronda7/fitstore-pos/docs/validacion/auditoria-ronda7-dirigidas.json',JSON.stringify(evidence,null,2));});
function timers(){let n=0;const live=new Map<number,()=>unknown>();vi.spyOn(globalThis,'setInterval').mockImplementation(((f:any)=>{live.set(++n,f);return n;}) as any);vi.spyOn(globalThis,'clearInterval').mockImplementation(((i:any)=>live.delete(i)) as any);return live;}
const flush=async()=>{for(let i=0;i<7;i++)await Promise.resolve();};
function res(){const r:any=new EventEmitter();r.code=200;r.writes=[];r.destroyed=false;r.status=(v:number)=>(r.code=v,r);r.json=(v:any)=>(r.body=v,r);r.write=(v:any)=>(r.writes.push(v),true);r.setHeader=()=>{};r.flushHeaders=()=>{};r.end=()=>r.emit('close');return r;}
const actor:any={id:'auditor',sessionId:'independent-session',branchId:'main'};
describe('Comprobaciones independientes R7: cierres y reproducciones observadas',()=>{
 it('12 altas: una inicialización, entrega única y cero temporizadores al cerrar',async()=>{
  const live=timers(),pending:any[]=[],sent:string[]=[];const event={id:1n,branchId:'main',type:'stock.changed',data:{}};
  const db:any={realtimeEvent:{aggregate:()=>new Promise(r=>pending.push(r)),findMany:async({where}:any)=>where.id.gt<1n?[event]:[]}};
  const hub=new RealtimeHub(db);const calls=Array.from({length:12},(_,i)=>hub.add({branchId:'main',send:e=>{if(i===0)sent.push(String(e.id));return true;}}));
  expect(pending.length).toBe(1);pending[0]({_max:{id:0n}});const remove=await Promise.all(calls);expect(live.size).toBe(1);
  [...live.values()][0]();await flush();[...live.values()][0]();await flush();expect(sent).toEqual(['1']);remove.forEach(r=>r());expect(live.size).toBe(0);expect(hub.count()).toBe(0);
  evidence.hub={clients:12,initialQueries:1,eventsForFirst:sent,timersAfterClose:live.size};
 });
 it('dos cierres durante la inicialización, seguido por un arranque nuevo',async()=>{
  const live=timers(),pending:any[]=[];const hub=new RealtimeHub({realtimeEvent:{aggregate:()=>new Promise(r=>pending.push(r)),findMany:async()=>[]}} as any);
  let closed=false;const a=hub.add({branchId:'main',send:()=>true},()=>closed),b=hub.add({branchId:'main',send:()=>true},()=>closed);closed=true;pending[0]({_max:{id:4n}});(await a)();(await b)();expect(live.size).toBe(0);
  const next=hub.add({branchId:'main',send:()=>true});pending[1]({_max:{id:7n}});const remove=await next;expect(hub.count()).toBe(1);remove();expect(live.size).toBe(0);evidence.hubRestartAfterClosedStartup=true;
 });
 it('20 aperturas simultáneas reservan sólo dos cupos antes del await',async()=>{
  timers();const pending:any[]=[];const c=new RealtimeController({} as any);(c as any).hub={add:()=>new Promise(r=>pending.push(r))};const responses=Array.from({length:20},res);
  const calls=responses.map(r=>c.events(new EventEmitter() as any,r,actor));expect(pending.length).toBe(2);pending.forEach(r=>r(()=>{}));await Promise.all(calls);expect(responses.filter(r=>r.code===429).length).toBe(18);responses.forEach(r=>r.emit('close'));
  evidence.quota={submitted:20,accepted:2,rejected429:18};
 });
 it('cierre durante await elimina listener y no escribe ready',async()=>{
  const live=timers();let resolve:any,removed=0;const c=new RealtimeController({} as any);(c as any).hub={add:()=>new Promise(r=>resolve=r)};const r=res();const p=c.events(new EventEmitter() as any,r,{...actor,sessionId:'closing'});r.emit('close');resolve(()=>removed++);await p;expect(removed).toBe(1);expect(r.writes.length).toBe(0);expect(live.size).toBe(0);evidence.disconnect={cleanupCalls:removed,writes:r.writes.length,timers:live.size};
 });
 it('el ejemplo original chocolate 5lb ya exige resolución manual',()=>{
  const catalog=[{id:'vanilla',sku:'WHEY-V2',barcode:'999',product:{id:'p',name:'Proteína Whey',sku:'WHEY'},attributes:{sabor:'Vainilla',tamaño:'2 lb'}}];const [r]=matchInvoiceLines([{code:'WHEY',description:'Proteína Whey chocolate 5 lb',qty:1,unitCost:50}],catalog);expect(r.variantId).toBeNull();expect(r.note).toBeTruthy();evidence.originalInvoiceConflict=r;
 });
 it('talla S frente a única M: ahora exige selección manual',()=>{
  const catalog=[{id:'legging-m',sku:'LEG-M',barcode:'123',product:{id:'p',name:'Leggings Sculpt',sku:'LEG'},attributes:{talla:'M',color:'Negro'}}];const invoice={code:'LEG',description:'Leggings Sculpt talla S negro',qty:2,unitCost:25};const [r]=matchInvoiceLines([invoice],catalog);expect(r.variantId).toBeNull();expect(r.note).toBeTruthy();evidence.residualInvoiceConflict={invoice,onlyCatalogAttributes:catalog[0].attributes,result:r,expectedVariantId:null,closed:true};
 });
 it('talla L frente a única M por nombre: ahora exige selección manual',()=>{
  const catalog=[{id:'legging-m',sku:'LEG-M',barcode:'123',product:{id:'p',name:'Leggings Sculpt',sku:'LEG'},attributes:{talla:'M',color:'Negro'}}];const [r]=matchInvoiceLines([{description:'Leggings Sculpt talla L negro',qty:1,unitCost:25}],catalog);expect(r.variantId).toBeNull();evidence.residualByName={result:r,expectedVariantId:null,closed:true};
 });
});
