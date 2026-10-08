import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:3009/api';
async function req(path,data,token){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.226',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
const logged=await req('/auth/login',{email:'admin@fitstore.demo',password:'FitStore-Demo-2026!'});assert.equal(logged.status,201);const token=logged.body.accessToken;
const registered=await req('/terminals/register',{id:randomUUID(),name:'Auditoría de validación en tsx',secret:'dev-qa-'+randomUUID()},token);assert.equal(registered.status,201);
const result=await req('/sales',{},token);assert.equal(result.status,400);assert.match(result.body.message,/Revisa los campos/);
writeFileSync('/workspace/auditoria-ronda6/fitstore-pos/docs/validacion/auditoria-ronda6-desarrollo-validacion.json',JSON.stringify(result,null,2));console.log('POST /sales {} en tsx: 400, validación en español.');
