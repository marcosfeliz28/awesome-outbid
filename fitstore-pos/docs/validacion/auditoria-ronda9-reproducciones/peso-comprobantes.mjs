import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3109/api";
const login = await fetch(base + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@fitstore.demo",
    password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
  }),
});
if (!login.ok) throw new Error("No se pudo iniciar la sesión de auditoría.");
const token = (await login.json()).accessToken;
const started = performance.now();
const response = await fetch(base + "/sales", {
  headers: { Authorization: "Bearer " + token },
});
const text = await response.text();
const durationMs = Math.round(performance.now() - started);
if (!response.ok) throw new Error(text);
const sales = JSON.parse(text);
const proofs = sales.flatMap((sale) =>
  sale.payments.flatMap((payment) =>
    payment.proofUrl
      ? [
          {
            saleId: sale.id,
            paymentId: payment.id,
            chars: payment.proofUrl.length,
          },
        ]
      : [],
  ),
);
const evidence = {
  generatedAt: new Date().toISOString(),
  endpoint: "/api/sales",
  status: response.status,
  durationMs,
  returnedSales: sales.length,
  responseBytes: Buffer.byteLength(text),
  proofs: proofs.length,
  proofCharacters: proofs.reduce((sum, proof) => sum + proof.chars, 0),
  maximumSingleProofCharacters: Math.max(
    0,
    ...proofs.map((proof) => proof.chars),
  ),
  implementationLimitBytesPerUpload: 2 * 1024 * 1024,
  endpointLimitSales: 100,
  theoreticalBase64PayloadBytesAtLimit:
    Math.ceil((2 * 1024 * 1024) / 3) * 4 * 100,
  note: "La respuesta incluye cada data URL completa. La cifra teórica no suma el resto del JSON ni cabeceras.",
};
writeFileSync(
  root + "docs/validacion/auditoria-ronda9-peso-comprobantes.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
