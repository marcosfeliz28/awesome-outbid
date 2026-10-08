import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='/workspace/auditoria-ronda7/fitstore-pos',req=createRequire(root+'/package.json'),{chromium,expect}=req('@playwright/test');
const proof=JSON.parse(readFileSync(root+'/docs/validacion/auditoria-ronda7-importador.json','utf8'));
const out=root+'/docs/validacion/auditoria-ronda7-capturas';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),evidence={pageErrors:[],screens:[],searches:[],dataScope:'Catálogo de nombres del fixture; stock y valores sintéticos de QA, no Excel real.'};page.on('pageerror',e=>evidence.pageErrors.push(e.message));
async function ready(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});}
async function capture(name){await ready();await page.screenshot({path:out+'/'+name+'.png',fullPage:false});evidence.screens.push({name:name+'.png',...(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1})))});}
try{
 await page.goto('http://127.0.0.1:4199');await page.getByLabel('Correo electrónico').fill('admin@fitstore.demo');await page.getByLabel('Contraseña',{exact:true}).fill('FitStore-Demo-2026!');const terminal=page.waitForResponse(r=>r.url().endsWith('/api/terminals/register'));await page.getByRole('button',{name:'Entrar a mi tienda'}).click();await terminal;
 await page.getByRole('button',{name:'Punto de venta',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Punto de venta'})).toBeVisible();await expect(page.locator('.product-card').first()).toBeVisible();
 evidence.initialRenderedCards=await page.locator('.product-card').count();assert.ok(evidence.initialRenderedCards<=120);const search=page.getByRole('textbox',{name:'Buscar productos'});
 for(const query of ['iso100 vanilla','moira 275n','cinturilla 2xs','proteina whey']){await search.fill(query);await ready();const cards=page.locator('.product-card');evidence.searches.push({query,cards:await cards.count(),names:await cards.locator('h3').allTextContents()});}
 await search.fill(proof.codeCollision.code);const started=performance.now();await search.press('Enter');await expect(page.locator('.cart-item-detail strong')).toHaveText(proof.codeCollision.existing.productName);const selected=await page.locator('.cart-item-detail strong').innerText();
 evidence.codeCollision={code:proof.codeCollision.code,expectedProduct:proof.codeCollision.imported.productName,actualProduct:selected,selectedWrongProduct:selected!==proof.codeCollision.imported.productName,latencyToCartMs:Math.round(performance.now()-started)};assert.equal(evidence.codeCollision.selectedWrongProduct,true);
 await capture('pc-codigo-selecciona-otro-producto');
 await page.setViewportSize({width:390,height:844});await search.fill('moira 275n');await ready();await capture('cel-catalogo-moira');await page.locator('.cart-panel').scrollIntoViewIfNeeded();await capture('cel-carrito-codigo-ambiguo');
 assert.deepEqual(evidence.pageErrors,[]);assert.ok(evidence.screens.every(s=>!s.horizontalOverflow));
}finally{await browser.close();writeFileSync(root+'/docs/validacion/auditoria-ronda7-ui-importador.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
