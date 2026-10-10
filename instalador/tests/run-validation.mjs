import process from "node:process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const powershellTests = [
  "PowerShell-Parse",
  "Transaction-FaultInjection",
  "Restore-FaultInjection",
  "Restore-Real-Sql",
  "Application-Service-Privacy",
  "Backup-Privacy",
  "FreshInstall-FaultInjection",
  "Stale-Update-FaultInjection",
  "Rollback-ServiceAccount-FaultInjection",
  "Rollback-Service-Sid",
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
  "Recovery-Restart-Previous",
  "Recovery-Temporary-Acl",
  "Recovery-Physical-Directory",
  "Recovery-Process-Directory",
  "Recovery-Missing-Installation",
  "Recovery-Schema-Contract",
  "Recovery-Acl-Interruption",
  "Recovery-Acl-MissingEntry",
  "Recovery-Pending-Acl-Always",
  "Recovery-Corrupt-Acl-Journal",
  "Recovery-Cleanup-Login",
  "Exact-Dacl-Contract",
  "Postgres-Real-Sql",
  "Recovery-Legacy-Schema",
  "Preflight-Backup-Fallback",
];

export function windowsPowerShellEnvironment(source) {
  if (!source.SystemRoot)
    throw new Error("Falta SystemRoot para ejecutar Windows PowerShell.");
  // Windows PowerShell 5 must not discover PowerShell 7 modules inherited
  // through pnpm's parent shell. Only this child process receives the change.
  return {
    ...source,
    PSModulePath: path.win32.join(
      source.SystemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "Modules",
    ),
  };
}

export function runValidation({ spawn = spawnSync, env = process.env } = {}) {
  if (env.CI && !env.PGBIN?.trim())
    throw new Error("3h1: CI requiere PGBIN; PostgreSQL real no puede omitirse.");
  const childEnv = windowsPowerShellEnvironment(env);
  const powerShell = path.win32.join(
    env.SystemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const steps = [
    [process.execPath, ["--test", "instalador/tests/web-server.test.mjs"]],
    [process.execPath, ["--test", "instalador/tests/recovery-error-contract.test.mjs"]],
    [process.execPath, ["--test", "instalador/tests/recovery-documentation.test.mjs"]],
    [
      process.execPath,
      ["--test", "instalador/tests/validation-command.test.mjs"],
    ],
    [
      process.execPath,
      ["--test", "instalador/tests/windows-validation-launcher.test.mjs"],
    ],
    ...powershellTests.map((name) => [
      powerShell,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        `instalador/tests/${name}.ps1`,
        ...(["Recovery-FaultInjection", "Recovery-Login-Exit", "Recovery-Activity-Guard", "Recovery-Restart-Previous", "Recovery-Temporary-Acl", "Postgres-Real-Sql", "Recovery-Legacy-Schema", "Recovery-Acl-MissingEntry", "Restore-Real-Sql", "Recovery-Cleanup-Login"].includes(name) && env.PGBIN
          ? ["-PgBin", env.PGBIN]
          : []),
      ],
    ]),
    [process.execPath, ["instalador/tests/validar.mjs"]],
  ];
  for (const [command, args] of steps) {
    const result = spawn(command, args, {
      env: childEnv,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
      return 1;
    }
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = runValidation();
}
