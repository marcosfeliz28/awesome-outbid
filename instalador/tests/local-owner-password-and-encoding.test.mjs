import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyProductLocalProfile } from "../tools/product-local-profile.mjs";

test("perfil local usa UTF-8 con BOM y contraseña de 4 a 20 caracteres", () => {
  const root = mkdtempSync(join(tmpdir(), "nexora-local-owner-"));
  try {
    const source = join(import.meta.dirname, "..");
    applyProductLocalProfile({ source, target: root, nsi: join(source, "installer", "FitStore.nsi") });
    const nsi = readFileSync(join(root, "FitStore.nsi"));
    assert.deepEqual([...nsi.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const text = nsi.toString("utf8");
    assert.match(text, /contraseña debe tener de 4 a 20 caracteres/);
    assert.match(text, /\$\{If\} \$0 < 4/);
    assert.match(text, /\$\{If\} \$0 > 20/);
    const install = readFileSync(join(root, "scripts", "Install-FitStore.ps1"));
    assert.deepEqual([...install.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.match(install.toString("utf8"), /NEXORA_LOCAL_INSTALL = "1"/);
    assert.doesNotMatch(text, /(?:Ã|Â|â€)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
