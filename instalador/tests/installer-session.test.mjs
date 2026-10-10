import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('../installer/FitStore.nsi', import.meta.url), 'utf8');
test('B11: la sesion se genera como GUID y ambas operaciones comparten esa identidad', () => {
  assert.match(source, /Var InstallerSession/);
  assert.match(source, /ole32::CoCreateGuid\(g \.r0\) i \.r1/);
  assert.match(source, /StrCpy \$InstallerSession \$0/);
  const calls = source.split('\n').filter(line => line.includes('nsExec::ExecToLog') && line.includes('-InstallerSession'));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call, /-InstallerSession "\$InstallerSession"/);
    assert.doesNotMatch(call, /-InstallerSession "\$PLUGINSDIR"/);
  }
});
