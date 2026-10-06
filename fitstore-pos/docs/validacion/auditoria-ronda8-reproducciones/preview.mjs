import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='/workspace/auditoria-ronda8/fitstore-pos/apps/web';
const req=createRequire(root+'/package.json');
const {preview}=await import(pathToFileURL(req.resolve('vite')).href);
const importing=process.argv.includes('import');
await preview({root,configFile:root+'/vite.config.ts',preview:{host:'127.0.0.1',port:importing?4210:4208,strictPort:true,proxy:{'/api':{target:importing?'http://127.0.0.1:3040':'http://127.0.0.1:3038',changeOrigin:true}}}});
console.log('Preview aislado R8 listo.');
