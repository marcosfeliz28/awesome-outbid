import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { publishPrivateBackup } from "../apps/api/src/tenant-backup";

const run = promisify(execFile);

async function powershell(script: string, path: string) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    env: { ...process.env, NEXORA_BACKUP_ACL_TARGET: path },
  });
}

it("publica un respaldo completo sin reemplazarlo ni dejar una ACL pública", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-private-publication-"));
  const first = join(directory, "primero.partial");
  const second = join(directory, "segundo.partial");
  const target = join(directory, "empresa.nxtb");
  const contents = Buffer.alloc(256 * 1024, 0x41);
  try {
    await writeFile(first, contents, { mode: 0o600 });
    await writeFile(second, "OTRO RESPALDO", { mode: 0o600 });
    if (process.platform === "win32") {
      await powershell(`
$ErrorActionPreference='Stop'
$acl=[IO.File]::GetAccessControl($env:NEXORA_BACKUP_ACL_TARGET)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
  [Security.Principal.SecurityIdentifier]::new('S-1-1-0'), 'Read', 'Allow'))
[IO.File]::SetAccessControl($env:NEXORA_BACKUP_ACL_TARGET,$acl)
`, first);
    }
    await publishPrivateBackup(first, target);
    expect(await readFile(target)).toEqual(contents);
    await expect(publishPrivateBackup(second, target)).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(target)).toEqual(contents);
    const raceTarget = join(directory, "carrera.nxtb");
    const race = await Promise.allSettled([
      publishPrivateBackup(first, raceTarget), publishPrivateBackup(second, raceTarget),
    ]);
    expect(race.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(race.filter(result => result.status === "rejected")).toHaveLength(1);
    const published = await readFile(raceTarget);
    expect([contents.equals(published), published.toString() === "OTRO RESPALDO"].filter(Boolean)).toHaveLength(1);
    if (process.platform === "win32") {
      const result = await powershell(`
$ErrorActionPreference='Stop'
$acl=[IO.File]::GetAccessControl($env:NEXORA_BACKUP_ACL_TARGET)
$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')
$rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
if (-not $acl.AreAccessRulesProtected -or $rules.Count -eq 0 -or @($rules | Where-Object {
  $_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow'
}).Count -gt 0) { throw 'ACL pública o heredada' }
'ACL PRIVADA'
`, target);
      expect(result.stdout).toContain("ACL PRIVADA");
    }
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
