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
    "Application-Service-Privacy",
    "Backup-Privacy",
    "FreshInstall-FaultInjection",
    "Stale-Update-FaultInjection",
    "Rollback-ServiceAccount-FaultInjection",
    "Recovery-FaultInjection",
    "Backup-Reader-Privacy",
    "Preflight-Rollback-Contract",
  ]) {
    assert.ok(
      powershellTests.includes(name),
      `${name} debe ejecutarse en instalador:validar`,
    );
  }
  assert.ok(launcher.includes('"instalador/tests/web-server.test.mjs"'));
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
