import { strict as assert } from "node:assert";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  windowsPowerShellEnvironment,
  runValidation,
} from "./run-validation.mjs";

test("PowerShell Windows carga Get-Acl aunque pnpm herede módulos PowerShell 7", () => {
  const original = process.env.PSModulePath;
  const child = windowsPowerShellEnvironment({
    ...process.env,
    PSModulePath: "C:/fixture/powershell7/Modules",
  });
  assert.equal(process.env.PSModulePath, original);
  assert.equal(child.PSModulePath.includes("fixture"), false);
  const result = spawnSync(
    `${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/powershell.exe`,
    [
      "-NoProfile",
      "-Command",
      "Import-Module Microsoft.PowerShell.Security -ErrorAction Stop; Get-Command Get-Acl | Out-Null; exit 0",
    ],
    { env: child, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("un fallo conserva exitcode y no ejecuta pruebas posteriores", () => {
  let calls = 0;
  const result = runValidation({
    spawn: () => {
      calls++;
      return { status: 37 };
    },
  });
  assert.equal(result, 37);
  assert.equal(calls, 1);
});

test("3i runner pasa PgBin solo a pruebas PostgreSQL y conecta todos los contratos", () => {
  const calls=[];
  assert.equal(runValidation({env:{...process.env,PGBIN:'C:/fixture/postgres/bin'},spawn:(command,args)=>{calls.push({command,args});return {status:0};}}),0);
  for(const name of ['Recovery-Restart-Previous','Recovery-Temporary-Acl','Postgres-Real-Sql','Recovery-Legacy-Schema']){
    const call=calls.find(c=>c.args.includes(`instalador/tests/${name}.ps1`));
    assert.ok(call, name);
    assert.deepEqual(call.args.slice(-2),['-PgBin','C:/fixture/postgres/bin']);
  }
  for(const name of ['Recovery-Physical-Directory','Preflight-Backup-Fallback','Rollback-Service-Sid','Recovery-Acl-Interruption']){
    const call=calls.find(c=>c.args.includes(`instalador/tests/${name}.ps1`));
    assert.ok(call,name);assert.equal(call.args.includes('-PgBin'),false,name);
  }
  assert.ok(calls.some(c=>c.args.includes('instalador/tests/recovery-error-contract.test.mjs')));
});
