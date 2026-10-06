from pathlib import Path
import hashlib,json,zipfile,re

base=Path('/workspace/auditoria-ronda8');project=base/'fitstore-pos';evidence=project/'docs/validacion'
def read(name):return json.loads((evidence/name).read_text())
integrity=read('auditoria-ronda8-integridad.json');kit=read('auditoria-ronda8-kit.json');importer=read('auditoria-ronda8-importador.json');ui=read('auditoria-ronda8-ui-importador.json');before=read('auditoria-ronda8-legado-antes.json');after=read('auditoria-ronda8-legado-despues.json');cleanup=read('auditoria-ronda8-limpieza.json')
assert integrity['originalFilesIdenticalAfterAudit']==327
assert integrity['sha256']=='b5a802fce919829f6e72774397e772bec236ddc6976009e82478abe4f145948c'
assert '75 passed | 1 skipped (76)' in (evidence/'auditoria-ronda8-check.txt').read_text()
assert '84 passed (84)' in (evidence/'auditoria-ronda8-integracion-compilada.txt').read_text()
assert '9 passed' in (evidence/'auditoria-ronda8-navegador.txt').read_text()
assert importer['originalCodeCollision']['rejectedWithoutWrites'] and importer['referenceCollision']['noWrites']
numbers=importer['localizedNumbers']['persisted'];assert (numbers['stock'],numbers['costAvg'],numbers['price'])==(1.5,1250.5,2500.75)
assert importer['numericErrors']['rejectedWithoutWrites']
assert importer['originalCategoryReload']['statuses']==[400,400]
assert importer['originalCategoryReload']['requiresLot'] and importer['originalCategoryReload']['requiresExpiry']
assert importer['explicitCategoryConversion']['rejectedWithoutWrites']
assert importer['explicitCategoryConversion']['audit'][0]['action']=='category_lots_disabled_by_import'
assert importer['caseCollision']['normalizedCollision'] and importer['caseCollision']['run']['status']==0
assert ui['codeCollision']['selectedWrongProduct'] and not ui['pageErrors']
assert all(not x['horizontalOverflow'] for x in ui['screens'])
assert ui['initialRenderedCards']==120
assert importer['catalogControl']['count']==616 and importer['catalogControl']['stockUnchanged']
assert importer['partialCategoryAbort']['run']['status']==1
assert importer['partialCategoryAbort']['after']['categories']==importer['partialCategoryAbort']['before']['categories']+1
assert importer['partialNumericAbort']['run']['status']==1 and importer['partialNumericAbort']['earlierRowPersisted']['stock']==1
assert importer['partialNumericAbort']['after']['movements']==importer['partialNumericAbort']['before']['movements']+1
assert kit['partialCost']['reportedRemainingCost']==35.03 and kit['partialCost']['storedLineCost']==15.02
assert kit['partialCost']['finalReportCost']==0 and kit['fractional']['noWrites']
assert before['before']['returnCost']==15.02 and before['before']['reportedRemainingCost']==35.04
assert after['after']['reportBeforeNewReturn']['Costo']==35.04
assert after['after']['newReturnCost']==35.03 and after['after']['bookedRemainingCostAfter']==0
assert after['after']['reportAfterFullReturn']['Costo']==0.01
assert after['after']['reportAfterFullReturn']['Utilidad']==-0.01
assert len(after['after']['migrations'])==12 and all(x['finished'] for x in after['after']['migrations'])
assert all(x['running'] for x in cleanup['originalServices']) and all(not x['responding'] for x in cleanup['auditPorts'])

summary={
 'project':'FitStore POS','round':8,'auditDate':'2026-10-05','timezone':'America/La_Paz','verdict':'REQUIERE_CORRECCIONES',
 'originalR7ReproductionsCorrected':['R7-01','R7-02','R7-03','R7-04'],
 'previousFindingScope':{'R7-01':'Caso exacto corregido; ambigüedad por mayúsculas pendiente R8-01','R7-02':'Formatos corregidos; rango máximo pendiente R8-03','R7-03':'Reglas preservadas y cambio explícito auditado; aborto mult categoría pendiente R8-03','R7-04':'Nuevas devoluciones corregidas; histórico pendiente R8-02'},
 'officialTests':{'unit':{'passed':75,'skipped':1,'registered':76,'skipReason':'Excel original de la tienda no suministrado'},'types':'passed','lint':'passed','build':'passed','integrationCompiled':{'passed':84,'total':84},'browser':{'passed':9,'total':9}},
 'independentChecks':{'importCatalogNames':616,'catalogStockTotal':616,'catalogFinancialValues':'Sólo QA: stock 1, costo 10, precio 20','catalogReloadStockUnchanged':True,'codeExactConflictRejectedWithoutWrites':True,'localizedNumbers':{'stock':1.5,'cost':1250.50,'price':2500.75},'categoryReloadStillRequiresLot':True,'explicitCategoryConversionAudited':True,'newReturnCostSequence':[50.05,15.02,35.03,0],'upgradeR7toR8':{'oldReturnCreatedByRealR7Api':True,'migrations':12,'pendingMigrations':0,'bookedCostAfterFullReturn':0,'reportedCostAfterFullReturn':0.01},'ownBrowserScreenshots':3,'browserJsErrors':0},
 'openFindings':[
  {'id':'R8-01','priority':'P1','title':'Importador sensible a mayúsculas, caja insensible: código agrega otro producto','evidence':['auditoria-ronda8-importador.json','auditoria-ronda8-ui-importador.json']},
  {'id':'R8-02','priority':'P2','title':'Devolución histórica sin costo de línea deja residuo en actualización R7→R8','evidence':['auditoria-ronda8-legado-antes.json','auditoria-ronda8-legado-despues.json'],'remainingCostAfterFullReturn':0.01},
  {'id':'R8-03','priority':'P2','title':'Importación rechazada deja categorías o filas previas guardadas','evidence':['auditoria-ronda8-importador.json'],'cases':['Reglas de categoría en segunda fila','Precio fuera del rango Decimal(14,2) en segunda fila']},
 ],
 'integrity':integrity,'implementationModified':False,'cleanup':cleanup,
 'limits':['Sin Excel original: no se certifican costos/precios/existencias reales ni 3158 unidades','Anthropic simulado, sin llamada real al proveedor','PostgreSQL 18.4 local: no se certifica Compose/PostgreSQL 17','Sin hardware, carga de producción o múltiples sucursales','Suite completa sobre API compilada: no se repitió con tsx','No se repitieron todas las migraciones de R3/R6, sin cambios de migraciones en R8'],
 'setupNote':'Prueba histórica: nueva sesión de QA requirió registrar terminal y trasladar caja; intentos iniciales 403/409 corregidos antes de la reproducción final, sin clasificación como defectos.'
}
(evidence/'auditoria-ronda8.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
baseline=json.loads((base/'source-baseline.json').read_text())
assert all(hashlib.sha256((base/r).read_bytes()).hexdigest()==h for r,h in baseline.items())
files=[project/'docs/AUDITORIA_RONDA8.md',base/'MENSAJE_PARA_CLAUDE_AUDITORIA_RONDA8.txt',base/'LEEME_AUDITORIA_RONDA8.txt',base/'source-baseline.json',base/'legado-fixture.json',base/'restaurar-originales.py',Path(__file__)]
files.extend(p for p in evidence.rglob('*') if p.is_file() and p.relative_to(evidence).parts[0].startswith('auditoria-ronda8'))
files.extend(base.glob('*.mjs'))
files.extend(base/name for name in ['instalacion.log','bases.log','prisma-generate.log','migraciones.log','migraciones-import.log','migraciones-upgrade7.log','semilla.log','semilla-import.log','api-listas.log','limpieza.log'])
files=sorted(set(files));assert all(p.is_file() for p in files)
assert not any('.private.' in p.name or p.name=='.env' or 'node_modules' in p.parts for p in files)
env=dict(line.split('=',1) for line in (project/'.env').read_text().splitlines() if '=' in line)
for p in files:
 data=p.read_bytes()
 assert env['JWT_SECRET'].encode() not in data
 if p.suffix in {'.json','.txt','.log','.md','.mjs','.py'}:assert re.search(rb'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',data) is None, p
manifest={'audit':'FitStore POS R8','uploadedSourceSha256':integrity['sha256'],'files':[{'path':str(p.relative_to(base)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
manifest_path=base/'MANIFIESTO_AUDITORIA_RONDA8.json';manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bundle=base/'auditoria-fitstore-ronda8.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[manifest_path]:z.write(p,p.relative_to(base))
with zipfile.ZipFile(bundle) as z:
 assert z.testzip() is None
 for item in manifest['files']:assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
result={'bundle':str(bundle),'bytes':bundle.stat().st_size,'files':len(files)+1,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'openFindings':3,'originalReproductionsCorrected':4,'originalFilesUnchanged':327}
(base/'entrega.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
