import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const areas=['month-report','settings','assistant','customers','expenses','purchases','merchandise','void-requests','transfer-reconciliation','courier-payouts','promotions','reports','alerts','incentives','gv'];
const selectors:Record<string,string>={customers:'.operations-customers',expenses:'.operations-expenses',purchases:'.operations-purchases',merchandise:'.goods-header','void-requests':'.operational-aux-void','transfer-reconciliation':'.operational-aux-transfer','courier-payouts':'.operational-aux-courier',settings:'[data-premium-area=configuration]'};
const requested=process.env.QA_AREAS?.split(',');
if(requested?.some(a=>!areas.includes(a)))throw new Error('Unknown QA_AREAS entry');
const arrays=['/customers','/expenses','/expense-categories','/suppliers','/purchase-orders','/products','/categories','/branches','/warehouses','/promotions','/promotions/clearance-candidates','/alerts','/incentives/rates','/gv/courses','/users','/roles','/audit-log','/void-requests','/payments/pending-transfers','/courier/pending','/courier/payouts','/reportes','/merchandise/operations','/goods-receipts','/terminals'];
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
for(const area of (requested||areas))for(const width of [1440,390])for(const theme of ['light','dark'])for(const lang of ['es','en']){
 test(`${area}-${width}-${theme}-${lang}`,async({page},info)=>{
  const errors:string[]=[],unknown:string[]=[],writes:string[]=[],external:string[]=[];
  const selector=selectors[area]||`[data-premium-area="${area}"]`;
  const name=info.title,dir='qa-evidence/captures';await mkdir(dir,{recursive:true});
  await page.setViewportSize({width,height:1000});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({theme,lang})=>{localStorage.setItem('fitstore-theme',theme);localStorage.setItem('norexos-overview-language',lang);},{theme,lang});
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),p=u.pathname.replace(/^\/api/,'');
   if(u.origin!=='http://127.0.0.1:5215'){external.push(u.origin);return route.abort();}
   if(!u.pathname.startsWith('/api/'))return route.continue();
   const fulfill=(json:unknown,status=200)=>route.fulfill({status,json});
   if(p==='/auth/refresh')return fulfill({user:{id:'qa',name:'PERSONA DEMO',role:'admin',branchId:'qa',permissions:['*']},accessToken:'synthetic-not-a-credential'});
   if(p==='/terminals/register')return fulfill({id:'qa',name:'DEMO',approved:true});
   if(!['GET','HEAD'].includes(r.method())){writes.push(p);return fulfill({message:'QA writes blocked'},405);}
   if(p==='/events')return route.fulfill({status:200,contentType:'text/event-stream',body:': synthetic heartbeat\n\n'});
   if(arrays.includes(p))return fulfill([]);
   if(p==='/merchandise/options')return fulfill({aiEnabled:false});
   if(p==='/notifications/status')return fulfill({enabled:false,pending:0,sent:0,failed:0,lastError:null});
   if(p==='/settings')return fulfill({name:'NEGOCIO DEMO',currency:'DOP',taxIncluded:true,receiptWidth:80,sellerDiscountLimit:5,idleDays:30,expiryDays:60,lowMargin:15,returnDays:7,allowCreditSales:false});
   if(p==='/assistant/status')return fulfill({enabled:true,canUse:true,limit:10,remaining:10});
   if(p==='/backups/status')return fulfill({configured:false,missing:['DEMO'],redirectUri:'http://localhost/demo'});
   if(p==='/ai/usage')return fulfill({from:'2026-11-01',to:'2026-11-18',total:null,byFeature:[],byUser:[],byDay:[]});
   if(p==='/survey/summary')return fulfill({responses:0,questions:[]});
   if(p==='/incentives')return fulfill({month:'2026-11',label:'DEMO',openPeriod:'2026-11',closed:null,rows:[]});
   if(p==='/reports/sales')return fulfill({rows:[],total:0,limit:20});
   if(p==='/dashboard/breakdown')return fulfill({revenue:0,profit:0,margin:0,averagePerDay:0,days:18,averageTicket:0,invoices:0,units:0,categories:[],payments:[],top:[],topByCategory:[]});
   unknown.push(p);return fulfill({message:'Unmodelled QA endpoint'},501);
  });
  let status='failed',measurements:unknown=null,motion:unknown=null;
  try{
   const assistantReady=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/assistant/status');
   await page.goto('/#'+(area==='assistant'?'customers':area));await expect(page.locator('.main-content')).toBeVisible();
   await assistantReady;
   if(area==='assistant'){await expect(page.locator('.nav-item').filter({hasText:lang==='en'?'Ask Norexos':'Preguntar a Norexos'})).toHaveCount(1);await page.evaluate(()=>{location.hash='assistant'});}
   await page.waitForLoadState('networkidle');await page.waitForTimeout(500);
   await expect.poll(()=>page.evaluate(()=>location.hash.split('?')[0])).toBe('#'+area);
   await expect(page.locator(selector)).toBeVisible();
   expect(errors).toEqual([]);expect(unknown).toEqual([]);expect(writes).toEqual([]);
   await expect(page.locator('.main-content .loading')).toHaveCount(0);
   measurements=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
   expect((measurements as {scrollWidth:number}).scrollWidth).toBeLessThanOrEqual(width+1);
   expect(writes).toEqual([]);expect(unknown).toEqual([]);
   const control=page.locator(selector).getByRole('button').first();
   if(await control.count()){
    await control.scrollIntoViewIfNeeded();
    const read=()=>control.evaluate(el=>{const s=getComputedStyle(el);return {transform:s.transform,transition:s.transition,animation:s.animation}});
    const before=await read();await control.hover();await page.waitForTimeout(180);const hover=await read();
    await page.screenshot({path:`${dir}/${name}-hover.png`});
    await page.emulateMedia({reducedMotion:'reduce'});const reduced=await read();
    motion={before,hover,reduced,note:'one first-button sample; not all transitions or full interaction'};
    await page.emulateMedia({reducedMotion:'no-preference'});
   }
   if(area==='settings'){
    await page.getByRole('button',{name:lang==='en'?'Edit settings':'Editar configuración',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:lang==='en'?'Business settings':'Configuración del negocio',exact:true});
    await expect(dialog).toBeVisible();
    await page.screenshot({path:dir+'/'+name+'-dialog.png',fullPage:true});
    await dialog.getByRole('button',{name:lang==='en'?'Cancel':'Cancelar',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([]);expect(unknown).toEqual([]);expect(errors).toEqual([]);
   }
   status='passed';
  }finally{
   await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
   await writeFile(`${dir}/${name}.json`,JSON.stringify({sha,tree,expectedSelector:selector,finalUrl:page.url(),expectedSourceSha:'0d1e00ccfedf2db6e5e082a5f1c40a84198dc49c',sourceTree:execFileSync('git',['rev-parse','HEAD:apps/web/src'],{encoding:'utf8'}).trim(),area,width,height:1000,theme,lang,role:'synthetic-admin',data:'empty-state fixtures; no real data',status,errors,unknown,writes,external,measurements,motion,scope:'root page only; no backend/animation/permission certification'},null,2));
  }
 });
}
