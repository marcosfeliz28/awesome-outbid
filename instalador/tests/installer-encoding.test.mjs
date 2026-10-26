import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const root = join(import.meta.dirname, "..");
const textExtensions = new Set([".nsi", ".ps1", ".mjs", ".template"]);
const mojibake = new RegExp(
  ["\\u00c3", "\\u00c2", "\\u00e2\\u20ac"].join("|"),
  "u",
);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return textExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

test("los textos del instalador no contienen mojibake", () => {
  for (const path of files(root)) {
    assert.doesNotMatch(readFileSync(path, "utf8"), mojibake, path);
  }
});

test("NSIS se compila explícitamente como Unicode y UTF-8", () => {
  const nsiPath = join(root, "installer", "FitStore.nsi");
  const bytes = readFileSync(nsiPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(bytes.toString("utf8"), /^\uFEFFUnicode true/mu);
  const build = readFileSync(join(root, "build.ps1"), "utf8");
  assert.match(build, /"\/INPUTCHARSET",\s*\r?\n\s*"UTF8"/u);
});
