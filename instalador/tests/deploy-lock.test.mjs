import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyDeployLock } from "../tools/verify-deploy-lock.mjs";
import { deserialize, serialize } from "node:v8";
const clone = (value) => deserialize(serialize(value));

const source = {
  importers: {
    "apps/api": { dependencies: { fixture: { version: "1.0.0" } } },
  },
  packages: {
    "fixture@1.0.0": { resolution: { integrity: "sha512-fixture" } },
  },
  snapshots: { "fixture@1.0.0": {} },
};
function deployed() {
  return {
    packages: clone(source.packages),
    snapshots: { "fixture@1.0.0": {} },
    importers: { ".": { dependencies: { fixture: { version: "1.0.0" } } } },
  };
}
test("lock dedicado conserva todas las identidades e integridades", () => {
  assert.equal(verifyDeployLock(source, deployed(), "/source", "/output"), 1);
});
test("rechaza cambio de edge API a version autorizada solo para otro importer", () => {
  const original = clone(source);
  original.importers["apps/web"] = {
    dependencies: { fixture: { version: "2.0.0" } },
  };
  original.packages["fixture@2.0.0"] = {
    resolution: { integrity: "sha512-two" },
  };
  original.snapshots["fixture@2.0.0"] = {};
  const changed = deployed();
  changed.packages = { "fixture@2.0.0": original.packages["fixture@2.0.0"] };
  changed.snapshots = { "fixture@2.0.0": {} };
  changed.importers["."].dependencies.fixture.version = "2.0.0";
  assert.throws(
    () => verifyDeployLock(original, changed, "/source", "/output"),
    /Dependencias.*API.*cambiaron/,
  );
});
test("rechaza cambio de edge transitivo a otra version del lock original", () => {
  const original = clone(source);
  original.packages["child@1.0.0"] = {
    resolution: { integrity: "sha512-child-one" },
  };
  original.packages["child@2.0.0"] = {
    resolution: { integrity: "sha512-child-two" },
  };
  original.snapshots["fixture@1.0.0"].dependencies = { child: "1.0.0" };
  original.snapshots["child@1.0.0"] = {};
  original.snapshots["child@2.0.0"] = {};
  const changed = deployed();
  changed.packages["child@2.0.0"] = original.packages["child@2.0.0"];
  changed.snapshots["fixture@1.0.0"].dependencies = { child: "2.0.0" };
  changed.snapshots["child@2.0.0"] = {};
  assert.throws(
    () => verifyDeployLock(original, changed, "/source", "/output"),
    /Dependencias.*snapshot.*cambiaron/,
  );
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
test("rechaza paquetes autorizados globalmente pero ajenos al grafo API", () => {
  const original = clone(source);
  original.packages["other@2.0.0"] = {
    resolution: { integrity: "sha512-other" },
  };
  original.snapshots["other@2.0.0"] = {};
  const changed = deployed();
  changed.packages["other@2.0.0"] = original.packages["other@2.0.0"];
  changed.snapshots["other@2.0.0"] = {};
  assert.throws(
    () => verifyDeployLock(original, changed, "/source", "/output"),
    /fuera del grafo original/,
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
