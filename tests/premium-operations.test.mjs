import { URL } from "node:url";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) => readFileSync(new URL('../apps/web/src/' + name, import.meta.url), 'utf8');
const management = read('Management.tsx');
const css = read('premiumOperations.css');

test('six operational views have isolated presentation boundaries', () => {
 for (const area of ['promotions','alerts','configuration']) assert.ok(management.includes(`<PremiumWorkspace area="${area}">`));
 for (const [file,area] of [['Gv.tsx','gv'],['Incentives.tsx','incentives'],['AssistantPanel.tsx','assistant']]) assert.ok(read(file).includes(`<PremiumWorkspace area="${area}">`));
});
test('reference imagery is not embedded as a screen and motion is optional', () => {
 assert.doesNotMatch(css,/url\(/);
 assert.match(css,/prefers-reduced-motion:\s*reduce/);
 assert.match(css,/prefers-reduced-motion:\s*no-preference/);
 assert.match(css,/max-width:\s*600px/);
 assert.match(css,/overflow-x:\s*auto/);
});
test('assistant keeps explicit submit, single-flight guard, errors and announced reply', () => {
 const s=read('AssistantPanel.tsx');
 assert.match(s,/if \(!question.trim\(\) \|\| busy\) return/);
 assert.match(s,/post<Reply>\("\/assistant\/ask", \{ question \}\)/);
 assert.match(s,/aria-live="polite"/);
 assert.match(s,/"Your question" : "Tu pregunta"/);
 assert.match(s,/role="alert"/);
 assert.match(s,/disabled=\{busy \|\| !question.trim\(\)\}/);
});
test('configuration admin gate and GV report permission remain intact', () => {
 assert.match(management,/if \(!can\(user.permissions, "\*"\)\)/);
 assert.match(read('Gv.tsx'),/can\(user.permissions, "gv:reports"\)/);
 assert.match(read('Incentives.tsx'),/\/incentives/);
 assert.match(management,/a.type !== "sale_void_request"/);
});

test('review fixes mobile alert grid and native split layouts', () => {
 assert.match(css,/\.alert-row\s*\{\s*display:\s*grid/);
 assert.match(css,/margin-left:\s*0/);
 assert.match(css,/\.button\.primary/);
 assert.match(management,/className="alerts-workspace-layout"/);
 assert.match(management,/className="settings-workspace-layout"/);
 assert.match(read('Gv.tsx'),/className="gv-workspace-layout"/);
 assert.match(read('AssistantPanel.tsx'),/en \? "Answer" : "Respuesta"/);
 assert.match(read('AssistantPanel.tsx'),/className="assistant-sources"/);
});

test('primary CTA decoration cannot leak to other workspaces', () => {
 assert.doesNotMatch(css, /\.norexos-premium-workspace\s+\.button\.primary/);
 assert.match(css, /data-premium-area="configuration"[^}]+\.button\.primary/s);
});

test('operational labels use saved language without translating record payloads', () => {
 const labels = read('operationsLanguage.ts');
 assert.match(labels,/useLanguage\(\) === "en"/);
 assert.match(labels,/"Cerrar mes": "Close month"/);
 assert.match(management,/const ot = useOperationsText\(\)/);
 assert.match(management,/key: "allowCreditSales"/);
 assert.match(management,/currency: "DOP"/);
 assert.match(read('Incentives.tsx'),/post\("\/incentives\/close", \{ month \}\)/);
});

test('localized roots pass language to query, table and modal states', () => {
 for (const name of ['Promotions','Alerts','Configuration']) {
  const start=management.indexOf('export function '+name+'(');
  const end=management.indexOf('\nexport function ',start+1);
  const section=management.slice(start,end<0?undefined:end);
  assert.match(section,/<QueryState english=\{en\}/);
  if(name!=='Alerts') assert.match(section,/<FormModal english=\{en\}/);
 }
 assert.match(read('Incentives.tsx'),/<QueryState english=\{en\}/);
});

test('visual QA fixes missing photo, English expiry and dark alert action contrast', () => {
 assert.match(management,/src=\{c.imageUrl \|\| "\/products\/accessories.svg"\}/);
 assert.match(management,/handleCatalogImageError\(event.currentTarget\)/);
 assert.match(management,/days to expiry/);
 assert.match(management,/rows.length === 1 \? "alerta" : "alertas"/);
 assert.match(css,/\.alert-row \.text-link\s*\{\s*color: var\(--premium-text\)/);
});

test('alert and configuration headings follow language and dates retain existing formatter', () => {
 for (const name of ['Alerts','Configuration']) {
  const start=management.indexOf('export function '+name+'(');
  const end=management.indexOf('\nexport function ',start+1);
  const section=management.slice(start,end<0?undefined:end);
  assert.match(section,/eyebrow=\{en \? "YOUR BUSINESS, WITH CLARITY"/);
 }
 assert.match(management,/dateLabel\(a.createdAt, en \? "en-US" : "es-DO"\)/);
 assert.match(management,/dateLabel\(selected.createdAt, en \? "en-US" : "es-DO"\)/);
});
