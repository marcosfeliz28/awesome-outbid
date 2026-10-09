import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

test("instalador:validar ejecuta todas las regresiones Windows A1-A7, sin omitir las existentes", () => {
  const scripts = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ).scripts;
  const command = scripts["instalador:validar"];
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
      command.includes(
        `powershell -NoProfile -ExecutionPolicy Bypass -File instalador/tests/${name}.ps1`,
      ),
      `${name} debe ejecutarse en instalador:validar`,
    );
  }
  assert.ok(
    command.includes("node --test instalador/tests/web-server.test.mjs"),
  );
  assert.ok(
    command.includes(
      "node --test instalador/tests/validation-command.test.mjs",
    ),
  );
  assert.ok(command.endsWith("node instalador/tests/validar.mjs"));
  assert.equal(
    command.includes("||"),
    false,
    "No ocultar fallos con comandos alternativos",
  );
});
