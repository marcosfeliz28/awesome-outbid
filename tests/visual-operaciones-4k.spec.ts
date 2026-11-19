/** Local synthetic API only. No credentials, live data, network writes or backend certification. */
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const areas = ["customers", "expenses", "purchases"] as const;
for (const area of areas) for (const width of [1440,390]) for (const theme of ["light","dark"]) {
  test(`${area} ${width} ${theme}`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.addInitScript((theme) => {localStorage.setItem("fitstore-theme",theme);localStorage.setItem("norexos-overview-language","es");},theme);
    const writes:string[]=[];
    const user={id:"qa-operations",name:"OPERACIONES DEMO",role:"admin",branchId:"qa",permissions:["*"]};
    await page.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url()),path=url.pathname;
      if(!["127.0.0.1","localhost"].includes(url.hostname)) return route.abort();
      if(!path.startsWith("/api/")) return route.continue();
      let body:unknown=[];
      if(path==="/api/auth/refresh") body={user,accessToken:"qa-local-not-a-credential"};
      else if(path==="/api/terminals/register") body={id:"qa-terminal",name:"DEMO",approved:true};
      else if(!["GET","HEAD"].includes(req.method())) {writes.push(path);return route.fulfill({status:405,body:"DEMO writes blocked"});}
      else if(path==="/api/settings") body={currency:"DOP",taxIncluded:true};
      else if(path==="/api/customers") body=[{id:"demo-customer",name:"Cliente de demostración con nombre largo",phone:"0000000000",email:"demo@example.invalid",legalId:"DEMO-NO-REAL",purchases:12,totalSpent:"98765432.17",lastPurchase:"2026-11-18T12:00:00Z",notes:"",creditLimit:500}];
      else if(path==="/api/expense-categories") body=[{id:"qa-cat",name:"Categoría de demostración extensa",monthlyBudget:"98765432.17"}];
      else if(path==="/api/expenses") body=[{id:"qa-expense",description:"Gasto exclusivamente de demostración",amount:"98765432.17",date:new Date().toISOString(),categoryId:"qa-cat",category:{name:"Categoría de demostración extensa"},method:"transfer",recurring:false}];
      else if(path==="/api/suppliers") body=[{id:"qa-supplier",name:"Proveedor de demostración extenso",legalId:"DEMO",phone:"0000000000",email:"demo@example.invalid",paymentTermsDays:30,leadTimeDays:7}];
      else if(path==="/api/purchase-orders") body=[{id:"qa-order",number:"OC-DEMO-001",supplierId:"qa-supplier",createdAt:"2026-11-18T12:00:00Z",items:[],total:"98765432.17",status:"ordered"}];
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    });
    await page.goto(`/#${area}`);
    const section=page.locator(`.operations-${area}`); await expect(section).toBeVisible();
    await expect(section).toContainText("98,765,432.17");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    // Every monetary text must remain readable as a whole, not clipped by its cell.
    const numbers=await section.evaluate(root=>{const results:{lines:number;inside:boolean}[]=[];const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=w.nextNode())){const str=node.textContent||"",at=str.indexOf("98,765,432.17");if(at<0)continue;const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+12);const rects=Array.from(range.getClientRects());const parent=node.parentElement!.getBoundingClientRect();results.push({lines:new Set(rects.map(r=>Math.round(r.top))).size,inside:rects.every(r=>r.left>=parent.left-1&&r.right<=parent.right+1)});}return results;});
    expect(numbers.length).toBeGreaterThan(0);for(const n of numbers){expect(n.lines).toBe(1);expect(n.inside).toBe(true);}
    await mkdir("test-results/operations-4k",{recursive:true});
    await page.screenshot({path:`test-results/operations-4k/${area}-${width}-${theme}.png`,fullPage:true});
    const action=area==="customers"?"Editar":area==="expenses"?"Anular":"Proveedor";
    await section.getByRole("button",{name:action,exact:true}).first().click();
    const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
    await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();
    await expect(dialog).toHaveCount(0);await expect(section).toBeVisible();expect(writes).toEqual([]);
  });
}
