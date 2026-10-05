import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='/workspace/auditoria-ronda4/fitstore-pos/apps/web';
const req=createRequire(root+'/package.json');
const {preview}=await import(pathToFileURL(req.resolve('vite')).href);
await preview({root,configFile:root+'/vite.config.ts',preview:{host:'127.0.0.1',port:4183,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3002',changeOrigin:true}}}});
console.log('PWA compilada R4 en http://127.0.0.1:4183; API aislada 3002.');
