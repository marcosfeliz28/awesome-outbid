from pathlib import Path
import hashlib,json,zipfile

base=Path('/workspace/auditoria-ronda7');project=base/'fitstore-pos';evidence=project/'docs/validacion'
def read(name):return json.loads((evidence/name).read_text())
integrity=read('auditoria-ronda7-integridad.json');kit=read('auditoria-ronda7-kit.json');legacy=read('auditoria-ronda7-legado.json');migration=read('auditoria-ronda7-migracion-r3.json');upgrade=read('auditoria-ronda7-upgrade6-despues.json');importer=read('auditoria-ronda7-importador.json');ui=read('auditoria-ronda7-ui-importador.json');directed=read('auditoria-ronda7-dirigidas.json');cleanup=read('auditoria-ronda7-limpieza.json')
assert integrity['originalFilesIdenticalAfterAudit']==270
assert kit['fractional']['statuses']==[400,400] and kit['fractional']['noWrites']
assert kit['wholeKit']['stockAfter']==0.6 and kit['wholeKit']['restoredStock']==1
assert legacy['purchaseAfterPay89']['Pendiente']==0 and legacy['purchaseAfterPay89']['Sin_conciliar']==1
assert migration['incomplete']['total'] is None and migration['idempotent']
assert len(migration['migrations'])==12 and len(upgrade['migrations'])==12
assert upgrade['after']['total'] is None and upgrade['idempotent']
assert directed['residualInvoiceConflict']['result']['variantId'] is None
assert importer['codeCollision']['existing']['barcode']==importer['codeCollision']['imported']['sku']
assert ui['codeCollision']['selectedWrongProduct'] and not ui['pageErrors']
assert all(not s['horizontalOverflow'] for s in ui['screens'])
assert importer['localizedNumbers']['persisted']['stock']==15
assert importer['localizedNumbers']['persisted']['costAvg']==1.25
assert importer['localizedNumbers']['persisted']['price']==2.5
assert importer['categoryReset']['before']['requiresLot'] and not importer['categoryReset']['after']['requiresLot']
assert importer['categoryReset']['entryWithoutLotBefore']['status']==400 and importer['categoryReset']['entryWithoutLotAfter']['status']==201
assert kit['partialCost']['reportedRemainingCost']==35.04
assert round(kit['partialCost']['bookedRemainingCost'],2)==35.03
assert kit['partialCost']['finalReportCost']==0
assert importer['catalogControl']['count']==616 and importer['catalogControl']['stockUnchanged']
assert all(x['running'] for x in cleanup['originalServices'])
assert '73 passed | 1 skipped (74)' in (evidence/'auditoria-ronda7-check.txt').read_text()
assert '81 passed (81)' in (evidence/'auditoria-ronda7-integracion-compilada.txt').read_text()
assert '9 passed' in (evidence/'auditoria-ronda7-navegador.txt').read_text()
summary={
 'project':'FitStore POS','round':7,'auditDate':'2026-10-05','verdict':'REQUIERE_CORRECCIONES',
 'closedPreviousFindings':['R6-01','R6-02','R6-03'],
 'officialTests':{'unit':{'passed':73,'skipped':1,'registered':74,'skipReason':'Excel original de la tienda no incluido'},'types':'passed','lint':'passed','build':'passed','integrationCompiled':{'passed':81,'total':81},'browser':{'passed':9,'total':9}},
 'independentTests':{'vitestCorrectionControls':7,'r3UpgradeMigrations':12,'r6UpgradeMigrations':12,'importCatalogNames':616,'importCatalogFinancialValues':'synthetic QA only','ownBrowserScreenshots':3,'browserJsErrors':0},
 'openFindings':[
  {'id':'R7-01','priority':'P1','title':'ID importado selecciona otro producto por colisión con barras existentes','evidence':['auditoria-ronda7-importador.json','auditoria-ronda7-ui-importador.json']},
  {'id':'R7-02','priority':'P1','title':'Lector del inventario altera números de texto con coma decimal','evidence':['auditoria-ronda7-importador.json']},
  {'id':'R7-03','priority':'P2','title':'Recarga desactiva controles de categorías existentes','evidence':['auditoria-ronda7-importador.json']},
  {'id':'R7-04','priority':'P2','title':'Reporte de utilidad difiere del costo contabilizado tras devolución parcial','evidence':['auditoria-ronda7-kit.json'],'observedDifference':0.01}
 ],
 'integrity':integrity,'implementationModified':False,'cleanup':cleanup,
 'limits':['Sin Excel original: no se certifican costos/precios/existencias reales','Anthropic simulado con SDK; sin llamada real','PostgreSQL 18.4 local; sin Compose/PostgreSQL 17','Sin hardware, carga de producción ni múltiples sucursales','Suite completa sobre API compilada; no se repitió toda la integración con tsx'],
 'setupNote':'Primer arranque anterior a fin de compilación falló; se corrigió el entorno y se ejecutaron 81/81 sobre API compilada disponible.'
}
(evidence/'auditoria-ronda7.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
files=[project/'docs/AUDITORIA_RONDA7.md',base/'MENSAJE_PARA_CLAUDE_AUDITORIA_RONDA7.txt',base/'LEEME_AUDITORIA_RONDA7.txt',base/'source-baseline.json',base/'legacy-fixture.json',Path(__file__)]
files.extend(p for p in evidence.rglob('*') if p.is_file() and p.relative_to(evidence).parts[0].startswith('auditoria-ronda7'))
files.extend(base.glob('*.mjs'));files.extend(p for p in (base/'pruebas').rglob('*') if p.is_file())
files.extend(base/name for name in ['generar.log','migrar.log','migrar-upgrade3.log','migrar-upgrade6.log','api-listas.log'])
files=sorted(set(files))
assert not any('.private.' in p.name or p.name=='.env' or 'node_modules' in p.parts for p in files)
manifest={'audit':'FitStore POS R7','uploadedSourceSha256':integrity['sha256'],'files':[{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
manifest_path=base/'MANIFIESTO_AUDITORIA_RONDA7.json';manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bundle=base/'auditoria-fitstore-ronda7.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[manifest_path]:z.write(p,p.relative_to(base))
env=dict(line.split('=',1) for line in (project/'.env').read_text().splitlines() if '=' in line)
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 for item in manifest['files']:
  data=z.read(item['path']);assert hashlib.sha256(data).hexdigest()==item['sha256'];assert env['JWT_SECRET'].encode() not in data
baseline=json.loads((base/'source-baseline.json').read_text());assert all(hashlib.sha256((base/r).read_bytes()).hexdigest()==h for r,h in baseline.items())
print(json.dumps({'bundle':str(bundle),'bytes':bundle.stat().st_size,'files':len(files)+1,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'openFindings':4,'closedPreviousFindings':3,'originalFilesUnchanged':270},ensure_ascii=False,indent=2))
