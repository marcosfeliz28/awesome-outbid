import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source=readFileSync(new URL('../scripts/Recover-FitStoreUpdate.ps1',import.meta.url),'utf8');
function verify(text){
 assert.match(text,/\$originalFailure=\$_[\s\S]*?try \{ Disable-FitStoreRecoveryIsolation[\s\S]*?catch \{ Write-Warning[\s\S]*?ALTER ROLE fitstore LOGIN;[\s\S]*?throw \$originalFailure/,'3i6: cleanup debe preservar causa original y dar instruccion LOGIN');
 assert.match(text,/nexora-recovery-control-'\+\[guid\]::NewGuid\(\)/,'3i6: TEMP impredecible por recuperacion');
 assert.doesNotMatch(text,/ComputeHash\(/,'3i6: no TEMP predecible por PGDATA');
}
test('3i6 preserves original failure and unpredictable capture directory',()=>verify(source));
test('3i6 rejects regression dropping original exception',()=>assert.throws(()=>verify(source.replace('throw $originalFailure','throw'))));
test('3i6 rejects predictable capture folder',()=>assert.throws(()=>verify(source.replace("'nexora-recovery-control-'+[guid]::NewGuid()","'nexora-recovery-control-'+[Security.Cryptography.SHA256]::Create().ComputeHash()"))));
