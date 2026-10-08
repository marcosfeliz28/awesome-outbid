import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const root='/workspace/auditoria-ronda4/fitstore-pos',req=createRequire(root+'/package.json');
const {chromium,expect}=req('@playwright/test');
const out=root+'/docs/validacion/auditoria-ronda4-capturas';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results={viewports:[],screenshots:[],pageErrors:[]};
async function login(email,width=390){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
 page.on('pageerror',e=>results.pageErrors.push(e.message));await page.goto('http://127.0.0.1:4183');
 await page.getByLabel('Correo electrónico').fill(email);await page.getByLabel('Contraseña',{exact:true}).fill('FitStore-Demo-2026!');
 const logged=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
 const terminal=page.waitForResponse(r=>r.url().endsWith('/api/terminals/register'));
 await page.getByRole('button',{name:'Entrar a mi tienda'}).click();
 const token=(await(await logged).json()).accessToken;await terminal;
 await expect(page.locator('.main-content')).toBeVisible();return{page,context,token};
}
async function nav(page,label){
 const menu=page.getByRole('button',{name:'Abrir menú'});if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name:label,exact:true}).first().click();
 await expect(page.locator('.main-content .loading')).toHaveCount(0);await expect(page.locator('.main-content h1')).toBeVisible();
}
async function capture(page,name){
 await page.evaluate(async()=>{
   await document.fonts.ready;
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
 });
 await page.screenshot({path:out+'/'+name+'.png',fullPage:false});
 const info=await page.evaluate(()=>{
   const tabs=document.querySelector('.tabs.outside'),rect=tabs?.getBoundingClientRect();
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,tabs:tabs?{left:rect.left,right:rect.right,clientWidth:tabs.clientWidth,scrollWidth:tabs.scrollWidth,overflowX:getComputedStyle(tabs).overflowX}:null};
 });
 results.viewports.push({screen:name,...info});results.screenshots.push(name+'.png');
}
try{
 const owner=await login('admin@fitstore.demo');
 await nav(owner.page,'Mercancía');
 await capture(owner.page,'cel-mercancia-entrada');
 await owner.page.getByRole('tab',{name:'SALIDA',exact:true}).click();
 await capture(owner.page,'cel-mercancia-salida');
 await nav(owner.page,'Configuración');await owner.page.getByRole('button',{name:'Equipos',exact:true}).click();
 await expect(owner.page.getByRole('heading',{name:'Este equipo',exact:true})).toBeVisible();
 await capture(owner.page,'cel-equipos');
 await owner.page.setViewportSize({width:320,height:844});await capture(owner.page,'cel-equipos-320');
 await owner.page.setViewportSize({width:1440,height:1000});await capture(owner.page,'pc-equipos');
 const warehouse=await login('almacen@fitstore.demo');
 await expect(warehouse.page.getByText('Este equipo necesita aprobación',{exact:true})).toBeVisible();
 await capture(warehouse.page,'cel-equipo-pendiente');
 await warehouse.page.getByLabel('PIN del gerente').fill('234567');
 await warehouse.page.getByRole('button',{name:'Aprobar este equipo',exact:true}).click();
 await expect(warehouse.page.getByText('Este equipo necesita aprobación',{exact:true})).toHaveCount(0);
 results.approvalWithPinRemovedPendingNotice=true;
 const headers={Authorization:'Bearer '+owner.token};
 const sessions=await(await owner.page.request.get('http://127.0.0.1:4183/api/cash-sessions',{headers})).json();
 const me=await(await owner.page.request.get('http://127.0.0.1:4183/api/auth/me',{headers})).json();
 for(const s of sessions.filter(s=>!s.closedAt&&s.userId===me.id)){
   await owner.page.request.post('http://127.0.0.1:4183/api/cash-sessions/'+s.id+'/close',{headers,data:{countedCash:Math.max(0,s.expected.cash),countedCard:Math.max(0,s.expected.card),countedTransfer:Math.max(0,s.expected.transfer),notes:'Auditoría UI aislada'}});
 }
 const opened=await owner.page.request.post('http://127.0.0.1:4183/api/cash-sessions/open',{headers,data:{openingAmount:100}});
 if(!opened.ok())throw new Error('Abrir caja UI: '+await opened.text());
 const cash=await opened.json();
 const second=await login('admin@fitstore.demo',1440);await nav(second.page,'Punto de venta');
 await expect(second.page.locator('.cash-elsewhere')).toBeVisible();
 await capture(second.page,'pc-caja-otro-equipo');
 await second.page.setViewportSize({width:390,height:844});
 await second.page.locator('.cash-elsewhere').scrollIntoViewIfNeeded();
 await expect(second.page.locator('.cash-elsewhere')).toBeInViewport();
 await capture(second.page,'cel-caja-otro-equipo');
 results.cashWarningVisible=true;
 await owner.page.request.post('http://127.0.0.1:4183/api/cash-sessions/'+cash.id+'/close',{headers,data:{countedCash:100,countedCard:0,countedTransfer:0,notes:'Cierre auditoría UI'}});
}finally{
 await browser.close();writeFileSync(root+'/docs/validacion/auditoria-ronda4-ui.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
}
