import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='/workspace/auditoria-ronda8',rows=spawnSync('ps',['-eo','pid=,ppid=,args='],{encoding:'utf8'}).stdout.trim().split('\n').map(l=>{const m=l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],parent:+m[2],args:m[3]}:null;}).filter(Boolean);
const roots=[55384,55385,55387,55388,56394],targets=new Set();
for(const pid of roots){const row=rows.find(r=>r.pid===pid);if(row&&/^node \.\.\/(runtime|preview)\.mjs\b/.test(row.args))targets.add(pid);}
let more=true;while(more){more=false;for(const row of rows)if(targets.has(row.parent)&&!targets.has(row.pid)){targets.add(row.pid);more=true;}}
const stopped=[];for(const pid of [...targets].reverse()){try{process.kill(pid,'SIGTERM');stopped.push(pid);}catch(e){if(e.code!=='ESRCH')throw e;}}
await new Promise(r=>setTimeout(r,500));
const ports=[];for(const port of [3038,3040,3042,3043,4208,4210]){let responding=false;try{await fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(500)});responding=true;}catch{}ports.push({port,responding});}assert.ok(ports.every(p=>!p.responding));
const original=[2258,5998,6058].map(pid=>{try{process.kill(pid,0);return {pid,running:true};}catch{return {pid,running:false};}});assert.ok(original.every(p=>p.running));
writeFileSync(base+'/fitstore-pos/docs/validacion/auditoria-ronda8-limpieza.json',JSON.stringify({auditRoots:roots,signalled:stopped,auditPorts:ports,originalServices:original},null,2));console.log('Servicios temporales detenidos y servicios originales conservados.');
