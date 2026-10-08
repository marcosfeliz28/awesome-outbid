import pg from './fitstore-pos/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const base='http://127.0.0.1:3004/api',fixture=JSON.parse(readFileSync('/workspace/auditoria-ronda4/legacy-fixture.json','utf8'));
const url='postgresql://fitstore:fitstore_local@127.0.0.1:5434/fitstore_audit_r4_upgrade';
const result={},controllers=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,data,token){const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.214',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const out=await r.json();if(!r.ok)throw new Error(path+' '+r.status+' '+JSON.stringify(out));return out;}
const login=()=>req('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'});
const token=(await login()).accessToken;
const locker=new pg.Client({connectionString:url}),observer=new pg.Client({connectionString:url});
await locker.connect();await observer.connect();
try{
 // Retardo controlado de PostgreSQL: todas las altas iniciales esperan el MAX.
 await locker.query('BEGIN');await locker.query('LOCK TABLE "RealtimeEvent" IN ACCESS EXCLUSIVE MODE');
 const opens=Array.from({length:8},()=>{const controller=new AbortController();controllers.push(controller);return fetch(base+'/events',{headers:{Authorization:'Bearer '+token},signal:controller.signal});});
 let blocked=0;
 for(let i=0;i<25;i++){
   await delay(100);
   blocked=Number((await observer.query("SELECT count(*) FROM pg_stat_activity WHERE datname='fitstore_audit_r4_upgrade' AND wait_event_type='Lock' AND query LIKE '%RealtimeEvent%'")).rows[0].count);
   if(blocked>=8)break;
 }
 await locker.query('COMMIT');
 const responses=await Promise.all(opens);
 result.capsOverHttp={controlledStartupDelay:true,pendingAggregateQueries:blocked,sessionLimit:2,userLimit:6,statuses:responses.map(r=>r.status),accepted:responses.filter(r=>r.status===200).length};
 controllers.forEach(c=>c.abort());await delay(200);
 const streams=[];
 for(let i=0;i<3;i++){
   const actor=(await login()).accessToken,id=randomUUID();
   await req('/terminals/register',{id,name:'Auditoría SSE '+i,secret:'secreto-qa-'+randomUUID()},actor);
   const controller=new AbortController();controllers.push(controller);
   const response=await fetch(base+'/events',{headers:{Authorization:'Bearer '+actor},signal:controller.signal});
   if(!response.ok)throw new Error('SSE '+response.status);
   let onReady,onStock,buffer='';const ready=new Promise(r=>onReady=r),stock=new Promise(r=>onStock=r);
   const reader=response.body.getReader();
   void(async()=>{try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);while(buffer.includes('\n\n')){const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(frame.includes('event: ready'))onReady();if(frame.includes('event: stock.changed')){const raw=frame.split('\n').find(l=>l.startsWith('data: '));if(raw){const event=JSON.parse(raw.slice(6));if(event.variantId===fixture.variantId)onStock({receivedAt:performance.now(),event});}}}}}catch{}})();
   await ready;streams.push({token:actor,stock});
 }
 const start=performance.now();
 await req('/inventory/adjustments',{variantId:fixture.variantId,qty:1,reason:'Auditoría SSE tres sesiones independientes'},streams[0].token);
 const notifications=await Promise.all(streams.map(s=>s.stock));
 result.threeSessions={transport:'HTTP SSE (sin interfaz de navegador)',latencyFromRequestMs:notifications.map(n=>Math.round(n.receivedAt-start)),events:notifications.map(n=>n.event)};
}finally{
 controllers.forEach(c=>c.abort());await locker.query('ROLLBACK').catch(()=>{});await locker.end();await observer.end();
 writeFileSync('/workspace/auditoria-ronda4/fitstore-pos/docs/validacion/auditoria-ronda4-sse.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}
