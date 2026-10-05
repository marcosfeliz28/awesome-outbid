import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='/workspace/auditoria-ronda7/fitstore-pos/apps/web';
const req=createRequire(root+'/package.json');
const {preview}=await import(pathToFileURL(req.resolve('vite')).href);
await preview({root,configFile:root+'/vite.config.ts',preview:{host:'127.0.0.1',port:process.argv.includes('import')?4199:4197,strictPort:true,proxy:{'/api':{target:process.argv.includes('import')?'http://127.0.0.1:3020':'http://127.0.0.1:3017',changeOrigin:true}}}});
console.log('Preview de auditoría R6: 4197 → API 3017.');
