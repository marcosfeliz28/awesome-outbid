from pathlib import Path
import json,hashlib,zipfile,shutil
base=Path('/workspace/auditoria-ronda8')
archive=Path('/workspace/attachments/ffa736c0-f79c-4ef9-af1b-faf674d9d3c3/fitstore-pos-ronda8.zip')
baseline=json.loads((base/'source-baseline.json').read_text())
allowed={
 'fitstore-pos/docs/cobro-exitoso.png',
 'fitstore-pos/docs/dashboard-mobile.png',
 'fitstore-pos/docs/pos-mobile.png',
 'fitstore-pos/docs/validacion/ronda6-capturas/cel-equipos-320.png',
 'fitstore-pos/docs/validacion/ronda6-capturas/cel-equipos-390.png',
 'fitstore-pos/apps/api/revision-inventario.csv',
}
changed=[r for r,h in baseline.items() if not (base/r).exists() or hashlib.sha256((base/r).read_bytes()).hexdigest()!=h]
assert set(changed)<=allowed,changed
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for rel in changed:
  path=base/rel
  if path.suffix=='.png':
   evidence=base/'fitstore-pos/docs/validacion/auditoria-ronda8-capturas-oficiales'/path.name
   evidence.parent.mkdir(parents=True,exist_ok=True)
   shutil.copyfile(path,evidence)
  path.write_bytes(z.read(rel))
assert all(hashlib.sha256((base/r).read_bytes()).hexdigest()==h for r,h in baseline.items())
result={'archive':archive.name,'archiveBytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'originalFilesIdenticalAfterAudit':len(baseline),'restoredOriginalFiles':changed,'implementationModified':False}
(base/'fitstore-pos/docs/validacion/auditoria-ronda8-integridad.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
