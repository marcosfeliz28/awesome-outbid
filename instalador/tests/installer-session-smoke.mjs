// Prueba local del codigo NSIS REAL: no instala servicios ni toca ProgramData.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const compiler = process.env.NSIS_MAKENSIS || 'C:/Program Files (x86)/NSIS/makensis.exe';
const source = readFileSync(new URL('../installer/FitStore.nsi', import.meta.url), 'utf8');
const fn = source.match(/Function CreateInstallerSession\r?\n[\s\S]*?FunctionEnd/);
assert.ok(fn, 'Falta la funcion real CreateInstallerSession');
const dir = mkdtempSync(join(tmpdir(), 'nexora-session-smoke-'));
try {
  const out = join(dir, 'session.exe');
  const result = join(dir, 'guids.txt');
  const script = join(dir, 'session.nsi');
  writeFileSync(script, `Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "Nexora session fixture"
OutFile "${out}"
!include "LogicLib.nsh"
Var InstallerSession
${fn[0]}
Section
  FileOpen $2 "${result}" w
  Call CreateInstallerSession
  FileWrite $2 "$InstallerSession$\\r$\\n"
  Call CreateInstallerSession
  FileWrite $2 "$InstallerSession$\\r$\\n"
  FileClose $2
SectionEnd
`);
  for (const [command, args] of [[compiler, ['/V2', script]], [out, ['/S']]]) {
    const run = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stderr || run.stdout);
  }
  const ids = readFileSync(result, 'utf8').trim().split(/\r?\n/);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.match(id, /^\{[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\}$/i);
  assert.notEqual(ids[0], ids[1], 'Sesiones distintas no deben compartir identidad');
  process.stdout.write('PASS B11: funcion NSIS real compilada y ejecutada; dos GUID distintos.\n');
} finally {
  // Solo el directorio exacto devuelto por mkdtemp, nunca un origen de usuario.
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
