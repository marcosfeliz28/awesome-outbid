// Ronda 7 · paso 3: con la API compilada de la ronda 7 (node dist/main.js)
// sobre la base creada por la ronda 3 y migrada (paso 2): equipos (R4-01),
// compras recuperadas (R4-02) y la recepción incompleta sin conciliar (R6-03).
// Compras recuperables: 34 (Mercancía) + 50 (orden) + 55 (2×25 + 4 + 1).
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.env.FITSTORE_API_URL ?? "http://127.0.0.1:3014/api";
const legacy = JSON.parse(
  readFileSync(new URL("./datos-r3.json", import.meta.url), "utf8"),
);
const { original: r3Session } = JSON.parse(
  readFileSync(join(tmpdir(), "fitstore-r3-session.json"), "utf8"),
);
async function call(path, data, token) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.62",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json() };
}
const login = async (email, password = "FitStore-QA-2026!") =>
  (await call("/auth/login", { email, password })).body.accessToken;
const owner = await login(
  "admin@fitstore.demo",
  process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
);
// El dueño usa un equipo nuevo de la ronda 6 (un gerente se aprueba solo).
const ownerDevice = await call(
  "/terminals/register",
  { id: randomUUID(), name: "Caja R6", secret: "r6-" + randomUUID() },
  owner,
);
const adjust = (token) =>
  call(
    "/inventory/adjustments",
    { variantId: legacy.variantId, qty: 1, reason: "Comprobación R6" },
    token,
  );
const result = { source: legacy.source, runtime: "node dist/main.js" };
// R4-01: sesión heredada enlazada al equipo R3.
result.legacySession = await adjust(r3Session);
// Otro usuario con el ID conocido y su propio secreto.
const other = await login(legacy.users[1].email);
const claim = await call(
  "/terminals/register",
  {
    id: legacy.terminalId,
    name: "Intento de reclamo",
    secret: "otro-" + randomUUID(),
  },
  other,
);
result.otherUserClaim = {
  status: claim.status,
  terminalStatus: claim.body.status,
  approvedBy: claim.body.approvedBy,
  secretHashInResponse: "secretHash" in claim.body,
};
result.otherUserMutation = await adjust(other);
const original = await login(legacy.users[0].email);
result.originalOwnerRegistration = await call(
  "/terminals/register",
  { id: legacy.terminalId, name: "Equipo R3", secret: "dueno-" + randomUUID() },
  original,
);
const listed = (await call("/terminals", undefined, owner)).body.find(
  (t) => t.id === legacy.terminalId,
);
result.managerView = {
  legacy: listed.legacy,
  status: listed.status,
  claimedBy: listed.createdByName,
};
// R4-02: compras históricas recuperadas.
const report = async () =>
  (
    await call(
      "/reports/purchases?from=2000-01-01&to=2100-01-01",
      undefined,
      owner,
    )
  ).body.rows.find((r) => r.Proveedor === legacy.supplierName);
result.purchasesAfterMigration = await report();
await call(
  "/supplier-payments",
  { supplierId: legacy.supplierId, amount: 139, method: "transfer" },
  owner,
);
result.purchasesAfterPaying139 = await report();
result.ownerDeviceStatus = ownerDevice.body.status;
const checks = {
  legacySessionBlocked:
    result.legacySession.status === 403 &&
    result.legacySession.body.code === "TERMINAL_PENDING",
  claimLeftPending:
    result.otherUserClaim.status === 201 &&
    result.otherUserClaim.terminalStatus === "pending",
  claimerCannotOperate: result.otherUserMutation.status === 403,
  managerSeesLegacyClaim:
    result.managerView.legacy === true &&
    result.managerView.status === "pending",
  purchasesRecovered:
    result.purchasesAfterMigration?.Compras === 139 &&
    result.purchasesAfterMigration?.Pendiente === 139,
  incompleteReceiptUnreconciled:
    result.purchasesAfterMigration?.Sin_conciliar === 1,
  paidToZero: result.purchasesAfterPaying139?.Pendiente === 0,
};
result.checks = checks;
writeFileSync(
  new URL("./3-comprobacion.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some((ok) => !ok)) process.exit(1);
