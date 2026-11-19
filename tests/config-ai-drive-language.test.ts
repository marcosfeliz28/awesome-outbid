import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const ledger = JSON.parse(readFileSync("tests/config-ai-drive-language.ledger.json", "utf8"));
const read = (file: string) => readFileSync(`apps/web/src/${file}`, "utf8");
describe("Configuration AI/Drive UI language, no connection side effects", () => {
  for (const file of ["AiUsage.tsx", "DriveBackup.tsx"]) {
    it(`${file}: reversing only labeled UI edits restores the complete original hash`, () => {
      let source = read(file);
      for (const edit of [...ledger[file].edits].reverse()) {
        expect(source.split(edit.after).length - 1).toBe(1);
        source = source.replace(edit.after, edit.before);
      }
      expect(createHash("sha256").update(source).digest("hex")).toBe(ledger[file].sha256);
    });
  }
  it("keeps Google callback effect and response text unmodified", () => {
    const source = read("DriveBackup.tsx");
    expect(source).toContain("const [message, error] = DRIVE_RESULT[result] ?? DRIVE_RESULT.error!;");
    expect(source).toContain("toast(message, error);");
    expect(source).toContain("}, []);");
    expect(source).toContain("toast(r.message);");
    expect(source).toContain("{data.lastRun.error}");
    expect(source).toContain("window.location.assign(r.url);");
    expect(source).toContain('timeZone: "America/Santo_Domingo"');
  });
  it("subscribes to shared language and translates only display labels", () => {
    expect(read("AiUsage.tsx")).toContain('const en = useLanguage() === "en";');
    expect(read("DriveBackup.tsx")).toContain('const en = useLanguage() === "en";');
    expect(read("AiUsage.tsx")).toContain('en ? "unpriced" : "sin precio"');
    expect(read("AiUsage.tsx")).toContain('<strong>{l.key}</strong>');
    expect(read("DriveBackup.tsx")).toContain('closeLabel={en ? "Close" : "Cerrar"}');
    expect(read("DriveBackup.tsx")).toContain('en ? "en-US" : "es-DO"');
  });
});
