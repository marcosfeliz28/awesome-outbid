for(const port of [3038,3040,3043]){
 let found=false;
 for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/api/auth/me');if(r.status<500){found=true;console.log('API '+port+' disponible ('+r.status+').');break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!found)throw new Error('API '+port+' no disponible');
}
