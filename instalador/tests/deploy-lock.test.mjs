import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyDeployLock } from "../tools/verify-deploy-lock.mjs";

const source = {
  importers: { "apps/api": {} },
  packages: {
    "fixture@1.0.0": { resolution: { integrity: "sha512-fixture" } },
  },
};
function deployed() {
  return {
    packages: structuredClone(source.packages),
    snapshots: { "fixture@1.0.0": {} },
    importers: { ".": { dependencies: { fixture: { version: "1.0.0" } } } },
  };
}
test("lock dedicado conserva todas las identidades e integridades", () => {
  assert.equal(verifyDeployLock(source, deployed(), "/source", "/output"), 1);
});
test("rechaza version externa nueva aunque conserve la integridad", () => {
  const lock = deployed();
  lock.packages["fixture@2.0.0"] = lock.packages["fixture@1.0.0"];
  assert.throws(
    () => verifyDeployLock(source, lock, "/source", "/output"),
    /nuevo o alterado/,
  );
});
test("rechaza integridad alterada", () => {
  const lock = deployed();
  lock.packages["fixture@1.0.0"].resolution.integrity = "sha512-different";
  assert.throws(
    () => verifyDeployLock(source, lock, "/source", "/output"),
    /nuevo o alterado/,
  );
});
test("rechaza directorio externo y dependencia sin entrada auditada", () => {
  const lock = deployed();
  lock.packages["external@file:external"] = {
    resolution: { type: "directory", directory: "/external" },
  };
  assert.throws(
    () => verifyDeployLock(source, lock, "/source", "/output"),
    /Directorio externo/,
  );
  const dangling = deployed();
  dangling.importers["."].dependencies.fixture.version = "2.0.0";
  assert.throws(
    () => verifyDeployLock(source, dangling, "/source", "/output"),
    /sin snapshot verificado/,
  );
});
