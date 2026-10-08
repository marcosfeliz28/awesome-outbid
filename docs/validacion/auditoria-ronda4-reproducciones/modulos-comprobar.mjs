import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
function diagnose(root){
 const req=createRequire(root+'/apps/api/package.json'),{ZodError}=req('zod'),{saleSchema}=req('@fitstore/shared');
 const error=saleSchema.safeParse({}).error;
 return{errorName:error.name,isCommonJsZodError:error instanceof ZodError,issueCount:error.issues.length,firstIssueMessage:error.issues[0].message,apiModule:req('./package.json').name,sharedPackageType:req('../../packages/shared/package.json').type};
}
const r4=diagnose('/workspace/auditoria-ronda4/fitstore-pos'),r3=diagnose('/workspace/fitstore-pos');
const result={r4,r3,interpretation:'El esquema compartido ESM lanza una clase distinta del ZodError CommonJS usado por la API compilada. El patrón ya existe en R3.'};
writeFileSync('/workspace/auditoria-ronda4/fitstore-pos/docs/validacion/auditoria-ronda4-modulos.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
