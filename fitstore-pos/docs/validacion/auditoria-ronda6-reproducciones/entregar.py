from pathlib import Path
import hashlib,json,zipfile

base=Path('/workspace/auditoria-ronda6')
project=base/'fitstore-pos'
evidence=project/'docs/validacion'
def read(name):return json.loads((evidence/name).read_text())
integrity=read('auditoria-ronda6-integridad.json')
api=read('auditoria-ronda6-api.json')
legacy=read('auditoria-ronda6-legado.json')
ordered=read('auditoria-ronda6-compras-orden.json')
kit=read('auditoria-ronda6-kit.json')
directed=read('auditoria-ronda6-dirigidas.json')
sse=read('auditoria-ronda6-sse.json')
ui=read('auditoria-ronda6-ui.json')
migration=read('auditoria-ronda6-migracion-despues.json')
cleanup=read('auditoria-ronda6-limpieza.json')
assert integrity['originalFilesIdenticalAfterAudit']==193
assert api['productionValidation']['status']==400
assert api['precision']['legacyReceiveStatus']==400
assert api['precision']['costBefore']==api['precision']['costAfter']
assert legacy['claim']['status']=='pending' and legacy['oldSessionMutation']['status']==403
assert legacy['originalPurchasesAfterRemovingSynthetic']['Compras']==89
assert legacy['originalPurchasesAfterRemovingSynthetic']['Pendiente']==0
assert ordered['reportAfterPayingInvoice']['Pendiente']==0
assert kit['observedDefect'] and kit['saleStatus']==201 and kit['stockBefore']==kit['stockAfter']
assert directed['residualInvoiceConflict']['result']['variantId']=='legging-m'
assert migration['syntheticIncomplete']['total']=='25.00'
assert sse['capsOverHttp']['accepted']==2
assert sse['capsOverHttp']['statuses'].count(429)==6
assert not ui['pageErrors'] and all(not v['horizontalOverflow'] for v in ui['viewports'])
assert all(x['running'] for x in cleanup['originalServices'])
assert 'Tests  38 passed (38)' in (evidence/'auditoria-ronda6-check.txt').read_text()
assert 'Tests  77 passed (77)' in (evidence/'auditoria-ronda6-integracion-compilada.txt').read_text()
assert '8 passed' in (evidence/'auditoria-ronda6-navegador.txt').read_text()
summary={
 'project':'FitStore POS','round':6,'auditDate':'2026-10-05',
 'verdict':'REQUIERE_CORRECCIONES','originalReproductionsCorrected':8,'partiallyCorrected':['R4-07'],
 'officialTests':{'unit':{'passed':38,'total':38},'integrationCompiled':{'passed':77,'total':77},'browser':{'passed':8,'total':8},'types':'passed','lint':'passed','build':'passed'},
 'independentObservations':{'vitest':{'passed':7,'total':7,'correctionControls':5,'defectReproductions':2},'screenshots':8,'browserJsErrors':0,'httpSseBurst':{'submitted':8,'accepted':2,'rejected429':6}},
 'openFindings':[
  {'id':'R6-01','priority':'P1','title':'Venta de combo redondea el consumo derivado a cero','evidence':'auditoria-ronda6-kit.json','ordinaryApiReproduction':True},
  {'id':'R6-02','priority':'P2','continues':'R4-07','title':'Talla explícita incompatible se asigna si no está en el vocabulario del catálogo','evidence':'auditoria-ronda6-dirigidas.json','ordinaryFunctionReproduction':True},
  {'id':'R6-03','priority':'P2','title':'Migración guarda suma parcial de recepción histórica incompleta','evidence':'auditoria-ronda6-migracion-despues.json','syntheticSqlFixture':True,'observedFromNormalR3Api':False}
 ],
 'migration':{'origin':'R3 original API and Prisma migration history','originalMigrationCount':8,'finalMigrationCount':11,'idempotent':migration['idempotent'],'validStandaloneReceiptTotal':34,'validOrderedReceiptTotal':55,'originalPurchasesPaidBalance':0},
 'integrity':integrity,
 'implementationModified':False,
 'limitations':['PostgreSQL 18.4 local; Compose/PostgreSQL 17 no ejecutado','Anthropic con SDK y respuestas simuladas; sin llamadas reales','Sin pruebas de hardware, carga de producción o múltiples sucursales','Suite completa ejecutada sobre API compilada; tsx sólo validación dirigida'],
 'cleanup':cleanup,
}
(evidence/'auditoria-ronda6.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')

files=[project/'docs/AUDITORIA_RONDA6.md',base/'MENSAJE_PARA_CLAUDE_AUDITORIA_RONDA6.txt',base/'LEEME_AUDITORIA_RONDA6.txt',base/'source-baseline.json']
files.extend(p for p in evidence.rglob('*') if p.is_file() and p.relative_to(evidence).parts[0].startswith('auditoria-ronda6'))
files.extend(base.glob('*.mjs'))
files.extend(p for p in (base/'pruebas').rglob('*') if p.is_file())
files.append(Path(__file__))
files=list(sorted(set(files)))
assert not any(p.suffix=='.env' or '.private.' in p.name or 'node_modules' in p.parts for p in files)
manifest={'audit':'FitStore POS R6','uploadedSourceSha256':integrity['sha256'],'files':[{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
manifest_path=base/'MANIFIESTO_AUDITORIA_RONDA6.json'
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bundle=base/'auditoria-fitstore-ronda6.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[manifest_path]:z.write(p,p.relative_to(base))
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 for item in manifest['files']:
  assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
print(json.dumps({'bundle':str(bundle),'bytes':bundle.stat().st_size,'files':len(files)+1,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'openFindings':3,'originalFilesUnchanged':193},ensure_ascii=False,indent=2))
