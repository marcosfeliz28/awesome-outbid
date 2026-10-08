for(const port of [3017,3020,3022]){
 let ready=false;
 for(let i=0;i<35;i++){
  try{const r=await fetch('http://127.0.0.1:'+port+'/api/auth/me',{signal:AbortSignal.timeout(1000)});if(r.status<500){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 if(!ready)throw new Error('API no disponible en '+port);
 console.log('API lista: '+port);
}
