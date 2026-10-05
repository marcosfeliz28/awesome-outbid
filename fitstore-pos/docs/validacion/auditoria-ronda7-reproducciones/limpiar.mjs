import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const base='/workspace/auditoria-ronda7';
const rows=spawnSync('ps',['-eo','pid=,ppid=,args='],{encoding:'utf8'}).stdout.trim().split('\n').map(l=>{const m=l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],parent:+m[2],args:m[3]}:null;}).filter(Boolean);
const targets=new Set(),roots=[];
for(const file of ['api.pid','api-upgrade.pid','api-import.pid','preview-import.pid','preview.pid']){
 const pid=Number(readFileSync(base+'/'+file,'utf8')),row=rows.find(r=>r.pid===pid);
 if(row&&/node .*\b(runtime|preview)\.mjs\b/.test(row.args)){roots.push(pid);targets.add(pid);}
}
let more=true;while(more){more=false;for(const r of rows)if(targets.has(r.parent)&&!targets.has(r.pid)){targets.add(r.pid);more=true;}}
const stopped=[];for(const pid of [...targets].reverse()){try{process.kill(pid,'SIGTERM');stopped.push(pid);}catch(e){if(e.code!=='ESRCH')throw e;}}
const original=[2258,5998,6058].map(pid=>{try{process.kill(pid,0);return {pid,running:true};}catch{return {pid,running:false};}});
writeFileSync(base+'/fitstore-pos/docs/validacion/auditoria-ronda7-limpieza.json',JSON.stringify({auditRoots:roots,signalled:stopped,originalServices:original},null,2));
console.log('Detenidos '+stopped.length+' procesos exclusivos de auditoría; servicios originales conservados: '+original.every(x=>x.running));
