import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
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

// Reproduce el staging declarado por NSIS, con los scripts de producción sin
// reescribir funciones. El proceso hijo nunca tiene marcador, base ni servicios
// de fixture; ProgramData y la ruta instalada quedan en un TEMP exclusivo.
function stagedScripts() {
  const section = source.slice(source.indexOf('Section "Nexora POS"'), source.indexOf('  SetOutPath "$INSTDIR"'));
  return [...section.matchAll(/File \/oname=([^\s]+) "\$\{PAYLOAD_DIR\}\\scripts\\([^"\r\n]+)"/g)]
    .map(match => ({ target: match[1], file: match[2] }));
}

test('NSIS: staging incluye las dependencias dot-source reales de rollback', () => {
  const files = stagedScripts();
  const targets = new Set(files.map(entry => entry.target));
  assert.ok(targets.has('Rollback-FitStoreUpdate.ps1'));
  for (const entry of files) {
    const script = readFileSync(new URL('../scripts/' + entry.file, import.meta.url), 'utf8');
    const imports = [...script.matchAll(/^\s*\.\s+\(Join-Path \$PSScriptRoot ['"]([^'"]+)['"]\)/gm)];
    for (const imported of imports) {
      assert.ok(targets.has(imported[1]), `${entry.target}: falta dependencia dot-source ${imported[1]} en PLUGINSDIR`);
    }
  }
});

test('NSIS: rollback real carga end-to-end desde su staging temporal sin tocar una instalación', { skip: process.platform !== 'win32' }, () => {
  const fixture = mkdtempSync(join(tmpdir(), 'nexora-nsis-staging-'));
  try {
    const data = join(fixture, 'ProgramData');
    mkdirSync(data);
    for (const entry of stagedScripts()) {
      copyFileSync(new URL('../scripts/' + entry.file, import.meta.url), join(fixture, entry.target));
    }
    const result = spawnSync(join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(fixture, 'Rollback-FitStoreUpdate.ps1'),
      '-InstallDir', join(fixture, 'AbsentInstall'), '-InstallerSession', randomUUID(),
    ], { cwd: fixture, env: { ...process.env, ProgramData: data, PSModulePath: join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules') }, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    if (result.status === 0) {
      assert.match(output, /No existe una transacci/);
    } else {
      // La consola medium local debe detenerse en la guarda real de admin,
      // DESPUÉS de cargar Common y Recover; CI administrador llega a no-marker.
      assert.equal(result.status, 1, output);
      assert.match(output, /Esta operaci[^\r\n]*necesita permisos de administrador/, output);
    }
    assert.doesNotMatch(output, /CommandNotFoundException|ItemNotFoundException/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
