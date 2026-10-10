import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { powershellTests } from "./run-validation.mjs";

test("instalador:validar ejecuta todas las regresiones Windows A1-A7, sin omitir las existentes", () => {
  const scripts = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ).scripts;
  const command = scripts["instalador:validar"];
  assert.equal(command, "node instalador/tests/run-validation.mjs");
  const launcher = readFileSync(
    new URL("./run-validation.mjs", import.meta.url),
    "utf8",
  );
  for (const name of [
    "PowerShell-Parse",
    "Transaction-FaultInjection",
    "Restore-FaultInjection",
    "Restore-Real-Sql",
    "Recovery-Acl-MissingEntry",
    "Recovery-Pending-Acl-Always",
    "Recovery-Corrupt-Acl-Journal",
    "Recovery-Cleanup-Login",
    "Application-Service-Privacy",
    "Service-Isolation",
    "Service-Pfx-Passwords",
    "Launcher-Backup-Destination",
    "Backup-Privacy",
    "FreshInstall-FaultInjection",
    "Stale-Update-FaultInjection",
    "Rollback-ServiceAccount-FaultInjection",
    "Rollback-Service-Sid",
    "Recovery-Restart-Previous",
    "Recovery-Temporary-Acl",
    "Recovery-Physical-Directory",
    "Recovery-Schema-Contract",
    "Recovery-Acl-Interruption",
    "Exact-Dacl-Contract",
    "Postgres-Real-Sql",
    "Recovery-Legacy-Schema",
    "Preflight-Backup-Fallback",
    "Recovery-FaultInjection",
    "Backup-Reader-Privacy",
    "Preflight-Rollback-Contract",
    "Recovery-Login-Exit",
    "Recovery-Activity-Guard",
    "Recovery-WorkingDirectory",
    "Preflight-Backup-Privacy",
    "Legacy-Backup-Unavailable",
    "Backup-AzureAD-Warning",
    "Recovery-Control-Logs",
  ]) {
    assert.ok(
      powershellTests.includes(name),
      `${name} debe ejecutarse en instalador:validar`,
    );
  }
  assert.ok(launcher.includes('"instalador/tests/web-server.test.mjs"'));
  assert.ok(launcher.includes('"instalador/tests/recovery-error-contract.test.mjs"'));
  assert.ok(
    launcher.includes('"instalador/tests/validation-command.test.mjs"'),
  );
  assert.ok(
    launcher.includes('[process.execPath, ["instalador/tests/validar.mjs"]]'),
  );
  assert.equal(
    command.includes("||"),
    false,
    "No ocultar fallos con comandos alternativos",
  );
});
